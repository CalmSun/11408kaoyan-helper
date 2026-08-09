// 本地存储工具 - 支持多用户隔离
const GUEST_PREFIX = 'kaoyan_helper_'
const USER_PREFIX = 'kaoyan_user_'
const ACCOUNT_KEY = 'kaoyan_accounts'
const CURRENT_USER_KEY = 'kaoyan_current_user'

// ─── 当前用户管理 ─────────────────────────────────────────────

export function getCurrentUsername(): string {
  return localStorage.getItem(CURRENT_USER_KEY) || ''
}

export function setCurrentUsername(username: string): void {
  if (username) {
    localStorage.setItem(CURRENT_USER_KEY, username)
  } else {
    localStorage.removeItem(CURRENT_USER_KEY)
  }
}

function getStoragePrefix(): string {
  const user = getCurrentUsername()
  return user ? `${USER_PREFIX}${user}_` : GUEST_PREFIX
}

// ─── 通用存储操作 ─────────────────────────────────────────────

export function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(getStoragePrefix() + key)
    if (data) {
      return JSON.parse(data) as T
    }
  } catch (e) {
    console.error('读取存储失败:', e)
  }
  return defaultValue
}

export function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(getStoragePrefix() + key, JSON.stringify(value))
  } catch (e) {
    console.error('写入存储失败:', e)
  }
}

export function removeStorage(key: string): void {
  localStorage.removeItem(getStoragePrefix() + key)
}

/** 清除当前用户的所有数据（不影响其他用户和账号列表） */
export function clearAllStorage(): void {
  const prefix = getStoragePrefix()
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith(prefix)) {
      localStorage.removeItem(key)
    }
  })
}

// ─── 导出/导入 ────────────────────────────────────────────────

/** 导出当前用户的所有数据 */
export function exportAllData(): string {
  const data: Record<string, any> = {}
  const prefix = getStoragePrefix()
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith(prefix)) {
      const shortKey = key.replace(prefix, '')
      try {
        data[shortKey] = JSON.parse(localStorage.getItem(key) || '')
      } catch {
        data[shortKey] = localStorage.getItem(key)
      }
    }
  })
  return JSON.stringify(data, null, 2)
}

/** 导入数据到当前用户（覆盖同名 key） */
export function importAllData(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr)
    const prefix = getStoragePrefix()
    Object.keys(data).forEach(key => {
      localStorage.setItem(prefix + key, JSON.stringify(data[key]))
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
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAccounts(accounts: AccountInfo[]): void {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts))
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
  const keys = Object.keys(localStorage)

  keys.forEach(key => {
    if (key.startsWith(guestPrefix) && key !== CURRENT_USER_KEY && key !== ACCOUNT_KEY) {
      const shortKey = key.replace(guestPrefix, '')
      const value = localStorage.getItem(key)
      if (value !== null) {
        // 如果用户空间已有该 key，合并数组类数据，否则覆盖
        const existing = localStorage.getItem(userPrefix + shortKey)
        if (existing) {
          try {
            const existingData = JSON.parse(existing)
            const guestData = JSON.parse(value)
            if (Array.isArray(existingData) && Array.isArray(guestData)) {
              const merged = [...existingData, ...guestData]
              localStorage.setItem(userPrefix + shortKey, JSON.stringify(merged))
            }
            // 非数组类型保留用户已有数据
          } catch {
            // 解析失败，跳过
          }
        } else {
          localStorage.setItem(userPrefix + shortKey, value)
        }
        localStorage.removeItem(key)
      }
    }
  })
}

/** 删除指定用户的全部数据和账号 */
export function deleteUserAccount(username: string): void {
  // 删除用户数据
  const userPrefix = `${USER_PREFIX}${username}_`
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith(userPrefix)) {
      localStorage.removeItem(key)
    }
  })
  // 从账号列表中移除
  const accounts = getAccounts().filter(a => a.username !== username)
  saveAccounts(accounts)
  // 如果删除的是当前登录用户，清除登录状态
  if (getCurrentUsername() === username) {
    setCurrentUsername('')
  }
}
