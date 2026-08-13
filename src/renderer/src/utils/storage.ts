/**
 * 本地存储工具（v3.1.0：改回 localStorage 实时持久化）
 *
 * 架构说明：
 * - 数据实时持久化在 localStorage（同步写入，确保退出不丢失）
 * - 内存缓存（Map）承载同步读写，getStorage/setStorage 同步 API 与全部调用方零改动
 * - 写入双通道：立即更新缓存 + 立即写入 localStorage
 * - 启动时 initStorage()：从 localStorage 载入缓存 → 触发就绪回调
 * - beforeunload/pagehide 双保险：退出前强制 flush 缓存到 localStorage
 * - 数据版本化迁移机制：DATA_VERSION + dataMigrations 注册表
 * - localStorage 容量不足时自动清理最旧的非关键数据（降级策略）
 */

// ─── 常量 ────────────────────────────────────────────────────
const GUEST_PREFIX = 'kaoyan_helper_'
const USER_PREFIX = 'kaoyan_user_'
const ACCOUNT_KEY = 'kaoyan_accounts'
const CURRENT_USER_KEY = 'kaoyan_current_user'

/**
 * 数据模式版本：数据结构变更时递增，并在 dataMigrations 追加对应变换。
 * v1：基线版本
 */
const DATA_VERSION = 1
const DATA_VERSION_KEY = '__data_version__'

interface DataMigration {
  version: number
  name: string
  migrate: (key: string, value: unknown) => unknown
}

const dataMigrations: DataMigration[] = []

// ─── 内部状态 ────────────────────────────────────────────────
const cache = new Map<string, unknown>()
let ready = false
const readyCallbacks: Array<() => void> = []
let readyPromise: Promise<void> | null = null

/** 等待存储层就绪（已就绪立即返回；未初始化则触发初始化） */
export function storageReady(): Promise<void> {
  if (ready) return Promise.resolve()
  if (!readyPromise) readyPromise = initStorage()
  return readyPromise
}

// ─── localStorage 基础操作 ───────────────────────────────────

function lsSet(key: string, value: unknown): void {
  try {
    const raw = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(key, raw)
  } catch (e) {
    console.error('[storage] localStorage 写入失败:', e)
    // 容量不足时尝试清理旧数据后重试
    try {
      cleanupOldData()
      const raw = typeof value === 'string' ? value : JSON.stringify(value)
      localStorage.setItem(key, raw)
    } catch (e2) {
      console.error('[storage] 清理后仍写入失败:', e2)
    }
  }
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function lsDelete(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch { /* 忽略 */ }
}

/** 判断 localStorage 键是否属于本应用数据 */
function isAppKey(key: string): boolean {
  return (
    key.startsWith(GUEST_PREFIX) ||
    key.startsWith(USER_PREFIX) ||
    key === ACCOUNT_KEY ||
    key === CURRENT_USER_KEY ||
    key === DATA_VERSION_KEY ||
    key.startsWith('kaoyan_')
  )
}

/** localStorage 容量不足时清理策略：优先清除游客旧数据、历史快照 */
function cleanupOldData(): void {
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !isAppKey(key)) continue
    // 保留账号和当前用户，优先清除游客数据和历史快照
    if (key === ACCOUNT_KEY || key === CURRENT_USER_KEY) continue
    if (key.includes('planSnapshots') || key.includes('pomodoroRecords')) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(k => {
    localStorage.removeItem(k)
    cache.delete(k)
  })
}

// ─── 数据版本化迁移 ──────────────────────────────────────────

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
          lsDelete(key)
        } else if (next !== value) {
          cache.set(key, next)
          lsSet(key, next)
        }
      } catch (e) {
        console.error(`数据迁移 [${migration.name}] 处理 ${key} 失败:`, e)
      }
    }
  }
}

// ─── 初始化 ─────────────────────────────────────────────────

/**
 * 初始化存储层：从 localStorage 载入缓存 → 版本迁移 → 触发就绪回调。
 * v3.1.0：改回 localStorage 实时持久化，确保重启不丢失数据。
 */
export async function initStorage(): Promise<void> {
  if (ready) return
  if (readyPromise && ready !== false) return readyPromise

  readyPromise = (async () => {
    // 从 localStorage 加载所有应用数据到缓存
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !isAppKey(key)) continue
      const raw = lsGet(key)
      if (raw === null) continue
      try {
        cache.set(key, JSON.parse(raw))
      } catch {
        // 非 JSON 值原样保存
        cache.set(key, raw)
      }
    }

    // 数据版本化迁移
    const storedVersion = (cache.get(DATA_VERSION_KEY) as number) || 0
    if (storedVersion < DATA_VERSION) {
      runDataMigrations(storedVersion)
      cache.set(DATA_VERSION_KEY, DATA_VERSION)
      lsSet(DATA_VERSION_KEY, DATA_VERSION)
    }

    ready = true

    // v3.1.0：注册退出前保存双保险
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', flushAll)
      window.addEventListener('pagehide', flushAll)
    }
  })()

  await readyPromise

  readyCallbacks.forEach(cb => {
    try { cb() } catch { /* 单个回调失败不影响其余 */ }
  })
  readyCallbacks.length = 0

  return readyPromise
}

/** 将缓存中所有数据强制写入 localStorage（退出前双保险） */
export function flushAll(): void {
  for (const [key, value] of cache.entries()) {
    lsSet(key, value)
  }
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
  // 缓存未命中时回退读 localStorage
  return lsGet(CURRENT_USER_KEY) || ''
}

export function setCurrentUsername(username: string): void {
  if (username) {
    writeKey(CURRENT_USER_KEY, username)
  } else {
    deleteKey(CURRENT_USER_KEY)
  }
}

function getStoragePrefix(): string {
  const user = getCurrentUsername()
  return user ? `${USER_PREFIX}${user}_` : GUEST_PREFIX
}

// ─── 通用写入（缓存 + 立即写入 localStorage） ────────────────

function writeKey(key: string, value: unknown): void {
  cache.set(key, value)
  lsSet(key, value)
}

function deleteKey(key: string): void {
  cache.delete(key)
  lsDelete(key)
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
  // 缓存未命中时直接读 localStorage
  const raw = lsGet(key)
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as T
      cache.set(key, parsed)
      return parsed
    } catch {
      return raw as unknown as T
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
  // 同时清理 localStorage 中可能存在的残留键
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      lsDelete(key)
    }
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
  passwordHash: string
  createdAt: string
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
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
  // 同时清理 localStorage 残留
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && key.startsWith(userPrefix)) lsDelete(key)
  }
  const accounts = getAccounts().filter(a => a.username !== username)
  saveAccounts(accounts)
  if (getCurrentUsername() === username) {
    setCurrentUsername('')
  }
}
