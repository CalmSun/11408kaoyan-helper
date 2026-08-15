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
          <!-- PDF 预览（v3.3.9：pdfjs-dist canvas 渲染，分页懒加载） -->
          <div v-if="currentFile.ext === '.pdf'" class="pdf-wrap">
            <!-- PDF 工具栏 -->
            <div class="pdf-toolbar">
              <div class="pdf-nav-group">
                <button class="pdf-btn" @click="pdfPrevPage" :disabled="pdfCurrentPage <= 1" title="上一页">‹</button>
                <input
                  class="page-input"
                  type="number"
                  v-model.number="pdfPageInput"
                  @change="pdfGoToPage"
                  @keyup.enter="pdfGoToPage"
                  :min="1"
                  :max="pdfTotalPages"
                />
                <span class="page-total">/ {{ pdfTotalPages }}</span>
                <button class="pdf-btn" @click="pdfNextPage" :disabled="pdfCurrentPage >= pdfTotalPages" title="下一页">›</button>
              </div>
              <div class="pdf-zoom-group">
                <button class="pdf-btn" @click="pdfZoomOut" :disabled="pdfScale <= 0.5" title="缩小">−</button>
                <span class="zoom-label">{{ Math.round(pdfScale * 100) }}%</span>
                <button class="pdf-btn" @click="pdfZoomIn" :disabled="pdfScale >= 3.0" title="放大">+</button>
              </div>
            </div>
            <!-- PDF 渲染区 -->
            <div class="pdf-viewer-wrap">
              <canvas ref="canvasRef" class="pdf-canvas" v-show="!pdfLoading && !pdfError"></canvas>
              <!-- 加载占位 -->
              <div v-if="pdfLoading" class="pdf-loading-mask">
                <div class="pdf-loading-spinner"></div>
                <div class="pdf-loading-bar"><div class="pdf-loading-bar-fill"></div></div>
                <span class="pdf-loading-text">PDF 加载中...</span>
              </div>
              <!-- 错误提示 -->
              <div v-if="pdfError" class="pdf-error-mask">
                <el-icon :size="40"><Warning /></el-icon>
                <span>PDF 加载失败</span>
                <span class="pdf-error-detail">{{ pdfError }}</span>
                <el-button size="small" type="primary" @click="pdfRetry">重试</el-button>
              </div>
              <!-- 渲染中指示 -->
              <div v-if="pdfRendering && !pdfLoading && !pdfError" class="pdf-rendering-indicator">
                <el-icon class="is-loading" :size="20"><Loading /></el-icon>
              </div>
            </div>
          </div>

          <!-- 视频播放（v3.3.9：原生 video + 倍速/封面/播放列表弹出） -->
          <div v-else-if="isVideo(currentFile.ext)" class="video-wrap" ref="videoWrap">
            <div class="video-stage">
              <video
                ref="nativeVideo"
                :src="videoSrc"
                :poster="videoPoster || undefined"
                controls
                preload="metadata"
                playsinline
                class="native-video"
                @loadedmetadata="onVideoLoadedMetadata"
                @play="videoPlaying = true"
                @pause="videoPlaying = false"
                @ended="onVideoEnded"
                @waiting="videoLoading = true"
                @playing="videoLoading = false; videoPlaying = true"
                @volumechange="onVolumeChange"
                @ratechange="onVideoRateChange"
                @error="onVideoError"
              ></video>
              <div v-if="videoLoading" class="video-loading-mask">
                <el-icon class="is-loading" :size="36"><Loading /></el-icon>
                <span>视频加载中...</span>
              </div>
              <button v-if="currentVideoIndex > 0" class="video-nav-btn video-nav-prev" @click="playPrevVideo" title="上一个 (Shift+←)">
                <el-icon><ArrowLeft /></el-icon>
              </button>
              <button v-if="currentVideoIndex >= 0 && currentVideoIndex < videoPlaylist.length - 1" class="video-nav-btn video-nav-next" @click="playNextVideo" title="下一个 (Shift+→)">
                <el-icon><ArrowRight /></el-icon>
              </button>
            </div>
            <div v-if="audioWarning" class="audio-warning">{{ audioWarning }}</div>
            <!-- 视频工具栏 -->
            <div class="video-controls-bar">
              <div class="video-controls-left">
                <button class="vc-btn" @click="seekRelative(-10)" title="快退 10 秒 (←)">
                  <span style="font-size:16px">⏪</span>
                </button>
                <button class="vc-btn" @click="seekRelative(10)" title="快进 10 秒 (→)">
                  <span style="font-size:16px">⏩</span>
                </button>
                <span class="vc-separator"></span>
                <span class="vc-label">倍速</span>
                <select
                  :value="videoPlaybackRate"
                  @change="(e) => setPlaybackRate(Number((e.target as HTMLSelectElement).value))"
                  class="vc-select"
                  title="播放倍速"
                >
                  <option :value="0.5">0.5x</option>
                  <option :value="1">1x</option>
                  <option :value="1.25">1.25x</option>
                  <option :value="1.5">1.5x</option>
                  <option :value="2">2x</option>
                </select>
                <span class="vc-separator"></span>
                <span class="vc-label">音量增益</span>
                <select
                  :value="videoGain"
                  @change="(e) => { videoGain = Number((e.target as HTMLSelectElement).value); applyGain() }"
                  class="vc-select"
                  title="提升视频音量"
                >
                  <option :value="1">1x</option>
                  <option :value="1.5">1.5x</option>
                  <option :value="1.8">1.8x</option>
                  <option :value="2.5">2.5x</option>
                  <option :value="4">4x</option>
                </select>
              </div>
              <div class="video-controls-right">
                <button
                  class="vc-btn vc-toggle"
                  :class="{ active: autoPlayNext }"
                  @click="toggleAutoPlay"
                  title="自动连播下一个视频"
                >
                  <el-icon><VideoPlay /></el-icon>
                  <span>连播</span>
                </button>
                <button
                  class="vc-btn vc-toggle"
                  :class="{ active: showPlaylist }"
                  @click="showPlaylist = !showPlaylist"
                  title="播放列表"
                >
                  <el-icon><List /></el-icon>
                  <span>列表</span>
                  <span class="vc-badge" v-if="videoPlaylist.length">{{ videoPlaylist.length }}</span>
                </button>
              </div>
            </div>
            <!-- 播放列表弹出面板 -->
            <transition name="playlist-slide">
              <div v-if="showPlaylist && videoPlaylist.length > 0" class="video-playlist-popover">
                <div class="playlist-header">
                  <span class="playlist-title">
                    <el-icon><List /></el-icon>
                    播放列表（当前文件夹）
                  </span>
                  <span class="playlist-count">{{ videoPlaylist.length }} 个</span>
                </div>
                <div class="playlist-items">
                  <div
                    v-for="(v, idx) in videoPlaylist"
                    :key="v.path"
                    class="playlist-item"
                    :class="{ active: idx === currentVideoIndex, played: idx < currentVideoIndex }"
                    @click="playVideoAt(idx)"
                  >
                    <span class="playlist-index">{{ idx + 1 }}</span>
                    <span class="playlist-name" :title="v.name">{{ v.name }}</span>
                    <div class="playlist-actions" @click.stop>
                      <button class="playlist-action-btn" @click="movePlaylistItem(idx, -1)" :disabled="idx === 0" title="上移">↑</button>
                      <button class="playlist-action-btn" @click="movePlaylistItem(idx, 1)" :disabled="idx === videoPlaylist.length - 1" title="下移">↓</button>
                      <button class="playlist-action-btn playlist-remove" @click="removeFromPlaylist(idx)" title="从列表移除">✕</button>
                    </div>
                    <el-icon v-if="idx === currentVideoIndex && videoPlaying" class="playlist-playing-icon is-loading"><Loading /></el-icon>
                    <el-icon v-else-if="idx === currentVideoIndex" class="playlist-playing-icon"><VideoPlay /></el-icon>
                  </div>
                </div>
              </div>
            </transition>
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
          <p class="hint">支持 PDF 阅读（分页懒加载/缩放/页码导航）、视频播放（倍速/增益/连播/播放列表）</p>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Folder, FolderOpened, Refresh, Document, VideoPlay, Files,
  View, Warning, ArrowRight, ArrowLeft, List, Loading, Open
} from '@element-plus/icons-vue'

