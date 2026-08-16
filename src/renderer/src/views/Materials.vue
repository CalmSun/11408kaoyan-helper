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
            <el-radio-button value="doc">文档</el-radio-button>
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
                <el-icon v-else-if="node.ext === '.docx'"><Document /></el-icon>
                <el-icon v-else-if="node.ext === '.xlsx'"><Files /></el-icon>
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
          <!-- PDF 预览（v3.4.0：Chromium PDFium <iframe> 渲染） -->
          <div v-if="currentFile.ext === '.pdf'" class="pdf-wrap">
            <!-- PDF 工具栏（v3.4.1：新增页码导航与进度保存） -->
            <div class="pdf-toolbar">
              <div class="pdf-page-nav">
                <button class="pdf-page-btn" :disabled="pdfPage <= 1" @click="goPdfPage(-1)" title="上一页">
                  <el-icon><ArrowLeft /></el-icon>
                </button>
                <span class="pdf-page-indicator">
                  第
                  <input
                    v-model.number="pdfPageInput"
                    class="pdf-page-input"
                    type="number"
                    min="1"
                    @change="jumpPdfPage(pdfPageInput)"
                    title="输入页码后回车跳转"
                  />
                  页
                </span>
                <button class="pdf-page-btn" @click="goPdfPage(1)" title="下一页">
                  <el-icon><ArrowRight /></el-icon>
                </button>
              </div>
              <el-icon class="pdf-tip-icon"><InfoFilled /></el-icon>
              <span class="pdf-tip">已通过内置查看器打开，可翻页 / 缩放 / 搜索 / 打印（快捷键 Ctrl+F 搜索），返回后自动恢复阅读进度</span>
            </div>
            <!-- PDF 渲染区 -->
            <div class="pdf-viewer-wrap">
              <iframe
                v-if="pdfFrameUrl"
                ref="pdfFrame"
                class="pdf-frame"
                :src="pdfFrameUrl"
                @load="pdfLoading = false"
                @error="onPdfFrameError"
              ></iframe>
              <!-- 加载占位 -->
              <div v-if="pdfLoading" class="pdf-loading-mask">
                <div class="pdf-loading-spinner"></div>
                <span class="pdf-loading-text">PDF 加载中...</span>
              </div>
              <!-- 错误提示 -->
              <div v-if="pdfError" class="pdf-error-mask">
                <el-icon :size="40"><Warning /></el-icon>
                <span>PDF 加载失败</span>
                <span class="pdf-error-detail">{{ pdfError }}</span>
                <el-button size="small" type="primary" @click="pdfRetry">重试</el-button>
              </div>
            </div>
          </div>

          <!-- v3.4.7：Office 文档预览（docx / xlsx，@open-file-viewer/core officePlugin） -->
          <div v-else-if="isDocumentFile(currentFile.ext)" class="doc-wrap">
            <!-- v3.4.7：文档工具栏（玻璃风格，与 PDF 工具栏一致）：
                 分页导航（docx 有分页；xlsx 无分页自动隐藏）+ 阅读进度提示 -->
            <div class="doc-toolbar">
              <div v-if="docTotalPages > 0" class="doc-page-nav">
                <button class="doc-page-btn" :disabled="docPage <= 1" @click="goDocPage(-1)" title="上一页">
                  <el-icon><ArrowLeft /></el-icon>
                </button>
                <span class="doc-page-indicator">
                  第
                  <input
                    v-model.number="docPageInput"
                    class="doc-page-input"
                    type="number"
                    min="1"
                    :max="docTotalPages"
                    @change="jumpDocPage(docPageInput)"
                    title="输入页码后回车跳转"
                  />
                  / {{ docTotalPages }} 页
                </span>
                <button class="doc-page-btn" :disabled="docPage >= docTotalPages" @click="goDocPage(1)" title="下一页">
                  <el-icon><ArrowRight /></el-icon>
                </button>
              </div>
              <el-icon class="pdf-tip-icon"><InfoFilled /></el-icon>
              <span class="pdf-tip">滚动阅读自动记忆页码，返回后自动恢复进度；缩放 / 全屏 / 搜索见下方工具栏</span>
            </div>
            <!-- 阅读进度条（滚动节流更新，避免频繁写 localStorage） -->
            <div class="doc-progress-wrap" :title="`阅读进度 ${docProgress}%`">
              <div class="doc-progress-bar" :style="{ width: docProgress + '%' }"></div>
            </div>
            <div ref="viewerContainer" class="doc-viewer-wrap"></div>
            <div v-if="viewerCreating" class="doc-loading-mask">
              <div class="doc-loading-spinner"></div>
              <span class="doc-loading-text">文档加载中...</span>
            </div>
            <div v-if="viewerError" class="doc-error-mask">
              <el-icon :size="40"><Warning /></el-icon>
              <span>文档加载失败</span>
              <span class="doc-error-detail">{{ viewerError }}</span>
              <el-button size="small" type="primary" @click="openDocumentViewer(currentFile)">重试</el-button>
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
                @pause="onVideoPause"
                @ended="onVideoEnded"
                @waiting="videoLoading = true"
                @playing="videoLoading = false; videoPlaying = true"
                @volumechange="onVolumeChange"
                @ratechange="onVideoRateChange"
                @timeupdate="onVideoTimeUpdate"
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
          <p class="hint">支持 PDF 阅读（页码导航/进度记忆）、Word/Excel 文档预览（docx/xlsx）、视频播放（倍速/增益/连播/播放列表）</p>
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
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Folder, FolderOpened, Refresh, Document, VideoPlay, Files,
  View, Warning, ArrowRight, ArrowLeft, List, Loading, Open, InfoFilled
} from '@element-plus/icons-vue'
// v3.4.4：Office 文档预览改用 @open-file-viewer/core（officePlugin 按需动态加载）
// open-file-viewer 的 officePlugin 统一支持 docx/xlsx/pptx/rtf/odt 等，包体仅在打开文档时加载，
// 避免常驻体积。PDF 仍用 PDFium iframe —— 因 open-file-viewer 依赖 pdfjs-dist 6.x，
// 在 Electron 28 (Chromium 120) 存在 ES2025 语法兼容问题（见项目历史教训）。
import '@open-file-viewer/core/style.css'

