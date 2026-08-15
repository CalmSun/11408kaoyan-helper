<template>
  <div class="materials-page">
    <div class="materials-header">
      <h2 class="page-title">
        <el-icon><Folder /></el-icon>
        学习资料
      </h2>
      <div class="materials-actions">
        <el-button size="small" type="primary" @click="pickFolder">
          <el-icon><FolderOpened /></el-icon> 选择资料文件夹
        </el-button>
        <el-button size="small" @click="refreshList" :disabled="!materialsFolder">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
        <span v-if="materialsFolder" class="folder-path">{{ materialsFolder }}</span>
      </div>
    </div>

    <div class="materials-body" v-if="flatFiles.length > 0">
      <!-- 文件树 -->
      <div class="file-list glass-card">
        <h3 class="section-title">
          <el-icon><Document /></el-icon>
          文件列表
          <span class="file-count">{{ totalFileCount }} 个文件</span>
        </h3>
        <div class="file-filter">
          <el-radio-group v-model="filterType" size="small">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="pdf">PDF</el-radio-button>
            <el-radio-button value="video">视频</el-radio-button>
            <el-radio-button value="other">其他</el-radio-button>
          </el-radio-group>
        </div>
        <div class="file-tree">
          <div
            v-for="node in displayNodes"
            :key="node.path"
            class="tree-node"
            :style="{ paddingLeft: (node.level * 16 + 8) + 'px' }"
          >
            <!-- 文件夹 -->
            <div
              v-if="node.type === 'folder'"
              class="tree-folder"
              @click="toggleFolder(node.path)"
            >
              <el-icon class="folder-arrow" :class="{ expanded: expandedFolders.has(node.path) }">
                <ArrowRight />
              </el-icon>
              <el-icon class="folder-icon"><FolderOpened /></el-icon>
              <span class="folder-name">{{ node.name }}</span>
              <span class="folder-count">{{ countFilesInFolder(node) }} 个</span>
            </div>
            <!-- 文件 -->
            <div
              v-else
              class="file-item"
              :class="{ active: currentFile?.url === node.url }"
              @click="openFile(node)"
            >
              <div class="file-icon" :class="getIconClass(node.ext || '')">
                <el-icon v-if="node.ext === '.pdf'"><Document /></el-icon>
                <el-icon v-else-if="isVideo(node.ext || '')"><VideoPlay /></el-icon>
                <el-icon v-else><Files /></el-icon>
              </div>
              <div class="file-info">
                <div class="file-name" :title="node.name">{{ node.name }}</div>
                <div class="file-size">{{ formatSize(node.size || 0) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 预览区 -->
      <div class="file-preview glass-card">
        <h3 class="section-title">
          <el-icon><View /></el-icon>
          <span class="preview-title-name">{{ currentFile?.name || '选择文件预览' }}</span>
          <el-button
            v-if="currentFile"
            size="small"
            link
            type="primary"
            class="open-external-btn"
            @click="openExternal"
            title="使用系统默认应用打开此文件"
          >
            <el-icon><Open /></el-icon> 默认应用打开
          </el-button>
        </h3>
        <div class="preview-container" v-if="currentFile">
          <!-- PDF 预览（v3.3.1：原生 PDFium + 加载指示/错误处理/切换时释放内存） -->
          <div v-if="currentFile.ext === '.pdf'" class="pdf-wrap">
            <iframe
              v-if="pdfVisible"
              :src="pdfSrc"
              class="pdf-viewer"
              @load="onPdfLoaded"
              @error="onPdfError"
            />
            <div v-if="pdfLoading" class="pdf-loading-mask">
              <el-icon class="is-loading" :size="40"><Loading /></el-icon>
              <span>PDF 加载中...</span>
            </div>
            <div v-if="pdfError" class="pdf-error-mask">
              <el-icon :size="40"><Warning /></el-icon>
              <span>PDF 加载失败</span>
              <el-button size="small" type="primary" @click="retryPdf">重试</el-button>
            </div>
          </div>
          <!-- 视频播放（v3.0.0：支持音量调节/全屏/进度拖动，Range 协议加速加载；v3.2.2：美化 UI + 修复音量过低 + 增强无声检测） -->
          <div v-else-if="isVideo(currentFile.ext)" class="video-wrap" ref="videoWrap">
            <div class="video-stage">
              <video
                ref="videoEl"
                :src="currentFile.url"
                class="video-player"
                preload="metadata"
                playsinline
                @timeupdate="onVideoTimeUpdate"
                @loadedmetadata="onVideoLoaded"
                @ended="videoPlaying = false"
                @error="onVideoError"
                @click="toggleVideoPlay"
                @waiting="videoLoading = true"
                @playing="videoLoading = false; videoPlaying = true"
                @canplay="videoLoading = false"
                @pause="videoPlaying = false"
              />
              <!-- v3.2.2：加载中的 spinner 遮罩 -->
              <div v-if="videoLoading" class="video-loading-mask">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <span>视频加载中...</span>
              </div>
              <!-- v3.2.2：居中播放按钮（暂停态显示） -->
              <div v-if="!videoPlaying && !videoLoading" class="video-center-play" @click.stop="toggleVideoPlay">
                <div class="center-play-btn">
                  <el-icon :size="40"><VideoPlay /></el-icon>
                </div>
              </div>
            </div>
            <!-- v3.1.2：音频编码不支持警告 -->
            <div v-if="audioWarning" class="audio-warning">{{ audioWarning }}</div>
            <!-- v3.0.0：自定义视频控制栏（v3.2.2：美化 + 缓冲进度 + 增益调节；v3.2.3：增加 -10s/+10s 前进后退 + 音量无极调节） -->
            <div class="video-controls" @keydown.stop>
              <button class="video-ctrl-btn" @click="toggleVideoPlay" :title="videoPlaying ? '暂停 (空格)' : '播放 (空格)'">
                <el-icon v-if="videoPlaying">⏸</el-icon>
                <el-icon v-else>▶</el-icon>
              </button>
              <!-- v3.2.3：快退 / 快进 10 秒 -->
              <button class="video-ctrl-btn seek-btn" @click="seekRelative(-10)" title="快退 10 秒 (←)">
                <el-icon>⏪</el-icon>
              </button>
              <button class="video-ctrl-btn seek-btn" @click="seekRelative(10)" title="快进 10 秒 (→)">
                <el-icon>⏩</el-icon>
              </button>
              <span class="video-time">{{ formatTime(videoCurrent) }}</span>
              <div class="video-progress-wrap">
                <div class="video-progress-buffered" :style="{ width: bufferedPercent + '%' }"></div>
                <input
                  type="range"
                  class="video-progress"
                  :min="0"
                  :max="videoDuration || 100"
                  :step="0.1"
                  :value="videoCurrent"
                  @input="onVideoSeek"
                />
              </div>
              <span class="video-time">{{ formatTime(videoDuration) }}</span>
              <!-- 音量控制 -->
              <button class="video-ctrl-btn" @click="toggleMute" :title="videoMuted ? '取消静音' : '静音'">
                <el-icon v-if="videoMuted || videoVolume === 0">🔇</el-icon>
                <el-icon v-else-if="videoVolume < 50">🔉</el-icon>
                <el-icon v-else>🔊</el-icon>
              </button>
              <input
                type="range"
                class="video-volume"
                :min="0"
                :max="100"
                :step="0.1"
                v-model="videoVolume"
                @input="onVolumeChange"
                title="音量 (↑/↓)"
              />
              <!-- v3.2.2：数字增益（提升音量） -->
              <select class="video-gain" :value="videoGain" @change="(e) => { videoGain = Number((e.target as HTMLSelectElement).value); applyVolumeAndGain() }">
                <option :value="1">1x</option>
                <option :value="1.5">1.5x</option>
                <option :value="1.8">1.8x</option>
                <option :value="2.5">2.5x</option>
                <option :value="4">4x</option>
              </select>
              <!-- 倍速 -->
              <select class="video-speed" v-model="videoSpeed" @change="onVideoSpeedChange">
                <option value="0.5">0.5x</option>
                <option value="1">1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>
              <!-- 全屏 -->
              <button class="video-ctrl-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'">
                <el-icon>{{ isFullscreen ? '🗗' : '⛶' }}</el-icon>
              </button>
            </div>
          </div>
          <!-- 图片预览 -->
          <img
            v-else-if="isImage(currentFile.ext)"
            :src="currentFile.url"
            class="image-viewer"
          />
          <!-- 其他文件 -->
          <div v-else class="unsupported">
            <el-icon :size="48"><Warning /></el-icon>
            <p>该文件类型暂不支持在线预览</p>
            <el-button type="primary" @click="downloadFile">下载文件</el-button>
          </div>
        </div>
        <div v-else class="preview-empty">
          <el-icon :size="48"><Document /></el-icon>
          <p>从左侧选择文件进行预览</p>
          <p class="hint">支持 PDF 阅读、MP4 视频播放（进度可拖动调节）</p>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state glass-card">
      <el-icon :size="64"><FolderOpened /></el-icon>
      <h3>暂无资料</h3>
      <p>选择一个包含 PDF、MP4 等文件的文件夹</p>
      <el-button type="primary" @click="pickFolder">
        <el-icon><FolderOpened /></el-icon> 选择资料文件夹
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Folder, FolderOpened, Refresh, Document, VideoPlay, Files,
  View, Warning, ArrowRight, Loading, Open
} from '@element-plus/icons-vue'

// v2.9.2：使用全局 MaterialNode 类型（树形结构）
interface DisplayNode extends MaterialNode {
  level: number
}

const fileTree = ref<MaterialNode[]>([])
const materialsFolder = ref('')
const currentFile = ref<MaterialNode | null>(null)
const filterType = ref('all')
const expandedFolders = ref<Set<string>>(new Set())

// v3.0.0：视频控制（含音量/全屏）
const videoEl = ref<HTMLVideoElement | null>(null)
const videoWrap = ref<HTMLElement | null>(null)
const videoCurrent = ref(0)
const videoDuration = ref(0)
const videoPlaying = ref(false)
const videoSpeed = ref(1)
// v3.2.2：修复音量过低——默认 100，并叠加 Web Audio 数字增益 1.8x 解决部分视频音量太小的问题
const videoVolume = ref(100)
const videoMuted = ref(false)
const videoGain = ref(1.8)
// v3.1.2：音频编码不支持警告
const audioWarning = ref('')
const isFullscreen = ref(false)
// v3.2.2：视频加载状态 + 美化（进度条缓冲显示）
const videoBuffered = ref(0)
const videoLoading = ref(false)
// v3.2.2：Web Audio 增益节点（用于提升音量）
let audioCtx: AudioContext | null = null
let gainNode: GainNode | null = null
let videoSourceNode: MediaElementAudioSourceNode | null = null
// v3.3.1：记录已接入增益链路的 video 元素——createMediaElementSource 每个元素仅能调用一次，
// 需据此判断是「同元素复用链路」还是「新元素需重建链路」
let attachedVideoEl: HTMLVideoElement | null = null

// v3.3.1：PDF 加载状态管理（借鉴 vue-pdf 的懒加载/显式释放模式，但保留原生 PDFium 的高效渲染）
const pdfVisible = ref(false)
const pdfLoading = ref(false)
const pdfError = ref(false)
// PDF URL 加上视图参数：FitH=按宽度适配、toolbar=1显示工具栏、page=1首页
const pdfSrc = computed(() => {
  if (!currentFile.value?.url) return ''
  return `${currentFile.value.url}#view=FitH&toolbar=1&page=1`
})

const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv']
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

// v3.2.2：缓冲百分比
const bufferedPercent = computed(() => {
  const dur = videoDuration.value || 0
  if (!dur) return 0
  return Math.max(0, Math.min(100, (videoBuffered.value / dur) * 100))
})

// v2.9.2：将树扁平化为显示列表（考虑展开状态和筛选）
const flatFiles = computed<DisplayNode[]>(() => {
  const result: DisplayNode[] = []
  function walk(nodes: MaterialNode[], level: number) {
    for (const node of nodes) {
      if (node.type === 'folder') {
        // 筛选模式下：只显示包含匹配文件的文件夹
        if (filterType.value !== 'all') {
          const hasMatch = folderHasMatchingFiles(node)
          if (!hasMatch) continue
        }
        result.push({ ...node, level })
        if (expandedFolders.value.has(node.path) && node.children) {
          walk(node.children, level + 1)
        }
      } else {
        // 文件筛选
        if (filterType.value === 'pdf' && node.ext !== '.pdf') continue
        if (filterType.value === 'video' && !isVideo(node.ext || '')) continue
        if (filterType.value === 'other' && (node.ext === '.pdf' || isVideo(node.ext || ''))) continue
        result.push({ ...node, level })
      }
    }
  }
  walk(fileTree.value, 0)
  return result
})

// 显示节点（筛选后）
const displayNodes = computed(() => flatFiles.value)

// 总文件数
const totalFileCount = computed(() => {
  let count = 0
  function walk(nodes: MaterialNode[]) {
    for (const n of nodes) {
      if (n.type === 'folder' && n.children) walk(n.children)
      else count++
    }
  }
  walk(fileTree.value)
  return count
})

function folderHasMatchingFiles(folder: MaterialNode): boolean {
  if (!folder.children) return false
  for (const child of folder.children) {
    if (child.type === 'folder') {
      if (folderHasMatchingFiles(child)) return true
    } else {
      if (filterType.value === 'pdf' && child.ext === '.pdf') return true
      if (filterType.value === 'video' && isVideo(child.ext || '')) return true
      if (filterType.value === 'other' && child.ext !== '.pdf' && !isVideo(child.ext || '')) return true
    }
  }
  return false
}

function countFilesInFolder(folder: MaterialNode): number {
  let count = 0
  function walk(nodes: MaterialNode[]) {
    for (const n of nodes) {
      if (n.type === 'folder' && n.children) walk(n.children)
      else count++
    }
  }
  if (folder.children) walk(folder.children)
  return count
}

onMounted(() => {
  restoreFolder()
  // v3.2.3：视频键盘快捷键——仅当预览中的文件是视频时生效
  window.addEventListener('keydown', onVideoKeydown)
})

// v3.3.1：组件卸载时彻底释放视频与音频资源，避免 AudioContext / MediaElementSource 泄漏
onUnmounted(() => {
  window.removeEventListener('keydown', onVideoKeydown)
  disposeVideoResources()
})

// v3.3.1：集中释放视频相关资源（src、Web Audio 链路、状态标记）
// 仅在「离开视频模式」或「组件卸载」时调用——video→video 切换由 Vue 复用同一元素，不能重建链路
function disposeVideoResources() {
  if (videoEl.value) {
    try {
      videoEl.value.pause()
    } catch { /* ignore */ }
    // 清空 src 触发底层 media element 释放网络流与解码缓冲
    videoEl.value.removeAttribute('src')
    try { videoEl.value.load() } catch { /* ignore */ }
  }
  if (audioCtx) {
    audioCtx.close().catch(() => { /* ignore */ })
    audioCtx = null
    gainNode = null
    videoSourceNode = null
    attachedVideoEl = null
  }
}

// v3.3.1：PDF 加载完成回调（iframe @load 仅在主框架加载完成时触发，PDFium 内部逐页懒渲染不影响）
function onPdfLoaded() {
  pdfLoading.value = false
  pdfError.value = false
}
function onPdfError() {
  pdfLoading.value = false
  pdfError.value = true
}
// 重试：先卸载再重新挂载 iframe
function retryPdf() {
  pdfVisible.value = false
  pdfError.value = false
  pdfLoading.value = true
  nextTick(() => { pdfVisible.value = true })
}

// v3.2.3：视频键盘快捷键：←/→ 快退快进 5 秒，↑/↓ 音量 ±5，空格 播放/暂停
function onVideoKeydown(e: KeyboardEvent) {
  // 仅在视频预览态生效
  if (!currentFile.value || !isVideo(currentFile.value.ext || '')) return
  // 输入框/文本域/下拉中不拦截，避免影响搜索等
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.target instanceof HTMLElement && e.target.isContentEditable) return
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      seekRelative(-5)
      break
    case 'ArrowRight':
      e.preventDefault()
      seekRelative(5)
      break
    case 'ArrowUp':
      e.preventDefault()
      changeVolumeStep(5)
      break
    case 'ArrowDown':
      e.preventDefault()
      changeVolumeStep(-5)
      break
    case ' ':
    case 'Spacebar':
      e.preventDefault()
      toggleVideoPlay()
      break
  }
}

