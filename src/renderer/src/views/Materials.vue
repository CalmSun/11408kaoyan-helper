<template>
  <div class="materials-page">
    <div class="materials-header">
      <h2 class="page-title">
        <el-icon><Folder /></el-icon>
        学习资料
      </h2>
      <div class="materials-actions" v-show="materialsMode === 'local'">
        <el-button size="small" type="primary" @click="pickFolder">
          <el-icon><FolderOpened /></el-icon> 选择资料文件夹
        </el-button>
        <el-button size="small" @click="refreshList" :disabled="!materialsFolder">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
        <span v-if="materialsFolder" class="folder-path">{{ materialsFolder }}</span>
      </div>
    </div>

    <!-- v3.5.4：模式切换独立成行并水平居中，两种模式下位置统一（B 站面板懒挂载，v-show 保活不中断播放） -->
    <div class="materials-mode-bar">
      <div class="materials-mode-switch">
        <button class="mode-btn" :class="{ active: materialsMode === 'local' }" @click="materialsMode = 'local'">
          <el-icon><FolderOpened /></el-icon> 本地资料
        </button>
        <button class="mode-btn" :class="{ active: materialsMode === 'bili' }" @click="enterBili">
          <el-icon><VideoCamera /></el-icon> 哔哩哔哩
        </button>
      </div>
    </div>

    <div class="materials-body" v-show="materialsMode === 'local'" v-if="flatFiles.length > 0">
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
          <!-- v3.5.2：文档进度栏（页码导航 + 阅读进度）移至顶栏左侧、紧随标题之后，
               美化后与整体玻璃风格统一；仅文档预览时显示 -->
          <div class="doc-status-bar" v-if="currentFile && isDocumentPreview(currentFile.ext)">
            <div class="doc-page-nav" v-if="docTotalPages > 1">
              <button class="dpn-btn" :disabled="docPage <= 1" @click="goDocPage(-1)" title="上一页">‹</button>
              <input
                class="dpn-input"
                type="number"
                min="1"
                :max="docTotalPages"
                v-model.number="docPageInput"
                @keyup.enter="submitDocPage"
                @change="submitDocPage"
                title="输入页码后回车跳转"
              />
              <span class="dpn-total">/ {{ docTotalPages }}</span>
              <button class="dpn-btn" :disabled="docPage >= docTotalPages" @click="goDocPage(1)" title="下一页">›</button>
            </div>
            <div class="doc-progress-track" :title="`阅读进度 ${docProgress}%`">
              <div class="doc-progress-bar" :style="{ width: docProgress + '%' }"></div>
            </div>
            <span class="doc-progress-text">{{ docProgress }}%</span>
          </div>
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
          <!-- v3.5.2：统一文档预览（PDF / Office / 图片 → 全部走 createViewer 多插件架构）
               复刻 open-file-viewer playground 示例布局：[viewerContainer（内置工具栏）+ 加载/错误遮罩]。
               页码导航 + 阅读进度已移至顶栏（.doc-status-bar，见上方 section-title）。
               PDF 使用 pdfPlugin（pdfjs-dist legacy 构建，兼容 Electron 28 / Chromium 120），
               与 Office/图片共用同一套页码跟踪（库内 .ofv-pdf-page-navigator 为 PDF 页码源）。
               视频文件走独立预览（下方 v-else-if="isVideo(...)"），不受影响。 -->
          <div v-if="isDocumentPreview(currentFile.ext)" class="doc-wrap">
            <!-- 统一预览容器：所有文档类型由 createViewer 渲染 -->
            <div ref="viewerContainer" class="doc-viewer-wrap"></div>
            <!-- 加载占位 -->
            <div v-if="viewerCreating" class="doc-loading-mask">
              <div class="doc-loading-spinner"></div>
              <span class="doc-loading-text">{{ currentFile.ext === '.pdf' ? 'PDF 加载中...' : '文档加载中...' }}</span>
            </div>
            <!-- 错误提示 -->
            <div v-if="viewerError" class="doc-error-mask">
              <el-icon :size="40"><Warning /></el-icon>
              <span>{{ viewerError }}</span>
              <span class="doc-error-detail">{{ viewerError }}</span>
              <el-button size="small" type="primary" @click="retryDocumentPreview">重试</el-button>
            </div>
          </div>

          <!-- 图片回退（imagePlugin 加载失败时显示原始 <img>，正常情况不会走到这里） -->
          <img
            v-else-if="isImage(currentFile.ext)"
            :src="currentFile.url"
            class="image-viewer-fallback"
          />

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

          <!-- 其他文件（非文档/非视频的未知格式） -->
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
    <div v-else v-show="materialsMode === 'local'" class="empty-state glass-card">
      <el-icon :size="64"><FolderOpened /></el-icon>
      <h3>暂无资料</h3>
      <p>选择一个包含 PDF、MP4 等文件的文件夹</p>
      <el-button type="primary" @click="pickFolder">
        <el-icon><FolderOpened /></el-icon> 选择资料文件夹
      </el-button>
    </div>

    <!-- v3.5.3：哔哩哔哩在线视频面板（登录/收藏夹/搜索/推荐/播放）。
         首次切入才挂载（biliVisited），之后 v-show 保活，视频播放不被模式切换打断；
         本地资料功能完全独立，互不影响。 -->
    <BiliBiliPanel v-if="biliVisited" v-show="materialsMode === 'bili'" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Folder, FolderOpened, Refresh, Document, VideoPlay, Files,
  View, Warning, ArrowRight, ArrowLeft, List, Loading, Open, InfoFilled, VideoCamera
} from '@element-plus/icons-vue'
// v3.5.3：哔哩哔哩在线视频面板（学习资料页集成，独立组件不影响本地资料逻辑）
import BiliBiliPanel from '@/components/BiliBiliPanel.vue'
// v3.5.2：统一文档预览（PDF / Office / 图片 → 全部走 createViewer 多插件架构）
// PDF 使用 pdfPlugin（pdfjs-dist），与 Office/图片共用同一套页码跟踪和工具栏逻辑。
// 所有插件按需动态加载，避免常驻体积。
import '@open-file-viewer/core/style.css'

