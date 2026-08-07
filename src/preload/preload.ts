import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  exportData: (data: string) => ipcRenderer.invoke('export-data', data),
  importData: () => ipcRenderer.invoke('import-data')
})