// v3.2.3：音量按步进调整（用于键盘 ↑/↓，无极范围 0~100）
function changeVolumeStep(step: number) {
  let v = videoVolume.value + step
  if (v < 0) v = 0
  if (v > 100) v = 100
  videoVolume.value = v
  if (v > 0) videoMuted.value = false
  applyVolumeAndGain()
}

// v3.0.0：切换文件时重置视频状态
// v3.3.1：借鉴 videojs-player 的资源管理模式——仅在「离开视频模式」时释放音频链路，
// video→video 由 Vue 复用同一 <video> 元素，不能重建 createMediaElementSource 链路
watch(() => currentFile.value, (newVal, oldVal) => {
  const oldIsVideo = !!(oldVal && isVideo(oldVal.ext || ''))
  const newIsVideo = !!(newVal && isVideo(newVal.ext || ''))
  // 离开视频模式（video→pdf/image/other 或 video→null）：彻底释放 src + Web Audio 上下文
  if (oldIsVideo && !newIsVideo) {
    disposeVideoResources()
  }
  // 旧文件是 PDF：先卸载 iframe（v-if=false 触发 PDFium 释放内存），下次再挂载
  if (oldVal && oldVal.ext === '.pdf') {
    pdfVisible.value = false
  }
  videoCurrent.value = 0
  videoDuration.value = 0
  videoPlaying.value = false
  videoSpeed.value = 1
  videoMuted.value = false
  isFullscreen.value = false
  videoBuffered.value = 0
  videoLoading.value = false
  audioWarning.value = ''
  // v3.3.1：新文件是 PDF 时，先显示 loading，下一帧再挂载 iframe（懒加载，避免立即占用内存）
  if (newVal && newVal.ext === '.pdf') {
    pdfLoading.value = true
    pdfError.value = false
    pdfVisible.value = false
    nextTick(() => { pdfVisible.value = true })
  } else {
    pdfLoading.value = false
    pdfError.value = false
    pdfVisible.value = false
  }
  nextTick(() => {
    if (videoEl.value) {
      videoEl.value.playbackRate = 1
      // v3.2.2：基础音量默认 100，数字增益将在首次播放/加载时再次确保生效
      videoEl.value.volume = Math.min(1, videoVolume.value / 100)
      videoEl.value.muted = false
    }
  })
})