// v3.4.0: PDF 预览改用 Chromium 内置 PDFium（<iframe>）。
// 此前 pdfjs-dist 6.x 在 Electron 28 (Chromium 120) 下因 ES2025 语法/worker 兼容问题
// 反复出现「加载后无内容」；Chromium PDFium 为系统内置渲染器，零依赖、无 worker、
// 不额外占内存，且自带翻页/缩放/搜索/打印等功能，是最稳定方案。
const pdfFrame = ref<HTMLIFrameElement | null>(null)
const pdfFrameUrl = ref('')

// v3.4.0: 由当前 PDF 文件 URL 拼接 PDFium 查看器参数（FitH 适应宽度，toolbar 显示原生工具条）
// v3.4.1: 支持 page 参数——打开时恢复到上次阅读页码
function buildPdfFrameUrl(url: string, page = 1): string {
  return `${url}#view=FitH&toolbar=1&page=${page}`
}

// v3.4.1: 当前 PDF 页码（父页面自管，导航时重载 iframe 的 page 参数）
const pdfPage = ref(1)
const pdfPageInput = ref(1)

// v3.4.0: 卸载 iframe 释放 PDFium 渲染资源（切换文件/离开 PDF 模式时调用）
function unloadPdf() {
  pdfFrameUrl.value = ''
}

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
// v3.4.3：文档预览支持（docx / xlsx）
const DOC_EXTS = ['.docx', '.xlsx']

// ============ v3.4.7：@open-file-viewer/core 文档预览状态（docx / xlsx） ============
const viewerContainer = ref<HTMLElement | null>(null)
let viewerInstance: any = null
const viewerCreating = ref(false)
const viewerError = ref('')

const docPage = ref(1)
const docPageInput = ref(1)
const docTotalPages = ref(0)
const docProgress = ref(0)

let lastDocProgressSave = 0
let docScrollRestoreAttempt = 0
const DOC_PROGRESS_SAVE_INTERVAL = 1500
// v3.4.7：页码 / 滚动恢复重试上限（分页块为异步渲染时轮询直到就绪）
const DOC_RESTORE_MAX_ATTEMPTS = 60
// v3.4.7：open-file-viewer 分页文档页面块选择器（取自库内部 goToRenderedPage，
// 覆盖 docx / 文本框页面 / 旧版 msdoc / pptx 幻灯片，确保页码统计准确）
const DOC_PAGE_FRAME_SELECTOR = '.ofv-docx-page-frame, .ofv-docx-textbox-page, .ofv-msdoc-page, .ofv-slide, .ofv-ppt-binary-slide'

let docScrollCaptureHandler: ((e: Event) => void) | null = null
let docResizeObserver: ResizeObserver | null = null
let docMutationObserver: MutationObserver | null = null

function isDocumentFile(ext?: string): boolean {
  return ext ? DOC_EXTS.includes(ext) : false
}

// v3.4.7：判断元素是否真正可滚动（用于定位文档真实滚动容器）
function isScrollableEl(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false
  const style = getComputedStyle(el)
  const overflowY = style.overflowY
  return (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1
}

// v3.4.7：定位真实滚动容器（修复浏览进度归零 / 页码不更新的根因）。
// 关键：库的 .ofv-viewport 被设为 overflow: visible（并非滚动容器），
// 旧代码据此把“外层挂载容器”当滚动容器，导致 scrollTop 恒为 0、进度卡 0、
// IntersectionObserver 根错误，从而页码 / 阅读进度无法正确跟踪。
// 正确做法：从首个页面块向上寻找最近的“可滚动祖先”作为滚动容器；
// 找不到时再退化到已知候选选择器；最终退回挂载容器。
function getDocumentScrollEl(): HTMLElement | null {
  const root = viewerContainer.value
  if (!root) return null
  const firstFrame = root.querySelector<HTMLElement>(DOC_PAGE_FRAME_SELECTOR)
  if (firstFrame) {
    let el: HTMLElement | null = firstFrame.parentElement
    while (el && el !== (root.parentElement as HTMLElement | null)) {
      const scrollable = isScrollableEl(el)
      if (scrollable) return el
      el = el.parentElement
    }
  }
  for (const sel of ['.ofv-table-scroll', '.ofv-office', '.ofv-docx', '.ofv-root', '.ofv-viewport']) {
    const el = root.querySelector<HTMLElement>(sel)
    if (el && isScrollableEl(el)) return el
  }
  return isScrollableEl(root) ? root : null
}

// v3.4.7：获取分页文档的页面块（docx / pptx 等有分页；xlsx 无分页返回空）
function getDocPageFrames(): HTMLElement[] {
  if (!viewerContainer.value) return []
  return Array.from(viewerContainer.value.querySelectorAll<HTMLElement>(DOC_PAGE_FRAME_SELECTOR))
}

// v3.4.7：根据“真实滚动元素”用几何法计算当前可见页。
// 取包含视口竖直中心的页面块；若中心落在页面间隙，则取顶部已越过中心的最近页。
// 几何法不依赖 IntersectionObserver 的根（根错配正是之前页码不更新的根因）。
function computeDocPageFromScroller(scroller: HTMLElement): number {
  const frames = getDocPageFrames()
  if (frames.length === 0) return 1
  if (docTotalPages.value !== frames.length) docTotalPages.value = frames.length
  const sTop = scroller.getBoundingClientRect().top
  const center = sTop + scroller.clientHeight / 2
  for (let i = 0; i < frames.length; i++) {
    const r = frames[i].getBoundingClientRect()
    if (r.top <= center && r.bottom >= center) return i + 1
  }
  let current = 0
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].getBoundingClientRect().bottom < center) current = i
    else break
  }
  return current + 1
}