// v3.5.3：本地资料 / 哔哩哔哩模式切换（v-show 保活，切换不打断 PDF 阅读与视频播放）
const materialsMode = ref<'local' | 'bili'>('local')
// B 站面板懒挂载标记：首次切入"哔哩哔哩"才创建组件，避免未使用时占用网络与内存
const biliVisited = ref(false)
function enterBili(): void {
  biliVisited.value = true
  materialsMode.value = 'bili'
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
// v3.4.3→v3.5.0：文档预览支持范围（统一通过 createViewer 预览）
// Office 文档（officePlugin）、PDF（PDFium iframe，因 pdfjs-dist 在 Electron 28 兼容问题）、图片（imagePlugin）
const DOC_EXTS = ['.docx', '.xlsx', '.pptx']
// v3.5.0：统一文档预览判断 —— 覆盖 PDF / Office / 图片，视频除外均走文档预览路径
function isDocumentPreview(ext?: string): boolean {
  if (!ext) return false
  return ext === '.pdf' || DOC_EXTS.includes(ext) || IMAGE_EXTS.includes(ext.toLowerCase())
}

// ============ v3.4.7：@open-file-viewer/core 文档预览状态（docx / xlsx） ============
const viewerContainer = ref<HTMLElement | null>(null)
let viewerInstance: any = null
// v3.5.2：文档视图代际计数——openDocumentViewer 是异步流程，快速连续切换文件时
// 旧文件的 createViewer 可能在新文件之后完成并覆盖实例 / 触发旧 onLoad 回调。
// destroyDocumentViewer 会使代际 +1，在途异步流程完成时若代际不匹配则丢弃自身。
let docViewerGen = 0
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
// v3.5.2：open-file-viewer 分页文档页面块选择器（取自库内部 goToRenderedPage，
// 覆盖 PDF / docx / 文本框页面 / 旧版 msdoc / pptx 幻灯片，确保页码统计准确）
// 修复：PDF 页面块是 .ofv-pdf-page-wrapper（骨架页即存在，带 data-page-index），
// 旧值 .ofv-pdf-page 是 canvas 类名——只有已渲染页才有 canvas，导致总页数偏少 / 页码计算错误
const DOC_PAGE_FRAME_SELECTOR = '.ofv-pdf-page-wrapper, .ofv-docx-page-frame, .ofv-docx-textbox-page, .ofv-msdoc-page, .ofv-slide, .ofv-ppt-binary-slide'

let docScrollCaptureHandler: (() => void) | null = null
// v3.5.1：真实滚动容器引用（直接监听它的 scroll 事件，比 window 捕获更可靠）
let docScrollEl: HTMLElement | null = null
let docScrollRaf = 0
let docResizeObserver: ResizeObserver | null = null
let docMutationObserver: MutationObserver | null = null
// v3.5.2：MutationObserver 防抖——库渲染多页文档时 subtree 变化极频繁，
// 每次都跑 querySelectorAll + getBoundingClientRect 导致严重卡顿
let docMutationRaf = 0
// v3.5.2：页面块数组缓存——querySelectorAll 整个容器很贵（数百页 PDF 尤其明显），
// 只在 MutationObserver 检测到结构变化（renderLayout 重建页面块）时失效重建；
// scroll 帧处理直接命中缓存，避免每次滚动都全量查询 DOM。
let docFramesCache: HTMLElement[] | null = null

function isDocumentFile(ext?: string): boolean {
  return ext ? DOC_EXTS.includes(ext) : false
}

// v3.5.2：读取库内置 PDF 页码导航器的当前页码（唯一真实来源）。
// pdfPlugin 内部在滚动 / goToPage 时同步更新该输入框（.ofv-pdf-page-navigator input），
// 与库 UI 永不脱节；读不到时返回 0，由调用方退化到几何法计算。
function readPdfNavigatorPage(): number {
  const input = viewerContainer.value?.querySelector<HTMLInputElement>('.ofv-pdf-page-navigator input')
  const v = input ? parseInt(input.value, 10) : NaN
  return Number.isFinite(v) && v > 0 ? v : 0
}

// v3.5.2：统一获取当前页码 —— PDF 优先读库导航器（与库算法完全一致），
// 其余文档（docx / pptx 等）用几何法；两者都失败返回 1
function computeCurrentDocPage(scroller: HTMLElement | null): number {
  if (currentFile.value?.ext === '.pdf') {
    const fromNav = readPdfNavigatorPage()
    if (fromNav > 0) return fromNav
  }
  return scroller ? computeDocPageFromScroller(scroller) : 1
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
  // 库的文档滚动容器是 .ofv-viewport（overflow-y: auto）；它通常就是真实滚动元素，优先直接取
  const vp = root.querySelector<HTMLElement>('.ofv-viewport')
  if (vp && isScrollableEl(vp)) return vp
  // 兜底：从首个页面块向上找最近的“可滚动祖先”作为滚动容器
  const firstFrame = root.querySelector<HTMLElement>(DOC_PAGE_FRAME_SELECTOR)
  if (firstFrame) {
    let el: HTMLElement | null = firstFrame.parentElement
    while (el && el !== (root.parentElement as HTMLElement | null)) {
      const scrollable = isScrollableEl(el)
      if (scrollable) return el
      el = el.parentElement
    }
  }
  // 再兜底：已知候选选择器
  for (const sel of ['.ofv-table-scroll', '.ofv-office', '.ofv-docx', '.ofv-root']) {
    const el = root.querySelector<HTMLElement>(sel)
    if (el && isScrollableEl(el)) return el
  }
  return isScrollableEl(root) ? root : null
}

// v3.4.7：获取分页文档的页面块（docx / pptx 等有分页；xlsx 无分页返回空）
// v3.5.2：命中 docFramesCache 缓存直接返回（scroll 帧热路径零 DOM 查询）；
// 缓存仅在 MutationObserver 检测到结构变化时由 invalidateDocFramesCache 失效。
function getDocPageFrames(): HTMLElement[] {
  if (docFramesCache) return docFramesCache
  const root = viewerContainer.value
  docFramesCache = root ? Array.from(root.querySelectorAll<HTMLElement>(DOC_PAGE_FRAME_SELECTOR)) : []
  return docFramesCache
}
function invalidateDocFramesCache() {
  docFramesCache = null
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
// v3.5.2：PDF 改读库导航器输入框（与库 UI 一致），其余文档保持几何法
function refreshDocPageNow() {
  const frames = getDocPageFrames()
  if (frames.length === 0) return
  if (docTotalPages.value !== frames.length) docTotalPages.value = frames.length
  const scroller = getDocumentScrollEl()
  const page = computeCurrentDocPage(scroller)
  if (page !== docPage.value) {
    docPage.value = page
    docPageInput.value = page
  }
}

// v3.5.1：scroll 事件只是"有滚动发生"的信号。始终从规范化滚动容器（getDocumentScrollEl）
// 重算页码与进度，而不是依赖 e.target——嵌套滚动 / 库内部实现差异会让 e.target 不可靠，
// 这正是此前"滚动不更新页码"的根因之一。rAF 节流避免每次滚动都做全量 getBoundingClientRect。
// v3.5.2：滚动容器引用在 bindDocScrollCapture 时已缓存（docScrollEl），
// renderLayout 后由 MutationObserver 触发重绑刷新；滚动帧直接用缓存引用，
// 不再每帧执行 getDocumentScrollEl()（querySelector + getComputedStyle）。
function handleDocScrollCapture() {
  if (docScrollRaf) return
  docScrollRaf = requestAnimationFrame(() => {
    docScrollRaf = 0
    const scroller = docScrollEl
    if (!scroller) return
    const max = scroller.scrollHeight - scroller.clientHeight
    const progress = max > 0 ? Math.min(100, Math.max(0, Math.round((scroller.scrollTop / max) * 100))) : 0
    if (progress !== docProgress.value) docProgress.value = progress
    // v3.5.2：rAF 回调在库自身滚动处理器之后执行，此时库已同步完导航器输入框，
    // PDF 读到的页码与库 UI 完全一致；其余文档走几何法
    const page = computeCurrentDocPage(scroller)
    if (page !== docPage.value) {
      docPage.value = page
      docPageInput.value = page
    }
    const now = Date.now()
    if (now - lastDocProgressSave >= DOC_PROGRESS_SAVE_INTERVAL) {
      lastDocProgressSave = now
      saveDocumentProgress(progress)
    }
  })
}

// v3.5.1：绑定 / 解绑。
// ① 直接监听真实滚动容器的 scroll 事件（元素自身的 scroll 一定被本地监听捕获，最可靠）；
// ② v3.5.2：仅当未找到直接滚动容器时才兜底用 window 捕获阶段监听。
//   旧代码同时绑定两者 → 文件树滚动、设置面板滚动等无关 scroll 也触发 handleDocScrollCapture，
//   每次都跑 getDocumentScrollEl()（querySelector + getComputedStyle），造成全页卡顿。
function bindDocScrollCapture() {
  unbindDocScrollCapture()
  docScrollEl = getDocumentScrollEl()
  docScrollCaptureHandler = handleDocScrollCapture
  if (docScrollEl) {
    docScrollEl.addEventListener('scroll', docScrollCaptureHandler)
  } else {
    // 兜底：滚动容器尚未就绪时用 window 捕获兜住
    window.addEventListener('scroll', docScrollCaptureHandler, true)
  }
}
function unbindDocScrollCapture() {
  if (docScrollCaptureHandler) {
    window.removeEventListener('scroll', docScrollCaptureHandler, true)
    if (docScrollEl) docScrollEl.removeEventListener('scroll', docScrollCaptureHandler)
    docScrollCaptureHandler = null
    docScrollEl = null
  }
}

// v3.4.7：MutationObserver 监听文档 DOM 变化（分页块异步渲染就绪后刷新页码）
// v3.5.2：rAF 防抖 + 数量守卫——库渲染多页文档时 subtree mutation 极频繁
//   （每页 canvas/text-layer 挂载都触发）。页面块数量不变说明只是页内渲染
//   进度变化，无需重算页码/重绑滚动，直接跳过，消除绝大多数无谓开销。
function setupDocMutationObserver() {
  if (!viewerContainer.value) return
  if (docMutationObserver) {
    docMutationObserver.disconnect()
    docMutationObserver = null
  }
  docMutationObserver = new MutationObserver(() => {
    if (docMutationRaf) return
    docMutationRaf = requestAnimationFrame(() => {
      docMutationRaf = 0
      // 数量守卫：先查当前页面块数量（命中缓存时是 O(1) 数组长度）
      const frames = getDocPageFrames()
      const total = frames.length
      if (total === 0) return
      if (total !== docTotalPages.value) {
        // 结构变化（renderLayout 重建页面块 / 首次加载完成）：
        // 失效缓存 → 重建数组 → 更新总数 → 重绑滚动容器 → 刷新页码
        docTotalPages.value = total
        invalidateDocFramesCache()
        getDocPageFrames()
        // 滚动容器可能此时才渲染就绪，重新绑定直接 scroll 监听
        bindDocScrollCapture()
        refreshDocPageNow()
      }
    })
  })
  // v3.5.2：只监听 childList（结构变化），不监听 attributes/characterData，
  //   库内部频繁修改 canvas/data-attr 会产生大量无意义 mutation
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
    if (getDocPageFrames().length > 0) {
      bindDocScrollCapture()
      refreshDocPageNow()
    }
  })
  docResizeObserver.observe(viewerContainer.value)
}