// v3.2.2：首次播放时搭建 Web Audio 增益链路（提升视频音量）
// v3.3.1：按 video 元素身份判断——同元素复用链路（createMediaElementSource 仅能调用一次），
// 切换到新元素（如 video→pdf→video 重建 DOM）时关闭旧上下文并重建链路
async function ensureAudioBoost(): Promise<void> {
  if (!videoEl.value) return
  // 同一元素已接入：仅需确保上下文处于运行态
  if (attachedVideoEl === videoEl.value && audioCtx && gainNode) {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => { /* ignore */ })
    }
    return
  }
  // 新元素：先关闭可能残留的旧上下文（指向已被销毁的旧元素）
  if (audioCtx) {
    try { await audioCtx.close() } catch { /* ignore */ }
    audioCtx = null
    gainNode = null
    videoSourceNode = null
  }
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    if (!AC) return
    audioCtx = new AC()
    gainNode = audioCtx.createGain()
    gainNode.gain.value = videoGain.value
    videoSourceNode = audioCtx.createMediaElementSource(videoEl.value)
    videoSourceNode.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    attachedVideoEl = videoEl.value
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => { /* ignore */ })
    }
  } catch {
    audioWarning.value = '音频增益初始化失败，视频声音可能较低'
  }
}

function applyVolumeAndGain() {
  if (videoEl.value) {
    const base = Math.min(1, videoVolume.value / 100)
    videoEl.value.volume = base
    videoEl.value.muted = videoMuted.value || videoVolume.value === 0
  }
  if (gainNode) {
    // 滑块到 100 时基础音量=1 + gain=1.8 => 总增益≈1.8x；静音时增益不抬
    const g = (videoMuted.value || videoVolume.value === 0) ? 0 : videoGain.value
    try {
      gainNode.gain.setTargetAtTime(g, audioCtx?.currentTime || 0, 0.01)
    } catch {
      gainNode.gain.value = g
    }
  }
}