// v3.3.9: pdfjs-dist legacy build — canvas 渲染，不使用 text-layer（避免 async iterable 问题）
import * as pdfjsLib from 'pdfjs-dist'
// eslint-disable-next-line import/no-unresolved
import PdfWorkerConstructor from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'

// v2.9.2：使用全局 MaterialNode 类型（树形结构）
interface DisplayNode extends MaterialNode {
  level: number
}

const fileTree = ref<MaterialNode[]>([])
const materialsFolder = ref('')
const currentFile = ref<MaterialNode | null>(null)
const filterType = ref('all')
const expandedFolders = ref<Set<string>>(new Set())

const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv']
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

// ============ v3.3.9: PDF 状态（pdfjs-dist canvas 渲染 + 分页懒加载） ============
const pdfLoading = ref(false)
const pdfError = ref('')
const pdfDoc = ref<pdfjsLib.PDFDocumentProxy | null>(null)
const pdfCurrentPage = ref(1)
const pdfTotalPages = ref(0)
const pdfScale = ref(1.2)
const pdfRendering = ref(false)
const pdfPageInput = ref(1)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderTask: pdfjsLib.RenderTask | null = null
let pdfLoadTimer: ReturnType<typeof setTimeout> | null = null

// v3.3.9: 初始化 worker（惰性，在首次加载 PDF 时执行）
let pdfWorkerReady = false
function ensurePdfWorker() {
  if (pdfWorkerReady) return
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    if (!pdfjsLib.GlobalWorkerOptions.workerPort && typeof PdfWorkerConstructor === 'function') {
      pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorkerConstructor() as unknown as Worker
    }
    pdfWorkerReady = true
  } catch (err) {
    console.warn('[Materials] pdf.js worker 初始化失败:', err)
  }
}

