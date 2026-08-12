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
}

interface Window {
  electronAPI?: ElectronAPI
}

// Vite define 注入的版本号
declare const __APP_VERSION__: string