async function restoreFolder() {
  const api = window.electronAPI
  if (!api?.restoreMaterialsFolder) return
  try {
    const res = await api.restoreMaterialsFolder()
    if (res.success && res.files) {
      fileTree.value = res.files
      materialsFolder.value = res.folder || ''
      // 默认展开根目录下的第一层文件夹
      expandFirstLevel()
    }
  } catch { /* ignore */ }
}

function expandFirstLevel() {
  for (const node of fileTree.value) {
    if (node.type === 'folder') {
      expandedFolders.value.add(node.path)
    }
  }
}

async function pickFolder() {
  const api = window.electronAPI
  if (!api?.pickMaterialsFolder) return
  try {
    const res = await api.pickMaterialsFolder()
    if (res.success && res.files) {
      fileTree.value = res.files
      materialsFolder.value = res.folder || ''
      currentFile.value = null
      expandedFolders.value.clear()
      expandFirstLevel()
    }
  } catch { /* ignore */ }
}

async function refreshList() {
  const api = window.electronAPI
  if (!api?.listMaterialsFiles) return
  try {
    const res = await api.listMaterialsFiles()
    if (res.success && res.files) {
      fileTree.value = res.files
    }
  } catch { /* ignore */ }
}

function toggleFolder(path: string) {
  if (expandedFolders.value.has(path)) {
    expandedFolders.value.delete(path)
  } else {
    expandedFolders.value.add(path)
  }
  // 触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
}

