/**
 * 本地存储工具（v2.8.1：IndexedDB 持久层 + 内存缓存同步 API）
 *
 * 架构说明：
 * - 数据实际持久化在 IndexedDB（容量大、异步非阻塞，突破 localStorage 5MB 限制）
 * - 内存缓存（Map）承载同步读写，既有 getStorage/setStorage 同步 API 与全部调用方零改动
 * - 写入双通道：立即更新缓存 + 异步入库（IndexedDB 未就绪时进入写队列，就绪后统一落库）
 * - 启动时 initStorage()：打开库 → 载入缓存 → 落库排队写入 → 一次性迁移旧版 localStorage
 *   数据（迁移成功后清理旧键）→ 执行数据版本迁移 → 触发就绪回调
 * - 数据版本化迁移机制：DATA_VERSION + dataMigrations 注册表；后续升级只需追加迁移函数，
 *   启动时自动对存量数据逐版本变换
 * - IndexedDB 不可用时自动降级回 localStorage，功能不受影响
 */

// ─── 常量 ────────────────────────────────────────────────────
const GUEST_PREFIX = 'kaoyan_helper_'
const USER_PREFIX = 'kaoyan_user_'
const ACCOUNT_KEY = 'kaoyan_accounts'
const CURRENT_USER_KEY = 'kaoyan_current_user'

const DB_NAME = 'kaoyan_helper_db'
const DB_VERSION = 1 // IndexedDB 结构版本（对象表结构变更时递增并在 onupgradeneeded 处理）
const STORE_NAME = 'kv'

/**
 * 数据模式版本：数据结构变更时递增，并在 dataMigrations 追加对应变换。
 * v1：基线版本（localStorage 原样迁入的数据结构）
 */
const DATA_VERSION = 1
const DATA_VERSION_KEY = '__data_version__'

interface DataMigration {
  /** 迁移到的目标版本号 */
  version: number
  name: string
  /** 对每条数据记录执行变换（返回 null 表示删除该记录） */
  migrate: (key: string, value: unknown) => unknown
}

/** 版本化数据迁移注册表（未来升级在此追加，示例见注释） */
const dataMigrations: DataMigration[] = [
  // {
  //   version: 2,
  //   name: '示例：为计划项补充新字段',
  //   migrate: (key, value) => (key === 'plans' ? (value as any[]).map(p => ({ priority: 'normal', ...p })) : value
  // }
]

// ─── 内部状态 ────────────────────────────────────────────────
const cache = new Map<string, unknown>()
let db: IDBDatabase | null = null
let ready = false
let useFallback = false // IndexedDB 不可用时降级 localStorage
const pendingWrites: { type: 'put' | 'delete'; key: string; value?: unknown }[] = []
const readyCallbacks: Array<() => void> = []

// v2.8.2：存储就绪 Promise。路由守卫等早期逻辑可 await 等待 IndexedDB 载入完成，
// 避免在缓存为空时误判"未登录"（重启掉登录的根因）。
let readyPromise: Promise<void> | null = null

/** 等待存储层就绪（已就绪立即返回；未初始化则触发初始化） */
export function storageReady(): Promise<void> {
  if (ready) return Promise.resolve()
  if (!readyPromise) readyPromise = initStorage()
  return readyPromise
}

// ─── IndexedDB 基础操作 ──────────────────────────────────────

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const database = req.result
      // DB_VERSION 1：建立 kv 单表（key 为主键）
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
}

function idbPut(key: string, value: unknown): void {
  if (!db) return
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ key, value })
  } catch (e) {
    console.error('IndexedDB 写入失败:', e)
  }
}

function idbDelete(key: string): void {
  if (!db) return
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
  } catch (e) {
    console.error('IndexedDB 删除失败:', e)
  }
}

function idbGetAll(): Promise<{ key: string; value: unknown }[]> {
  return new Promise((resolve, reject) => {
    if (!db) { resolve([]); return }
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as { key: string; value: unknown }[])
    req.onerror = () => reject(req.error)
  })
}