// v3.5.2：保存文档阅读进度（页码 + 滚动百分比）
// v3.5.2 更新：统一使用 docPage 字段保存所有文档类型的页码（包括 PDF）
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

// v3.5.2：状态栏页码输入框提交（回车 / change）—— 夹紧到有效页码后跳转
function submitDocPage() {
  const p = Number(docPageInput.value)
  if (Number.isFinite(p) && p >= 1) jumpDocPage(p)
  else docPageInput.value = docPage.value
}

// v3.5.2：文档工具栏改用库内置工具栏（toolbar: true + locale: 'zh-CN'，与 playground 示例一致），
// 自定义 toolbar.render 方案已移除——内置工具栏由库管理状态（缩放百分比 / 按钮禁用 / 搜索计数），
// 页码导航与阅读进度改由页面级「文档状态栏」承担（见模板 .doc-status-bar），避免双状态源不同步。

// v3.5.2 修复（黑屏）：PDF getTextContent 防御性包装。
// 背景：@open-file-viewer/core 的 pdfPlugin.renderPage 在 canvas 渲染成功后才调用
//   page.getTextContent() 构建文本层（仅用于文字选择/复制）。若该调用抛异常，库的 catch-all
//   会用「无法渲染该页面…」错误页替换已成功渲染的 canvas —— 这正是「画面一闪而过变黑屏」的根因。
//   （已核验库源码 node_modules/@open-file-viewer/core/dist/index.js：6138 await page.getTextContent()
//    在 6176-6182 的 catch 中 replaceChildren(ofv-pdf-error)。）
// 文本层是可选增强能力，绝不能因它的失败抹掉已渲染的 PDF 内容。
// v3.5.2 修订：pdfjs 经 Vite 动态 import 得到的是 ES module namespace（不可扩展、属性只读），
//   不能给它加标记属性、也不能直接替换其 getDocument（抛 Cannot add property / read only 错误）。
//   正确做法：基于 namespace 浅拷贝生成可写代理对象（{ ...pdfjs }，GlobalWorkerOptions 仍指向
//   原单例引用，库对 workerSrc 的赋值语义不变），在代理上替换 getDocument；文档就绪后经
//   doc.getPage(1) 定位 PDFPageProxy.prototype，再包装 getTextContent（WeakSet 防重复包装）。
//   正常路径原样透传；异常/畸形结果降级为 { items: [], styles: {} }（库内文本层循环自然跳过，
//   canvas 保留）。不改 node_modules、不改 pdfjs 模块本身。
const patchedGetTextContentProtos = new WeakSet<object>()