// v3.3.9: 加载 PDF 文档
async function loadPdf(url: string) {
  ensurePdfWorker()
  pdfLoading.value = true
  pdfError.value = ''
  // 销毁旧文档
  if (pdfDoc.value) {
    try { await pdfDoc.value.destroy() } catch { /* ignore */ }
    pdfDoc.value = null
  }
  try {
    const loadingTask = pdfjsLib.getDocument({ url })
    const doc = await loadingTask.promise
    pdfDoc.value = doc
    pdfTotalPages.value = doc.numPages
    pdfCurrentPage.value = 1
    pdfPageInput.value = 1
    await renderPdfPage(1)
  } catch (err) {
    console.error('[Materials] PDF 加载失败:', err)
    pdfError.value = err instanceof Error ? err.message : 'PDF 加载失败'
  } finally {
    pdfLoading.value = false
  }
}

// v3.3.9: 渲染单页到 canvas（懒加载：仅渲染当前页）
async function renderPdfPage(pageNum: number) {
  if (!pdfDoc.value || !canvasRef.value) return
  // 取消正在进行的渲染
  if (renderTask) {
    try { renderTask.cancel() } catch { /* ignore */ }
    renderTask = null
  }
  pdfRendering.value = true
  try {
    const page = await pdfDoc.value.getPage(pageNum)
    const canvas = canvasRef.value
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const viewport = page.getViewport({ scale: pdfScale.value * dpr })
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.width = (viewport.width / dpr) + 'px'
    canvas.style.height = (viewport.height / dpr) + 'px'
    renderTask = page.render({ canvasContext: ctx, viewport })
    await renderTask.promise
  } catch (err) {
    // cancel 不算错误
    if (!(err instanceof Error && err.name === 'RenderingCancelledException')) {
      console.error('[Materials] 页面渲染失败:', err)
    }
  } finally {
    pdfRendering.value = false
    renderTask = null
  }
}

function pdfPrevPage() {
  if (pdfCurrentPage.value <= 1) return
  pdfCurrentPage.value--
  pdfPageInput.value = pdfCurrentPage.value
  renderPdfPage(pdfCurrentPage.value)
}

function pdfNextPage() {
  if (pdfCurrentPage.value >= pdfTotalPages.value) return
  pdfCurrentPage.value++
  pdfPageInput.value = pdfCurrentPage.value
  renderPdfPage(pdfCurrentPage.value)
}

function pdfGoToPage() {
  const n = Math.max(1, Math.min(pdfTotalPages.value, pdfPageInput.value))
  pdfCurrentPage.value = n
  pdfPageInput.value = n
  renderPdfPage(n)
}

function pdfZoomIn() {
  pdfScale.value = Math.min(pdfScale.value + 0.25, 3.0)
  renderPdfPage(pdfCurrentPage.value)
}

