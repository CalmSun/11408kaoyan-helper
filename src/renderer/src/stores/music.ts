import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getStorage, setStorage } from '@/utils/storage'

interface MusicTrack {
  name: string
  url: string // 本地协议地址或在线播放URL
  source?: 'local' | 'online' // v2.9.0：曲目来源
  id?: number // v2.9.0：网易云歌曲ID
  artist?: string // v2.9.0：艺术家
  album?: string // v2.9.0：专辑
  cover?: string // v2.9.0：封面图URL
}

/** v2.9.0：网易云搜索结果 */
interface NetEaseSong {
  id: number
  name: string
  artist: string
  album: string
  cover: string
}

/** 可识别的音频扩展名 */
const AUDIO_EXTS = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'opus']

/**
 * 全局音乐播放器（v2.7.0 引入，v2.9.0 增强在线播放）
 * - 本地文件/文件夹播放
 * - v2.9.0：网易云在线搜索与播放、在线歌词
 */
export const useMusicStore = defineStore('music', () => {
  const audio = new Audio()
  audio.preload = 'metadata'

  const playlist = ref<MusicTrack[]>([])
  const currentIndex = ref(0)
  const isPlaying = ref(false)
  // v3.2.7：默认音量改为 100%
  const volume = ref(1.0)
  const shuffle = ref<boolean>(getStorage('musicShuffle', false))

  // v3.3.3：在线歌曲音质等级（standard/higher/exhigh/lossless/hires）
  const qualityLevel = ref<string>(getStorage('musicQualityLevel', 'exhigh'))
  function setQualityLevel(level: string) {
    qualityLevel.value = level
    setStorage('musicQualityLevel', level)
  }

  // v2.8.2：歌词相关状态
  const lyricLines = ref<{ time: number; text: string }[]>([])
  const currentLyricIndex = ref(-1)
  // v2.9.2：顶栏歌词显示开关（持久化）
  const showLyrics = ref<boolean>(getStorage('musicShowLyrics', true))

  // v2.9.0：播放进度（供音乐页面和顶栏显示）
  const currentTime = ref(0)
  const duration = ref(0)

  // v2.9.0：网易云搜索结果
  const searchResults = ref<NetEaseSong[]>([])
  const searchLoading = ref(false)
  const searchKeyword = ref('')

  const currentTrack = computed<MusicTrack | null>(
    () => playlist.value[currentIndex.value] ?? null
  )

  const hasMusic = computed(() => playlist.value.length > 0)

  audio.volume = volume.value

  // v2.8.2：启动时自动恢复上次选择的音乐文件夹
  async function restoreMusicFolder(): Promise<number> {
    const api = window.electronAPI
    if (!api?.restoreMusicFolder) return 0
    let files: { name: string; url: string }[] = []
    try {
      const res = await api.restoreMusicFolder()
      if (!res.success || !res.files?.length) return 0
      files = res.files
    } catch {
      return 0
    }
    setPlaylist(files.map(f => ({ name: f.name, url: f.url, source: 'local' as const })))
    return files.length
  }

  if (typeof window !== 'undefined' && window.electronAPI?.restoreMusicFolder) {
    restoreMusicFolder()
  }

  // 自动续播
  audio.addEventListener('ended', () => {
    if (playlist.value.length > 1) {
      next()
    } else {
      isPlaying.value = false
    }
  })

  // v3.1.9：音频播放错误处理（在线歌曲 URL 过期时自动刷新重试）
  let urlRefreshRetryCount = 0
  let isRefreshingUrl = false

  audio.addEventListener('error', async () => {
    const track = currentTrack.value
    if (!track || track.source !== 'online' || !track.id) {
      isPlaying.value = false
      return
    }
    if (isRefreshingUrl || urlRefreshRetryCount >= 2) {
      isPlaying.value = false
      urlRefreshRetryCount = 0
      return
    }
    isRefreshingUrl = true
    urlRefreshRetryCount++
    try {
      const api = window.electronAPI
      if (api?.neteaseSongUrl) {
        const res = await api.neteaseSongUrl([track.id], qualityLevel.value)
        const urlInfo = res.urls?.find(u => u.id === track.id)
        if (urlInfo?.url) {
          // 更新播放列表中的 URL
          const idx = currentIndex.value
          if (playlist.value[idx]) {
            playlist.value[idx] = { ...playlist.value[idx], url: urlInfo.url }
          }
          audio.src = urlInfo.url
          await audio.play()
          isPlaying.value = true
          urlRefreshRetryCount = 0
        }
      }
    } catch { /* ignore */ }
    isRefreshingUrl = false
  })

  // v2.9.0：监听播放进度
  audio.addEventListener('timeupdate', () => {
    currentTime.value = audio.currentTime
    updateLyricIndex()
  })
  audio.addEventListener('loadedmetadata', () => {
    duration.value = audio.duration || 0
  })

  function applyVolume() {
    audio.volume = volume.value
  }

  function setVolume(v: number) {
    volume.value = Math.min(1, Math.max(0, v))
    applyVolume()
  }

  /** v2.9.0：跳转到指定播放时间 */
  function seek(time: number) {
    if (isFinite(time) && time >= 0) {
      audio.currentTime = time
      currentTime.value = time
    }
  }

  function isAudioName(name: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    return AUDIO_EXTS.includes(ext)
  }

  function parseLyric(content: string): { time: number; text: string }[] {
    const lines: { time: number; text: string }[] = []
    const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/
    const rawLines = content.split('\n')
    for (const line of rawLines) {
      const match = line.match(regex)
      if (match) {
        const min = parseInt(match[1], 10)
        const sec = parseInt(match[2], 10)
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0
        const time = min * 60 + sec + ms / 1000
        const text = match[4].trim()
        if (text) {
          lines.push({ time, text })
        }
      }
    }
    return lines.sort((a, b) => a.time - b.time)
  }

  async function loadLyric() {
    const track = currentTrack.value
    if (!track) {
      lyricLines.value = []
      currentLyricIndex.value = -1
      return
    }

    // v2.9.0：在线曲目走网易云歌词接口
    if (track.source === 'online' && track.id) {
      const api = window.electronAPI
      if (api?.neteaseLyric) {
        try {
          const res = await api.neteaseLyric(track.id)
          if (res.success && res.lyric) {
            lyricLines.value = parseLyric(res.lyric)
            currentLyricIndex.value = -1
            return
          }
        } catch { /* fallthrough */ }
      }
      lyricLines.value = []
      currentLyricIndex.value = -1
      return
    }

    // 本地曲目：读取同目录 .lrc 文件
    const api = window.electronAPI
    if (!api?.readLyric) {
      lyricLines.value = []
      currentLyricIndex.value = -1
      return
    }
    try {
      const res = await api.readLyric(track.name)
      if (res.success && res.content) {
        lyricLines.value = parseLyric(res.content)
      } else {
        lyricLines.value = []
      }
      currentLyricIndex.value = -1
    } catch {
      lyricLines.value = []
      currentLyricIndex.value = -1
    }
  }

  function updateLyricIndex() {
    if (lyricLines.value.length === 0) {
      currentLyricIndex.value = -1
      return
    }
    const t = audio.currentTime
    let idx = -1
    for (let i = lyricLines.value.length - 1; i >= 0; i--) {
      if (t >= lyricLines.value[i].time) {
        idx = i
        break
      }
    }
    currentLyricIndex.value = idx
  }

  function revokeIfBlob(url: string) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  }

  function setPlaylist(tracks: MusicTrack[]) {
    playlist.value.forEach(t => revokeIfBlob(t.url))
    playlist.value = tracks
    currentIndex.value = 0
    loadCurrent()
  }

  function pickFiles(): Promise<number> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac'
      input.multiple = true
      input.onchange = () => {
        const files = Array.from(input.files || [])
        if (files.length === 0) {
          resolve(0)
          return
        }
        setPlaylist(files.map(f => ({ name: f.name, url: URL.createObjectURL(f), source: 'local' as const })))
        resolve(files.length)
      }
      input.click()
    })
  }

  async function pickFolder(): Promise<number> {
    const api = window.electronAPI
    if (!api?.pickMusicFolder) return 0
    let files: { name: string; url: string }[] = []
    try {
      const res = await api.pickMusicFolder()
      if (res.canceled) return 0
      if (!res.success || !res.files?.length) return 0
      files = res.files
    } catch {
      return 0
    }
    setPlaylist(files.map(f => ({ name: f.name, url: f.url, source: 'local' as const })))
    return files.length
  }

  function loadCurrent() {
    const track = currentTrack.value
    if (!track) return
    audio.src = track.url
    loadLyric()
    urlRefreshRetryCount = 0
  }

  async function play() {
    if (!currentTrack.value) return
    applyVolume()
    try {
      await audio.play()
      isPlaying.value = true
    } catch {
      // v3.1.9：播放失败时，若是在线歌曲尝试刷新 URL 后重试
      const track = currentTrack.value
      if (track.source === 'online' && track.id && !isRefreshingUrl && urlRefreshRetryCount < 2) {
        isRefreshingUrl = true
        urlRefreshRetryCount++
        try {
          const api = window.electronAPI
          if (api?.neteaseSongUrl) {
            const res = await api.neteaseSongUrl([track.id], qualityLevel.value)
            const urlInfo = res.urls?.find(u => u.id === track.id)
            if (urlInfo?.url) {
              const idx = currentIndex.value
              if (playlist.value[idx]) {
                playlist.value[idx] = { ...playlist.value[idx], url: urlInfo.url }
              }
              audio.src = urlInfo.url
              await audio.play()
              isPlaying.value = true
              urlRefreshRetryCount = 0
            }
          }
        } catch { /* ignore */ }
        isRefreshingUrl = false
      }
      if (!isPlaying.value) {
        isPlaying.value = false
      }
    }
  }

  function pause() {
    audio.pause()
    isPlaying.value = false
  }

  function toggle() {
    if (isPlaying.value) pause()
    else play()
  }

  function playIndex(index: number) {
    if (index < 0 || index >= playlist.value.length) return
    currentIndex.value = index
    loadCurrent()
    play()
  }

  function randomIndex(): number {
    const len = playlist.value.length
    if (len <= 1) return currentIndex.value
    let idx = currentIndex.value
    while (idx === currentIndex.value) {
      idx = Math.floor(Math.random() * len)
    }
    return idx
  }

  function next() {
    if (playlist.value.length === 0) return
    if (shuffle.value && playlist.value.length > 1) {
      currentIndex.value = randomIndex()
    } else {
      currentIndex.value = (currentIndex.value + 1) % playlist.value.length
    }
    loadCurrent()
    if (isPlaying.value) play()
  }

  function prev() {
    if (playlist.value.length === 0) return
    if (shuffle.value && playlist.value.length > 1) {
      currentIndex.value = randomIndex()
    } else {
      currentIndex.value = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length
    }
    loadCurrent()
    if (isPlaying.value) play()
  }

  function toggleShuffle() {
    shuffle.value = !shuffle.value
    setStorage('musicShuffle', shuffle.value)
  }

  /** v2.9.2：切换顶栏歌词显示 */
  function toggleLyrics() {
    showLyrics.value = !showLyrics.value
    setStorage('musicShowLyrics', showLyrics.value)
  }

  function removeTrack(index: number) {
    if (index < 0 || index >= playlist.value.length) return
    revokeIfBlob(playlist.value[index].url)
    playlist.value.splice(index, 1)
    if (playlist.value.length === 0) {
      pause()
      audio.removeAttribute('src')
      currentIndex.value = 0
      return
    }
    if (index < currentIndex.value) {
      currentIndex.value--
    } else if (index === currentIndex.value) {
      if (currentIndex.value >= playlist.value.length) currentIndex.value = 0
      const wasPlaying = isPlaying.value
      loadCurrent()
      if (wasPlaying) play()
    }
  }

  function clearPlaylist() {
    pause()
    playlist.value.forEach(t => revokeIfBlob(t.url))
    playlist.value = []
    currentIndex.value = 0
    audio.removeAttribute('src')
  }

  // ── v2.9.0：网易云在线搜索与播放 ──

  async function searchOnline(keyword: string, limit = 30): Promise<number> {
    const api = window.electronAPI
    if (!api?.neteaseSearch) return 0
    searchLoading.value = true
    searchKeyword.value = keyword
    try {
      const res = await api.neteaseSearch(keyword, limit, 0)
      if (res.success && res.songs) {
        searchResults.value = res.songs
        return res.songs.length
      }
      searchResults.value = []
      return 0
    } catch {
      searchResults.value = []
      return 0
    } finally {
      searchLoading.value = false
    }
  }

  /** 播放网易云在线歌曲：获取播放URL后加入播放列表并立即播放 */
  async function playOnlineSong(song: NetEaseSong): Promise<boolean> {
    const api = window.electronAPI
    if (!api?.neteaseSongUrl) return false
    try {
      const res = await api.neteaseSongUrl([song.id], qualityLevel.value)
      const urlInfo = res.urls?.find(u => u.id === song.id)
      if (!urlInfo?.url) return false
      const track: MusicTrack = {
        name: song.name,
        url: urlInfo.url,
        source: 'online',
        id: song.id,
        artist: song.artist,
        album: song.album,
        cover: song.cover
      }
      // 加入播放列表末尾并播放
      const idx = playlist.value.length
      playlist.value.push(track)
      currentIndex.value = idx
      loadCurrent()
      play()
      return true
    } catch {
      return false
    }
  }

  /** 将网易云歌曲加入播放列表（不立即播放） */
  async function addOnlineSong(song: NetEaseSong): Promise<boolean> {
    const api = window.electronAPI
    if (!api?.neteaseSongUrl) return false
    try {
      const res = await api.neteaseSongUrl([song.id], qualityLevel.value)
      const urlInfo = res.urls?.find(u => u.id === song.id)
      if (!urlInfo?.url) return false
      playlist.value.push({
        name: song.name,
        url: urlInfo.url,
        source: 'online',
        id: song.id,
        artist: song.artist,
        album: song.album,
        cover: song.cover
      })
      return true
    } catch {
      return false
    }
  }

  // ── v2.9.2：网易云登录与歌单同步 ──

  interface NetEaseUser {
    id: number
    nickname: string
    avatar: string
    signature: string
    level: number
  }

  interface NetEasePlaylist {
    id: number
    name: string
    cover: string
    playCount: number
    trackCount: number
    creator?: string
  }

  interface NetEasePlaylistTrack {
    id: number
    name: string
    artist: string
    album: string
    cover: string
    duration: number
  }

  const neteaseLoggedIn = ref(false)
  const neteaseUser = ref<NetEaseUser | null>(null)
  const userPlaylists = ref<NetEasePlaylist[]>([])
  const currentPlaylistInfo = ref<NetEasePlaylist | null>(null)
  const currentPlaylistTracks = ref<NetEasePlaylistTrack[]>([])
  const playlistLoading = ref(false)
  const qrKey = ref('')
  const qrStatus = ref<number>(0) // 0=未开始, 801=等待扫码, 802=扫码待确认, 803=登录成功, 800=过期
  const qrImage = ref('') // v3.0.0：二维码 base64 图片

  /** 检查网易云登录状态 */
  async function checkLoginStatus(): Promise<boolean> {
    const api = window.electronAPI
    if (!api?.neteaseLoginStatus) return false
    try {
      const res = await api.neteaseLoginStatus()
      if (res.success && res.loggedIn && res.user) {
        neteaseLoggedIn.value = true
        neteaseUser.value = res.user
        // v3.2.1：登录成功后拉取已喜欢歌曲列表（非阻塞，供卡片/列表初始点亮）
        fetchLikelist(true)
        return true
      }
      neteaseLoggedIn.value = false
      neteaseUser.value = null
      return false
    } catch {
      return false
    }
  }

  /** v3.1.0：通过 Cookie 字符串登录网易云（用户从浏览器复制 Cookie 粘贴） */
  async function setNeteaseCookie(cookie: string): Promise<{ success: boolean; message: string }> {
    const api = window.electronAPI
    if (!api?.neteaseSetCookie) return { success: false, message: 'API 不可用' }
    try {
      const res = await api.neteaseSetCookie(cookie)
      if (res.success && res.loggedIn && res.user) {
        neteaseLoggedIn.value = true
        neteaseUser.value = {
          id: res.user.id,
          nickname: res.user.nickname,
          avatar: res.user.avatar,
          signature: '',
          level: 0
        }
        await fetchUserPlaylists()
        // v3.2.1：登录成功后拉取已喜欢歌曲列表
        fetchLikelist(true)
        return { success: true, message: `登录成功：${res.user.nickname}` }
      }
      return { success: false, message: res.message || 'Cookie 无效或已过期' }
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }

  /** v3.1.9：手机号登录 */
  async function loginPhone(phone: string, password: string, countrycode = '86'): Promise<{ success: boolean; message: string }> {
    const api = window.electronAPI
    if (!api?.neteaseLoginPhone) return { success: false, message: 'API 不可用' }
    try {
      const res = await api.neteaseLoginPhone(phone, password, countrycode)
      if (res.success && res.loggedIn && res.user) {
        neteaseLoggedIn.value = true
        neteaseUser.value = {
          id: res.user.id,
          nickname: res.user.nickname,
          avatar: res.user.avatar,
          signature: '',
          level: 0
        }
        await fetchUserPlaylists()
        // v3.2.1：登录成功后拉取已喜欢歌曲列表
        fetchLikelist(true)
        return { success: true, message: `登录成功：${res.user.nickname}` }
      }
      return { success: false, message: res.message || '登录失败，请检查手机号和密码' }
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }

  /** v3.0.0：获取二维码登录 key + 二维码图片（新版 API 直接返回 base64 图片） */
  async function getQrKey(): Promise<{ key: string; qrimg: string }> {
    const api = window.electronAPI
    if (!api?.neteaseQrKey) return { key: '', qrimg: '' }
    try {
      const res = await api.neteaseQrKey()
      if (res.success && res.key) {
        qrKey.value = res.key
        qrStatus.value = 801
        qrImage.value = res.qrimg || ''
        return { key: res.key, qrimg: res.qrimg || '' }
      }
    } catch { /* ignore */ }
    return { key: '', qrimg: '' }
  }

  /** 检查二维码登录状态 */
  async function checkQrLogin(): Promise<number> {
    const api = window.electronAPI
    if (!api?.neteaseQrCheck || !qrKey.value) return 0
    try {
      const res = await api.neteaseQrCheck(qrKey.value)
      if (res.success) {
        qrStatus.value = res.code || 0
        if (res.code === 803) {
          // 登录成功，刷新用户信息
          await checkLoginStatus()
          await fetchUserPlaylists()
        }
        return res.code || 0
      }
    } catch { /* ignore */ }
    return 0
  }

  /** 退出网易云登录 */
  async function logoutNetease(): Promise<void> {
    const api = window.electronAPI
    if (api?.neteaseLogout) {
      try { await api.neteaseLogout() } catch { /* ignore */ }
    }
    neteaseLoggedIn.value = false
    neteaseUser.value = null
    userPlaylists.value = []
    currentPlaylistInfo.value = null
    currentPlaylistTracks.value = []
    qrKey.value = ''
    qrStatus.value = 0
    neteaseUserDetail.value = null
    neteaseUserAccount.value = null
    // v3.2.1：退出登录时清空已喜欢歌曲缓存
    likelistLoaded = false
    likedSongIds.value = new Set()
    currentLiked.value = false
  }

  /** 获取用户歌单列表 */
  async function fetchUserPlaylists(): Promise<void> {
    const api = window.electronAPI
    if (!api?.neteaseUserPlaylist || !neteaseUser.value) return
    try {
      const res = await api.neteaseUserPlaylist(neteaseUser.value.id, 100, 0)
      if (res.success && res.playlists) {
        userPlaylists.value = res.playlists
      }
    } catch { /* ignore */ }
  }

  /** 获取歌单详情（歌曲列表） */
  async function fetchPlaylistDetail(id: number): Promise<void> {
    const api = window.electronAPI
    if (!api?.neteasePlaylistDetail) return
    playlistLoading.value = true
    try {
      const res = await api.neteasePlaylistDetail(id)
      if (res.success && res.playlist) {
        currentPlaylistInfo.value = res.playlist
        currentPlaylistTracks.value = res.tracks || []
      }
    } catch { /* ignore */ }
    playlistLoading.value = false
  }

  /** 播放整个歌单（替换当前播放列表）
   *  v3.2.0：修复点击"播放全部"后原歌曲仍播放的问题
   *  - 替换列表前先暂停并释放旧 URL
   *  - 替换后调用 loadCurrent() 设置新的 audio.src 再 play()
   */
  async function playPlaylist(tracks: NetEasePlaylistTrack[]): Promise<void> {
    if (!tracks.length) return
    const api = window.electronAPI
    if (!api?.neteaseSongUrl) return
    try {
      // 批量获取播放地址（每次最多 20 首）
      const allTracks: MusicTrack[] = []
      for (let i = 0; i < tracks.length; i += 20) {
        const batch = tracks.slice(i, i + 20)
        const res = await api.neteaseSongUrl(batch.map(t => t.id), qualityLevel.value)
        const urlMap = new Map((res.urls || []).map(u => [u.id, u.url]))
        for (const t of batch) {
          const url = urlMap.get(t.id)
          if (url) {
            allTracks.push({
              name: t.name,
              url,
              source: 'online',
              id: t.id,
              artist: t.artist,
              album: t.album,
              cover: t.cover
            })
          }
        }
      }
      if (allTracks.length) {
        // v3.2.0：先暂停当前播放，避免新旧音频叠加
        pause()
        // 释放旧列表中的 blob URL
        playlist.value.forEach(t => revokeIfBlob(t.url))
        // 替换播放列表
        playlist.value = allTracks
        currentIndex.value = 0
        // v3.2.0：关键修复 - 必须调用 loadCurrent() 设置新的 audio.src
        loadCurrent()
        // 重置 URL 刷新重试计数
        urlRefreshRetryCount = 0
        await play()
      }
    } catch { /* ignore */ }
  }

  /** 将歌单添加到播放队列末尾 */
  async function addPlaylistToQueue(tracks: NetEasePlaylistTrack[]): Promise<void> {
    if (!tracks.length) return
    const api = window.electronAPI
    if (!api?.neteaseSongUrl) return
    try {
      for (let i = 0; i < tracks.length; i += 20) {
        const batch = tracks.slice(i, i + 20)
        const res = await api.neteaseSongUrl(batch.map(t => t.id), qualityLevel.value)
        const urlMap = new Map((res.urls || []).map(u => [u.id, u.url]))
        for (const t of batch) {
          const url = urlMap.get(t.id)
          if (url) {
            playlist.value.push({
              name: t.name,
              url,
              source: 'online',
              id: t.id,
              artist: t.artist,
              album: t.album,
              cover: t.cover
            })
          }
        }
      }
    } catch { /* ignore */ }
  }

  // ── v3.1.5：热搜列表 ──
  interface HotSearchItem {
    rank: number
    keyword: string
    score: number
    iconUrl: string
  }

  const hotSearchList = ref<HotSearchItem[]>([])
  const hotSearchLoading = ref(false)

  async function fetchHotSearch(): Promise<void> {
    const api = window.electronAPI
    if (!api?.neteaseHotSearch) return
    hotSearchLoading.value = true
    try {
      const res = await api.neteaseHotSearch()
      if (res.success && res.hots) {
        hotSearchList.value = res.hots
      }
    } catch { /* ignore */ }
    hotSearchLoading.value = false
  }

  // ── v3.2.2：网易云云盘歌曲列表 ──
  interface CloudDriveSong {
    id: number
    name: string
    artist: string
    album: string
    cover: string
    duration: number
    fileName?: string
    fileSize?: number
    addTime?: number
    level?: string
  }
  const cloudDriveList = ref<CloudDriveSong[]>([])
  const cloudDriveLoading = ref(false)
  const cloudDriveCount = ref(0)

  // v3.2.3：云盘全量加载——首页拿到 count 后循环拉取剩余分页，逐页累加展示
  async function fetchCloudDrive(pageSize = 100, pageNo = 0): Promise<void> {
    const api = window.electronAPI
    if (!api?.neteaseCloudDrive) return
    cloudDriveLoading.value = true
    try {
      // 第一页：拿到总数 count
      const first = await api.neteaseCloudDrive(pageSize, pageNo)
      if (!first.success || !first.songs) {
        cloudDriveList.value = []
        cloudDriveCount.value = Number(first.count || 0)
        return
      }
      const all: CloudDriveSong[] = [...(first.songs as CloudDriveSong[])]
      const total = Number(first.count || all.length)
      cloudDriveCount.value = total
      cloudDriveList.value = [...all] // 先展示第一页
      // 循环拉取剩余分页
      let loaded = all.length
      let page = pageNo + 1
      while (loaded < total && page < pageNo + 100) { // 安全上限 100 页
        const next = await api.neteaseCloudDrive(pageSize, page)
        if (!next.success || !next.songs || next.songs.length === 0) break
        all.push(...(next.songs as CloudDriveSong[]))
        cloudDriveList.value = [...all] // 逐页刷新，用户可见进度
        loaded += next.songs.length
        page++
      }
      cloudDriveCount.value = all.length
    } catch { /* ignore */ }
    cloudDriveLoading.value = false
  }

  // ── v3.1.5：排行榜 ──
  interface ToplistItem {
    id: number
    name: string
    cover: string
    updateFrequency: string
    description: string
    playCount: number
    topTracks: { name: string; artist: string }[]
  }

  const toplistList = ref<ToplistItem[]>([])
  const toplistLoading = ref(false)
  const currentToplistDetail = ref<NetEasePlaylistTrack[]>([])
  const currentToplistInfo = ref<{ id: number; name: string; cover: string } | null>(null)
  const toplistDetailLoading = ref(false)

  async function fetchToplist(): Promise<void> {
    const api = window.electronAPI
    if (!api?.neteaseToplist) return
    toplistLoading.value = true
    try {
      const res = await api.neteaseToplist()
      if (res.success && res.lists) {
        toplistList.value = res.lists
      }
    } catch { /* ignore */ }
    toplistLoading.value = false
  }

  async function fetchToplistDetail(id: number): Promise<void> {
    const api = window.electronAPI
    if (!api?.neteaseToplistDetail) return
    toplistDetailLoading.value = true
    try {
      const res = await api.neteaseToplistDetail(id)
      if (res.success && res.tracks) {
        currentToplistInfo.value = res.playlist ? { id: res.playlist.id, name: res.playlist.name, cover: res.playlist.cover } : null
        currentToplistDetail.value = res.tracks
      }
    } catch { /* ignore */ }
    toplistDetailLoading.value = false
  }

  // ── v3.1.5：用户详情 ──
  interface NetEaseUserDetail {
    id: number
    nickname: string
    avatar: string
    signature: string
    level: number
    gender: number
    birthday: number
    followeds: number
    follows: number
    playlistCount: number
    listenSongs: number
  }

  // v3.1.6：账号信息
  interface NetEaseUserAccount {
    id: number
    username: string
    nickname: string
    phone: string
    email: string
    vipType: number
    createTime: number
    createDays: number
  }

  const neteaseUserDetail = ref<NetEaseUserDetail | null>(null)
  const userDetailLoading = ref(false)
  const neteaseUserAccount = ref<NetEaseUserAccount | null>(null)
  const userAccountLoading = ref(false)

  async function fetchUserDetail(uid: number): Promise<void> {
    const api = window.electronAPI
    if (!api?.neteaseUserDetail) return
    userDetailLoading.value = true
    try {
      const res = await api.neteaseUserDetail(uid)
      if (res.success && res.user) {
        neteaseUserDetail.value = res.user
      }
    } catch { /* ignore */ }
    userDetailLoading.value = false
  }

  /** 获取当前登录用户账号信息 */
  async function fetchUserAccount(): Promise<void> {
    const api = window.electronAPI
    if (!api?.neteaseUserAccount) return
    userAccountLoading.value = true
    try {
      const res = await api.neteaseUserAccount()
      if (res.success && res.data) {
        neteaseUserAccount.value = res.data as NetEaseUserAccount
      }
    } catch { /* ignore */ }
    userAccountLoading.value = false
  }

  // ── v3.1.6：喜欢音乐 ──

  const currentLiked = ref(false)
  const likingSongId = ref<number | null>(null)
  // v3.1.8：批量缓存歌曲喜欢状态，供列表项展示
  const likedSongIds = ref<Set<number>>(new Set())
  // v3.2.1：likelist 是否已拉取（避免对空集合用户的重复请求）
  let likelistLoaded = false

  // v3.1.9：更新喜欢状态时创建新 Set 触发 Vue 响应式
  function setLiked(songId: number, liked: boolean) {
    const next = new Set(likedSongIds.value)
    if (liked) next.add(songId)
    else next.delete(songId)
    likedSongIds.value = next
  }

  /** v3.2.1：一次性拉取当前用户已喜欢歌曲 ID 列表
   *  - 替代旧 /song/like/check（该接口不存在，导致已喜爱状态始终为 false）
   *  - 使用 /song/like/get（likelist）返回用户全部已喜欢歌曲 ID
   *  - 拉取后重建 likedSongIds 触发列表项与卡片响应式刷新
   */
  async function fetchLikelist(force = false): Promise<void> {
    const api = window.electronAPI
    if (!api?.neteaseLikelist) return
    if (likelistLoaded && !force) return
    try {
      const uid = neteaseUser.value?.id || 0
      const res = await api.neteaseLikelist(uid)
      if (res.success && Array.isArray(res.ids)) {
        likedSongIds.value = new Set(res.ids.map(Number).filter(id => id > 0))
      }
      likelistLoaded = true
    } catch { /* ignore */ }
  }

  /** 获取当前播放歌曲是否已喜欢
   *  v3.2.1：改用 likelist 判断（确保已喜爱歌曲初始即为点亮状态）
   */
  async function checkSongLikeStatus(songId: number): Promise<boolean> {
    if (!songId) return false
    await fetchLikelist()
    const liked = likedSongIds.value.has(songId)
    currentLiked.value = liked
    return liked
  }

  /** 切换歌曲喜欢状态
   *  v3.2.6：乐观更新——点击立即更新本地 UI，API 失败自动回滚
   */
  async function toggleLikeSong(songId: number, currentState?: boolean): Promise<boolean> {
    const api = window.electronAPI
    if (!api?.neteaseLike || !songId) return false
    if (likingSongId.value === songId) return false // 防重复
    likingSongId.value = songId
    const targetLiked = currentState !== undefined ? !currentState : !currentLiked.value
    // v3.2.6：乐观更新——立即变更 UI 状态
    currentLiked.value = targetLiked
    setLiked(songId, targetLiked)
    let ok = false
    try {
      const res = await api.neteaseLike(songId, targetLiked)
      if (res.success) {
        // 以服务端返回状态为准做最终校正（通常与目标一致）
        if (res.liked !== undefined && res.liked !== targetLiked) {
          currentLiked.value = res.liked
          setLiked(songId, res.liked)
        }
        ok = true
      }
    } catch { /* ignore */ }
    finally {
      // v3.2.6：失败时回滚 UI 状态
      if (!ok) {
        currentLiked.value = !targetLiked
        setLiked(songId, !targetLiked)
      }
      likingSongId.value = null
    }
    return ok
  }

  async function likeSong(songId: number, like: boolean): Promise<boolean> {
    return await toggleLikeSong(songId, !like)
  }

  // v3.1.8：列表项喜欢功能

  /** 批量检查歌曲喜欢状态（用于搜索结果/歌单列表渲染时）
   *  v3.2.1：改用 likelist 判断——拉取一次后列表项通过 isSongLiked 响应式读取
   */
  async function checkSongsLiked(songIds: number[]): Promise<void> {
    if (!songIds?.length) return
    await fetchLikelist()
    // likedSongIds 已在 fetchLikelist 中重建触发响应式；列表项的 isSongLiked 会自动更新
  }

  /** 从缓存判断歌曲是否已喜欢 */
  function isSongLiked(songId: number): boolean {
    return likedSongIds.value.has(songId)
  }

  /** 切换任意歌曲的喜欢状态（用于列表项按钮） */
  async function toggleSongLike(songId: number): Promise<boolean> {
    const wasLiked = likedSongIds.value.has(songId)
    const success = await toggleLikeSong(songId, wasLiked)
    return success
  }

  // ── v3.1.8：歌曲评论 ──

  interface NetEaseComment {
    commentId: number
    content: string
    time: number
    likedCount: number
    nickname: string
    avatar: string
    userId: number
    repliedContent: string
    repliedNickname: string
  }

  const currentHotComment = ref<NetEaseComment | null>(null)
  const songComments = ref<NetEaseComment[]>([])
  const commentsLoading = ref(false)
  const commentsTotal = ref(0)
  const currentCommentSongId = ref(0)

  /** 获取歌曲评论（含热门评论） */
  async function fetchSongComments(songId: number, pageNo = 1, pageSize = 20, sortType = 1): Promise<void> {
    const api = window.electronAPI
    if (!api?.neteaseComments || !songId) return
    commentsLoading.value = true
    currentCommentSongId.value = songId
    try {
      const res = await api.neteaseComments(songId, pageNo, pageSize, sortType)
      if (res.success) {
        if (pageNo === 1) {
          currentHotComment.value = res.hotComments?.[0] || null
          songComments.value = [...(res.hotComments || []), ...(res.comments || [])]
        } else {
          songComments.value.push(...(res.comments || []))
        }
        commentsTotal.value = res.total || 0
      }
    } catch { /* ignore */ }
    commentsLoading.value = false
  }

  /** 清空评论数据 */
  function clearComments(): void {
    currentHotComment.value = null
    songComments.value = []
    commentsTotal.value = 0
    currentCommentSongId.value = 0
  }

  // ── v3.2.0：评论点赞 ──

  // 已点赞评论 ID 缓存（响应式 Set）
  const likedCommentIds = ref<Set<number>>(new Set())
  const likingCommentId = ref<number | null>(null)

  /** 判断评论是否已点赞 */
  function isCommentLiked(commentId: number): boolean {
    return likedCommentIds.value.has(commentId)
  }

  /** 更新评论点赞状态（创建新 Set 触发响应式） */
  function setCommentLiked(commentId: number, liked: boolean) {
    const next = new Set(likedCommentIds.value)
    if (liked) next.add(commentId)
    else next.delete(commentId)
    likedCommentIds.value = next
  }

  /** 切换评论点赞状态
   *  v3.2.0：调用 /comment/like 接口
   *  v3.2.1：修复点赞按钮不能再次选中——likingCommentId 未在结束时重置导致按钮永久禁用
   *  v3.2.6：乐观更新——点击立即变更 UI 状态，失败自动回滚
   */
  async function toggleCommentLike(commentId: number, currentLiked: boolean): Promise<boolean> {
    const api = window.electronAPI
    if (!api?.neteaseCommentLike) return false
    const songId = currentCommentSongId.value
    if (!songId || !commentId) return false
    if (likingCommentId.value === commentId) return false // 防重复
    likingCommentId.value = commentId
    const nextState = !currentLiked
    const delta = nextState ? 1 : -1
    // v3.2.6：乐观更新——立即变更本地状态与计数
    setCommentLiked(commentId, nextState)
    const applyDeltaToComments = (d: number) => {
      const updateComment = (c: NetEaseComment) => {
        if (c.commentId === commentId) {
          c.likedCount = Math.max(0, c.likedCount + d)
        }
      }
      songComments.value.forEach(updateComment)
      if (currentHotComment.value && currentHotComment.value.commentId === commentId) {
        currentHotComment.value = {
          ...currentHotComment.value,
          likedCount: Math.max(0, currentHotComment.value.likedCount + d)
        }
      }
    }
    applyDeltaToComments(delta)
    let ok = false
    try {
      const res = await api.neteaseCommentLike(songId, commentId, nextState)
      ok = !!res.success
    } catch { /* ignore */ }
    finally {
      // v3.2.6：失败时回滚 UI 状态与计数
      if (!ok) {
        setCommentLiked(commentId, currentLiked)
        applyDeltaToComments(-delta) // 撤销计数变更
      }
      // v3.2.1：必须复位，否则按钮 :disabled 永久为 true
      likingCommentId.value = null
    }
    return ok
  }

  // ── v3.1.3：心动模式（一键播放喜欢歌单的随机歌曲） ──

  const heartbeatMode = ref(false)

  /** 从用户歌单中找到"我喜欢的音乐"歌单 */
  function findLikedPlaylist(): NetEasePlaylist | null {
    if (!userPlaylists.value.length) return null
    // 优先匹配名称包含"喜欢"的歌单
    const liked = userPlaylists.value.find(p => p.name.includes('喜欢'))
    if (liked) return liked
    // 退而求其次：用户创建的第一个歌单（通常就是喜欢的音乐）
    return userPlaylists.value[0]
  }

  /** Fisher-Yates 随机打乱数组 */
  function shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  /**
   * v3.1.5：开启心动模式（使用官方 intelligence list API）
   * v3.2.0：修复 intelligence list API 参数错误，并支持无当前曲目时自动选取
   * 1. 确保已登录并获取用户歌单
   * 2. 找到"我喜欢的音乐"歌单
   * 3. 获取当前播放歌曲 ID（若无则取歌单第一首作为起始种子）
   * 4. 调用 /playmode/intelligence/list 获取智能推荐列表
   * 5. 降级：获取歌单全部歌曲并随机打乱
   * 6. 批量获取播放地址并替换播放列表
   */
  async function startHeartbeatMode(): Promise<{ success: boolean; message: string }> {
    const api = window.electronAPI
    if (!api?.neteaseSongUrl || !api?.neteasePlaylistDetail) {
      return { success: false, message: '网易云 API 不可用' }
    }
    // 确保已登录
    if (!neteaseLoggedIn.value) {
      const ok = await checkLoginStatus()
      if (!ok) return { success: false, message: '请先登录网易云音乐' }
    }
    // 确保有歌单列表
    if (!userPlaylists.value.length) {
      await fetchUserPlaylists()
    }
    const likedPlaylist = findLikedPlaylist()
    if (!likedPlaylist) {
      return { success: false, message: '未找到喜欢的歌单' }
    }

    // v3.2.0：获取种子歌曲 ID（当前播放曲目或歌单第一首）
    let seedSongId = currentTrack.value?.id || 0
    let likedPlaylistTracks: NetEasePlaylistTrack[] = []
    if (!seedSongId) {
      // 无当前曲目时，获取歌单第一首作为种子
      const detailRes = await api.neteasePlaylistDetail(likedPlaylist.id)
      if (detailRes.success && detailRes.tracks?.length) {
        likedPlaylistTracks = detailRes.tracks as NetEasePlaylistTrack[]
        seedSongId = likedPlaylistTracks[0].id
      }
    }
    if (!seedSongId) {
      return { success: false, message: '无法确定种子歌曲，请先播放一首歌曲' }
    }

    // v3.2.0：调用官方 intelligence list API（参数已修复）
    let tracks: NetEasePlaylistTrack[] = []
    let usedIntelligenceApi = false

    if (api.neteaseIntelligenceList) {
      try {
        const intelRes = await api.neteaseIntelligenceList(seedSongId, likedPlaylist.id)
        if (intelRes.success && intelRes.songs?.length) {
          tracks = intelRes.songs as NetEasePlaylistTrack[]
          usedIntelligenceApi = true
        }
      } catch { /* fallthrough to legacy method */ }
    }

    // 降级：获取歌单详情并随机打乱
    if (!tracks.length) {
      if (!likedPlaylistTracks.length) {
        const detailRes = await api.neteasePlaylistDetail(likedPlaylist.id)
        if (!detailRes.success || !detailRes.tracks?.length) {
          return { success: false, message: '获取歌单歌曲失败' }
        }
        likedPlaylistTracks = detailRes.tracks as NetEasePlaylistTrack[]
      }
      const shuffled = shuffleArray(likedPlaylistTracks)
      tracks = shuffled.slice(0, 100)
    }

    try {
      const allTracks: MusicTrack[] = []
      for (let i = 0; i < tracks.length; i += 20) {
        const batch = tracks.slice(i, i + 20)
        const res = await api.neteaseSongUrl(batch.map(t => t.id), qualityLevel.value)
        const urlMap = new Map((res.urls || []).map(u => [u.id, u.url]))
        for (const t of batch) {
          const url = urlMap.get(t.id)
          if (url) {
            allTracks.push({
              name: t.name,
              url,
              source: 'online',
              id: t.id,
              artist: t.artist,
              album: t.album,
              cover: t.cover
            })
          }
        }
      }
      if (!allTracks.length) {
        return { success: false, message: '未获取到可用的播放地址' }
      }
      // 替换播放列表并播放
      pause()
      playlist.value.forEach(t => revokeIfBlob(t.url))
      playlist.value = allTracks
      currentIndex.value = 0
      // v3.2.0：调用 loadCurrent() 设置新的 audio.src
      loadCurrent()
      urlRefreshRetryCount = 0
      heartbeatMode.value = true
      await play()
      const modeHint = usedIntelligenceApi ? '智能推荐' : '随机播放'
      return { success: true, message: `心动模式已开启（${modeHint}）：${likedPlaylist.name}（${allTracks.length}首）` }
    } catch (err) {
      return { success: false, message: '加载歌曲失败：' + String(err) }
    }
  }

  // ── v3.5.3：歌曲下载URL获取（高音质） ──

  /** 获取歌曲下载URL（支持指定音质等级） */
  async function downloadSongUrl(songId: number, level?: string): Promise<{ success: boolean; url?: string; level?: string; size?: number; type?: string; message?: string }> {
    const api = window.electronAPI
    if (!api?.neteaseDownloadUrl) return { success: false, message: 'API 不可用' }
    try {
      const res = await api.neteaseDownloadUrl(songId, level || qualityLevel.value)
      return res
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }

  /** 主进程下载歌曲（控制文件名） */
  async function downloadSong(songId: number, artist: string, name: string, level?: string): Promise<{ success: boolean; filePath?: string; lyricPath?: string; level?: string; size?: number; type?: string; message?: string }> {
    const api = window.electronAPI
    if (!api?.neteaseDownloadSong) return { success: false, message: 'API 不可用' }
    try {
      const res = await api.neteaseDownloadSong(songId, artist, name, level || qualityLevel.value)
      return res
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }

  // ── v3.6.3：云盘本地上传 + 批量下载 ──

  /** 云盘本地上传：选择本地音频文件上传到网易云云盘 */
  async function cloudUploadFiles(): Promise<{ success: boolean; canceled?: boolean; total?: number; successCount?: number; failCount?: number; failed?: string[]; message?: string }> {
    const api = window.electronAPI
    if (!api?.neteaseCloudUploadFiles) return { success: false, message: 'API 不可用' }
    try {
      return await api.neteaseCloudUploadFiles()
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }

  /** 批量下载：所选歌曲一键下载到选定目录（音频 + 同目录 .lrc） */
  async function batchDownloadSongs(songs: { id: number; name: string; artist: string }[]): Promise<{ success: boolean; canceled?: boolean; total?: number; successCount?: number; failCount?: number; failed?: { id: number; name: string }[]; dir?: string; message?: string }> {
    const api = window.electronAPI
    if (!api?.neteaseBatchDownload) return { success: false, message: 'API 不可用' }
    try {
      return await api.neteaseBatchDownload(songs)
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }

  /** 获取歌曲歌词 */
  async function getSongLyric(songId: number): Promise<{ success: boolean; lyric?: string; message?: string }> {
    const api = window.electronAPI
    if (!api?.neteaseLyric) return { success: false, message: 'API 不可用' }
    try {
      const res = await api.neteaseLyric(songId)
      if (res.success && res.lyric) {
        return { success: true, lyric: res.lyric }
      }
      return { success: false, message: '无歌词' }
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }

  // ── v3.5.3：云盘快传（无需文件转存） ──

  /** 批量快传歌曲到云盘（通过歌曲ID获取文件信息后导入；songInfo 可选，提供真实名称用于导入） */
  async function quickUploadSongs(songInfos: Array<{ id: number; name?: string; artist?: string; album?: string }>, level?: string): Promise<{ success: boolean; message: string; results?: any[] }> {
    const api = window.electronAPI
    if (!api?.neteaseDownloadUrl || !api?.neteaseCloudUploadCheck || !api?.neteaseCloudSongImport || !api?.neteaseCloudSongMatch) {
      return { success: false, message: 'API 不可用' }
    }
    try {
      const songIds = songInfos.map((s) => Number(s.id)).filter((id) => id > 0)
      if (songIds.length === 0) return { success: false, message: '没有可操作的歌曲' }
      const metaById: Record<number, { name: string; artist: string; album: string }> = {}
      songInfos.forEach((s) => {
        metaById[Number(s.id)] = { name: String(s?.name ?? ''), artist: String(s?.artist ?? ''), album: String(s?.album ?? '') }
      })
      const results: any[] = []
      // 第一步：获取歌曲文件信息（md5、size等）- 使用 downloadUrl 接口获取完整信息
      const fileInfos: any[] = []
      for (const songId of songIds) {
        const info = await api.neteaseDownloadUrl(songId, level || qualityLevel.value)
        if (info.success && info.md5 && info.url) {
          fileInfos.push({
            songId,
            md5: info.md5,
            size: info.size || 0,
            br: info.br || 128000,
            url: info.url,
            type: info.type || 'mp3'
          })
        }
      }

      if (fileInfos.length === 0) {
        return { success: false, message: '无法获取歌曲文件信息' }
      }

      // 第二步：批量检查 + 导入。分批进行（每批 BATCH 首），避免单次接口请求过大被拒
      const BATCH = 100
      let uploadedCount = 0
      let firstFailMessage = ''
      // 单首导入（导入成功且需要匹配时自动纠正关联）
      const importOne = async (d: any, fileInfo: any): Promise<boolean> => {
        const meta = metaById[d.songId] || { name: '', artist: '', album: '' }
        const name = meta.name || `song_${d.songId}`
        const artist = meta.artist
        const fileName = `${name}${artist ? ' - ' + artist : ''}.${fileInfo?.type || 'mp3'}`.replace(/[\\/:*?"<>|]/g, '_')
        const imp = await api.neteaseCloudSongImport([{
          songId: d.songId,
          bitrate: Math.floor((fileInfo?.br || 128000) / 1000),
          song: name,
          artist,
          album: meta.album,
          fileName
        }])
        if (!imp.success) return false
        const ss = imp.data?.successSongs || []
        if (ss.length) {
          const song = ss[0]
          if (song.song?.songId && song.song?.songId !== song.songId) {
            try { await api.neteaseCloudSongMatch(song.song.songId, song.songId) } catch { /* 关联失败不影响上传 */ }
          }
          results.push({ songId: song.songId, success: true })
        }
        return true
      }
      for (let i = 0; i < fileInfos.length; i += BATCH) {
        const chunk = fileInfos.slice(i, i + BATCH)
        const checkData = chunk.map((u: any) => ({
          md5: u.md5,
          songId: u.songId,
          bitrate: Math.floor(u.br / 1000),
          fileSize: u.size || 0
        }))
        let chunkCheck: any
        try {
          chunkCheck = await api.neteaseCloudUploadCheck(checkData)
        } catch (e) {
          chunkCheck = { success: false, message: String(e) }
        }
        if (!chunkCheck.success || !chunkCheck.data) {
          // 整批失败：记录原因，并逐首回退尝试，尽量补上能成功的
          firstFailMessage = firstFailMessage || (chunkCheck.message || '检查云盘状态失败')
          for (const u of chunk) {
            try {
              const one = await api.neteaseCloudUploadCheck([{
                md5: u.md5, songId: u.songId, bitrate: Math.floor(u.br / 1000), fileSize: u.size || 0
              }])
              if (one.success && one.data && one.data[0]?.upload === 1) {
                const ok = await importOne(one.data[0], u)
                if (ok) uploadedCount++
              }
            } catch { /* 单首检查失败忽略 */ }
          }
          continue
        }
        const needUpload = chunkCheck.data.filter((d: any) => d.upload === 1)
        for (const d of needUpload) {
          const fileInfo = chunk.find((u: any) => u.songId === d.songId)
          const ok = await importOne(d, fileInfo)
          if (ok) uploadedCount++
        }
      }

      if (uploadedCount === 0 && firstFailMessage) {
        return { success: false, message: firstFailMessage }
      }
      return { success: true, message: `成功快传 ${uploadedCount} 首歌曲到云盘`, results }
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }

  // ── v3.5.3：云盘匹配纠正 ──

  /** 纠正云盘歌曲匹配（将云盘歌曲关联到正确的歌曲ID） */
  async function matchCloudSong(cloudSongId: number, targetSongId: number): Promise<{ success: boolean; message: string }> {
    const api = window.electronAPI
    if (!api?.neteaseCloudSongMatch) return { success: false, message: 'API 不可用' }
    try {
      const res = await api.neteaseCloudSongMatch(cloudSongId, targetSongId)
      return { success: res.success, message: res.message || (res.success ? '匹配成功' : '匹配失败') }
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }

  /** 删除云盘歌曲 */
  async function deleteCloudSongs(songIds: number[]): Promise<{ success: boolean; message: string }> {
    const api = window.electronAPI
    if (!api?.neteaseCloudSongDelete) return { success: false, message: 'API 不可用' }
    try {
      const res = await api.neteaseCloudSongDelete(songIds)
      if (res.success) {
        // 更新本地云盘列表
        cloudDriveList.value = cloudDriveList.value.filter(s => !songIds.includes(s.id))
        cloudDriveCount.value = Math.max(0, cloudDriveCount.value - songIds.length)
      }
      return { success: res.success, message: res.success ? `成功删除 ${songIds.length} 首歌曲` : '删除失败' }
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }

  return {
    playlist,
    currentIndex,
    isPlaying,
    volume,
    shuffle,
    qualityLevel,
    setQualityLevel,
    currentTrack,
    hasMusic,
    lyricLines,
    currentLyricIndex,
    showLyrics,
    currentTime,
    duration,
    searchResults,
    searchLoading,
    searchKeyword,
    isAudioName,
    // v2.9.2：网易云登录与歌单
    neteaseLoggedIn,
    neteaseUser,
    userPlaylists,
    currentPlaylistInfo,
    currentPlaylistTracks,
    playlistLoading,
    qrKey,
    qrStatus,
    qrImage,
    pickFiles,
    pickFolder,
    play,
    pause,
    toggle,
    toggleShuffle,
    toggleLyrics,
    playIndex,
    next,
    prev,
    removeTrack,
    clearPlaylist,
    setVolume,
    seek,
    loadLyric,
    searchOnline,
    playOnlineSong,
    addOnlineSong,
    // v2.9.2：网易云登录与歌单方法
    checkLoginStatus,
    setNeteaseCookie,
    loginPhone,
    getQrKey,
    checkQrLogin,
    logoutNetease,
    fetchUserPlaylists,
    fetchPlaylistDetail,
    playPlaylist,
    addPlaylistToQueue,
    // v3.1.3：心动模式
    heartbeatMode,
    startHeartbeatMode,
    // v3.1.5：热搜列表
    hotSearchList,
    hotSearchLoading,
    fetchHotSearch,
    // v3.2.2：网易云云盘
    cloudDriveList,
    cloudDriveLoading,
    cloudDriveCount,
    fetchCloudDrive,
    // v3.1.5：排行榜
    toplistList,
    toplistLoading,
    currentToplistDetail,
    currentToplistInfo,
    toplistDetailLoading,
    fetchToplist,
    fetchToplistDetail,
    // v3.1.5：用户详情
    neteaseUserDetail,
    userDetailLoading,
    fetchUserDetail,
    // v3.1.6：账号信息
    neteaseUserAccount,
    userAccountLoading,
    fetchUserAccount,
    // v3.1.6：喜欢音乐
    currentLiked,
    likingSongId,
    checkSongLikeStatus,
    toggleLikeSong,
    likeSong,
    // v3.2.1：喜欢歌曲列表
    fetchLikelist,
    // v3.1.8：列表项喜欢 + 歌曲评论
    likedSongIds,
    checkSongsLiked,
    isSongLiked,
    toggleSongLike,
    currentHotComment,
    songComments,
    commentsLoading,
    commentsTotal,
    currentCommentSongId,
    fetchSongComments,
    clearComments,
    // v3.2.0：评论点赞
    likedCommentIds,
    likingCommentId,
    isCommentLiked,
    toggleCommentLike,
    // v3.5.3：歌曲下载与云盘快传
    downloadSongUrl,
    downloadSong,
    getSongLyric,
    quickUploadSongs,
    matchCloudSong,
    deleteCloudSongs,
    // v3.6.3：云盘本地上传 + 批量下载
    cloudUploadFiles,
    batchDownloadSongs
  }
})
