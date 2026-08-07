// 本地存储工具
const STORAGE_PREFIX = 'kaoyan_helper_'

export function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(STORAGE_PREFIX + key)
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
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch (e) {
    console.error('写入存储失败:', e)
  }
}

export function removeStorage(key: string): void {
  localStorage.removeItem(STORAGE_PREFIX + key)
}

export function clearAllStorage(): void {
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith(STORAGE_PREFIX)) {
      localStorage.removeItem(key)
    }
  })
}

// 导出所有数据
export function exportAllData(): string {
  const data: Record<string, any> = {}
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith(STORAGE_PREFIX)) {
      const shortKey = key.replace(STORAGE_PREFIX, '')
      try {
        data[shortKey] = JSON.parse(localStorage.getItem(key) || '')
      } catch {
        data[shortKey] = localStorage.getItem(key)
      }
    }
  })
  return JSON.stringify(data, null, 2)
}

// 导入所有数据
export function importAllData(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr)
    Object.keys(data).forEach(key => {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data[key]))
    })
    return true
  } catch (e) {
    console.error('导入数据失败:', e)
    return false
  }
}
