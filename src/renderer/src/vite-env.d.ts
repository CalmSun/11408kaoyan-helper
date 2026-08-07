/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  exportData: (data: string) => Promise<{ success: boolean; path?: string }>
  importData: () => Promise<{ success: boolean; data?: string }>
}

interface Window {
  electronAPI?: ElectronAPI
}