// v3.4.7：无滚动事件时（翻页 / 恢复 / 缩放 / 布局变化）刷新当前页码
function refreshDocPageNow() {
  const frames = getDocPageFrames()
  if (frames.length === 0) return
  if (docTotalPages.value !== frames.length) docTotalPages.value = frames.length
  const scroller = getDocumentScrollEl()
  if (!scroller) return
  const page = computeDocPageFromScroller(scroller)
  if (page !== docPage.value) {
    docPage.value = page
    docPageInput.value = page
  }
}

// v3.4.7：capture 阶段监听任意内层滚动，自动识别“真正滚动的元素”并更新页码 / 进度。
// 关键：docx 实际滚动容器可能是 .ofv-viewport / .ofv-panel / 外层 .doc-viewer-wrap 之一，
// 旧代码“向上找第一个可滚动祖先”会误判，导致滚动监听与 IntersectionObserver 根错配、
// 页码 / 进度永远停在恢复值。capture 阶段能捕获任意内层 scroll 事件，e.target 即真实滚动元素。
function handleDocScrollCapture(e: Event) {
  const target = e.target as HTMLElement | null
  if (!target || !viewerContainer.value || !viewerContainer.value.contains(target)) return
  const scroller = target
  const max = scroller.scrollHeight - scroller.clientHeight
  const progress = max > 0 ? Math.min(100, Math.max(0, Math.round((scroller.scrollTop / max) * 100))) : 0
  if (progress !== docProgress.value) docProgress.value = progress
  const page = computeDocPageFromScroller(scroller)
  if (page !== docPage.value) {
    docPage.value = page
    docPageInput.value = page
  }
  const now = Date.now()
  if (now - lastDocProgressSave >= DOC_PROGRESS_SAVE_INTERVAL) {
    lastDocProgressSave = now
    saveDocumentProgress(progress)
  }
}

// v3.4.7：绑定 / 解绑（capture 阶段，全局只挂一次，按 containment 过滤）
function bindDocScrollCapture() {
  unbindDocScrollCapture()
  docScrollCaptureHandler = handleDocScrollCapture
  window.addEventListener('scroll', docScrollCaptureHandler, true)
}
function unbindDocScrollCapture() {
  if (docScrollCaptureHandler) {
    window.removeEventListener('scroll', docScrollCaptureHandler, true)
    docScrollCaptureHandler = null
  }
}

// v3.4.7：MutationObserver 监听文档 DOM 变化（分页块异步渲染就绪后刷新页码）
function setupDocMutationObserver() {
  if (!viewerContainer.value) return
  if (docMutationObserver) {
    docMutationObserver.disconnect()
    docMutationObserver = null
  }
  docMutationObserver = new MutationObserver(() => {
    const frames = getDocPageFrames()
    if (frames.length > 0) {
      if (frames.length !== docTotalPages.value) docTotalPages.value = frames.length
      refreshDocPageNow()
    }
  })
  docMutationObserver.observe(viewerContainer.value, { childList: true, subtree: true })
}

// v3.4.7：ResizeObserver 监听缩放 / 布局变化，重算当前页码（缩放不改变滚动也可能改变可见页）
function setupDocResizeObserver() {
  if (!viewerContainer.value || typeof ResizeObserver === 'undefined') return
  if (docResizeObserver) {
    docResizeObserver.disconnect()
    docResizeObserver = null
  }
  docResizeObserver = new ResizeObserver(() => {
    if (getDocPageFrames().length > 0) refreshDocPageNow()
  })
  docResizeObserver.observe(viewerContainer.value)
}

// v3.4.7：保存文档阅读进度（页码 + 滚动百分比）
function saveDocumentProgress(progress = docProgress.value, filePath?: string) {
  const path = filePath || currentFile.value?.path
  if (!path) return
  saveProgress(path, { docPage: docPage.value, scrollProgress: progress })
}

// v3.4.7：跳到指定页（docx 等有分页文档）—— 优先使用库官方 goToPage API
function jumpDocPage(page: number) {
  if (!Number.isFinite(page)) return
  const frames = getDocPageFrames()
  if (frames.length === 0) return
  const p = Math.min(frames.length, Math.max(1, Math.round(page)))
  docPage.value = p
  docPageInput.value = p
  if (viewerInstance && typeof viewerInstance.goToPage === 'function') {
    // 官方 API：officePlugin 内部 goToRenderedPage 滚动到对应页面块
    viewerInstance.goToPage(p)
  } else {
    // 兜底：库未提供 goToPage 时按滚动定位
    const scroller = getDocumentScrollEl()
    const target = frames[p - 1]
    if (scroller && target) {
      const top = scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16
      try {
        scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      } catch {
        scroller.scrollTop = Math.max(0, top)
      }
    }
  }
  saveDocumentProgress()
}

function goDocPage(delta: number) {
  jumpDocPage(docPage.value + delta)
}

