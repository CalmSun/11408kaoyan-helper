import { ref } from 'vue'
import { exportAllData, getGlobalStorage, setGlobalStorage } from '@/utils/storage'

/**
 * 数据目录管理（v2.8.0；v2.8.1 持久层迁移至 IndexedDB）
 * - 所有学习数据实时存于 IndexedDB（渲染进程本地），
 *   本模块负责将数据快照同步到用户自定义的数据目录（默认"文档\11408kaoyan-helper"，
 *   不在 C 盘应用数据区），形成第二份可迁移的备份。
 * - 自定义背景图、自动备份文件由主进程直接写入数据目录。
 */

const SYNC_KEY = 'kaoyan_data_sync_enabled'
const SYNC_INTERVAL = 30 * 60 * 1000 // 每 30 分钟同步一次（v2.8.1：由 5 分钟降低频率，减少磁盘写入）

export const dataDir = ref('')
export const syncEnabled = ref(loadSyncEnabled())
export const lastSyncAt = ref<string>('')

let syncTimer: number | null = null

function loadSyncEnabled(): boolean {
  return getGlobalStorage<string>(SYNC_KEY, '0') === '1'
}

/** 加载当前数据目录路径 */
export async function loadDataDir(): Promise<void> {
  const api = window.electronAPI
  if (!api?.getDataDir) return
  try {
    const res = await api.getDataDir()
    dataDir.value = res.dir
  } catch {
    // 忽略
  }
}

/** 选择新的数据目录（主进程弹目录对话框并迁移已有文件） */
export async function changeDataDir(): Promise<{ ok: boolean; message?: string }> {
  const api = window.electronAPI
  if (!api?.setDataDir) {
    return { ok: false, message: '当前环境不支持自定义数据目录' }
  }
  try {
    const res = await api.setDataDir()
    if (res.canceled) return { ok: false }
    if (res.success && res.dir) {
      dataDir.value = res.dir
      // 切换目录后立即同步一份数据过去
      await syncOnce()
      return { ok: true }
    }
    return { ok: false, message: res.message }
  } catch {
    return { ok: false, message: '操作失败，请重试' }
  }
}

/** 在资源管理器中打开数据目录 */
export async function openDataDir(): Promise<void> {
  try {
    await window.electronAPI?.openDataDir()
  } catch {
    // 忽略
  }
}

/** 立即将全量数据快照写入数据目录 */
export async function syncOnce(): Promise<boolean> {
  const api = window.electronAPI
  if (!api?.syncDataToDir) return false
  try {
    const res = await api.syncDataToDir(exportAllData())
    if (res.success) {
      lastSyncAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      return true
    }
    return false
  } catch {
    return false
  }
}

/** 设置自动同步开关并持久化 */
export function setSyncEnabled(on: boolean): void {
  syncEnabled.value = on
  setGlobalStorage(SYNC_KEY, on ? '1' : '0')
  if (on) {
    syncOnce()
    startAutoSync()
  } else {
    stopAutoSync()
  }
}

/** 启动定时同步（幂等） */
export function startAutoSync(): void {
  if (!syncEnabled.value) return
  if (syncTimer) return
  syncTimer = window.setInterval(() => {
    syncOnce()
  }, SYNC_INTERVAL)
}

/** 停止定时同步 */
export function stopAutoSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

/** 初始化：加载目录、恢复开关、启动定时同步（在存储层就绪后由根组件调用） */
export function initDataSync(): void {
  // 存储层已就绪：重新读取开关（模块加载期的初读可能早于存储初始化）
  syncEnabled.value = loadSyncEnabled()
  loadDataDir()
  if (syncEnabled.value) {
    syncOnce()
    startAutoSync()
  }
}