// ─── 数据版本化迁移 ──────────────────────────────────────────

/** 对缓存中全部数据记录执行版本迁移（元信息键除外） */
function runDataMigrations(fromVersion: number): void {
  const applicable = dataMigrations
    .filter(m => m.version > fromVersion)
    .sort((a, b) => a.version - b.version)
  if (applicable.length === 0) return

  for (const migration of applicable) {
    for (const [key, value] of Array.from(cache.entries())) {
      if (key === DATA_VERSION_KEY) continue
      try {
        const next = migration.migrate(key, value)
        if (next === null) {
          cache.delete(key)
          idbDelete(key)
        } else if (next !== value) {
          cache.set(key, next)
          idbPut(key, next)
        }
      } catch (e) {
        console.error(`数据迁移 [${migration.name}] 处理 ${key} 失败:`, e)
      }
    }
  }
}

// ─── 旧版 localStorage 迁移 ─────────────────────────────────

/** 判断 localStorage 键是否属于本应用数据（含用户数据/全局设置/账号） */
function isLegacyKey(key: string): boolean {
  return (
    key.startsWith(GUEST_PREFIX) ||
    key.startsWith(USER_PREFIX) ||
    key === ACCOUNT_KEY ||
    key === CURRENT_USER_KEY ||
    key.startsWith('kaoyan_')
  )
}

/** 将旧版 localStorage 数据迁入缓存与 IndexedDB（缓存已有的键不覆盖），成功后清理旧键 */
function migrateLegacyLocalStorage(): void {
  const keys = Object.keys(localStorage)
  let migrated = 0
  keys.forEach(key => {
    if (!isLegacyKey(key)) return
    const raw = localStorage.getItem(key)
    if (raw === null) return
    if (!cache.has(key)) {
      let value: unknown = raw
      try {
        value = JSON.parse(raw)
      } catch {
        // 非 JSON 值原样保存
      }
      cache.set(key, value)
      idbPut(key, value)
      migrated++
    }
    // 迁移落库后清理旧键，避免双份数据
    // v2.8.2：保留当前用户键作为 localStorage 镜像（路由守卫早读兜底，修复重启掉登录）
    if (key !== CURRENT_USER_KEY) {
      localStorage.removeItem(key)
    }
  })
  if (migrated > 0) {
    console.info(`[storage] 已从 localStorage 迁移 ${migrated} 条数据至 IndexedDB`)
  }
}

// ─── 初始化 ─────────────────────────────────────────────────

/**
 * 初始化存储层：打开 IndexedDB → 载入缓存 → 落库排队写入 → 迁移旧数据 → 版本迁移。
 * 必须在应用挂载前 await 完成。IndexedDB 不可用时降级 localStorage（缓存仍生效）。
 * v2.8.2：支持单例 Promise 模式，防止并发调用导致重复初始化。
 */
export async function initStorage(): Promise<void> {
  if (ready) return
  if (readyPromise) return readyPromise

  readyPromise = (async () => {
    try {
      db = await openDatabase()
      const records = await idbGetAll()
      records.forEach(r => {
        if (!cache.has(r.key)) cache.set(r.key, r.value)
      })
      // 落库初始化前排队的写入
      pendingWrites.forEach(w => {
        if (w.type === 'put') {
          cache.set(w.key, w.value)
          idbPut(w.key, w.value)
        } else {
          cache.delete(w.key)
          idbDelete(w.key)
        }
      })
      pendingWrites.length = 0

      // 一次性迁移旧版 localStorage 数据
      migrateLegacyLocalStorage()

      // 数据版本化迁移
      const storedVersion = (cache.get(DATA_VERSION_KEY) as number) || 0
      if (storedVersion < DATA_VERSION) {
        runDataMigrations(storedVersion)
        cache.set(DATA_VERSION_KEY, DATA_VERSION)
        idbPut(DATA_VERSION_KEY, DATA_VERSION)
      }

      ready = true
    } catch (e) {
      console.error('IndexedDB 初始化失败，降级使用 localStorage:', e)
      useFallback = true
      db = null
      ready = true
    }
    readyCallbacks.forEach(cb => {
      try { cb() } catch { /* 单个回调失败不影响其余 */ }
    })
    readyCallbacks.length = 0
  })()

  return readyPromise
}