function pdfZoomOut() {
  pdfScale.value = Math.max(pdfScale.value - 0.25, 0.5)
  renderPdfPage(pdfCurrentPage.value)
}

function pdfRetry() {
  if (currentFile.value?.url) loadPdf(currentFile.value.url)
}

// v3.3.9: 销毁 PDF 文档释放内存
async function destroyPdf() {
  if (renderTask) {
    try { renderTask.cancel() } catch { /* ignore */ }
    renderTask = null
  }
  if (pdfDoc.value) {
    try { await pdfDoc.value.destroy() } catch { /* ignore */ }
    pdfDoc.value = null
  }
  pdfTotalPages.value = 0
  pdfCurrentPage.value = 1
  pdfPageInput.value = 1
  pdfScale.value = 1.2
  pdfError.value = ''
  pdfLoading.value = false
}

// ============ v3.3.8：视频状态管理（原生 <video> + Web Audio API 增益） ============
const videoWrap = ref<HTMLElement | null>(null)
const nativeVideo = ref<HTMLVideoElement | null>(null)
const videoSrc = computed(() => {
  if (currentFile.value && isVideo(currentFile.value.ext || '') && currentFile.value.url) {
    return currentFile.value.url
  }
  return ''
})
const videoVolume = ref(100)
const videoGain = ref(1.8)
const videoPlaying = ref(false)
const videoLoading = ref(false)
const audioWarning = ref('')
// v3.3.9: 视频倍速
const videoPlaybackRate = ref(1)
// v3.3.9: 视频首帧封面（loadedmetadata 后 seek 到 0.1s 截图）
const videoPoster = ref('')

function setPlaybackRate(rate: number) {
  videoPlaybackRate.value = rate
  if (nativeVideo.value) nativeVideo.value.playbackRate = rate
}

// v3.2.2：Web Audio 增益节点（用于提升音量）
let audioCtx: AudioContext | null = null
let gainNode: GainNode | null = null
let videoSourceNode: MediaElementAudioSourceNode | null = null
// v3.3.1：记录已接入增益链路的 video 元素——createMediaElementSource 每个元素仅能调用一次
let attachedVideoEl: HTMLVideoElement | null = null

// v3.2.2：缓冲百分比
const videoBuffered = ref(0)

// v3.3.9: 播放列表 — 仅当前文件夹的视频文件（非递归全部）
const videoPlaylist = ref<MaterialNode[]>([])
const showPlaylist = ref(false)

// v3.3.9: 当切换视频文件时，更新播放列表为该文件所在文件夹的视频
function updateVideoPlaylist(file: MaterialNode) {
  // 找到文件所在的直接父文件夹
  let parentChildren: MaterialNode[] | null = null
  function findParent(nodes: MaterialNode[]): boolean {
    for (const n of nodes) {
      if (n.path === file.path) return true
      if (n.type === 'folder' && n.children) {
        if (findParent(n.children)) {
          // 如果父级就是当前层级的 children
          return true
        }
      }
    }
    return false
  }
  // 从 fileTree 查找包含此文件的同级视频文件
  function findSiblings(nodes: MaterialNode[], target: MaterialNode): MaterialNode[] | null {
    for (const n of nodes) {
      if (n.type === 'folder' && n.children) {
        const found = findSiblings(n.children, target)
        if (found) return found
      }
      if (n.path === target.path) {
        // 返回同级文件中的视频文件
        return nodes.filter(s => s.type === 'file' && isVideo(s.ext || ''))
      }
    }
    return null
  }
  const siblings = findSiblings(fileTree.value, file)
  videoPlaylist.value = siblings || [file]
}

const currentVideoIndex = computed(() => {
  if (!currentFile.value || !isVideo(currentFile.value.ext || '')) return -1
  return videoPlaylist.value.findIndex(v => v.path === currentFile.value!.path)
})

const autoPlayNext = ref(localStorage.getItem('materials-autoplay') !== 'false')

function toggleAutoPlay() {
  autoPlayNext.value = !autoPlayNext.value
  localStorage.setItem('materials-autoplay', String(autoPlayNext.value))
}

function onVideoEnded() {
  videoPlaying.value = false
  if (autoPlayNext.value) {
    setTimeout(() => playNextVideo(), 800)
  }
}

function playNextVideo() {
  const idx = currentVideoIndex.value
  if (idx < 0 || idx >= videoPlaylist.value.length - 1) return
  openFile(videoPlaylist.value[idx + 1])
}