// v3.4.7：创建文档预览（createViewer + officePlugin）
async function openDocumentViewer(file: MaterialNode) {
  destroyDocumentViewer()
  viewerCreating.value = true
  viewerError.value = ''
  docProgress.value = 0
  docPage.value = 1
  docPageInput.value = 1
  docTotalPages.value = 0
  lastDocProgressSave = 0
  docScrollRestoreAttempt = 0

  try {
    const { createViewer, officePlugin } = await import('@open-file-viewer/core')
    await new Promise(resolve => setTimeout(resolve, 80))
    if (!viewerContainer.value) { viewerCreating.value = false; return }

    // 恢复上次阅读页码：库官方 initialPage 在加载后定位；onLoad 后再叠加 goToPage 兜底，
    // 规避分页块异步渲染导致 initialPage 提前生效失败的情况。
    const prog = loadProgress()[file.path]
    const savedPage = typeof prog?.docPage === 'number' && prog.docPage > 0 ? prog.docPage : 1

    viewerInstance = createViewer({
      container: viewerContainer.value,
      file: file.url,
      fileName: file.name,
      height: '100%',
      width: '100%',
      theme: 'auto',
      locale: 'zh-CN',
      initialPage: savedPage,
      toolbar: {
        zoom: true,
        fullscreen: true,
        search: true,
        download: false,
        print: false,
        rotate: false
      },
      plugins: [officePlugin()],
      onLoad: () => {
        viewerCreating.value = false
        bindDocScrollCapture()
        setupDocMutationObserver()
        setupDocResizeObserver()
        restoreDocumentProgress()
        requestAnimationFrame(refreshDocPageNow)
      },
      onError: (err: unknown) => {
        viewerCreating.value = false
        viewerError.value = err instanceof Error ? err.message : '文档加载失败'
      }
    })
  } catch (e) {
    viewerCreating.value = false
    viewerError.value = e instanceof Error ? e.message : '文档加载失败'
  }
}

// v3.4.7：恢复文档阅读进度（优先按页码定位，无分页文档按滚动百分比）
function restoreDocumentProgress() {
  if (!currentFile.value) return
  const prog = loadProgress()[currentFile.value.path]
  const savedPage = typeof prog?.docPage === 'number' ? prog.docPage : 0
  const savedScroll = typeof prog?.scrollProgress === 'number' ? prog.scrollProgress : 0
  if (savedPage > 0) { restoreDocPage(savedPage); return }
  if (savedScroll > 0) restoreDocScroll(savedScroll)
}

// v3.4.7：恢复 docx 页码（库官方 goToPage，页面块异步渲染时轮询重试）
function restoreDocPage(page: number) {
  docScrollRestoreAttempt = 0
  const apply = () => {
    const frames = getDocPageFrames()
    if (frames.length === 0) {
      if (docScrollRestoreAttempt++ < DOC_RESTORE_MAX_ATTEMPTS) requestAnimationFrame(apply)
      return
    }
    const targetIdx = Math.min(frames.length - 1, Math.max(0, page - 1))
    if (viewerInstance && typeof viewerInstance.goToPage === 'function') {
      viewerInstance.goToPage(targetIdx + 1)
    } else {
      const scroller = getDocumentScrollEl()
      const target = frames[targetIdx]
      if (scroller && target) {
        const top = scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16
        scroller.scrollTop = Math.max(0, top)
      }
    }
    docPage.value = targetIdx + 1
    docPageInput.value = targetIdx + 1
  }
  requestAnimationFrame(apply)
}

// v3.4.7：恢复 xlsx / 无分页文档的滚动百分比
function restoreDocScroll(target: number) {
  docScrollRestoreAttempt = 0
  const apply = () => {
    const el = getDocumentScrollEl()
    if (!el) { if (docScrollRestoreAttempt++ < DOC_RESTORE_MAX_ATTEMPTS) requestAnimationFrame(apply); return }
    const max = el.scrollHeight - el.clientHeight
    if (max <= 0) { if (docScrollRestoreAttempt++ < DOC_RESTORE_MAX_ATTEMPTS) requestAnimationFrame(apply); return }
    el.scrollTop = (max * target) / 100
    const reached = Math.abs(el.scrollTop - (max * target) / 100) < 8
    if (!reached && docScrollRestoreAttempt++ < DOC_RESTORE_MAX_ATTEMPTS) requestAnimationFrame(apply)
  }
  requestAnimationFrame(apply)
}

// v3.4.7：销毁文档预览
function destroyDocumentViewer() {
  unbindDocScrollCapture()
  if (docResizeObserver) {
    docResizeObserver.disconnect()
    docResizeObserver = null
  }
  if (docMutationObserver) {
    docMutationObserver.disconnect()
    docMutationObserver = null
  }
  if (viewerInstance) {
    try { viewerInstance.destroy() } catch { /* ignore */ }
    viewerInstance = null
  }
  viewerCreating.value = false
  viewerError.value = ''
  docProgress.value = 0
  docPage.value = 1
  docPageInput.value = 1
  docTotalPages.value = 0
}

// ============ v3.4.0: PDF 状态（Chromium PDFium <iframe> 渲染） ============
// PDF 加载由 Chromium 内核处理，无需前端解析，状态仅需记录是否出错/加载中。
const pdfLoading = ref(false)
const pdfError = ref('')

// v3.4.0: 加载 PDF（iframe 懒挂载，卸载时清空 src 释放 PDFium 资源）
// v3.4.1: 打开时恢复到上次阅读页码
function loadPdf(url: string) {
  unloadPdf()
  pdfLoading.value = true
  pdfError.value = ''
  // 恢复上次阅读页码
  const prog = currentFile.value ? loadProgress()[currentFile.value.path] : null
  const startPage = prog?.pdfPage && prog.pdfPage > 0 ? prog.pdfPage : 1
  pdfPage.value = startPage
  pdfPageInput.value = startPage
  // 打开时直接指定起始页码，由 iframe 加载完成后关闭 loading
  pdfFrameUrl.value = buildPdfFrameUrl(url, startPage)
}

