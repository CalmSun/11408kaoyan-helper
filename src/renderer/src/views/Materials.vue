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
          <!-- PDF 预览（v3.3.2：使用 @tato30/vue-pdf 重构，支持翻页/缩放/旋转/文本选择） -->
          <div v-if="currentFile.ext === '.pdf'" class="pdf-wrap">
            <div class="pdf-toolbar">
              <div class="pdf-nav-group">
                <button class="pdf-btn" @click="prevPage" :disabled="pdfPage <= 1" title="上一页">‹</button>
                <input
                  type="number"
                  v-model="pdfPage"
                  :min="1"
                  :max="pages || 1"
                  class="page-input"
                  @change="onPageInput"
                />
                <span class="page-total">/ {{ pages }}</span>
                <button class="pdf-btn" @click="nextPage" :disabled="pdfPage >= pages" title="下一页">›</button>
              </div>
              <div class="pdf-zoom-group">
                <button class="pdf-btn" @click="zoomOut" :disabled="!pdfFitParent && pdfScale <= 0.5" title="缩小">−</button>
                <span class="zoom-label">{{ pdfFitParent ? '适配' : Math.round(pdfScale * 100) + '%' }}</span>
                <button class="pdf-btn" @click="zoomIn" :disabled="!pdfFitParent && pdfScale >= 3" title="放大">+</button>
                <button class="pdf-btn" @click="fitWidth" :class="{ active: pdfFitParent }" title="适配宽度">⤢</button>
              </div>
              <button class="pdf-btn" @click="rotatePdf" title="旋转 90°">
                <el-icon><RefreshRight /></el-icon>
              </button>
            </div>
            <div class="pdf-viewer-wrap">
              <VuePDF
                v-if="pdf"
                :pdf="pdf"
                :page="pdfPage"
                :scale="pdfScale"
                :fit-parent="pdfFitParent"
                :rotation="pdfRotation"
                text-layer
                annotation-layer
                @loaded="onPdfPageLoaded"
              >
                <div class="pdf-page-loading">
                  <el-icon class="is-loading" :size="32"><Loading /></el-icon>
                </div>
              </VuePDF>
              <div v-if="pdfLoading && !pdfError" class="pdf-loading-mask">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <span>PDF 加载中...{{ pdfProgress > 0 ? ' ' + pdfProgress + '%' : '' }}</span>
              </div>
              <div v-if="pdfError" class="pdf-error-mask">
                <el-icon :size="40"><Warning /></el-icon>
                <span>PDF 加载失败</span>
                <el-button size="small" type="primary" @click="retryPdf">重试</el-button>
              </div>
            </div>
          </div>

          <!-- 视频播放（v3.3.2：使用 @videojs-player/vue 重构，原生 video.js 控制栏 + 增益/快捷键/无声检测） -->
          <div v-else-if="isVideo(currentFile.ext)" class="video-wrap" ref="videoWrap">
            <div class="video-stage">
              <video-player
                v-if="videoSrc"
                :src="videoSrc"
                controls
                preload="metadata"
                playsinline
                fill
                :volume="videoVolume / 100"
                :playback-rates="[0.5, 1, 1.25, 1.5, 2]"
                @mounted="onVideoMounted"
                @ready="onVideoReady"
                @loadedmetadata="onVideoLoadedMetadata"
                @play="videoPlaying = true"
                @pause="videoPlaying = false"
                @ended="videoPlaying = false"
                @waiting="videoLoading = true"
                @playing="videoLoading = false; videoPlaying = true"
                @volumechange="onVolumeChange"
                @error="onVideoError"
                class="video-player"
              />
              <div v-if="videoLoading" class="video-loading-mask">
                <el-icon class="is-loading" :size="40"><Loading /></el-icon>
                <span>视频加载中...</span>
              </div>
            </div>
            <!-- v3.1.2：音频编码不支持警告 -->
            <div v-if="audioWarning" class="audio-warning">{{ audioWarning }}</div>
            <!-- v3.2.2：增益调节 + 快退快进（video.js 原生控制栏不含此功能，作为自定义覆盖层） -->
            <div class="video-extra-controls">
              <button class="extra-ctrl-btn" @click="seekRelative(-10)" title="快退 10 秒 (←)">
                <el-icon>⏪</el-icon>
              </button>
              <button class="extra-ctrl-btn" @click="seekRelative(10)" title="快进 10 秒 (→)">
                <el-icon>⏩</el-icon>
              </button>
              <span class="extra-label">音量增益</span>
              <select
                :value="videoGain"
                @change="(e) => { videoGain = Number((e.target as HTMLSelectElement).value); applyGain() }"
                class="gain-select"
                title="提升视频音量（Web Audio API）"
              >
                <option :value="1">1x</option>
                <option :value="1.5">1.5x</option>
                <option :value="1.8">1.8x</option>
                <option :value="2.5">2.5x</option>
                <option :value="4">4x</option>
              </select>
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
          <p class="hint">支持 PDF 阅读（翻页/缩放/旋转/文本选择）、视频播放（video.js 原生控制 + 音量增益）</p>
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
  View, Warning, ArrowRight, Loading, Open, RefreshRight
} from '@element-plus/icons-vue'