function patchPdfGetTextContent(pdfjs: any): any {
  if (!pdfjs || typeof pdfjs.getDocument !== 'function') return pdfjs
  // 浅拷贝 namespace 为可写代理对象（所有导出为值/引用拷贝；GlobalWorkerOptions 为同一单例引用）
  const proxy: any = { ...pdfjs }
  const originalGetDocument = pdfjs.getDocument
  proxy.getDocument = function (this: any, ...args: any[]) {
    const task = originalGetDocument.apply(this, args)
    const promise = task?.promise
    if (promise && typeof promise.then === 'function') {
      promise
        .then((doc: any) => {
          if (!doc || typeof doc.getPage !== 'function') return
          doc
            .getPage(1)
            .then((page: any) => {
              const proto = page?.constructor?.prototype
              if (!proto || typeof proto.getTextContent !== 'function') return
              if (patchedGetTextContentProtos.has(proto)) return
              patchedGetTextContentProtos.add(proto)
              const originalGetTextContent = proto.getTextContent
              proto.getTextContent = function (this: any, params?: unknown) {
                return Promise.resolve()
                  .then(() => originalGetTextContent.call(this, params))
                  .then((result: any) =>
                    result && Array.isArray(result.items) && result.styles
                      ? result
                      : { items: [], styles: Object.create(null), lang: null }
                  )
                  .catch((err: unknown) => {
                    console.warn('[Materials] PDF getTextContent 失败，文本层已降级为空：', err)
                    return { items: [], styles: Object.create(null), lang: null }
                  })
              }
            })
            .catch(() => {
              /* 忽略：取页信息失败不影响后续渲染（库内另有兜底） */
            })
        })
        .catch(() => {
          /* 忽略：文档加载失败时库内已有错误兜底 */
        })
    }
    return task
  }
  return proxy
}