// v3.4.1: PDF 页码导航（±1 页）并保存进度
function goPdfPage(delta: number) {
  const target = pdfPage.value + delta
  if (target < 1) return
  jumpPdfPage(target)
}

// v3.4.3：PDF 页码导航 — 仅更新 iframe hash，无需重载整个 PDF
function jumpPdfPage(target: number) {
  if (!Number.isFinite(target)) return
  if (target < 1) target = 1
  pdfPage.value = target
  pdfPageInput.value = target
  if (currentFile.value) saveProgress(currentFile.value.path, { pdfPage: target })
  const url = currentFile.value?.url
  if (!url) return
  // 仅更新 hash 即可跳转页码，Chromium PDFium 不会重新加载 PDF
  pdfFrameUrl.value = buildPdfFrameUrl(url, target)
}

function pdfRetry() {
  if (currentFile.value?.url) loadPdf(currentFile.value.url)
}

// v3.4.0: iframe 加载出错时提示（PDFium 无法打开的文件会走此回调）
function onPdfFrameError() {
  pdfLoading.value = false
  pdfError.value = '文件可能已损坏或不是有效的 PDF 文档'
}

function destroyPdf() {
  unloadPdf()
  pdfLoading.value = false
  pdfError.value = ''
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
  // v3.4.1：播放结束保存进度（结尾附近自动置 0，下次从头开始）
  if (nativeVideo.value && currentFile.value) {
    saveVideoProgress(nativeVideo.value.currentTime, nativeVideo.value.duration)
  }
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
        if (filterType.value === 'doc' && !DOC_EXTS.includes(node.ext || '')) continue
        if (filterType.value === 'video' && !isVideo(node.ext || '')) continue
        if (filterType.value === 'other' && (node.ext === '.pdf' || DOC_EXTS.includes(node.ext || '') || isVideo(node.ext || ''))) continue
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
      if (filterType.value === 'doc' && DOC_EXTS.includes(child.ext || '')) return true
      if (filterType.value === 'video' && isVideo(child.ext || '')) return true
      if (filterType.value === 'other' && child.ext !== '.pdf' && !DOC_EXTS.includes(child.ext || '') && !isVideo(child.ext || '')) return true
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

// ============ v3.4.2：学习进度保存（PDF 页码 / 视频播放位置 / 当前文件路径）
// 以文件 path 为 key 存 localStorage，重新打开应用后自动恢复上次文件与进度
const PROGRESS_KEY = 'materials-progress'
const CURRENT_FILE_KEY = 'materials-current-file'

interface MaterialProgressEntry {
  pdfPage?: number
  videoTime?: number
  videoDuration?: number
  // v3.4.7：Office 文档（docx）阅读页码
  docPage?: number
  // v3.4.4：Office 文档阅读进度（滚动百分比 0-100，xlsx 及无分页文档用）
  scrollProgress?: number
  updatedAt?: number
}
type MaterialProgress = Record<string, MaterialProgressEntry>

function loadProgress(): MaterialProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch { /* ignore */ }
  return {}
}

function saveProgress(path: string, patch: Partial<MaterialProgressEntry>) {
  if (!path) return
  const all = loadProgress()
  all[path] = { ...(all[path] || {}), ...patch, updatedAt: Date.now() }
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)) } catch { /* ignore */ }
}

// v3.4.1：视频进度保存（按文件 path）
function saveVideoProgress(time: number, dur: number) {
  if (!currentFile.value || !(dur > 0)) return
  // 已看到结尾附近（最后 5 秒）视为看完，下次从头开始
  const finalTime = time >= dur - 5 ? 0 : time
  saveProgress(currentFile.value.path, { videoTime: finalTime, videoDuration: dur })
}

// v3.4.1：视频播放中节流保存（每 5 秒，避免频繁写 localStorage）
let lastVideoSaveTime = 0
function onVideoTimeUpdate() {
  const el = nativeVideo.value
  if (!el || !currentFile.value) return
  const now = Date.now()
  if (now - lastVideoSaveTime < 5000) return
  lastVideoSaveTime = now
  saveVideoProgress(el.currentTime, el.duration)
}

// v3.4.1：视频暂停时保存进度
function onVideoPause() {
  videoPlaying.value = false
  if (nativeVideo.value && currentFile.value) {
    saveVideoProgress(nativeVideo.value.currentTime, nativeVideo.value.duration)
  }
}

// v3.4.1：打开视频时恢复到上次观看位置（结尾附近从头开始）
function restoreVideoProgress(el: HTMLVideoElement) {
  if (!currentFile.value) return
  const prog = loadProgress()[currentFile.value.path]
  if (!prog) return
  const savedTime = prog.videoTime || 0
  const dur = el.duration || 0
  if (savedTime > 5 && savedTime < dur - 5) {
    el.currentTime = savedTime
  }
}

// ============ 生命周期 ============
onMounted(async () => {
  await restoreFolder()
  // v3.4.2：文件树恢复后，自动打开上次查看的文件并恢复阅读/播放进度
  restoreCurrentFile()
  // v3.4.1：keep-alive 下键盘监听改由 onActivated/onDeactivated 控制
  // v3.4.2：应用退出前兜底保存当前视频进度
  window.addEventListener('beforeunload', handleBeforeUnload)
})