// v3.3.2：引入 @tato30/vue-pdf（基于 pdf.js 的 Vue 3 组件）
// v3.3.5：关键修复——改用 /minimal 入口！
//        默认入口 index.mjs 包含模块级副作用：
//          import PDFWorker from "pdfjs-dist/build/pdf.worker.min?url";
//          if (!GlobalWorkerOptions?.workerSrc) configWorker(PDFWorker);
//        该 ?url 导入在 Electron file:// 协议下解析失败会导致整个模块 import 崩溃，
//        表现为「点击学习资料无响应」。/minimal 入口无此副作用，仅导出组件+composable。
import { VuePDF, usePDF } from '@tato30/vue-pdf/minimal'
import '@tato30/vue-pdf/style.css'

// v3.3.3：修复 Electron file:// 环境下 pdf.js worker 无法从 data URL 加载的问题
// v3.3.4：从模块顶层移到 onMounted try/catch 内执行，避免 new PdfWorker() 抛异常导致整个模块加载失败
// v3.3.5：仍保留此处的 worker 初始化（workerPort 优先级高于 workerSrc），
//        真正生效的是我们通过 Vite ?worker&inline 构造的 blob Worker，不受 pdfjs 默认路径影响
import { GlobalWorkerOptions } from 'pdfjs-dist'
// eslint-disable-next-line import/no-unresolved
import PdfWorkerConstructor from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'

let pdfWorkerInitialized = false
function initPdfWorker() {
  if (pdfWorkerInitialized) return
  try {
    // v3.3.5：先强制清掉 @tato30/vue-pdf 默认入口可能遗留的无效 workerSrc（防止它内部 fallback 到错误路径）
    GlobalWorkerOptions.workerSrc = ''
    if (!GlobalWorkerOptions.workerPort && typeof PdfWorkerConstructor === 'function') {
      GlobalWorkerOptions.workerPort = new PdfWorkerConstructor() as unknown as Worker
    }
    pdfWorkerInitialized = true
  } catch (err) {
    console.warn('[Materials] pdf.js worker 初始化失败，PDF 预览可能不可用：', err)
  }
}

// v3.3.2：引入 @videojs-player/vue（Video.js 的 Vue 3 封装）
import { VideoPlayer } from '@videojs-player/vue'
import 'video.js/dist/video-js.css'
import type typeVideojs from 'video.js'

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

// ============ v3.3.2：PDF 状态管理（@tato30/vue-pdf） ============
// usePDF 接受 Ref<PDFSrc>，源变化时自动重新加载
const pdfSource = computed<string | undefined>(() => {
  if (currentFile.value?.ext === '.pdf' && currentFile.value?.url) {
    return currentFile.value.url
  }
  return undefined
})
const pdfLoading = ref(false)
const pdfError = ref(false)
const pdfProgress = ref(0)
const pdfPage = ref(1)
const pdfScale = ref(1)
const pdfFitParent = ref(true)
const pdfRotation = ref(0)

const { pdf, pages } = usePDF(pdfSource, {
  onProgress: (e: { loaded: number; total: number }) => {
    pdfLoading.value = true
    pdfError.value = false
    if (e.total) {
      pdfProgress.value = Math.round((e.loaded / e.total) * 100)
    }
  },
  onError: (_err: unknown) => {
    pdfLoading.value = false
    pdfError.value = true
  }
})

// pages 变化意味着 PDF 加载完成
watch(pages, (p) => {
  if (p > 0) {
    pdfLoading.value = false
    pdfError.value = false
    pdfProgress.value = 0
  }
})

// 源变化时重置状态
watch(pdfSource, (newVal) => {
  if (newVal) {
    // v3.3.4：首次打开 PDF 前确保 worker 已就绪
    initPdfWorker()
    pdfLoading.value = true
    pdfError.value = false
    pdfProgress.value = 0
    pdfPage.value = 1
    pdfScale.value = 1
    pdfFitParent.value = true
    pdfRotation.value = 0
  } else {
    // 离开 PDF 模式：销毁文档释放内存
    if (pdf.value) {
      pdf.value.destroy()
    }
    pdfLoading.value = false
    pdfError.value = false
  }
})

