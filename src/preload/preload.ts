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
  // 音乐文件夹选择（v2.7.1 引入；v2.8.0 仅返回文件清单，播放走协议流式读取）
  pickMusicFolder: () => ipcRenderer.invoke('music:pick-folder'),
  // 恢复上次选择的音乐文件夹（v2.8.2）
  restoreMusicFolder: () => ipcRenderer.invoke('music:restore-folder'),
  // 读取本地歌词文件（v2.8.2）
  readLyric: (trackName: string) => ipcRenderer.invoke('music:read-lyric', trackName),
  // v2.9.0：资料文件夹
  pickMaterialsFolder: () => ipcRenderer.invoke('materials:pick-folder'),
  restoreMaterialsFolder: () => ipcRenderer.invoke('materials:restore-folder'),
  listMaterialsFiles: () => ipcRenderer.invoke('materials:list-files'),
  // v2.9.0：默认浏览器打开外部链接
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  // v2.9.0：网易云音乐 API
  neteaseSearch: (keyword: string, limit?: number, offset?: number) => ipcRenderer.invoke('netease:search', keyword, limit, offset),
  neteaseSongUrl: (ids: number[]) => ipcRenderer.invoke('netease:song-url', ids),
  neteaseLyric: (id: number) => ipcRenderer.invoke('netease:lyric', id),
  // 国内天气服务（v2.8.0）
  weatherCurrent: (cityId: string) => ipcRenderer.invoke('weather:current', cityId),
  weatherSearch: (name: string) => ipcRenderer.invoke('weather:search', name),
  // 数据目录管理（v2.8.0）
  getDataDir: () => ipcRenderer.invoke('data:get-dir'),
  setDataDir: () => ipcRenderer.invoke('data:set-dir'),
  openDataDir: () => ipcRenderer.invoke('data:open-dir'),
  syncDataToDir: (json: string) => ipcRenderer.invoke('data:sync', json),
  onUpdateEvent: (cb: (channel: string, payload?: unknown) => void) => {
    const channels = ['update:available', 'update:not-available', 'update:progress', 'update:downloaded', 'update:error']
    channels.forEach(ch => {
      ipcRenderer.on(ch, (_e, payload) => cb(ch, payload))
    })
  }
})
