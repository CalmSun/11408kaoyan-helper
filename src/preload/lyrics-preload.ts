import { contextBridge, ipcRenderer } from 'electron'

// v3.6.8：桌面歌词窗专用 preload（最小暴露面）
export interface LyricRenderPayload {
  line?: string
  trans?: string
  next?: string
  title?: string
  playing?: boolean
  lineTime?: number
  words?: { time: number; duration: number; text: string }[]
}

export interface LyricWinConfigPayload {
  fontSize: number
  color: string
  opacity: number
  align: 'left' | 'center' | 'right'
  showTranslation: boolean
  showNext: boolean
  locked: boolean
}

contextBridge.exposeInMainWorld('lyricsAPI', {
  onRender: (cb: (payload: LyricRenderPayload) => void) => {
    ipcRenderer.on('lyrics:render', (_e, payload) => cb(payload))
  },
  onConfig: (cb: (payload: LyricWinConfigPayload) => void) => {
    ipcRenderer.on('lyrics:config', (_e, payload) => cb(payload))
  },
  ready: () => ipcRenderer.send('lyrics:ready')
})
