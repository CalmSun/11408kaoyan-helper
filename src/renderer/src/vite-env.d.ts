/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// v2.9.2：资料文件夹树形节点
interface MaterialNode {
  name: string
  type: 'folder' | 'file'
  path: string
  children?: MaterialNode[]
  url?: string
  ext?: string
  size?: number
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
  // 应用更新（v2.6.7）
  checkUpdate: () => Promise<{ success: boolean; version?: string | null; message?: string }>
  downloadUpdate: () => Promise<{ success: boolean; message?: string }>
  installUpdate: () => Promise<{ success: boolean }>
  openGithub: () => Promise<{ success: boolean }>
  // 全屏与学习报告导出（v2.7.0）
  setFullscreen: (on: boolean) => void
  exportReportPdf: (html: string) => Promise<{ success: boolean; path?: string; message?: string }>
  // 音乐文件夹选择（v2.7.1；v2.8.0 返回播放协议地址而非文件内容）
  pickMusicFolder: () => Promise<{
    success: boolean
    canceled?: boolean
    files?: { name: string; url: string }[]
  }>
  // 恢复上次选择的音乐文件夹（v2.8.2）
  restoreMusicFolder: () => Promise<{
    success: boolean
    canceled?: boolean
    files?: { name: string; url: string }[]
  }>
  // 读取本地歌词文件（v2.8.2）
  readLyric: (trackName: string) => Promise<{ success: boolean; content: string }>
  // v2.9.0：资料文件夹（v2.9.2：树形结构）
  pickMaterialsFolder: () => Promise<{
    success: boolean
    canceled?: boolean
    files?: MaterialNode[]
    folder?: string
  }>
  restoreMaterialsFolder: () => Promise<{
    success: boolean
    canceled?: boolean
    files?: MaterialNode[]
    folder?: string
  }>
  listMaterialsFiles: () => Promise<{
    success: boolean
    files?: MaterialNode[]
    folder?: string
  }>
  // v3.2.9：系统默认应用打开资料文件
  openMaterialsExternal: (token: string) => Promise<{ success: boolean; message?: string }>
  // v3.5.2：pdf.js 静态资源回环 HTTP 服务基址
  getAssetsBaseUrl: () => Promise<string>
  // v2.9.0：默认浏览器打开外部链接
  openExternalUrl: (url: string) => Promise<{ success: boolean; message?: string }>
  // v2.9.0：网易云音乐 API
  neteaseSearch: (keyword: string, limit?: number, offset?: number) => Promise<{
    success: boolean
    songs?: { id: number; name: string; artist: string; album: string; cover: string }[]
    total?: number
    message?: string
  }>
  neteaseSongUrl: (ids: number[], level?: string) => Promise<{
    success: boolean
    urls?: { id: number; url: string | null; br: number }[]
    message?: string
  }>
  neteaseLyric: (id: number) => Promise<{
    success: boolean
    lyric?: string
    tlyric?: string
    message?: string
  }>
  // v2.9.2：网易云登录与歌单
  neteaseQrKey: () => Promise<{ success: boolean; key?: string; qrimg?: string; qrurl?: string; message?: string }>
  neteaseQrCheck: (key: string) => Promise<{ success: boolean; code?: number; message?: string; cookie?: string }>
  neteaseLoginStatus: () => Promise<{
    success: boolean
    loggedIn?: boolean
    user?: { id: number; nickname: string; avatar: string; signature: string; level: number } | null
    message?: string
  }>
  neteaseLogout: () => Promise<{ success: boolean }>
  neteaseSetCookie: (cookie: string) => Promise<{ success: boolean; loggedIn: boolean; user?: { id: number; nickname: string; avatar: string } | null; message?: string }>
  // v3.1.9：手机号登录
  neteaseLoginPhone: (phone: string, password: string, countrycode?: string) => Promise<{ success: boolean; loggedIn: boolean; user?: { id: number; nickname: string; avatar: string } | null; message?: string }>
  neteaseUserPlaylist: (uid: number, limit?: number, offset?: number) => Promise<{
    success: boolean
    playlists?: { id: number; name: string; cover: string; playCount: number; trackCount: number; creator: string }[]
    message?: string
  }>
  neteasePlaylistDetail: (id: number) => Promise<{
    success: boolean
    playlist?: { id: number; name: string; cover: string; playCount: number; trackCount: number; description: string } | null
    tracks?: { id: number; name: string; artist: string; album: string; cover: string; duration: number }[]
    message?: string
  }>
  // v3.1.3：网易云歌曲评论
  neteaseComments: (id: number, pageNo?: number, pageSize?: number, sortType?: number) => Promise<{
    success: boolean
    comments?: { commentId: number; content: string; time: number; likedCount: number; nickname: string; avatar: string; userId: number; repliedContent: string; repliedNickname: string }[]
    hotComments?: { commentId: number; content: string; time: number; likedCount: number; nickname: string; avatar: string; userId: number; repliedContent: string; repliedNickname: string }[]
    total?: number
    message?: string
  }>
  // v3.1.5：热搜列表、排行榜、用户详情、心动模式
  neteaseHotSearch: () => Promise<{
    success: boolean
    hots?: { rank: number; keyword: string; score: number; iconUrl: string }[]
    message?: string
  }>
  neteaseToplist: () => Promise<{
    success: boolean
    lists?: { id: number; name: string; cover: string; updateFrequency: string; description: string; playCount: number; topTracks: { name: string; artist: string }[] }[]
    message?: string
  }>
  neteaseToplistDetail: (id: number) => Promise<{
    success: boolean
    playlist?: { id: number; name: string; cover: string; playCount: number; trackCount: number; description: string } | null
    tracks?: { id: number; name: string; artist: string; album: string; cover: string; duration: number }[]
    message?: string
  }>
  neteaseUserDetail: (uid: number) => Promise<{
    success: boolean
    user?: {
      id: number; nickname: string; avatar: string; signature: string; level: number
      gender: number; birthday: number; followeds: number; follows: number
      playlistCount: number; listenSongs: number
    } | null
    message?: string
  }>
  neteaseUserAccount: () => Promise<{
    success: boolean
    data?: {
      id: number; username: string; nickname: string; phone: string; email: string
      vipType: number; createTime: number; createDays: number
    } | null
    message?: string
  }>
  neteaseLike: (songId: number, like?: boolean) => Promise<{ success: boolean; liked: boolean; message?: string }>
  neteaseSongLikeStatus: (songId: number | string) => Promise<{ success: boolean; liked: boolean; likedMap: Record<string, boolean> }>
  neteaseIntelligenceList: (songId: number, playlistId: number) => Promise<{
    success: boolean
    songs?: { id: number; name: string; artist: string; album: string; cover: string; duration: number; recommended: boolean }[]
    message?: string
  }>
  // v3.2.1：喜欢音乐列表
  neteaseLikelist: (uid?: number) => Promise<{ success: boolean; ids: number[]; message?: string }>
  // v3.2.0：评论点赞
  neteaseCommentLike: (songId: number, commentId: number, like: boolean) => Promise<{ success: boolean; liked: boolean; message?: string }>
  // v3.2.2：网易云云盘歌曲
  neteaseCloudDrive: (pageSize?: number, pageNo?: number) => Promise<{
    success: boolean
    songs?: {
      id: number; name: string; artist: string; album: string; cover: string; duration: number
      fileName?: string; fileSize?: number; addTime?: number; level?: string
    }[]
    count?: number
    message?: string
  }>
  // v3.5.3：歌曲下载与云端管理（补全之前缺位的类型声明）
  neteaseDownloadUrl: (songId: number, level?: string) => Promise<{
    success: boolean
    url?: string
    level?: string
    size?: number
    type?: string
    md5?: string
    br?: number
    message?: string
  }>
  neteaseDownloadSong: (songId: number, artist: string, name: string, level?: string) => Promise<{
    success: boolean
    filePath?: string
    lyricPath?: string
    level?: string
    size?: number
    type?: string
    message?: string
  }>
  neteaseCloudUploadCheck: (songs: Array<{ md5: string; songId: number; bitrate: number; fileSize: number }>) => Promise<{
    success: boolean
    data?: any[]
    message?: string
  }>
  neteaseCloudSongImport: (songs: Array<{ songId: number; bitrate: number; song: string; artist: string; album: string; fileName: string }>) => Promise<{
    success: boolean
    data?: any
    message?: string
  }>
  neteaseCloudSongMatch: (songId: number, adjustSongId: number) => Promise<{
    success: boolean
    code?: number
    message?: string
  }>
  neteaseCloudSongDelete: (songIds: number[]) => Promise<{
    success: boolean
    code?: number
    message?: string
  }>
  neteaseSongDetail: (songIds: number[]) => Promise<{
    success: boolean
    code?: number
    data?: any
    message?: string
  }>
  // v3.6.3：云盘本地上传 + 批量下载
  neteaseCloudUploadFiles: () => Promise<{
    success: boolean
    canceled?: boolean
    total?: number
    successCount?: number
    failCount?: number
    failed?: string[]
    message?: string
  }>
  neteaseBatchDownload: (songs: Array<{ id: number; name: string; artist: string }>) => Promise<{
    success: boolean
    canceled?: boolean
    total?: number
    successCount?: number
    failCount?: number
    failed?: { id: number; name: string }[]
    dir?: string
    message?: string
  }>
  onCloudUploadProgress: (cb: (p: { current: number; total: number; fileName: string; status: string }) => void) => void
  onCloudDownloadProgress: (cb: (p: { current: number; total: number; fileName: string; status: string }) => void) => void
  // 国内天气服务（v2.8.0）
  weatherCurrent: (cityId: string) => Promise<{ success: boolean; data?: Record<string, string>; message?: string }>
  weatherSearch: (name: string) => Promise<{ success: boolean; results?: { id: string; name: string; province: string }[]; message?: string }>
  // 数据目录管理（v2.8.0）
  getDataDir: () => Promise<{ dir: string }>
  setDataDir: () => Promise<{ success: boolean; canceled?: boolean; dir?: string; message?: string }>
  openDataDir: () => Promise<{ success: boolean }>
  syncDataToDir: (json: string) => Promise<{ success: boolean; path?: string; message?: string }>
  onUpdateEvent: (cb: (channel: string, payload?: unknown) => void) => void
}

interface Window {
  electronAPI?: ElectronAPI
}

// Vite define 注入的版本号
declare const __APP_VERSION__: string
