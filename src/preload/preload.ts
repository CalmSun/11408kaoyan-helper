import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  exportData: (data: string) => ipcRenderer.invoke('export-data', data),
  importData: () => ipcRenderer.invoke('import-data'),
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setCustomBg: () => ipcRenderer.invoke('set-custom-bg'),
  clearCustomBg: () => ipcRenderer.invoke('clear-custom-bg'),
  getCustomBg: () => ipcRenderer.invoke('get-custom-bg'),
  // 窗口控制（v2.6.6：自建顶栏按钮）
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowToggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  windowCloseToTray: () => ipcRenderer.send('window:close-to-tray')
})