function playPrevVideo() {
  const idx = currentVideoIndex.value
  if (idx <= 0) return
  openFile(videoPlaylist.value[idx - 1])
}

function playVideoAt(idx: number) {
  if (idx >= 0 && idx < videoPlaylist.value.length) {
    openFile(videoPlaylist.value[idx])
  }
}

// v3.3.9: 调整播放列表顺序
function movePlaylistItem(idx: number, direction: -1 | 1) {
  const newList = [...videoPlaylist.value]
  const target = idx + direction
  if (target < 0 || target >= newList.length) return
  ;[newList[idx], newList[target]] = [newList[target], newList[idx]]
  videoPlaylist.value = newList
}

// v3.3.9: 从播放列表移除文件
function removeFromPlaylist(idx: number) {
  if (idx === currentVideoIndex.value) return // 不能移除当前播放项
  const newList = videoPlaylist.value.filter((_, i) => i !== idx)
  videoPlaylist.value = newList
}

function onVideoRateChange() {
  if (nativeVideo.value) {
    videoPlaybackRate.value = nativeVideo.value.playbackRate
  }
}

// ============ 文件树扁平化 ============
const flatFiles = computed<DisplayNode[]>(() => {
  const result: DisplayNode[] = []
  function walk(nodes: MaterialNode[], level: number) {
    for (const node of nodes) {
      if (node.type === 'folder') {
        if (filterType.value !== 'all') {
          const hasMatch = folderHasMatchingFiles(node)
          if (!hasMatch) continue
        }
        result.push({ ...node, level })
        if (expandedFolders.value.has(node.path) && node.children) {
          walk(node.children, level + 1)
        }
      } else {
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

const displayNodes = computed(() => flatFiles.value)

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

// ============ 生命周期 ============
onMounted(() => {
  restoreFolder()
  window.addEventListener('keydown', onVideoKeydown)
})

// v3.3.1：组件卸载时彻底释放视频与音频资源
onUnmounted(() => {
  window.removeEventListener('keydown', onVideoKeydown)
  disposeAudioResources()
  // v3.3.9: 销毁 PDF 文档释放内存
  destroyPdf()
})

// v3.3.1：集中释放音频资源（AudioContext / GainNode / SourceNode）
function disposeAudioResources() {
  if (audioCtx) {
    audioCtx.close().catch(() => { /* ignore */ })
    audioCtx = null
    gainNode = null
    videoSourceNode = null
    attachedVideoEl = null
  }
}

// v3.0.0：切换文件时重置状态
// v3.3.1：仅在「离开视频模式」时释放音频链路
// v3.3.8：适配原生 <video> 元素生命周期
// v3.3.9：合并 PDF 加载/销毁逻辑
watch(() => currentFile.value, async (newVal, oldVal) => {
  // v3.3.9: 离开 PDF 模式时销毁文档
  if (oldVal?.ext === '.pdf' && newVal?.ext !== '.pdf') {
    await destroyPdf()
  }
  // 进入 PDF 模式：加载文档
  if (newVal?.ext === '.pdf' && newVal.url) {
    await loadPdf(newVal.url)
  }
  const oldIsVideo = !!(oldVal && isVideo(oldVal.ext || ''))
  const newIsVideo = !!(newVal && isVideo(newVal.ext || ''))
  // 离开视频模式：释放 AudioContext
  if (oldIsVideo && !newIsVideo) {
    disposeAudioResources()
  }
  // 重置视频状态
  videoPlaying.value = false
  videoLoading.value = false
  audioWarning.value = ''
  videoBuffered.value = 0
})

// ============ 视频播放器事件处理 ============

// v3.1.2 + v3.2.2：loadedmetadata 后进行无声检测
// v3.3.8：改用原生 <video> 元素
function onVideoLoadedMetadata() {
  if (!nativeVideo.value) return
  const el = nativeVideo.value as HTMLVideoElement & {
    audioTracks?: { length: number }
    mozHasAudio?: boolean
    webkitAudioDecodedByteCount?: number
  }
  let hasAudioTrack = true
  if (typeof el.audioTracks === 'object' && el.audioTracks) {
    hasAudioTrack = el.audioTracks.length > 0
  } else if (typeof el.mozHasAudio === 'boolean') {
    hasAudioTrack = el.mozHasAudio
  }
  const videoOk = el.videoWidth > 0
  if (videoOk && !hasAudioTrack) {
    audioWarning.value = '该视频未检测到音轨或使用了不支持的音频编码（如 AC3/DTS/E-AC3），建议用格式工厂/HandBrake 转码为 H.264 + AAC(MP4)'
  } else {
    audioWarning.value = ''
  }
  // v3.3.9: 捕获首帧作为封面
  try {
    nativeVideo.value.currentTime = 0.1
    nativeVideo.value.addEventListener('seeked', function onSeeked() {
      nativeVideo.value?.removeEventListener('seeked', onSeeked)
      const canvas = document.createElement('canvas')
      canvas.width = nativeVideo.value?.videoWidth || 320
      canvas.height = nativeVideo.value?.videoHeight || 180
      const ctx = canvas.getContext('2d')
      if (ctx && nativeVideo.value) {
        ctx.drawImage(nativeVideo.value, 0, 0, canvas.width, canvas.height)
        videoPoster.value = canvas.toDataURL('image/jpeg', 0.6)
      }
    }, { once: true })
  } catch { /* ignore */ }
  // 尝试播放（非用户交互可能被拦截，吞异常）
  if (nativeVideo.value.paused) {
    nativeVideo.value.play()?.then(() => {
      videoPlaying.value = true
      ensureAudioBoost()
    }).catch(() => {
      videoPlaying.value = false
    })
  }
}

// v3.2.2：首次播放时搭建 Web Audio 增益链路（提升视频音量）
// v3.3.1：按 video 元素身份判断——同元素复用链路，新元素重建链路
// v3.3.8：直接使用原生 <video> 元素
async function ensureAudioBoost(): Promise<void> {
  if (!nativeVideo.value) return
  const el = nativeVideo.value
  // 同一元素已接入：仅需确保上下文处于运行态
  if (attachedVideoEl === el && audioCtx && gainNode) {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => { /* ignore */ })
    }
    return
  }
  // 新元素：先关闭可能残留的旧上下文
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
    videoSourceNode = audioCtx.createMediaElementSource(el)
    videoSourceNode.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    attachedVideoEl = el
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => { /* ignore */ })
    }
  } catch {
    audioWarning.value = '音频增益初始化失败，视频声音可能较低'
  }
}

