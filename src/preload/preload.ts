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
  // v3.2.9：系统默认应用打开资料文件
  openMaterialsExternal: (token: string) => ipcRenderer.invoke('materials:open-external', token),
  // v3.5.2：pdf.js 静态资源回环 HTTP 服务基址（CMap/标准字体本地化主通道；为空则回退 kaoyan-assets:// 协议）
  getAssetsBaseUrl: () => ipcRenderer.invoke('assets:get-base-url'),
  // v2.9.0：默认浏览器打开外部链接
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  // v2.9.0：网易云音乐 API
  neteaseSearch: (keyword: string, limit?: number, offset?: number) => ipcRenderer.invoke('netease:search', keyword, limit, offset),
  neteaseSongUrl: (ids: number[], level?: string) => ipcRenderer.invoke('netease:song-url', ids, level),
  neteaseLyric: (id: number) => ipcRenderer.invoke('netease:lyric', id),
  // v2.9.2：网易云登录与歌单
  neteaseQrKey: () => ipcRenderer.invoke('netease:qr-key'),
  neteaseQrCheck: (key: string) => ipcRenderer.invoke('netease:qr-check', key),
  neteaseLoginStatus: () => ipcRenderer.invoke('netease:login-status'),
  neteaseLogout: () => ipcRenderer.invoke('netease:logout'),
  neteaseSetCookie: (cookie: string) => ipcRenderer.invoke('netease:set-cookie', cookie),
  // v3.1.9：手机号登录
  neteaseLoginPhone: (phone: string, password: string, countrycode?: string) => ipcRenderer.invoke('netease:login-phone', phone, password, countrycode),
  neteaseUserPlaylist: (uid: number, limit?: number, offset?: number) => ipcRenderer.invoke('netease:user-playlist', uid, limit, offset),
  neteasePlaylistDetail: (id: number) => ipcRenderer.invoke('netease:playlist-detail', id),
  // v3.1.3：网易云歌曲评论
  neteaseComments: (id: number, pageNo?: number, pageSize?: number, sortType?: number) => ipcRenderer.invoke('netease:comments', id, pageNo, pageSize, sortType),
  // v3.1.5：热搜列表、排行榜、用户详情、心动模式
  neteaseHotSearch: () => ipcRenderer.invoke('netease:hot-search'),
  neteaseToplist: () => ipcRenderer.invoke('netease:toplist'),
  neteaseToplistDetail: (id: number) => ipcRenderer.invoke('netease:toplist-detail', id),
  neteaseUserDetail: (uid: number) => ipcRenderer.invoke('netease:user-detail', uid),
  neteaseUserAccount: () => ipcRenderer.invoke('netease:user-account'),
  neteaseLike: (songId: number, like?: boolean) => ipcRenderer.invoke('netease:like', songId, like),
  neteaseSongLikeStatus: (songId: number | string) => ipcRenderer.invoke('netease:song-like-status', songId),
  neteaseIntelligenceList: (songId: number, playlistId: number) => ipcRenderer.invoke('netease:intelligence-list', songId, playlistId),
  // v3.2.1：喜欢音乐列表（一次性拉取用户已喜欢歌曲 ID）
  neteaseLikelist: (uid?: number) => ipcRenderer.invoke('netease:likelist', uid),
  // v3.2.0：评论点赞
  neteaseCommentLike: (songId: number, commentId: number, like: boolean) => ipcRenderer.invoke('netease:comment-like', songId, commentId, like),
  // v3.2.2：网易云云盘歌曲
  neteaseCloudDrive: (pageSize?: number, pageNo?: number) => ipcRenderer.invoke('netease:cloud-drive', pageSize, pageNo),
  // v3.5.3：网易云歌曲下载URL（高音质）、云盘快传/匹配纠正/删除、歌曲详情
  neteaseDownloadUrl: (songId: number, level?: string) => ipcRenderer.invoke('netease:download-url', songId, level),
  neteaseDownloadSong: (songId: number, artist: string, name: string, level?: string) => ipcRenderer.invoke('netease:download-song', songId, artist, name, level),
  neteaseCloudUploadCheck: (songs: Array<{md5: string; songId: number; bitrate: number; fileSize: number}>) => ipcRenderer.invoke('netease:cloud-upload-check', songs),
  neteaseCloudSongImport: (songs: Array<{songId: number; bitrate: number; song: string; artist: string; album: string; fileName: string}>) => ipcRenderer.invoke('netease:cloud-song-import', songs),
  neteaseCloudSongMatch: (songId: number, adjustSongId: number) => ipcRenderer.invoke('netease:cloud-song-match', songId, adjustSongId),
  neteaseCloudSongDelete: (songIds: number[]) => ipcRenderer.invoke('netease:cloud-song-delete', songIds),
  neteaseSongDetail: (songIds: number[]) => ipcRenderer.invoke('netease:song-detail', songIds),
  // v3.6.3：云盘本地上传 + 批量下载
  neteaseCloudUploadFiles: () => ipcRenderer.invoke('netease:cloud-upload-files'),
  neteaseBatchDownload: (songs: Array<{ id: number; name: string; artist: string }>) => ipcRenderer.invoke('netease:batch-download', songs),
  onCloudUploadProgress: (cb: (p: { current: number; total: number; fileName: string; status: string }) => void) => {
    ipcRenderer.on('netease:cloud-upload-progress', (_e, p) => cb(p))
  },
  onCloudDownloadProgress: (cb: (p: { current: number; total: number; fileName: string; status: string }) => void) => {
    ipcRenderer.on('netease:cloud-download-progress', (_e, p) => cb(p))
  },
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