// v3.4.1：keep-alive 激活（从其他页面返回学习资料页）时恢复键盘监听
// v3.4.3：返回时恢复 PDF 页码和文档进度
// v3.4.7：返回时恢复 Office 文档页码/滚动进度
onActivated(() => {
  window.addEventListener('keydown', onVideoKeydown)
  // 恢复当前文件进度
  if (currentFile.value) {
    if (currentFile.value.ext === '.pdf') {
      const prog = loadProgress()[currentFile.value.path]
      if (prog?.pdfPage) {
        pdfPage.value = prog.pdfPage
        pdfPageInput.value = prog.pdfPage
      }
    } else if (isDocumentFile(currentFile.value.ext || '')) {
      bindDocScrollCapture()
      setupDocMutationObserver()
      setupDocResizeObserver()
      restoreDocumentProgress()
      requestAnimationFrame(refreshDocPageNow)
    } else if (isVideo(currentFile.value.ext || '')) {
      const el = nativeVideo.value
      if (el) {
        const prog = loadProgress()[currentFile.value.path]
        if (prog?.videoTime && prog.videoTime > 5 && prog.videoDuration && prog.videoTime < prog.videoDuration - 5) {
          el.currentTime = prog.videoTime
        }
      }
    }
  }
})

// v3.4.1：keep-alive 失活（切换到其他页面）时：
//   - 移除键盘监听，避免误控隐藏页面的视频
//   - 保存视频进度并暂停，保持「原状态」，返回后可继续观看
// v3.4.4：失活时同步兜底保存文档阅读进度
onDeactivated(() => {
  window.removeEventListener('keydown', onVideoKeydown)
  if (nativeVideo.value && currentFile.value && isVideo(currentFile.value.ext || '')) {
    saveVideoProgress(nativeVideo.value.currentTime, nativeVideo.value.duration)
    nativeVideo.value.pause()
    videoPlaying.value = false
  } else if (currentFile.value && isDocumentFile(currentFile.value.ext || '')) {
    saveDocumentProgress()
  }
})

// v3.3.1：组件卸载时彻底释放视频与音频资源
onUnmounted(() => {
  window.removeEventListener('keydown', onVideoKeydown)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // v3.4.2：卸载前保存当前视频进度（重启后可接续）
  if (nativeVideo.value && currentFile.value && isVideo(currentFile.value.ext || '')) {
    saveVideoProgress(nativeVideo.value.currentTime, nativeVideo.value.duration)
  }
  disposeAudioResources()
  // v3.3.9: 销毁 PDF 文档释放内存
  destroyPdf()
  // v3.4.4: 销毁 Office 文档预览释放内存
  destroyDocumentViewer()
})

// v3.4.2：应用退出前兜底保存当前视频进度（页面卸载/关窗/退出时触发）
// v3.4.4：同步兜底保存文档阅读进度
function handleBeforeUnload() {
  if (nativeVideo.value && currentFile.value && isVideo(currentFile.value.ext || '')) {
    saveVideoProgress(nativeVideo.value.currentTime, nativeVideo.value.duration)
  } else if (currentFile.value && isDocumentFile(currentFile.value.ext || '')) {
    saveDocumentProgress()
  }
}

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
// v3.4.0：PDF 走 PDFium iframe（懒挂载 + 卸载释放）
watch(() => currentFile.value, async (newVal, oldVal) => {
  // v3.4.7：切换前兜底保存旧文档进度 —— 此时 currentFile 已指向新文件，
  // 但 docPage / docProgress ref 仍属于旧文档，用 oldVal.path 落盘
  if (oldVal && DOC_EXTS.includes(oldVal.ext || '')) {
    saveDocumentProgress(docProgress.value, oldVal.path)
  }
  // v3.4.0: 离开 PDF 模式时卸载 iframe 释放渲染资源
  if (oldVal?.ext === '.pdf' && newVal?.ext !== '.pdf') {
    await destroyPdf()
  }
  // 进入 PDF 模式：加载文档
  if (newVal?.ext === '.pdf' && newVal.url) {
    await loadPdf(newVal.url)
  }
  // v3.4.4：离开 Office 文档模式时销毁预览
  if (oldVal && DOC_EXTS.includes(oldVal.ext || '') && !(newVal && DOC_EXTS.includes(newVal.ext || ''))) {
    destroyDocumentViewer()
  }
  // v3.4.4：进入 Office 文档模式：创建预览
  if (newVal && DOC_EXTS.includes(newVal.ext || '') && newVal.url) {
    await openDocumentViewer(newVal)
  }
  const oldIsVideo = !!(oldVal && isVideo(oldVal.ext || ''))
  const newIsVideo = !!(newVal && isVideo(newVal.ext || ''))
  // v3.4.1：离开视频前保存最终进度（含 视频→视频 切换）
  if (oldIsVideo && nativeVideo.value) {
    saveVideoProgress(nativeVideo.value.currentTime, nativeVideo.value.duration)
  }
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
  // v3.4.1：恢复到上次观看位置（在首帧封面捕获之后设置，避免 seek 覆盖）
  restoreVideoProgress(nativeVideo.value)
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
  // v3.4.2：记录当前文件路径，重启后自动恢复
  saveCurrentFilePath()
  // v3.3.9: 打开视频时更新播放列表为同级文件夹视频
  if (file.type === 'file' && isVideo(file.ext || '')) {
    updateVideoPlaylist(file)
    videoPoster.value = '' // 重置封面
  }
}

// v3.4.2：保存当前文件路径（localStorage）
function saveCurrentFilePath() {
  try {
    if (currentFile.value?.path) {
      localStorage.setItem(CURRENT_FILE_KEY, currentFile.value.path)
    } else {
      localStorage.removeItem(CURRENT_FILE_KEY)
    }
  } catch { /* ignore */ }
}

// v3.4.2：在文件树中按 path 查找文件节点
function findNodeByPath(nodes: MaterialNode[], path: string): MaterialNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNodeByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}