function onPdfPageLoaded() {
  // 单页渲染完成
}
function prevPage() {
  if (pdfPage.value > 1) pdfPage.value--
}
function nextPage() {
  if (pdfPage.value < pages.value) pdfPage.value++
}
function onPageInput() {
  if (pdfPage.value < 1) pdfPage.value = 1
  if (pdfPage.value > pages.value) pdfPage.value = pages.value
}
function zoomIn() {
  pdfFitParent.value = false
  pdfScale.value = Math.min(3, pdfScale.value + 0.25)
}
function zoomOut() {
  pdfFitParent.value = false
  pdfScale.value = Math.max(0.25, pdfScale.value - 0.25)
}
function fitWidth() {
  pdfFitParent.value = true
  pdfScale.value = 1
}
function rotatePdf() {
  pdfRotation.value = (pdfRotation.value + 90) % 360
}
function retryPdf() {
  if (pdfSource.value) {
    pdfError.value = false
    pdfLoading.value = true
    // 触发重新加载：先销毁再重新设置源
    if (pdf.value) {
      pdf.value.destroy()
    }
    nextTick(() => {
      const src = pdfSource.value
      if (src) {
        // usePDF 内部 watch 会在 ref 值变化时重新加载，
        // 但值未变时不会触发，这里手动重新设置
        pdfSource.value // 触发 computed 重新求值
      }
    })
  }
}

// ============ v3.3.2：视频状态管理（@videojs-player/vue） ============
const videoWrap = ref<HTMLElement | null>(null)
const vjsPlayer = ref<typeVideojs.Player | null>(null)
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

// v3.2.2：Web Audio 增益节点（用于提升音量）
let audioCtx: AudioContext | null = null
let gainNode: GainNode | null = null
let videoSourceNode: MediaElementAudioSourceNode | null = null
// v3.3.1：记录已接入增益链路的 video 元素——createMediaElementSource 每个元素仅能调用一次
let attachedVideoEl: HTMLVideoElement | null = null

// v3.2.2：缓冲百分比
const videoBuffered = ref(0)

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
  // v3.3.4：worker 初始化放 onMounted try/catch 内，失败不阻塞页面
  initPdfWorker()
  restoreFolder()
  window.addEventListener('keydown', onVideoKeydown)
})