/** 注册存储就绪回调（已就绪则立即执行） */
export function onStorageReady(cb: () => void): void {
  if (ready) cb()
  else readyCallbacks.push(cb)
}

// ─── 当前用户管理 ─────────────────────────────────────────────

export function getCurrentUsername(): string {
  const v = cache.get(CURRENT_USER_KEY)
  if (typeof v === 'string') return v
  // v2.8.2 修复重启掉登录：缓存未命中时一律回退读 localStorage 镜像。
  // 此前仅在"未就绪且未降级"的短暂窗口回退，IndexedDB 初始化失败降级后
  // 缓存为空且不再读 localStorage，导致每次启动都被判定为未登录。
  try {
    return localStorage.getItem(CURRENT_USER_KEY) || ''
  } catch {
    return ''
  }
}

export function setCurrentUsername(username: string): void {
  if (username) {
    writeKey(CURRENT_USER_KEY, username)
    // v2.8.2：同步镜像到 localStorage，作为路由守卫首次导航的兜底读取源
    try { localStorage.setItem(CURRENT_USER_KEY, username) } catch { /* 忽略 */ }
  } else {
    deleteKey(CURRENT_USER_KEY)
    try { localStorage.removeItem(CURRENT_USER_KEY) } catch { /* 忽略 */ }
  }
}

function getStoragePrefix(): string {
  const user = getCurrentUsername()
  return user ? `${USER_PREFIX}${user}_` : GUEST_PREFIX
}

// ─── 通用写入（缓存 + 异步入库） ─────────────────────────────

function writeKey(key: string, value: unknown): void {
  cache.set(key, value)
  if (!ready || useFallback) {
    if (useFallback) {
      try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)) } catch { /* 忽略 */ }
    } else {
      pendingWrites.push({ type: 'put', key, value })
    }
    return
  }
  idbPut(key, value)
}

function deleteKey(key: string): void {
  cache.delete(key)
  if (!ready || useFallback) {
    if (useFallback) {
      localStorage.removeItem(key)
    } else {
      pendingWrites.push({ type: 'delete', key })
    }
    return
  }
  idbDelete(key)
}

// ─── 通用存储操作（同步 API，保持既有调用方零改动） ──────────

export function getStorage<T>(key: string, defaultValue: T): T {
  const fullKey = getStoragePrefix() + key
  return getGlobalStorage(fullKey, defaultValue)
}

export function setStorage<T>(key: string, value: T): void {
  writeKey(getStoragePrefix() + key, value)
}

export function removeStorage(key: string): void {
  deleteKey(getStoragePrefix() + key)
}

/** 全局（不带用户前缀）读取 */
export function getGlobalStorage<T>(key: string, defaultValue: T): T {
  if (cache.has(key)) {
    return cache.get(key) as T
  }
  // 初始化完成前的兜底：直接读旧版 localStorage（迁移前的短暂窗口）
  if (!ready || useFallback) {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      try {
        return JSON.parse(raw) as T
      } catch {
        // 旧版以裸字符串保存的值（如主题 'dark'），原样返回
        return raw as unknown as T
      }
    }
  }
  return defaultValue
}

/** 全局（不带用户前缀）写入 */
export function setGlobalStorage<T>(key: string, value: T): void {
  writeKey(key, value)
}

/** 全局（不带用户前缀）删除 */
export function removeGlobalStorage(key: string): void {
  deleteKey(key)
}

/** 清除当前用户的所有数据（不影响其他用户和账号列表） */
export function clearAllStorage(): void {
  const prefix = getStoragePrefix()
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) deleteKey(key)
  }
  if (useFallback) {
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k))
  }
}

// ─── 导出/导入 ────────────────────────────────────────────────