// v3.4.2：展开到目标文件所在的所有祖先文件夹，保证恢复的文件在树中可见
function expandToPath(nodes: MaterialNode[], targetPath: string): boolean {
  for (const node of nodes) {
    if (node.type !== 'folder') continue
    const containsDirect = node.children?.some(c => c.path === targetPath) === true
    const containsDeep = containsDirect || expandToPath(node.children || [], targetPath)
    if (containsDeep) {
      expandedFolders.value.add(node.path)
      return true
    }
  }
  return false
}

// v3.4.2：应用启动后自动打开上次查看的文件（同时自动恢复其阅读/播放进度）
function restoreCurrentFile() {
  if (currentFile.value) return
  try {
    const saved = localStorage.getItem(CURRENT_FILE_KEY)
    if (!saved) return
    expandToPath(fileTree.value, saved)
    const node = findNodeByPath(fileTree.value, saved)
    if (node && node.type === 'file') {
      openFile(node)
    }
  } catch { /* ignore */ }
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

function isVideo(ext?: string): boolean {
  return ext ? VIDEO_EXTS.includes(ext.toLowerCase()) : false
}

function isImage(ext?: string): boolean {
  return ext ? IMAGE_EXTS.includes(ext.toLowerCase()) : false
}

function getIconClass(ext: string): string {
  if (ext === '.pdf') return 'icon-pdf'
  if (DOC_EXTS.includes(ext)) return 'icon-doc'
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
  position: relative;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--mo-radius);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow:
    var(--glass-shadow),
    inset 0 1px 0 rgba(255, 255, 255, var(--glass-edge-highlight)),
    inset 0 -1px 0 rgba(255, 255, 255, var(--glass-highlight-bottom));
  transition: box-shadow 0.25s ease;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  isolation: isolate;
}

/* v3.4.2：液态高光层（与全局 .glass-card--card::before 一致，修复液态玻璃模式不生效） */
.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
  background:
    radial-gradient(120% 60% at 18% 0%, rgba(255, 255, 255, var(--glass-highlight-corner)) 0%, transparent 60%),
    linear-gradient(180deg, rgba(255, 255, 255, var(--glass-highlight-top)) 0%, transparent 32%);
}

/* v3.4.2：液态玻璃模式下：菲涅尔镜面反射 + 色差边缘 + 噪声纹理（与全局一致） */
body.liquid-glass .glass-card::before {
  background:
    linear-gradient(180deg, rgba(255,255,255,calc(var(--glass-highlight-top) * 1.5)) 0%, transparent 30%),
    linear-gradient(90deg, rgba(255,255,255,var(--glass-highlight-corner)) 0%, transparent 15%, transparent 85%, rgba(255,255,255,var(--glass-highlight-corner)) 100%),
    linear-gradient(0deg, rgba(255,255,255,var(--glass-highlight-bottom)) 0%, transparent 20%);
}
body.liquid-glass .glass-card {
  box-shadow:
    var(--glass-shadow),
    inset 0 1px 0 rgba(255, 255, 255, var(--glass-edge-highlight)),
    inset 0 -1px 0 rgba(255, 255, 255, var(--glass-highlight-bottom)),
    inset 1px 0 0 rgba(255, 100, 100, 0.02),
    inset -1px 0 0 rgba(100, 100, 255, 0.02);
}
body.liquid-glass .glass-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0.025;
  z-index: -1;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