function openFile(file: MaterialNode) {
  currentFile.value = file
}

// v3.2.9：使用系统默认应用打开当前文件
async function openExternal() {
  if (!currentFile.value?.url) return
  const api = window.electronAPI
  if (!api?.openMaterialsExternal) {
    ElMessage.warning('当前环境不支持此操作')
    return
  }
  const token = currentFile.value.url.replace('kaoyan-material://', '')
  try {
    const res = await api.openMaterialsExternal(token)
    if (!res.success) {
      ElMessage.error(res.message || '打开失败')
    }
  } catch {
    ElMessage.error('打开失败，请重试')
  }
}

function isVideo(ext: string): boolean {
  return VIDEO_EXTS.includes(ext.toLowerCase())
}

function isImage(ext: string): boolean {
  return IMAGE_EXTS.includes(ext.toLowerCase())
}

function getIconClass(ext: string): string {
  if (ext === '.pdf') return 'icon-pdf'
  if (isVideo(ext)) return 'icon-video'
  return 'icon-other'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function downloadFile() {
  if (!currentFile.value) return
  const a = document.createElement('a')
  a.href = currentFile.value.url || ''
  a.download = currentFile.value.name
  a.click()
}

function onVideoTimeUpdate() {
  if (videoEl.value) {
    videoCurrent.value = videoEl.value.currentTime
    // 已缓冲长度
    try {
      if (videoEl.value.buffered.length > 0) {
        videoBuffered.value = videoEl.value.buffered.end(videoEl.value.buffered.length - 1)
      }
    } catch { /* ignore */ }
  }
}

function onVideoLoaded() {
  if (videoEl.value) {
    videoDuration.value = videoEl.value.duration
    // v3.2.2：确保音量/增益生效
    videoEl.value.volume = Math.min(1, videoVolume.value / 100)
    videoEl.value.muted = false
    applyVolumeAndGain()
    // v3.1.2 + v3.2.2：更可靠的无声检测——同时检测 audioTracks 与 mozHasAudio / webkitAudioDecodedByteCount
    const el = videoEl.value as HTMLVideoElement & {
      audioTracks?: { length: number }
      mozHasAudio?: boolean
      webkitAudioDecodedByteCount?: number
    }
    let hasAudioTrack = true
    if (typeof (el.audioTracks as unknown) === 'object' && el.audioTracks) {
      hasAudioTrack = el.audioTracks.length > 0
    } else if (typeof el.mozHasAudio === 'boolean') {
      hasAudioTrack = el.mozHasAudio
    }
    const videoOk = videoEl.value.videoWidth > 0
    if (videoOk && !hasAudioTrack) {
      audioWarning.value = '该视频未检测到音轨或使用了不支持的音频编码（如 AC3/DTS/E-AC3），建议用格式工厂/HandBrake 转码为 H.264 + AAC(MP4)'
    } else {
      audioWarning.value = ''
    }
    // 页面内非用户交互直接播放可能被浏览器策略拦截；此处只尝试一次并吞异常
    videoEl.value.play().then(() => {
      videoPlaying.value = true
      ensureAudioBoost()
      applyVolumeAndGain()
    }).catch(() => {
      videoPlaying.value = false
    })
  }
}

// v3.1.2 + v3.2.2：视频加载错误处理，区分编码/音轨问题和普通加载失败
function onVideoError() {
  const code = videoEl.value?.error?.code || 0
  if (code === 3 || code === 4) {
    audioWarning.value = '视频加载/解码失败，可能使用了浏览器不支持的编码，建议转码为 MP4(H.264 + AAC) 后重试'
  } else {
    audioWarning.value = '视频加载失败，请检查文件是否损坏或格式是否支持'
  }
}

async function toggleVideoPlay() {
  if (!videoEl.value) return
  // v3.2.2：播放前搭建 Web Audio 增益（需用户手势）
  await ensureAudioBoost()
  if (videoEl.value.paused) {
    try {
      await videoEl.value.play()
      videoPlaying.value = true
      applyVolumeAndGain()
    } catch {
      videoPlaying.value = false
    }
  } else {
    videoEl.value.pause()
    videoPlaying.value = false
  }
}

function onVideoSeek(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(val) && videoEl.value) {
    videoEl.value.currentTime = val
    videoCurrent.value = val
  }
}

