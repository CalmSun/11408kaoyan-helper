import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface MusicTrack {
  name: string
  url: string // 本地文件的 object URL
}

/** 可识别的音频扩展名 */
const AUDIO_EXTS = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'opus']

/**
 * 全局本地音乐播放器（v2.7.0 引入，v2.7.1 增强）
 * - 支持多选本地音频文件（mp3/flac/wav/ogg/m4a 等）构建播放列表
 * - v2.7.1：支持选择音乐文件夹（Electron 环境递归读取目录内全部音频）
 * - 播放/暂停/上一首/下一首/指定播放/音量/自动续播/移除曲目
 * - 仅播放本地文件，不联网、不上传
 */
export const useMusicStore = defineStore('music', () => {
  const audio = new Audio()
  audio.preload = 'metadata'

  const playlist = ref<MusicTrack[]>([])
  const currentIndex = ref(0)
  const isPlaying = ref(false)
  const volume = ref(0.7)

  const currentTrack = computed<MusicTrack | null>(
    () => playlist.value[currentIndex.value] ?? null
  )

  const hasMusic = computed(() => playlist.value.length > 0)

  audio.volume = volume.value

  // 自动续播
  audio.addEventListener('ended', () => {
    if (playlist.value.length > 1) {
      next()
    } else {
      isPlaying.value = false
    }
  })

  function applyVolume() {
    audio.volume = volume.value
  }

  function setVolume(v: number) {
    volume.value = Math.min(1, Math.max(0, v))
    applyVolume()
  }

  /** 判断文件名是否为音频 */
  function isAudioName(name: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    return AUDIO_EXTS.includes(ext)
  }

  /** 释放 blob 地址（kaoyan-music:// 协议地址无需释放，v2.8.0） */
  function revokeIfBlob(url: string) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  }

  /** 替换播放列表（释放旧 object URL） */
  function setPlaylist(tracks: MusicTrack[]) {
    playlist.value.forEach(t => revokeIfBlob(t.url))
    playlist.value = tracks
    currentIndex.value = 0
    loadCurrent()
  }

  /** 打开本地文件选择器（多选音频） */
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
        setPlaylist(files.map(f => ({ name: f.name, url: URL.createObjectURL(f) })))
        resolve(files.length)
      }
      input.click()
    })
  }

  /**
   * 选择音乐文件夹并加载其中全部音频（v2.7.1 引入，v2.8.0 优化）
   * v2.8.0：主进程仅返回文件名清单与播放协议地址，播放时由协议按需流式读取，
   * 大文件夹不再把全部文件内容读入内存（此前会占用大量存储/内存）
   */
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
    setPlaylist(files.map(f => ({ name: f.name, url: f.url })))
    return files.length
  }

  function loadCurrent() {
    const track = currentTrack.value
    if (!track) return
    audio.src = track.url
  }

  async function play() {
    if (!currentTrack.value) return
    applyVolume()
    try {
      await audio.play()
      isPlaying.value = true
    } catch {
      isPlaying.value = false
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

  /** 跳转到指定曲目播放（v2.7.1：播放列表选择） */
  function playIndex(index: number) {
    if (index < 0 || index >= playlist.value.length) return
    currentIndex.value = index
    loadCurrent()
    play()
  }

  function next() {
    if (playlist.value.length === 0) return
    currentIndex.value = (currentIndex.value + 1) % playlist.value.length
    loadCurrent()
    if (isPlaying.value) play()
  }

  function prev() {
    if (playlist.value.length === 0) return
    currentIndex.value = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length
    loadCurrent()
    if (isPlaying.value) play()
  }

  /** 移除指定曲目（v2.7.1） */
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

  /** 清空播放列表 */
  function clearPlaylist() {
    pause()
    playlist.value.forEach(t => revokeIfBlob(t.url))
    playlist.value = []
    currentIndex.value = 0
    audio.removeAttribute('src')
  }

  return {
    playlist,
    currentIndex,
    isPlaying,
    volume,
    currentTrack,
    hasMusic,
    isAudioName,
    pickFiles,
    pickFolder,
    play,
    pause,
    toggle,
    playIndex,
    next,
    prev,
    removeTrack,
    clearPlaylist,
    setVolume
  }
})