// v3.5.2：统一文档预览入口（PDF / Office / 图片 → 全部走 createViewer）
// 与 playground 示例一致的配置：toolbar: true（内置工具栏）+ locale: 'zh-CN' + theme: 'auto'
// PDF 使用 pdfjs-dist legacy 构建（内置 core-js polyfill）：
//   modern 构建引用 Iterator.prototype（Chromium 122+ 才有全局 Iterator），Electron 28 (Chromium 120)
//   加载即抛 ReferenceError —— 这是 PDF 预览黑屏的根因，必须走 legacy 主线程 + legacy worker。
async function openDocumentViewer(file: MaterialNode) {
  destroyDocumentViewer()
  // v3.5.2：destroy 已使代际 +1，捕获当前代际；异步流程中若代际变化则放弃自身
  const gen = docViewerGen
  invalidateDocFramesCache()
  viewerError.value = ''
  docProgress.value = 0
  docPage.value = 1
  docPageInput.value = 1
  docTotalPages.value = 0
  lastDocProgressSave = 0
  docScrollRestoreAttempt = 0

  const ext = file.ext || ''
  viewerCreating.value = true

  try {
    const mod = await import('@open-file-viewer/core')
    const { createViewer } = mod
    let plugins: any[] = []
    // v3.5.2：PDF 阅读进度恢复改用官方 initialPage 选项（库在插件渲染完成后自动 goToPage）
    let initialPage: number | undefined

    // v3.5.2：根据文件类型选择插件（与 playground createPlugins 对应的子集）
    if (ext === '.pdf') {
      const [pdfjs, workerMod] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')
      ])
      // v3.5.2 修复：必须先包装 getTextContent 再交给 pdfPlugin（防文本层失败抹掉已渲染 canvas → 黑屏）。
      // 注意：返回的是基于 namespace 浅拷贝的可写代理对象（原 namespace 不可扩展/属性只读，不能直接改）。
      const patchedPdfjs = patchPdfGetTextContent(pdfjs)
      // useFetchData: 主线程先取字节再交给 pdf.js，规避自定义协议（kaoyan-material://）下的
      // worker 网络流兼容问题（playground 示例同款配置）
      // v3.5.2：cMapUrl / standardFontDataUrl 本地化——库默认指向 jsDelivr CDN，
      // 中文 CID 字体 PDF 解码依赖 CMap，离线/国内网络下 CDN 不可达会导致
      // 「无法渲染该页面。该页可能包含浏览器 PDF 引擎暂不支持的图形、字体或压缩特性」。
      // 资源由 scripts/copy-pdfjs-assets.mjs 复制到 src/renderer/public/pdfjs（prod 进 dist/renderer）。
      // v3.5.2 修复（最终方案）：主进程回环 HTTP 服务（http://127.0.0.1）提供资源。
      // 根因链：pdf.js 的 isValidFetchUrl 只认 http(s)，非 http(s)（file:// / 自定义协议）一律走
      //   XMLHttpRequest 分支；file:// XHR 被 webSecurity:true 的 CORS 拦截，自定义协议 XHR
      //   在打包后仍不可靠（kaoyan-assets:// + corsEnabled 方案历经多轮未根治）→ CMap 加载失败 → 报错。
      // 正确做法：回环 http URL 使 pdf.js 走最成熟稳定的 fetch 分支，dev/prod 行为一致；
      //   服务不可用时回退 kaoyan-assets:// 自定义协议（保留为备用通道）。
      let pdfAssetsBase = 'kaoyan-assets://pdfjs/'
      try {
        const base = await window.electronAPI?.getAssetsBaseUrl?.()
        if (base) pdfAssetsBase = base.endsWith('/') ? base : `${base}/`
      } catch { /* 回退自定义协议备用通道 */ }
      plugins = [mod.pdfPlugin({
        pdfjs: patchedPdfjs,
        workerSrc: workerMod.default,
        useFetchData: true,
        cMapUrl: `${pdfAssetsBase}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${pdfAssetsBase}standard_fonts/`
      })]
      const prog = loadProgress()[file.path]
      if (typeof prog?.docPage === 'number' && prog.docPage > 1) initialPage = prog.docPage
    } else if (DOC_EXTS.includes(ext)) {
      plugins = [mod.officePlugin()]
    } else if (IMAGE_EXTS.includes(ext.toLowerCase())) {
      plugins = [mod.imagePlugin()]
    }

    await new Promise(resolve => setTimeout(resolve, 80))
    if (!viewerContainer.value) { viewerCreating.value = false; return }

    // v3.5.2：内置工具栏 + locale 中文本地化（参考官方 API 文档和 playground 示例）
    // 内置工具栏自带缩放（重置按钮显示百分比）/ 旋转 / 下载 / 全屏 / 打印 / 搜索（带计数），
    // 按钮可用性由库按插件能力自动管理，无自定义状态同步问题。
    // 页码导航由页面级文档状态栏承担，PDF 库内导航器已通过 CSS 隐藏避免双导航。
    viewerInstance = createViewer({
      container: viewerContainer.value,
      file: file.url,
      fileName: file.name,
      height: '100%',
      width: '100%',
      fit: 'contain',
      theme: 'auto',
      locale: 'zh-CN',
      toolbar: true,
      initialPage,
      plugins,
      onLoad: () => {
        // v3.5.2：代际守卫——期间若已切换到其他文件，丢弃本次回调
        if (gen !== docViewerGen) {
          if (viewerInstance) { try { viewerInstance.destroy() } catch { /* ignore */ } }
          viewerInstance = null
          return
        }
        viewerCreating.value = false
        bindDocScrollCapture()
        setupDocMutationObserver()
        setupDocResizeObserver()
        // v3.5.2：PDF 阅读进度已通过 initialPage 选项在插件渲染完成后自动 goToPage 恢复，
        //   onLoad 里再调 restoreDocumentProgress → restoreDocPage 会二次 goToPage，
        //   造成滚动跳动/页码闪烁。PDF 只需刷新页码显示；Office/图片才走通用恢复。
        if (currentFile.value?.ext === '.pdf') {
          requestAnimationFrame(refreshDocPageNow)
        } else {
          restoreDocumentProgress()
        }
      },
      onError: (err: unknown) => {
        if (gen !== docViewerGen) return
        viewerCreating.value = false
        viewerError.value = err instanceof Error ? err.message : '文档加载失败'
      }
    })
  } catch (e) {
    // v3.5.2：代际守卫——被新文件取代的旧流程静默退出，不覆盖新文件错误状态
    if (gen !== docViewerGen) return
    viewerCreating.value = false
    viewerError.value = e instanceof Error ? e.message : '文档加载失败'
  }
}

