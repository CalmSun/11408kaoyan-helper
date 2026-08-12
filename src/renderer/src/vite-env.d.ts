/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  exportData: (data: string) => Promise<{ success: boolean; path?: string }>
  importData: () => Promise<{ success: boolean; data?: string }>
  setAutoLaunch: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>
  getAutoLaunch: () => Promise<{ enabled: boolean }>
  setCustomBg: () => Promise<{ success: boolean }>
  clearCustomBg: () => Promise<{ success: boolean }>
  getCustomBg: () => Promise<{ enabled: boolean }>
  // 窗口控制（v2.6.6：自建顶栏按钮）
  windowMinimize: () => void
  windowToggleMaximize: () => void
  windowCloseToTray: () => void
  // 应用更新（v2.6.7）
  checkUpdate: () => Promise<{ success: boolean; version?: string | null; message?: string }>
  downloadUpdate: () => Promise<{ success: boolean; message?: string }>
  installUpdate: () => Promise<{ success: boolean }>
  openGithub: () => Promise<{ success: boolean }>
  // 全屏与学习报告导出（v2.7.0）
  setFullscreen: (on: boolean) => void
  exportReportPdf: (html: string) => Promise<{ success: boolean; path?: string; message?: string }>
  // 音乐文件夹选择（v2.7.1；v2.8.0 返回播放协议地址而非文件内容）
  pickMusicFolder: () => Promise<{
    success: boolean
    canceled?: boolean
    files?: { name: string; url: string }[]
  }>
  // 国内天气服务（v2.8.0）
  weatherCurrent: (cityId: string) => Promise<{ success: boolean; data?: Record<string, string>; message?: string }>
  weatherSearch: (name: string) => Promise<{ success: boolean; results?: { id: string; name: string; province: string }[]; message?: string }>
  // 数据目录管理（v2.8.0）
  getDataDir: () => Promise<{ dir: string }>
  setDataDir: () => Promise<{ success: boolean; canceled?: boolean; dir?: string; message?: string }>
  openDataDir: () => Promise<{ success: boolean }>
  syncDataToDir: (json: string) => Promise<{ success: boolean; path?: string; message?: string }>
  onUpdateEvent: (cb: (channel: string, payload?: unknown) => void) => void
}

interface Window {
  electronAPI?: ElectronAPI
}

// Vite define 注入的版本号
declare const __APP_VERSION__: string
