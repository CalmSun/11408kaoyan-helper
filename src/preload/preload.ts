import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  exportData: (data: string) => ipcRenderer.invoke('export-data', data),
  importData: () => ipcRenderer.invoke('import-data'),
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setCustomBg: () => ipcRenderer.invoke('set-custom-bg'),
  clearCustomBg: () => ipcRenderer.invoke('clear-custom-bg'),
  getCustomBg: () => ipcRenderer.invoke('get-custom-bg')
})