// v3.5.2：统一重试入口（所有文档类型统一走 openDocumentViewer）
function retryDocumentPreview() {
  if (!currentFile.value) return
  openDocumentViewer(currentFile.value)
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
  // v3.5.2：代际 +1，使所有在途 openDocumentViewer 异步流程失效
  docViewerGen++
  unbindDocScrollCapture()
  // v3.5.2：清理页面块缓存 / MutationObserver 防抖 rAF
  invalidateDocFramesCache()
  if (docMutationRaf) {
    cancelAnimationFrame(docMutationRaf)
    docMutationRaf = 0
  }
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

// v3.5.2：PDF 现在统一走 createViewer + pdfPlugin，不再需要单独的 PDF iframe 逻辑
// 所有文档类型（PDF/Office/图片）共用同一套页码跟踪、工具栏和进度保存逻辑

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
    // v3.5.2 修复：延迟播放前校验 currentFile 未变——800ms 内用户可能已
    // 手动切换文件，此时连播意图已失效，禁止旧视频的连播跳转新位置
    const endedPath = currentFile.value?.path
    setTimeout(() => {
      if (currentFile.value?.path !== endedPath) return
      playNextVideo()
    }, 800)
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

// v3.5.2：预计算每个文件夹的文件数（避免模板中每次渲染都递归遍历子节点）
// 同时计算总文件数，替代旧 totalFileCount 的独立遍历
const folderFileCounts = computed(() => {
  const map = new Map<string, number>()
  let total = 0
  function walk(nodes: MaterialNode[]): number {
    let count = 0
    for (const n of nodes) {
      if (n.type === 'folder' && n.children) {
        const childCount = walk(n.children)
        map.set(n.path, childCount)
        count += childCount
      } else {
        count++
        total++
      }
    }
    return count
  }
  walk(fileTree.value)
  map.set('__total__', total)
  return map
})

const totalFileCount = computed(() => folderFileCounts.value.get('__total__') || 0)

function folderHasMatchingFiles(folder: MaterialNode): boolean {
  if (!folder.children) return false
  for (const child of folder.children) {
    if (child.type === 'folder') {
      if (folderHasMatchingFiles(child)) return true
    } else {
      if (filterType.value === 'pdf' && child.ext === '.pdf') return true
      // v3.5.0：'doc' 过滤器覆盖 Office + 图片（统一文档预览）
      if (filterType.value === 'doc' && (DOC_EXTS.includes(child.ext || '') || IMAGE_EXTS.includes(child.ext || ''))) return true
      if (filterType.value === 'video' && isVideo(child.ext || '')) return true
      // v3.5.0：'other' = 非文档/非视频（PDF 现在也属于文档范畴）
      if (filterType.value === 'other' && !isDocumentPreview(child.ext || '') && !isVideo(child.ext || '')) return true
    }
  }
  return false
}

// v3.5.2：从预计算缓存读取，O(1) 查表替代递归遍历
function countFilesInFolder(folder: MaterialNode): number {
  return folderFileCounts.value.get(folder.path) || 0
}

// ============ v3.5.2：学习进度保存（文档页码 / 视频播放位置 / 当前文件路径）
// 以文件 path 为 key 存 localStorage，重新打开应用后自动恢复上次文件与进度
// v3.5.2 更新：PDF 现在也统一使用 docPage 字段，不再单独使用 pdfPage
const PROGRESS_KEY = 'materials-progress'
const CURRENT_FILE_KEY = 'materials-current-file'

interface MaterialProgressEntry {
  videoTime?: number
  videoDuration?: number
  // v3.5.2：所有文档类型（PDF / Office）统一使用 docPage 字段保存页码
  docPage?: number
  // v3.4.4：Office 文档阅读进度（滚动百分比 0-100，xlsx 及无分页文档用）
  scrollProgress?: number
  updatedAt?: number
}
type MaterialProgress = Record<string, MaterialProgressEntry>

// v3.5.2：进度对象内存缓存——saveProgress 每秒级调用（视频 5s / 文档滚动 1.5s）时，
// 旧代码每次都 JSON.parse 整个 localStorage 再全量 stringify 写回；进度记录多时
// 反复序列化大对象造成可感知卡顿。缓存命中后读操作零开销，写操作仅一次 stringify。
let progressCache: MaterialProgress | null = null
function loadProgress(): MaterialProgress {
  if (progressCache) return progressCache
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        progressCache = parsed
        return parsed
      }
    }
  } catch { /* ignore */ }
  progressCache = {}
  return progressCache
}

function saveProgress(path: string, patch: Partial<MaterialProgressEntry>) {
  if (!path) return
  const all = loadProgress()
  const prev = all[path] || {}
  // v3.5.2：值未实质变化（仅 updatedAt 变了）则跳过写盘——
  // 文档滚动时页码/百分比不变的重入调用不再触发全量 JSON 序列化
  const hasChange = (Object.keys(patch) as (keyof MaterialProgressEntry)[]).some(
    k => prev[k] !== patch[k]
  )
  if (!hasChange) return
  all[path] = { ...prev, ...patch, updatedAt: Date.now() }
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)) } catch { /* ignore */ }
}