// v3.3.1：组件卸载时彻底释放视频与音频资源
onUnmounted(() => {
  window.removeEventListener('keydown', onVideoKeydown)
  disposeAudioResources()
  if (pdf.value) {
    pdf.value.destroy()
  }
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
// v3.3.2：适配 video.js player 生命周期
watch(() => currentFile.value, (newVal, oldVal) => {
  const oldIsVideo = !!(oldVal && isVideo(oldVal.ext || ''))
  const newIsVideo = !!(newVal && isVideo(newVal.ext || ''))
  // 离开视频模式：释放 AudioContext
  if (oldIsVideo && !newIsVideo) {
    disposeAudioResources()
    vjsPlayer.value = null
  }
  // 重置视频状态
  videoPlaying.value = false
  videoLoading.value = false
  audioWarning.value = ''
  videoBuffered.value = 0
})

// ============ 视频播放器事件处理 ============

// v3.3.2：video.js player 挂载——保存 player 实例
function onVideoMounted(player: typeVideojs.Player) {
  vjsPlayer.value = player
}

function onVideoReady(player: typeVideojs.Player) {
  vjsPlayer.value = player
}

// v3.1.2 + v3.2.2：loadedmetadata 后进行无声检测
function onVideoLoadedMetadata() {
  if (!vjsPlayer.value) return
  const el = vjsPlayer.value.el()?.querySelector('video') as (HTMLVideoElement & {
    audioTracks?: { length: number }
    mozHasAudio?: boolean
    webkitAudioDecodedByteCount?: number
  }) | null
  if (!el) return
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
  // 尝试播放（非用户交互可能被拦截，吞异常）
  if (vjsPlayer.value.paused()) {
    vjsPlayer.value.play()?.then(() => {
      videoPlaying.value = true
      ensureAudioBoost()
    }).catch(() => {
      videoPlaying.value = false
    })
  }
}

// v3.2.2：首次播放时搭建 Web Audio 增益链路（提升视频音量）
// v3.3.1：按 video 元素身份判断——同元素复用链路，新元素重建链路
// v3.3.2：通过 video.js player 获取底层 video 元素
async function ensureAudioBoost(): Promise<void> {
  if (!vjsPlayer.value) return
  const el = vjsPlayer.value.el()?.querySelector('video') as HTMLVideoElement | null
  if (!el) return
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
  if (vjsPlayer.value) {
    videoVolume.value = Math.round(vjsPlayer.value.volume() * 100)
  }
}

// v3.1.2 + v3.2.2：视频加载错误处理
function onVideoError() {
  const err = vjsPlayer.value?.error()
  const code = err?.code || 0
  if (code === 3 || code === 4) {
    audioWarning.value = '视频加载/解码失败，可能使用了浏览器不支持的编码，建议转码为 MP4(H.264 + AAC) 后重试'
  } else {
    audioWarning.value = '视频加载失败，请检查文件是否损坏或格式是否支持'
  }
}

// v3.2.3：相对快进/快退（秒），自动夹紧到 [0, duration]
function seekRelative(delta: number) {
  if (!vjsPlayer.value) return
  const dur = vjsPlayer.value.duration() || 0
  let next = (vjsPlayer.value.currentTime() || 0) + delta
  if (next < 0) next = 0
  if (dur && next > dur) next = dur
  vjsPlayer.value.currentTime(next)
}

// v3.2.3：视频键盘快捷键：←/→ 快退快进 5 秒，↑/↓ 音量 ±5，空格 播放/暂停
function onVideoKeydown(e: KeyboardEvent) {
  if (!currentFile.value || !isVideo(currentFile.value.ext || '')) return
  if (!vjsPlayer.value) return
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
      if (vjsPlayer.value.paused()) {
        vjsPlayer.value.play()?.then(() => { videoPlaying.value = true; ensureAudioBoost() }).catch(() => {})
      } else {
        vjsPlayer.value.pause()
        videoPlaying.value = false
      }
      break
  }
}

function changeVolumeStep(step: number) {
  if (!vjsPlayer.value) return
  let v = vjsPlayer.value.volume() * 100 + step
  if (v < 0) v = 0
  if (v > 100) v = 100
  vjsPlayer.value.volume(v / 100)
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
    // video.js 自行处理全屏状态，此处无需额外操作
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

.pdf-page-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--mo-text-3, #888);
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

/* v3.3.2：视频播放区域（使用 video.js） */
.video-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
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

.video-player {
  width: 100%;
  height: 100%;
}

.video-player :deep(.video-js) {
  width: 100%;
  height: 100%;
  border-radius: 14px;
  overflow: hidden;
  font-size: 13px;
}

/* v3.3.2：video.js 深色主题适配 */
.video-player :deep(.video-js .vjs-control-bar) {
  background: linear-gradient(180deg, rgba(20, 22, 30, 0.85) 0%, rgba(10, 12, 18, 0.95) 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.video-player :deep(.video-js .vjs-button > .vjs-icon-placeholder:before) {
  font-size: 16px;
  line-height: 28px;
  color: #fff;
}

.video-player :deep(.video-js .vjs-slider) {
  background-color: rgba(255, 255, 255, 0.15);
}

.video-player :deep(.video-js .vjs-load-progress) {
  background: rgba(255, 255, 255, 0.3);
}

.video-player :deep(.video-js .vjs-play-progress) {
  background: var(--mo-primary, #409eff);
}

.video-player :deep(.video-js .vjs-volume-level) {
  background: var(--mo-primary, #409eff);
}

.video-player :deep(.video-js .vjs-big-play-button) {
  background-color: rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  width: 88px;
  height: 88px;
  line-height: 88px;
  font-size: 48px;
  border: none;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), 0 0 0 6px rgba(255, 255, 255, 0.12);
}

.video-player :deep(.video-js .vjs-big-play-button .vjs-icon-placeholder:before) {
  color: var(--mo-primary, #409eff);
  font-size: 48px;
  line-height: 88px;
}

.video-player :deep(.video-js:hover .vjs-big-play-button) {
  background-color: #fff;
  transform: scale(1.05);
}

.video-player :deep(.video-js .vjs-time) {
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
}

.video-player :deep(.video-js .vjs-menu-button-popup .vjs-menu .vjs-menu-content) {
  background: rgba(20, 22, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.video-player :deep(.video-js .vjs-menu li) {
  font-size: 12px;
  color: #fff;
}

.video-player :deep(.video-js .vjs-menu li.vjs-selected) {
  background: var(--mo-primary, #409eff);
  color: #fff;
}

/* v3.3.2：全屏时 video.js 铺满 */
.video-stage:fullscreen {
  border-radius: 0;
  border: none;
}

.video-stage:fullscreen .video-player :deep(.video-js) {
  border-radius: 0;
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

/* v3.3.2：自定义额外控制栏（增益 + 快退快进） */
.video-extra-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: linear-gradient(180deg, rgba(20, 22, 30, 0.92) 0%, rgba(10, 12, 18, 0.96) 100%);
  color: #fff;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.extra-ctrl-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.extra-ctrl-btn:hover {
  background: var(--mo-primary, #409eff);
  border-color: transparent;
  color: #fff;
  transform: translateY(-1px);
}

.extra-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
  flex-shrink: 0;
  margin-left: auto;
}

.gain-select {
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

.gain-select:hover {
  border-color: var(--mo-primary, #409eff);
}

.gain-select option {
  background: #1a1c25;
  color: #fff;
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