function applyGain() {
  if (gainNode) {
    const g = videoGain.value
    try {
      gainNode.gain.setTargetAtTime(g, audioCtx?.currentTime || 0, 0.01)
    } catch {
      gainNode.gain.value = g
    }
  }
}

function onVolumeChange() {
  if (nativeVideo.value) {
    videoVolume.value = Math.round(nativeVideo.value.volume * 100)
  }
}

// v3.1.2 + v3.2.2：视频加载错误处理
function onVideoError() {
  const err = nativeVideo.value?.error
  const code = err?.code || 0
  if (code === 3 || code === 4) {
    audioWarning.value = '视频加载/解码失败，可能使用了浏览器不支持的编码，建议转码为 MP4(H.264 + AAC) 后重试'
  } else {
    audioWarning.value = '视频加载失败，请检查文件是否损坏或格式是否支持'
  }
}

// v3.2.3：相对快进/快退（秒），自动夹紧到 [0, duration]
function seekRelative(delta: number) {
  if (!nativeVideo.value) return
  const dur = nativeVideo.value.duration || 0
  let next = (nativeVideo.value.currentTime || 0) + delta
  if (next < 0) next = 0
  if (dur && next > dur) next = dur
  nativeVideo.value.currentTime = next
}

// v3.2.3：视频键盘快捷键：←/→ 快退快进 5 秒，↑/↓ 音量 ±5，空格 播放/暂停
function onVideoKeydown(e: KeyboardEvent) {
  if (!currentFile.value || !isVideo(currentFile.value.ext || '')) return
  if (!nativeVideo.value) return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.target instanceof HTMLElement && e.target.isContentEditable) return
  switch (e.key) {
    case 'ArrowLeft':
      if (e.shiftKey) { e.preventDefault(); playPrevVideo(); return }
      e.preventDefault(); seekRelative(-5); break
    case 'ArrowRight':
      if (e.shiftKey) { e.preventDefault(); playNextVideo(); return }
      e.preventDefault(); seekRelative(5); break
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
      if (nativeVideo.value.paused) {
        nativeVideo.value.play()?.then(() => { videoPlaying.value = true; ensureAudioBoost() }).catch(() => {})
      } else {
        nativeVideo.value.pause()
        videoPlaying.value = false
      }
      break
  }
}