// v3.4.1：视频进度保存（按文件 path）
// v3.5.2 修复：切换视频瞬间 watch(currentFile) 里 currentFile 已指向新文件，
// 若直接保存会把旧视频的播放位置写到新视频名下 → "所有视频同一进度"。
// 增加可选 path 参数：切换场景必须显式传旧文件 path。
function saveVideoProgress(time: number, dur: number, path?: string) {
  const key = path || currentFile.value?.path
  if (!key || !(dur > 0)) return
  // 已看到结尾附近（最后 5 秒）视为看完，下次从头开始
  const finalTime = time >= dur - 5 ? 0 : time
  saveProgress(key, { videoTime: finalTime, videoDuration: dur })
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

// v3.5.2：keep-alive 激活（从其他页面返回学习资料页）时恢复状态
// 统一文档路径：PDF / Office / 图片 共用同一恢复逻辑（全部走 createViewer）
onActivated(() => {
  window.addEventListener('keydown', onVideoKeydown)
  // 恢复当前文件进度
  if (currentFile.value) {
    if (isDocumentPreview(currentFile.value.ext || '')) {
      // 统一文档模式：重新绑定滚动监听 + 恢复页码
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

// v3.5.2：keep-alive 失活（切换到其他页面）时：
//   - 移除键盘监听，避免误控隐藏页面的视频
//   - 保存视频进度并暂停，保持「原状态」，返回后可继续观看
//   - 统一保存文档阅读进度（PDF / Office / 图片 全部统一处理）
onDeactivated(() => {
  window.removeEventListener('keydown', onVideoKeydown)
  if (nativeVideo.value && currentFile.value && isVideo(currentFile.value.ext || '')) {
    saveVideoProgress(nativeVideo.value.currentTime, nativeVideo.value.duration)
    nativeVideo.value.pause()
    videoPlaying.value = false
  } else if (currentFile.value && isDocumentPreview(currentFile.value.ext || '')) {
    saveDocumentProgress()
  }
})

// v3.5.2：组件卸载时彻底释放视频与音频资源
onUnmounted(() => {
  window.removeEventListener('keydown', onVideoKeydown)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // v3.4.2：卸载前保存当前视频进度（重启后可接续）
  if (nativeVideo.value && currentFile.value && isVideo(currentFile.value.ext || '')) {
    saveVideoProgress(nativeVideo.value.currentTime, nativeVideo.value.duration)
  }
  disposeAudioResources()
  // v3.5.2: 统一销毁文档预览（PDF / Office / 图片 全部通过 destroyDocumentViewer）
  destroyDocumentViewer()
})

// v3.5.2：应用退出前兜底保存当前视频/文档进度（页面卸载/关窗/退出时触发）
function handleBeforeUnload() {
  if (nativeVideo.value && currentFile.value && isVideo(currentFile.value.ext || '')) {
    saveVideoProgress(nativeVideo.value.currentTime, nativeVideo.value.duration)
  } else if (currentFile.value && isDocumentPreview(currentFile.value.ext || '')) {
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

// v3.5.2：切换文件时重置状态（统一文档路由）
// v3.3.1：仅在「离开视频模式」时释放音频链路
// v3.3.8：适配原生 <video> 元素生命周期
// v3.5.2：PDF / Office / 图片 统一走 openDocumentViewer → createViewer 多插件架构
watch(() => currentFile.value, async (newVal, oldVal) => {
  // v3.5.2：切换前兜底保存旧文档进度（统一处理 PDF / Office / 图片）
  const oldIsDoc = oldVal && isDocumentPreview(oldVal.ext || '')
  const newIsDoc = newVal && isDocumentPreview(newVal.ext || '')
  if (oldIsDoc) {
    saveDocumentProgress(docProgress.value, oldVal!.path)
  }
  // 离开文档模式时销毁预览（统一清理 createViewer 实例）
  if (oldIsDoc && !newIsDoc) {
    destroyDocumentViewer()
  }
  // 进入文档模式：统一入口（内部根据 ext 自动选择 pdfPlugin / officePlugin / imagePlugin）
  if (newIsDoc && newVal!.url) {
    await openDocumentViewer(newVal!)
  }
  const oldIsVideo = !!(oldVal && isVideo(oldVal.ext || ''))
  const newIsVideo = !!(newVal && isVideo(newVal.ext || ''))
  // v3.4.1：离开视频前保存最终进度（含 视频→视频 切换）
  // v3.5.2 修复：必须用旧文件 path 保存——此时 currentFile 已是新文件，
  // 用 currentFile.value.path 会把旧视频位置写入新视频（进度串号 bug）
  if (oldIsVideo && nativeVideo.value) {
    saveVideoProgress(nativeVideo.value.currentTime, nativeVideo.value.duration, oldVal!.path)
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
  // v3.5.0：图片文件独立图标
  if (IMAGE_EXTS.includes(ext.toLowerCase())) return 'icon-image'
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

/* v3.5.4：模式切换独立成行并水平居中，两种模式下位置统一 */
.materials-mode-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

/* v3.5.3：本地资料 / 哔哩哔哩模式切换（胶囊分段控件，玻璃拟态） */
.materials-mode-switch {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
}

.materials-mode-switch .mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--mo-text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.materials-mode-switch .mode-btn:hover {
  color: var(--mo-text-1);
}

.materials-mode-switch .mode-btn.active {
  color: #fff;
  background: var(--mo-accent);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
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
  flex: 0 1 auto;
  min-width: 0;
  max-width: 240px;
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

/* 预览区
   v3.5.2：补全高度收缩链——grid/flex 子项默认 min-height:auto 会被内容（大文档）撑高，
   导致预览卡片随 PDF 页数变长、整个页面出现超长滚动。给 .file-preview / .preview-container
   设 min-height:0 后，文档在 .doc-viewer-wrap（overflow:hidden）内的 .ofv-viewport 中滚动，
   卡片高度恒等于网格行高。 */
.file-preview {
  overflow: hidden;
  min-height: 0;
}

.preview-container {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* v3.5.0：PDF 样式已合并到统一文档容器（.doc-viewer-wrap 内的 .pdf-frame） */

/* v3.5.0：统一文档预览容器（PDF / Office / 图片 共用） */
.doc-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 0;
  position: relative;
}

/* v3.5.2：文档进度栏（页码导航 + 阅读进度）——移至顶栏左侧紧随标题，胶囊样式与玻璃风格统一。
   margin-right:auto 将右侧「默认应用打开」按钮推到顶栏最右；
   视频预览时进度栏不渲染（v-if），按钮保持原有位置不受影响。 */
.doc-status-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 auto 0 0;
  padding: 3px 12px;
  border-radius: 999px;
  background: var(--mo-bg-2, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--mo-border, rgba(0, 0, 0, 0.08));
}

.doc-page-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dpn-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--mo-text-2);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
}
.dpn-btn:hover:not(:disabled) {
  background: var(--mo-bg-1, rgba(255, 255, 255, 0.1));
  color: var(--mo-text-1);
}
.dpn-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.dpn-input {
  width: 40px;
  height: 22px;
  padding: 0;
  text-align: center;
  border: 1px solid var(--mo-border, rgba(0, 0, 0, 0.08));
  border-radius: 6px;
  background: transparent;
  color: var(--mo-text-1);
  font-size: 12px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}
.dpn-input:focus {
  outline: none;
  border-color: var(--mo-primary, #409eff);
}
.dpn-input::-webkit-outer-spin-button,
.dpn-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.dpn-total {
  font-size: 12px;
  color: var(--mo-text-3);
  font-variant-numeric: tabular-nums;
}

.doc-progress-track {
  width: 110px;
  height: 4px;
  border-radius: 999px;
  background: var(--mo-surface, rgba(255, 255, 255, 0.1));
  overflow: hidden;
  flex-shrink: 0;
}

.doc-progress-bar {
  height: 100%;
  border-radius: 999px;
  background: var(--mo-primary, #409eff);
  transition: width 0.12s linear;
}

.doc-progress-text {
  min-width: 34px;
  font-size: 12px;
  color: var(--mo-text-2);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* v3.5.0：统一文档预览容器（createViewer 渲染区 / PDFium iframe 容器）
   复刻 playground 示例：浅色背景、圆角、细边框 */
.doc-viewer-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
  background: var(--mo-surface, #fff);
  border-radius: 8px;
  border: 1px solid var(--mo-border, rgba(0,0,0,0.08));
}

/* v3.5.2：隐藏库内置 PDF 页码导航器与摘要条——页面级 .doc-status-bar 已提供页码导航+阅读进度，
   避免双导航器混淆。隐藏仅影响显示，.ofv-pdf-page-navigator input 的 value 仍可由 JS 读取，
   页码源（readPdfNavigatorPage）不受影响。 */
.doc-viewer-wrap :deep(.ofv-pdf-page-navigator),
.doc-viewer-wrap :deep(.ofv-pdf-summary) {
  display: none;
}

/* v3.5.0：PDF 模式 —— Chromium PDFium <iframe> 填满容器 */
.doc-viewer-wrap .pdf-frame {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 7px; /* 略小于容器的 8px，避免双边框 */
}

/* v3.4.9：统一自定义文档工具栏（toolbar.render 输出）
   布局参考 playground 示例：单行扁平、轻量图标、清晰分组 */
.doc-viewer-wrap :deep(.ofv-custom-toolbar),
.doc-viewer-wrap :deep(.ofv-toolbar.ofv-custom-toolbar) {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--mo-surface, #f8f9fa);
  border-bottom: 1px solid var(--mo-border, rgba(0,0,0,0.08));
  min-height: 40px;
  font-size: 13px;
  color: var(--mo-text-1, #333);
  user-select: none;
  flex-shrink: 0;
}

/* 工具栏分组 */
.doc-viewer-wrap :deep(.ofv-tb-group) {
  display: flex;
  align-items: center;
  gap: 3px;
}

.doc-viewer-wrap :deep(.ofv-tb-group + .ofv-tb-group)::before {
  content: '';
  display: inline-block;
  width: 1px;
  height: 18px;
  background: var(--mo-border, rgba(0,0,0,0.12));
  margin: 0 6px;
  vertical-align: middle;
}

/* 页码导航区 */
.doc-viewer-wrap :deep(.ofv-tb-page-nav) {
  gap: 4px;
  margin-right: 2px;
}

.doc-viewer-wrap :deep(.ofv-tb-page-input) {
  width: 42px;
  height: 26px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--mo-text-1, #333);
  background: transparent;
  border: 1px solid var(--mo-border, rgba(0,0,0,0.15));
  border-radius: 5px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  -moz-appearance: textfield;
  appearance: textfield;
  padding: 0 2px;
}

.doc-viewer-wrap :deep(.ofv-tb-page-input::-webkit-outer-spin-button),
.doc-viewer-wrap :deep(.ofv-tb-page-input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.doc-viewer-wrap :deep(.ofv-tb-page-input:focus) {
  border-color: var(--mo-primary, #409eff);
  box-shadow: 0 0 0 2px rgba(64,158,255,0.15);
}

.doc-viewer-wrap :deep(.ofv-tb-page-sep) {
  color: var(--mo-text-3, #999);
  font-size: 12px;
  margin: 0 1px;
}

.doc-viewer-wrap :deep(.ofv-tb-total-pages) {
  font-size: 12px;
  color: var(--mo-text-3, #888);
  min-width: 16px;
  text-align: center;
}

/* 缩放标签 */
.doc-viewer-wrap :deep(.ofv-tb-zoom-label) {
  font-size: 12px;
  font-weight: 600;
  color: var(--mo-text-1, #333);
  min-width: 38px;
  text-align: center;
  cursor: default;
}

/* 统一按钮样式（Material 风格，贴合 playground 示例） */
.doc-viewer-wrap :deep(.ofv-tb-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--mo-text-2, #555);
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
  padding: 0;
  flex-shrink: 0;
}

.doc-viewer-wrap :deep(.ofv-tb-btn:hover) {
  background: rgba(0, 0, 0, 0.06);
  color: var(--mo-text-1, #222);
}

.doc-viewer-wrap :deep(.ofv-tb-btn:active) {
  background: rgba(0, 0, 0, 0.10);
}

/* 搜索区域 */
.doc-viewer-wrap :deep(.ofv-tb-search-wrap) {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  background: var(--mo-surface, #fff);
  border: 1px solid var(--mo-border, rgba(0,0,0,0.12));
  border-radius: 6px;
  padding: 2px 8px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.doc-viewer-wrap :deep(.ofv-tb-search-wrap:focus-within) {
  border-color: var(--mo-primary, #409eff);
  box-shadow: 0 0 0 2px rgba(64,158,255,0.1);
}

.doc-viewer-wrap :deep(.ofv-tb-search-icon) {
  display: flex;
  align-items: center;
  color: var(--mo-text-3, #aaa);
  flex-shrink: 0;
}

.doc-viewer-wrap :deep(.ofv-tb-search-icon svg) {
  display: block;
}

.doc-viewer-wrap :deep(.ofv-tb-search-input) {
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: var(--mo-text-1, #333);
  width: 120px;
  padding: 2px 0;
}

.doc-viewer-wrap :deep(.ofv-tb-search-input::placeholder) {
  color: var(--mo-text-3, #bbb);
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
  animation: doc-spin 0.8s linear infinite;
}

@keyframes doc-spin {
  to { transform: rotate(360deg); }
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

/* v3.5.0：图片回退样式（imagePlugin 加载失败时的 <img> 兜底） */
.image-viewer-fallback {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
  background: var(--mo-surface, #f5f5f5);
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