body.liquid-glass .glass-card:hover {
  box-shadow:
    0 8px 28px rgba(31, 64, 130, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, calc(var(--glass-edge-highlight) + 0.08)),
    inset 0 -1px 0 rgba(255, 255, 255, var(--glass-highlight-bottom)),
    inset 1px 0 0 rgba(255, 100, 100, 0.03),
    inset -1px 0 0 rgba(100, 100, 255, 0.03);
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

/* v3.4.3：docx/xlsx 文档图标 */
.icon-doc {
  background: rgba(64, 158, 255, 0.12);
  color: #409eff;
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
  overflow: visible;
}

.preview-container {
  flex: 1;
  overflow: visible;
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
  gap: 6px;
  padding: 8px 12px;
  background: var(--mo-surface-hover, rgba(255, 255, 255, 0.04));
  border-radius: 8px;
  flex-shrink: 0;
}

.pdf-tip-icon {
  font-size: 14px;
  color: var(--mo-primary, #409eff);
  flex-shrink: 0;
}

.pdf-tip {
  font-size: 12px;
  color: var(--mo-text-3, #888);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* v3.4.1: PDF 页码导航控件 */
.pdf-page-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pdf-page-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--mo-border, rgba(255,255,255,0.1));
  border-radius: 6px;
  background: var(--mo-surface, rgba(255,255,255,0.06));
  color: var(--mo-text-2, #ccc);
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
}

.pdf-page-btn:hover:not(:disabled) {
  background: var(--mo-surface-hover, rgba(255, 255, 255, 0.74));
  border-color: var(--glass-border, rgba(255, 255, 255, 0.8));
  color: var(--mo-text-1, #222);
}

.pdf-page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.pdf-page-indicator {
  font-size: 12px;
  color: var(--mo-text-2, #ccc);
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

.pdf-page-input {
  width: 44px;
  height: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--mo-text-1, #eee);
  background: var(--mo-surface, rgba(255,255,255,0.06));
  border: 1px solid var(--mo-border, rgba(255,255,255,0.1));
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s;
  -moz-appearance: textfield;
  appearance: textfield;
}

.pdf-page-input::-webkit-outer-spin-button,
.pdf-page-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.pdf-page-input:focus {
  border-color: var(--mo-primary, #409eff);
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

.pdf-loading-text {
  font-size: 13px;
  color: var(--mo-text-3, #888);
}

.pdf-frame {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 4px;
  background: #fff;
}

.pdf-error-detail {
  font-size: 12px;
  color: var(--mo-text-3, #888);
  max-width: 300px;
  text-align: center;
  word-break: break-all;
}

/* v3.4.4：Office 文档预览容器（docx / xlsx，@open-file-viewer/core officePlugin） */
.doc-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 8px;
  position: relative;
}

/* v3.4.7：文档工具栏（玻璃风格，与 PDF 工具栏一致） */
.doc-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--mo-surface-hover, rgba(255, 255, 255, 0.04));
  border-radius: 8px;
  flex-shrink: 0;
}

/* v3.4.7：docx 分页导航控件 */
.doc-page-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.doc-page-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--mo-border, rgba(255,255,255,0.1));
  border-radius: 6px;
  background: var(--mo-surface, rgba(255,255,255,0.06));
  color: var(--mo-text-2, #ccc);
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
}

.doc-page-btn:hover:not(:disabled) {
  background: var(--mo-surface-hover, rgba(255, 255, 255, 0.74));
  border-color: var(--glass-border, rgba(255, 255, 255, 0.8));
  color: var(--mo-text-1, #222);
}

.doc-page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.doc-page-indicator {
  font-size: 12px;
  color: var(--mo-text-2, #ccc);
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

.doc-page-input {
  width: 44px;
  height: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--mo-text-1, #eee);
  background: var(--mo-surface, rgba(255,255,255,0.06));
  border: 1px solid var(--mo-border, rgba(255,255,255,0.1));
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s;
  -moz-appearance: textfield;
  appearance: textfield;
}

.doc-page-input::-webkit-outer-spin-button,
.doc-page-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.doc-page-input:focus {
  border-color: var(--mo-primary, #409eff);
}

/* v3.4.4：文档阅读进度条（顶部细条，随滚动实时更新） */
.doc-progress-wrap {
  height: 3px;
  border-radius: 3px;
  background: var(--mo-surface, rgba(255,255,255,0.06));
  overflow: hidden;
  flex-shrink: 0;
}

.doc-progress-bar {
  height: 100%;
  border-radius: 3px;
  background: var(--mo-primary, #409eff);
  transition: width 0.12s linear;
}

.doc-viewer-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
  background: var(--mo-surface, #fff);
  border-radius: 8px;
  border: 1px solid var(--mo-border, rgba(255,255,255,0.1));
}

/* v3.4.4：open-file-viewer 核心内层（缩放按钮等）跟随全局主题色 */
.doc-viewer-wrap :deep(.ofv-root) {
  --ofv-accent: var(--mo-primary, #409eff);
}

/* v3.4.7：内置工具栏（缩放/全屏/搜索）玻璃风格化，贴合全局视觉与文档工具栏一致 */
.doc-viewer-wrap :deep(.ofv-toolbar) {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--mo-surface, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--mo-border, rgba(255, 255, 255, 0.08));
  border-radius: 8px 8px 0 0;
  min-height: 40px;
  padding: 5px 10px;
  font-size: 12px;
  color: var(--mo-text-2, #ccc);
}

.doc-viewer-wrap :deep(.ofv-toolbar button),
.doc-viewer-wrap :deep(.ofv-toolbar .ofv-toolbar-action) {
  border-radius: 6px;
  border: 1px solid var(--mo-border, rgba(255, 255, 255, 0.1));
  background: var(--mo-surface, rgba(255, 255, 255, 0.06));
  color: var(--mo-text-2, #ccc);
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.doc-viewer-wrap :deep(.ofv-toolbar button:hover),
.doc-viewer-wrap :deep(.ofv-toolbar .ofv-toolbar-action:hover) {
  background: var(--mo-surface-hover, rgba(255, 255, 255, 0.74));
  border-color: var(--glass-border, rgba(255, 255, 255, 0.8));
  color: var(--mo-text-1, #222);
}

/* v3.4.7：搜索输入框跟随主题 */
.doc-viewer-wrap :deep(.ofv-toolbar input),
.doc-viewer-wrap :deep(.ofv-toolbar-search) {
  border-radius: 6px;
  border: 1px solid var(--mo-border, rgba(255, 255, 255, 0.1));
  background: var(--mo-surface, rgba(255, 255, 255, 0.06));
  color: var(--mo-text-1, #eee);
  font-size: 12px;
  padding: 3px 8px;
  outline: none;
}

.doc-viewer-wrap :deep(.ofv-toolbar input:focus),
.doc-viewer-wrap :deep(.ofv-toolbar-search:focus) {
  border-color: var(--mo-primary, #409eff);
}

.doc-loading-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  justify-content: center;
  background: var(--mo-surface, #f5f6f8);
  z-index: 2;
  border-radius: 8px;
}

.doc-loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(64, 158, 255, 0.15);
  border-top-color: var(--mo-primary, #409eff);
  border-radius: 50%;
  animation: pdf-spin 0.8s linear infinite;
}

.doc-loading-text {
  font-size: 13px;
  color: var(--mo-text-3, #888);
}

.doc-error-mask {
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

.doc-error-detail {
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

.vc-btn:hover:not(.active) {
  background: var(--mo-surface-hover, rgba(255, 255, 255, 0.74));
  border-color: var(--glass-border, rgba(255, 255, 255, 0.8));
  color: var(--mo-text-1, #222);
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
  background: var(--mo-surface-hover, rgba(255, 255, 255, 0.74));
  border-color: var(--glass-border, rgba(255, 255, 255, 0.8));
  color: var(--mo-text-1, #222);
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

/* v3.4.0: 播放列表弹出面板 — 定位在控制栏上方，确保始终可见 */
.video-playlist-popover {
  position: absolute;
  right: 20px;
  bottom: 50px;
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
  background: var(--mo-surface, rgba(255, 255, 255, 0.15));
  color: var(--mo-text-1, #fff);
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