function changeVolumeStep(step: number) {
  if (!nativeVideo.value) return
  let v = nativeVideo.value.volume * 100 + step
  if (v < 0) v = 0
  if (v > 100) v = 100
  nativeVideo.value.volume = v / 100
  videoVolume.value = v
}

// ============ 文件夹操作 ============
async function restoreFolder() {
  const api = window.electronAPI
  if (!api?.restoreMaterialsFolder) return
  try {
    const res = await api.restoreMaterialsFolder()
    if (res.success && res.files) {
      fileTree.value = res.files
      materialsFolder.value = res.folder || ''
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
  expandedFolders.value = new Set(expandedFolders.value)
}

function openFile(file: MaterialNode) {
  currentFile.value = file
  // v3.3.9: 打开视频时更新播放列表为同级文件夹视频
  if (file.type === 'file' && isVideo(file.ext || '')) {
    updateVideoPlaylist(file)
    videoPoster.value = '' // 重置封面
  }
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

function downloadFile() {
  if (!currentFile.value) return
  const a = document.createElement('a')
  a.href = currentFile.value.url || ''
  a.download = currentFile.value.name
  a.click()
}

// 监听全屏变化（用户按 ESC 退出时同步状态）
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    // 原生 <video> 全屏由浏览器/控件自行处理，此处无需额外操作
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
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05);
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

/* v3.3.2：PDF 工具栏 */
.pdf-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 8px;
}

.pdf-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--mo-surface-hover, rgba(255, 255, 255, 0.04));
  border-radius: 8px;
  flex-shrink: 0;
}

.pdf-nav-group,
.pdf-zoom-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pdf-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--mo-text-1, #fff);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 28px;
  transition: all 0.15s;
}

