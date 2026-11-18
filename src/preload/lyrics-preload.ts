import { contextBridge, ipcRenderer } from 'electron'

// v3.6.8：桌面歌词窗的专用 preload（最小暴露面）
contextBridge.exposeInMainWorld('lyricsAPI', {
  onRender: (cb: (payload: { line?: string; next?: string; title?: string; playing?: boolean }) => void) => {
    ipcRenderer.on('lyrics:render', (_e, payload) => cb(payload))
  },
  ready: () => ipcRenderer.send('lyrics:ready')
})