// v3.2.3：相对快进/快退（秒），自动夹紧到 [0, duration]
function seekRelative(delta: number) {
  if (!videoEl.value) return
  const dur = videoDuration.value || videoEl.value.duration || 0
  let next = (videoEl.value.currentTime || videoCurrent.value) + delta
  if (next < 0) next = 0
  if (dur && next > dur) next = dur
  videoEl.value.currentTime = next
  videoCurrent.value = next
}

function onVideoSpeedChange() {
  if (videoEl.value) {
    videoEl.value.playbackRate = videoSpeed.value
  }
}

// v3.0.0：音量控制（v3.2.2：叠加 Web Audio 数字增益）
function onVolumeChange() {
  applyVolumeAndGain()
}

function toggleMute() {
  if (!videoEl.value) return
  videoMuted.value = !videoMuted.value
  if (!videoMuted.value && videoVolume.value === 0) {
    videoVolume.value = 100
  }
  applyVolumeAndGain()
}

// v3.0.0：全屏控制
function toggleFullscreen() {
  if (!videoWrap.value) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
    isFullscreen.value = false
  } else {
    videoWrap.value.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch(() => { /* ignore */ })
  }
}

// 监听全屏变化（用户按 ESC 退出时同步状态）
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
}
</script>

<style scoped>
.materials-page {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.materials-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--mo-text-1);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.materials-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.folder-path {
  font-size: 12px;
  color: var(--mo-text-3);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.materials-body {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  height: calc(100% - 70px);
}

.glass-card {
  background: var(--mo-surface);
  border: 1px solid var(--mo-border);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--mo-text-1);
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 14px 0;
  flex-shrink: 0;
}

