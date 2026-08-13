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
          {{ currentFile?.name || '选择文件预览' }}
        </h3>
        <div class="preview-container" v-if="currentFile">
          <!-- PDF 预览 -->
          <iframe
            v-if="currentFile.ext === '.pdf'"
            :src="currentFile.url"
            class="pdf-viewer"
          />
          <!-- 视频播放（v3.0.0：支持音量调节/全屏/进度拖动，Range 协议加速加载） -->
          <div v-else-if="isVideo(currentFile.ext)" class="video-wrap" ref="videoWrap">
            <video
              ref="videoEl"
              :src="currentFile.url"
              class="video-player"
              preload="metadata"
              @timeupdate="onVideoTimeUpdate"
              @loadedmetadata="onVideoLoaded"
              @ended="videoPlaying = false"
              @click="toggleVideoPlay"
            />
            <!-- v3.0.0：自定义视频控制栏（含音量+全屏） -->
            <div class="video-controls">
              <button class="video-ctrl-btn" @click="toggleVideoPlay">
                <el-icon>{{ videoPlaying ? '⏸' : '▶' }}</el-icon>
              </button>
              <span class="video-time">{{ formatTime(videoCurrent) }}</span>
              <input
                type="range"
                class="video-progress"
                :min="0"
                :max="videoDuration || 100"
                :step="0.1"
                :value="videoCurrent"
                @input="onVideoSeek"
              />
              <span class="video-time">{{ formatTime(videoDuration) }}</span>
              <!-- 音量控制 -->
              <button class="video-ctrl-btn" @click="toggleMute">
                <el-icon>{{ videoMuted || videoVolume === 0 ? '🔇' : '🔊' }}</el-icon>
              </button>
              <input
                type="range"
                class="video-volume"
                :min="0"
                :max="100"
                :step="1"
                v-model="videoVolume"
                @input="onVolumeChange"
              />
              <!-- 倍速 -->
              <select class="video-speed" v-model="videoSpeed" @change="onVideoSpeedChange">
                <option value="0.5">0.5x</option>
                <option value="1">1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>
              <!-- 全屏 -->
              <button class="video-ctrl-btn" @click="toggleFullscreen">
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
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import {
  Folder, FolderOpened, Refresh, Document, VideoPlay, Files,
  View, Warning, ArrowRight
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
const videoVolume = ref(80)
const videoMuted = ref(false)
const isFullscreen = ref(false)

const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv']
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

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
})

// v3.0.0：切换文件时重置视频状态
watch(() => currentFile.value, () => {
  videoCurrent.value = 0
  videoDuration.value = 0
  videoPlaying.value = false
  videoSpeed.value = 1
  videoMuted.value = false
  isFullscreen.value = false
  nextTick(() => {
    if (videoEl.value) {
      videoEl.value.playbackRate = 1
      videoEl.value.volume = videoVolume.value / 100
      videoEl.value.muted = false
    }
  })
})

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

// v2.9.2：视频控制函数
function onVideoTimeUpdate() {
  if (videoEl.value) {
    videoCurrent.value = videoEl.value.currentTime
  }
}

function onVideoLoaded() {
  if (videoEl.value) {
    videoDuration.value = videoEl.value.duration
  }
}

function toggleVideoPlay() {
  if (!videoEl.value) return
  if (videoEl.value.paused) {
    videoEl.value.play()
    videoPlaying.value = true
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

function onVideoSpeedChange() {
  if (videoEl.value) {
    videoEl.value.playbackRate = videoSpeed.value
  }
}

// v3.0.0：音量控制
function onVolumeChange() {
  if (videoEl.value) {
    videoEl.value.volume = videoVolume.value / 100
    videoEl.value.muted = videoVolume.value === 0
    videoMuted.value = videoVolume.value === 0
  }
}

function toggleMute() {
  if (!videoEl.value) return
  videoMuted.value = !videoMuted.value
  videoEl.value.muted = videoMuted.value
  if (!videoMuted.value && videoVolume.value === 0) {
    videoVolume.value = 50
    videoEl.value.volume = 0.5
  }
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

/* v2.9.2：视频播放区域 */
.video-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.video-player {
  width: 100%;
  max-height: 70%;
  object-fit: contain;
  background: #000;
  border-radius: 8px;
}

/* v3.1.0：全屏时视频铺满整个屏幕 */
.video-wrap:fullscreen {
  width: 100vw;
  height: 100vh;
  background: #000;
  justify-content: center;
  align-items: center;
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
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.6);
  color: #fff;
  z-index: 10;
}

.video-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--mo-surface-hover);
  border-radius: 8px;
}

.video-ctrl-btn {
  background: none;
  border: none;
  color: var(--mo-text-1);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
}

.video-ctrl-btn:hover {
  color: var(--mo-primary);
}

.video-time {
  font-size: 12px;
  color: var(--mo-text-3);
  min-width: 40px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.video-progress {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--mo-bg-2);
  border-radius: 2px;
  cursor: pointer;
  outline: none;
}

.video-progress::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--mo-primary, #409eff);
  cursor: pointer;
}

.video-progress::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--mo-primary, #409eff);
  cursor: pointer;
  border: none;
}

.video-speed {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--mo-border);
  background: var(--mo-surface);
  color: var(--mo-text-1);
  cursor: pointer;
}

/* v3.0.0：音量滑块 */
.video-volume {
  width: 60px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  cursor: pointer;
  outline: none;
}

.video-volume::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
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
