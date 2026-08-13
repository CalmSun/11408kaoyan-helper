import { ref } from 'vue'
import { exportAllData } from '@/utils/storage'

/**
 * 数据目录管理（v2.8.0；v2.8.1 持久层迁移至 IndexedDB；v2.9.2 关闭自动备份同步）
 * - 所有学习数据实时存于 IndexedDB（渲染进程本地），实时记录和读取。
 * - v2.9.2：关闭每 2 分钟自动备份同步机制，不再定时写入数据目录快照。
 * - 保留数据目录自定义、手动立即同步、打开目录等功能。
 */

const SYNC_KEY = 'kaoyan_data_sync_enabled'
// v2.9.2：自动备份同步已关闭，保留常量供手动同步使用
const SYNC_INTERVAL = 2 * 60 * 1000

export const dataDir = ref('')
export const syncEnabled = ref(false) // v2.9.2：强制关闭自动同步
export const lastSyncAt = ref<string>('')

let syncTimer: number | null = null

function loadSyncEnabled(): boolean {
  // v2.9.2：始终返回 false，自动备份同步机制已关闭
  return false
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

/** 设置自动同步开关（v2.9.2：自动同步已关闭，此函数保留但不生效） */
export function setSyncEnabled(on: boolean): void {
  // v2.9.2：自动备份同步机制已关闭，忽略开关操作
  syncEnabled.value = false
}

/** 启动定时同步（v2.9.2：已禁用，空实现） */
export function startAutoSync(): void {
  // v2.9.2：自动同步已关闭
}

/** 停止定时同步 */
export function stopAutoSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

/** 初始化：加载目录（v2.9.2：不再启动自动同步） */
export function initDataSync(): void {
  loadDataDir()
  // v2.9.2：关闭备份同步，数据通过 IndexedDB 实时记录和读取
}
