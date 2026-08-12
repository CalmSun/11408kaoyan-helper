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
  windowCloseToTray: () => ipcRenderer.send('window:close-to-tray'),
  // 应用更新（v2.6.7）
  checkUpdate: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  openGithub: () => ipcRenderer.invoke('open-github'),
  // 全屏与报告导出（v2.7.0）
  setFullscreen: (on: boolean) => ipcRenderer.send('window:set-fullscreen', on),
  exportReportPdf: (html: string) => ipcRenderer.invoke('report:export-pdf', html),
  onUpdateEvent: (cb: (channel: string, payload?: unknown) => void) => {
    const channels = ['update:available', 'update:not-available', 'update:progress', 'update:downloaded', 'update:error']
    channels.forEach(ch => {
      ipcRenderer.on(ch, (_e, payload) => cb(ch, payload))
    })
  }
})