.preview-title-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.open-external-btn {
  flex-shrink: 0;
  font-weight: 400;
}

.file-count {
  font-size: 12px;
  color: var(--mo-text-3);
  font-weight: 400;
}

.file-filter {
  margin-bottom: 12px;
  flex-shrink: 0;
}

/* v2.9.2：文件树 */
.file-tree {
  flex: 1;
  overflow-y: auto;
  margin: 0 -8px;
}

.tree-node {
  min-height: 36px;
}

.tree-folder {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.tree-folder:hover {
  background: var(--mo-surface-hover);
}

.folder-arrow {
  font-size: 12px;
  color: var(--mo-text-3);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.folder-arrow.expanded {
  transform: rotate(90deg);
}

.folder-icon {
  color: #e6a23c;
  font-size: 16px;
  flex-shrink: 0;
}

.folder-name {
  font-size: 13px;
  color: var(--mo-text-1);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  font-size: 11px;
  color: var(--mo-text-3);
  flex-shrink: 0;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.file-item:hover {
  background: var(--mo-surface-hover);
}

.file-item.active {
  background: var(--mo-surface-hover);
  color: var(--mo-primary);
}

.file-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.icon-pdf {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.icon-video {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.icon-other {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 13px;
  color: var(--mo-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 11px;
  color: var(--mo-text-3);
}

/* 预览区 */
.file-preview {
  overflow: hidden;
}

.preview-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pdf-viewer {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 8px;
}

/* v3.3.1：PDF 容器与加载/错误遮罩 */
.pdf-wrap {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.pdf-loading-mask,
.pdf-error-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  background: var(--mo-surface, #1a1c25);
  color: var(--mo-text-2, #ccc);
  font-size: 14px;
  z-index: 2;
  border-radius: 8px;
}

.pdf-error-mask {
  background: rgba(245, 108, 108, 0.08);
  color: #f56c6c;
}

/* v2.9.2：视频播放区域（v3.2.2 重构美化） */
.video-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #000;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.video-stage {
  position: relative;
  flex: 1;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.video-player {
  width: 100%;
  height: 100%;
  max-height: 100%;
  object-fit: contain;
  background: #000;
  display: block;
}

/* v3.2.2：加载遮罩 */
.video-loading-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 14px;
  pointer-events: none;
  z-index: 2;
  backdrop-filter: blur(2px);
}

/* v3.2.2：居中大播放按钮（暂停态） */
.video-center-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.18);
  cursor: pointer;
  z-index: 3;
  transition: opacity 0.2s;
}
.video-center-play:hover {
  background: rgba(0, 0, 0, 0.28);
}
.center-play-btn {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: var(--mo-primary, #409eff);
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), 0 0 0 6px rgba(255, 255, 255, 0.12);
  transition: transform 0.15s;
}
.video-center-play:hover .center-play-btn {
  transform: scale(1.05);
  background: #fff;
}

/* v3.1.2：音频编码不支持警告 */
.audio-warning {
  margin: 0 12px;
  padding: 8px 12px;
  background: rgba(255, 152, 0, 0.15);
  border: 1px solid rgba(255, 152, 0, 0.4);
  border-radius: 8px;
  color: #ffb74d;
  font-size: 12px;
  text-align: center;
}

/* v3.1.0：全屏时视频铺满整个屏幕 */
.video-wrap:fullscreen {
  width: 100vw;
  height: 100vh;
  background: #000;
  border-radius: 0;
  border: none;
  padding: 0;
  box-shadow: none;
  justify-content: center;
  align-items: stretch;
  gap: 0;
}

.video-wrap:fullscreen .video-player {
  width: 100%;
  height: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 0;
}

.video-wrap:fullscreen .video-controls {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 64px);
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  z-index: 10;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(6px);
}

.video-wrap:fullscreen .audio-warning {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 90vw;
  margin: 0;
  z-index: 20;
}

/* v3.0.0：自定义视频控制栏（v3.2.2 美化） */
.video-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: linear-gradient(180deg, rgba(20, 22, 30, 0.92) 0%, rgba(10, 12, 18, 0.96) 100%);
  color: #fff;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.video-ctrl-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.video-ctrl-btn:hover {
  background: var(--mo-primary, #409eff);
  border-color: transparent;
  color: #fff;
  transform: translateY(-1px);
}

/* v3.2.3：快退/快进按钮——略紧凑 */
.video-ctrl-btn.seek-btn {
  padding: 6px 7px;
  font-size: 14px;
}

.video-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
  min-width: 46px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* v3.2.2：双层进度条：缓冲 + 实际进度 */
.video-progress-wrap {
  flex: 1;
  position: relative;
  height: 18px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.video-progress-buffered {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  pointer-events: none;
  z-index: 0;
  transition: width 0.2s;
}

.video-progress {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
  outline: none;
}

.video-progress::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--mo-primary, #409eff);
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  transition: transform 0.1s;
}
.video-progress::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.video-progress::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--mo-primary, #409eff);
  cursor: pointer;
  border: 2px solid #fff;
}

.video-speed,
.video-gain {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  height: 28px;
  min-width: 52px;
}
.video-speed:hover,
.video-gain:hover {
  border-color: var(--mo-primary, #409eff);
}

.video-speed option,
.video-gain option {
  background: #1a1c25;
  color: #fff;
}

/* v3.2.2：音量滑块：改白色主题（v3.2.3：加宽到 96px，配合 step=0.1 无极调节） */
.video-volume {
  width: 96px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  cursor: pointer;
  outline: none;
  flex-shrink: 0;
}

.video-volume::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.25);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.video-volume::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  border: none;
}

.image-viewer {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.unsupported {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--mo-text-3);
}

.preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--mo-text-3);
}

.preview-empty .hint {
  font-size: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--mo-text-3);
}

.empty-state h3 {
  margin: 0;
  font-size: 18px;
  color: var(--mo-text-1);
}

@media (max-width: 900px) {
  .materials-body {
    grid-template-columns: 1fr;
    height: auto;
  }
}
</style>