/** 导出当前用户的所有数据 */
export function exportAllData(): string {
  const data: Record<string, unknown> = {}
  const prefix = getStoragePrefix()
  for (const [key, value] of cache.entries()) {
    if (key.startsWith(prefix)) {
      data[key.replace(prefix, '')] = value
    }
  }
  return JSON.stringify(data, null, 2)
}

/** 导入数据到当前用户（覆盖同名 key） */
export function importAllData(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr) as Record<string, unknown>
    const prefix = getStoragePrefix()
    Object.keys(data).forEach(key => {
      writeKey(prefix + key, data[key])
    })
    return true
  } catch (e) {
    console.error('导入数据失败:', e)
    return false
  }
}

// ─── 账号管理 ─────────────────────────────────────────────────

interface AccountInfo {
  username: string
  passwordHash: string  // 简单哈希，非生产级安全
  createdAt: string
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

function getAccounts(): AccountInfo[] {
  const v = getGlobalStorage<AccountInfo[]>(ACCOUNT_KEY, [])
  return Array.isArray(v) ? v : []
}

function saveAccounts(accounts: AccountInfo[]): void {
  setGlobalStorage(ACCOUNT_KEY, accounts)
}

/** 检查用户名是否已注册 */
export function isUserRegistered(username: string): boolean {
  return getAccounts().some(a => a.username === username)
}

/** 获取所有已注册的用户名列表 */
export function getUserList(): string[] {
  return getAccounts().map(a => a.username)
}

/** 注册新账号 */
export function registerUser(username: string, password: string): { success: boolean; message: string } {
  if (!username || !password) {
    return { success: false, message: '用户名和密码不能为空' }
  }
  if (username.length < 2 || username.length > 20) {
    return { success: false, message: '用户名长度需在 2-20 个字符之间' }
  }
  if (password.length < 4) {
    return { success: false, message: '密码长度至少 4 个字符' }
  }
  if (isUserRegistered(username)) {
    return { success: false, message: '该用户名已被注册' }
  }

  const accounts = getAccounts()
  accounts.push({
    username,
    passwordHash: simpleHash(password),
    createdAt: new Date().toISOString()
  })
  saveAccounts(accounts)
  return { success: true, message: '注册成功' }
}

/** 验证登录 */
export function authenticateUser(username: string, password: string): { success: boolean; message: string } {
  if (!username || !password) {
    return { success: false, message: '请输入用户名和密码' }
  }
  const account = getAccounts().find(a => a.username === username)
  if (!account) {
    return { success: false, message: '用户名不存在' }
  }
  if (account.passwordHash !== simpleHash(password)) {
    return { success: false, message: '密码错误' }
  }
  return { success: true, message: '登录成功' }
}

/** 将游客数据迁移到指定用户账号下 */
export function migrateGuestData(username: string): void {
  const guestPrefix = GUEST_PREFIX
  const userPrefix = `${USER_PREFIX}${username}_`

  for (const key of Array.from(cache.keys())) {
    if (!key.startsWith(guestPrefix) || key === CURRENT_USER_KEY || key === ACCOUNT_KEY) continue
    const shortKey = key.replace(guestPrefix, '')
    const value = cache.get(key)
    if (value === undefined) continue

    const targetKey = userPrefix + shortKey
    if (cache.has(targetKey)) {
      // 用户空间已有该 key：数组类数据合并，其余保留用户已有数据
      const existingData = cache.get(targetKey)
      if (Array.isArray(existingData) && Array.isArray(value)) {
        writeKey(targetKey, [...existingData, ...value])
      }
    } else {
      writeKey(targetKey, value)
    }
    deleteKey(key)
  }
}

/** 删除指定用户的全部数据和账号 */
export function deleteUserAccount(username: string): void {
  const userPrefix = `${USER_PREFIX}${username}_`
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(userPrefix)) deleteKey(key)
  }
  // 从账号列表中移除
  const accounts = getAccounts().filter(a => a.username !== username)
  saveAccounts(accounts)
  // 如果删除的是当前登录用户，清除登录状态
  if (getCurrentUsername() === username) {
    setCurrentUsername('')
  }
}
