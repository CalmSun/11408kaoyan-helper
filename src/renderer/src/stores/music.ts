import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface MusicTrack {
  name: string
  url: string // 本地文件的 object URL
}

/**
 * 全局本地音乐播放器（v2.7.0）
 * - 支持多选本地音频文件（mp3/flac/wav/ogg/m4a 等）构建播放列表
 * - 播放/暂停/上一首/下一首/音量/自动续播
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
        // 释放旧的 object URL
        playlist.value.forEach(t => URL.revokeObjectURL(t.url))
        playlist.value = files.map(f => ({ name: f.name, url: URL.createObjectURL(f) }))
        currentIndex.value = 0
        loadCurrent()
        resolve(files.length)
      }
      input.click()
    })
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

  return {
    playlist,
    currentIndex,
    isPlaying,
    volume,
    currentTrack,
    hasMusic,
    pickFiles,
    play,
    pause,
    toggle,
    next,
    prev,
    setVolume
  }
})