.pdf-btn:hover:not(:disabled) {
  background: var(--mo-primary, #409eff);
  border-color: transparent;
  color: #fff;
}

.pdf-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pdf-btn.active {
  background: var(--mo-primary, #409eff);
  color: #fff;
}

.page-input {
  width: 48px;
  text-align: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: var(--mo-text-1, #fff);
  font-size: 13px;
  height: 28px;
  outline: none;
}

.page-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}

.page-total {
  font-size: 12px;
  color: var(--mo-text-3, #888);
  min-width: 32px;
}

.zoom-label {
  font-size: 12px;
  color: var(--mo-text-2, #ccc);
  min-width: 48px;
  text-align: center;
}

/* v3.3.2：PDF 查看器容器 */
.pdf-viewer-wrap {
  flex: 1;
  overflow: auto;
  position: relative;
  display: flex;
  justify-content: center;
  background: var(--mo-bg, #1a1c25);
  border-radius: 8px;
  padding: 8px;
}

.pdf-error-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  background: rgba(245, 108, 108, 0.08);
  color: #f56c6c;
  font-size: 14px;
  z-index: 2;
  border-radius: 8px;
}

.pdf-loading-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  justify-content: center;
  background: var(--mo-surface, #1a1c25);
  z-index: 2;
  border-radius: 8px;
}

.pdf-loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(64, 158, 255, 0.15);
  border-top-color: var(--mo-primary, #409eff);
  border-radius: 50%;
  animation: pdf-spin 0.8s linear infinite;
}

@keyframes pdf-spin {
  to { transform: rotate(360deg); }
}

.pdf-loading-bar {
  width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.pdf-loading-bar-fill {
  height: 100%;
  background: var(--mo-primary, #409eff);
  border-radius: 2px;
  animation: pdf-load-progress 2s ease-in-out infinite;
}

@keyframes pdf-load-progress {
  0% { width: 0%; transform: translateX(-100%); }
  50% { width: 60%; }
  100% { width: 100%; transform: translateX(200%); }
}

.pdf-loading-text {
  font-size: 13px;
  color: var(--mo-text-3, #888);
}

.pdf-canvas {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.pdf-rendering-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  backdrop-filter: blur(4px);
  z-index: 3;
}

.pdf-error-detail {
  font-size: 12px;
  color: var(--mo-text-3, #888);
  max-width: 300px;
  text-align: center;
  word-break: break-all;
}

/* v3.3.2：视频播放区域（使用 video.js） */
.video-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  position: relative; /* v3.3.9: for playlist popover */
}

.video-stage {
  position: relative;
  flex: 1;
  background: #000;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 0;
  display: flex;
}

/* v3.3.8：原生 <video> 元素样式 */
.native-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  border-radius: 14px;
}

/* v3.3.2：全屏时铺满 */
.video-stage:fullscreen {
  border-radius: 0;
  border: none;
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

/* v3.1.2：音频编码不支持警告 */
.audio-warning {
  padding: 8px 12px;
  background: rgba(255, 152, 0, 0.15);
  border: 1px solid rgba(255, 152, 0, 0.4);
  border-radius: 8px;
  color: #ffb74d;
  font-size: 12px;
  text-align: center;
  flex-shrink: 0;
}

/* Video controls bar */
.video-controls-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px;
  background: linear-gradient(180deg, rgba(20, 22, 30, 0.92) 0%, rgba(10, 12, 18, 0.96) 100%);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.video-controls-left,
.video-controls-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vc-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
  height: 30px;
}

.vc-btn:hover {
  background: var(--mo-primary, #409eff);
  border-color: transparent;
  color: #fff;
}

.vc-btn.vc-toggle.active {
  background: var(--mo-primary, #409eff);
  border-color: transparent;
  color: #fff;
}

.vc-separator {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 4px;
}

.vc-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.vc-select {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  cursor: pointer;
  height: 28px;
  min-width: 52px;
  outline: none;
  transition: border-color 0.15s;
}

.vc-select:hover {
  border-color: var(--mo-primary, #409eff);
}

.vc-select option {
  background: #1a1c25;
  color: #fff;
}

/* Video navigation overlay buttons */
.video-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 3;
  opacity: 0;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}

.video-stage:hover .video-nav-btn {
  opacity: 0.85;
}

.video-nav-btn:hover {
  opacity: 1 !important;
  background: var(--mo-primary, #409eff);
  border-color: transparent;
}

.video-nav-prev { left: 12px; }
.video-nav-next { right: 12px; }

.playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--mo-border);
  flex-shrink: 0;
}

.playlist-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mo-text-1);
  display: flex;
  align-items: center;
  gap: 6px;
}

.playlist-count {
  font-size: 11px;
  color: var(--mo-text-3);
}

.playlist-items {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.12s;
}

.playlist-item:hover {
  background: var(--mo-surface-hover);
}

.playlist-item.active {
  background: rgba(64, 158, 255, 0.12);
}

.playlist-item.played {
  opacity: 0.5;
}

.playlist-index {
  font-size: 11px;
  color: var(--mo-text-3);
  font-variant-numeric: tabular-nums;
  min-width: 20px;
  text-align: right;
  flex-shrink: 0;
}

.playlist-item.active .playlist-index {
  color: var(--mo-primary, #409eff);
  font-weight: 700;
}

.playlist-name {
  flex: 1;
  font-size: 12px;
  color: var(--mo-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-item.active .playlist-name {
  color: var(--mo-primary, #409eff);
  font-weight: 500;
}

.playlist-playing-icon {
  font-size: 12px;
  color: var(--mo-primary, #409eff);
  flex-shrink: 0;
}

/* v3.3.9: 播放列表弹出面板 */
.video-playlist-popover {
  position: absolute;
  right: 20px;
  bottom: 100%;
  margin-bottom: 8px;
  width: 340px;
  max-height: 320px;
  background: var(--mo-surface, #1e2030);
  border: 1px solid var(--mo-border, rgba(255,255,255,0.1));
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10;
  backdrop-filter: blur(16px);
}

.playlist-slide-enter-active,
.playlist-slide-leave-active {
  transition: all 0.2s ease;
}
.playlist-slide-enter-from,
.playlist-slide-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.vc-badge {
  background: var(--mo-primary, #409eff);
  color: #fff;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
  min-width: 16px;
  text-align: center;
}

.playlist-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.playlist-item:hover .playlist-actions {
  opacity: 1;
}

.playlist-action-btn {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--mo-text-2, #ccc);
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}

.playlist-action-btn:hover:not(:disabled) {
  background: var(--mo-primary, #409eff);
  color: #fff;
}

.playlist-action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.playlist-action-btn.playlist-remove:hover {
  background: var(--el-color-danger, #f56c6c);
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
