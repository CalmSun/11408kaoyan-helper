<template>
  <div class="music-page">
    <div class="music-header">
      <h2 class="page-title">
        <el-icon><Headset /></el-icon>
        音乐播放
      </h2>
      <div class="music-actions">
        <!-- v2.9.2：网易云登录状态 -->
        <div v-if="music.neteaseLoggedIn && music.neteaseUser" class="netease-user">
          <img :src="music.neteaseUser.avatar" class="netease-avatar" />
          <span class="netease-nickname">{{ music.neteaseUser.nickname }}</span>
          <el-button size="small" text @click="handleLogout">退出</el-button>
        </div>
        <el-button v-else size="small" type="success" @click="showLoginDialog = true">
          <el-icon><User /></el-icon> 网易云登录
        </el-button>
        <el-button size="small" @click="music.pickFolder()">
          <el-icon><FolderOpened /></el-icon> 选择文件夹
        </el-button>
        <el-button size="small" @click="music.pickFiles()">
          <el-icon><Document /></el-icon> 选择文件
        </el-button>
        <el-button size="small" type="danger" plain :disabled="!music.hasMusic" @click="music.clearPlaylist()">
          <el-icon><Delete /></el-icon> 清空列表
        </el-button>
      </div>
    </div>

    <div class="music-body">
      <!-- 左侧：播放器 + 歌词 -->
      <div class="music-player-col">
        <div class="glass-card player-card">
          <!-- 封面/信息 -->
          <div class="player-cover">
            <img v-if="currentCover" :src="currentCover" alt="cover" class="cover-img" :class="{ spinning: music.isPlaying }" />
            <div v-else class="cover-placeholder">
              <el-icon :size="64"><Headset /></el-icon>
            </div>
          </div>
          <div class="player-info">
            <div class="track-name">{{ music.currentTrack?.name || '未选择歌曲' }}</div>
            <div class="track-meta" v-if="music.currentTrack?.artist || music.currentTrack?.album">
              {{ music.currentTrack?.artist || '' }}
              <span v-if="music.currentTrack?.artist && music.currentTrack?.album"> · </span>
              {{ music.currentTrack?.album || '' }}
            </div>
            <div class="track-source" v-if="music.currentTrack">
              <el-tag size="small" :type="music.currentTrack.source === 'online' ? 'success' : 'info'">
                {{ music.currentTrack.source === 'online' ? '网易云在线' : '本地文件' }}
              </el-tag>
            </div>
          </div>

          <!-- 进度条 -->
          <div class="progress-section">
            <span class="time-label">{{ formatTime(music.currentTime) }}</span>
            <el-slider
              v-model="progressValue"
              :min="0"
              :max="music.duration || 100"
              :step="0.1"
              :show-tooltip="false"
              class="progress-slider"
              @change="music.seek(progressValue)"
            />
            <span class="time-label">{{ formatTime(music.duration) }}</span>
          </div>

          <!-- 控制按钮 -->
          <div class="player-controls">
            <button class="ctrl-btn" :class="{ active: music.shuffle }" title="随机播放" @click="music.toggleShuffle()">
              <el-icon><Sort /></el-icon>
            </button>
            <button class="ctrl-btn" title="上一首" @click="music.prev()">
              <el-icon><DArrowLeft /></el-icon>
            </button>
            <button class="ctrl-btn play-btn" :title="music.isPlaying ? '暂停' : '播放'" @click="music.toggle()">
              <el-icon v-if="!music.isPlaying"><VideoPlay /></el-icon>
              <el-icon v-else><VideoPause /></el-icon>
            </button>
            <button class="ctrl-btn" title="下一首" @click="music.next()">
              <el-icon><DArrowRight /></el-icon>
            </button>
            <div class="volume-control">
              <el-icon><Microphone /></el-icon>
              <el-slider
                v-model="volumeValue"
                :min="0"
                :max="1"
                :step="0.01"
                :show-tooltip="false"
                class="volume-slider"
                @input="music.setVolume(volumeValue)"
              />
            </div>
          </div>
        </div>

        <!-- 歌词区 -->
        <div class="glass-card lyrics-card">
          <h3 class="section-title">歌词</h3>
          <div class="lyrics-container" ref="lyricsContainer">
            <div v-if="music.lyricLines.length === 0" class="lyrics-empty">
              暂无歌词<br />
              <span class="lyrics-hint">本地歌曲需同目录 .lrc 文件</span>
            </div>
            <div
              v-for="(line, i) in music.lyricLines"
              :key="i"
              class="lyric-line"
              :class="{ active: i === music.currentLyricIndex }"
              :ref="el => { if (i === music.currentLyricIndex && el) scrollToLyric(el as HTMLElement) }"
            >
              {{ line.text }}
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：搜索 + 我的歌单 + 播放列表 -->
      <div class="music-list-col">
        <!-- v2.9.2：Tab 切换 -->
        <div class="music-tabs">
          <button class="music-tab" :class="{ active: neteaseTab === 'search' }" @click="neteaseTab = 'search'">
            <el-icon><Search /></el-icon> 搜索
          </button>
          <button class="music-tab" :class="{ active: neteaseTab === 'playlists' }" @click="neteaseTab = 'playlists'; onPlaylistTab()">
            <el-icon><List /></el-icon> 我的歌单
          </button>
        </div>

        <!-- 网易云搜索 -->
        <div class="glass-card search-card" v-show="neteaseTab === 'search'">
          <h3 class="section-title">
            <el-icon><Search /></el-icon>
            网易云搜索
          </h3>
          <div class="search-input-row">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索歌曲、歌手..."
              clearable
              @keyup.enter="doSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" :loading="music.searchLoading" @click="doSearch">搜索</el-button>
          </div>
          <div v-if="music.searchLoading" class="search-loading">
            <el-icon class="is-loading"><Loading /></el-icon> 搜索中...
          </div>
          <div v-else-if="music.searchResults.length > 0" class="search-results">
            <div
              v-for="song in music.searchResults"
              :key="song.id"
              class="search-item"
            >
              <img v-if="song.cover" :src="song.cover" class="song-cover" />
              <div v-else class="song-cover placeholder"><el-icon><Headset /></el-icon></div>
              <div class="song-info">
                <div class="song-name">{{ song.name }}</div>
                <div class="song-artist">{{ song.artist }} · {{ song.album }}</div>
              </div>
              <div class="song-actions">
                <el-button size="small" type="primary" circle @click="music.playOnlineSong(song)">
                  <el-icon><VideoPlay /></el-icon>
                </el-button>
                <el-button size="small" circle @click="music.addOnlineSong(song)">
                  <el-icon><Plus /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
          <div v-else-if="music.searchKeyword" class="search-empty">
            未找到相关歌曲
          </div>
        </div>

        <!-- v2.9.2：我的歌单 -->
        <div class="glass-card playlist-card" v-show="neteaseTab === 'playlists'">
          <h3 class="section-title">
            <el-icon><List /></el-icon>
            我的歌单
            <span v-if="music.userPlaylists.length" class="playlist-count">{{ music.userPlaylists.length }} 个</span>
          </h3>

          <!-- 未登录提示 -->
          <div v-if="!music.neteaseLoggedIn" class="playlist-empty">
            请先登录网易云账号以同步歌单<br />
            <el-button size="small" type="primary" @click="showLoginDialog = true" style="margin-top: 10px">
              去登录
            </el-button>
          </div>

          <!-- 歌单列表（网格） -->
          <div v-else-if="!viewingPlaylistId" class="user-playlists-grid">
            <div
              v-for="pl in music.userPlaylists"
              :key="pl.id"
              class="playlist-grid-item"
              @click="openPlaylist(pl.id)"
            >
              <img v-if="pl.cover" :src="pl.cover" class="playlist-cover" />
              <div v-else class="playlist-cover placeholder"><el-icon :size="32"><FolderOpened /></el-icon></div>
              <div class="playlist-grid-name" :title="pl.name">{{ pl.name }}</div>
              <div class="playlist-grid-meta">{{ pl.trackCount }} 首</div>
            </div>
          </div>

          <!-- 歌单详情（歌曲列表） -->
          <div v-else class="playlist-detail">
            <div class="playlist-detail-header">
              <el-button size="small" text @click="viewingPlaylistId = 0">
                <el-icon><DArrowLeft /></el-icon> 返回歌单列表
              </el-button>
              <span class="playlist-detail-name">{{ music.currentPlaylistInfo?.name }}</span>
            </div>
            <div class="playlist-detail-actions">
              <el-button size="small" type="primary" :loading="music.playlistLoading" @click="music.playPlaylist(music.currentPlaylistTracks)">
                <el-icon><VideoPlay /></el-icon> 播放全部
              </el-button>
              <el-button size="small" :loading="music.playlistLoading" @click="music.addPlaylistToQueue(music.currentPlaylistTracks)">
                <el-icon><Plus /></el-icon> 添加到队列
              </el-button>
            </div>
            <div class="playlist-tracks">
              <div v-if="music.playlistLoading" class="search-loading">
                <el-icon class="is-loading"><Loading /></el-icon> 加载中...
              </div>
              <div
                v-for="(track, i) in music.currentPlaylistTracks"
                :key="track.id"
                class="search-item"
              >
                <span class="item-index">{{ i + 1 }}</span>
                <div class="song-info">
                  <div class="song-name">{{ track.name }}</div>
                  <div class="song-artist">{{ track.artist }} · {{ track.album }}</div>
                </div>
                <div class="song-actions">
                  <el-button size="small" type="primary" circle @click="music.playOnlineSong(track)">
                    <el-icon><VideoPlay /></el-icon>
                  </el-button>
                  <el-button size="small" circle @click="music.addOnlineSong(track)">
                    <el-icon><Plus /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 播放列表 -->
        <div class="glass-card playlist-card">
          <h3 class="section-title">
            <el-icon><List /></el-icon>
            播放列表
            <span class="playlist-count">{{ music.playlist.length }} 首</span>
          </h3>
          <div class="playlist-container">
            <div v-if="music.playlist.length === 0" class="playlist-empty">
              播放列表为空，请选择本地文件或搜索在线歌曲
            </div>
            <div
              v-for="(track, i) in music.playlist"
              :key="i"
              class="playlist-item"
              :class="{ active: i === music.currentIndex }"
              @click="music.playIndex(i)"
            >
              <span class="item-index">{{ i + 1 }}</span>
              <div class="item-info">
                <div class="item-name">{{ track.name }}</div>
                <div class="item-meta" v-if="track.artist || track.source === 'online'">
                  {{ track.artist || '' }}
                  <el-tag v-if="track.source === 'online'" size="small" type="success" class="source-tag">在线</el-tag>
                </div>
              </div>
              <button class="item-remove" title="移除" @click.stop="music.removeTrack(i)">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- v2.9.2：网易云二维码登录对话框 -->
    <el-dialog v-model="showLoginDialog" title="网易云音乐登录" width="360px" :close-on-click-modal="false" @close="stopQrPolling">
      <div class="qr-login-box">
        <div v-if="qrImageUrl" class="qr-image-wrap">
          <img :src="qrImageUrl" class="qr-image" alt="登录二维码" />
          <div v-if="music.qrStatus === 802" class="qr-overlay">
            <el-icon :size="32"><CircleCheck /></el-icon>
            <div>已扫码，请在手机上确认</div>
          </div>
          <div v-else-if="music.qrStatus === 800" class="qr-overlay expired">
            <el-icon :size="32"><Warning /></el-icon>
            <div>二维码已过期</div>
            <el-button size="small" type="primary" @click="refreshQrCode" style="margin-top: 8px">刷新二维码</el-button>
          </div>
        </div>
        <div v-else class="qr-loading">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <div>正在生成二维码...</div>
        </div>
        <div class="qr-tip">
          打开网易云音乐 App，扫描二维码登录
        </div>
        <div class="qr-status" v-if="music.qrStatus === 801">等待扫码...</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useMusicStore } from '@/stores/music'
import {
  Headset, FolderOpened, Document, Delete, Search, Loading,
  VideoPlay, VideoPause, DArrowLeft, DArrowRight, Sort, Microphone,
  List, Plus, Close, User, CircleCheck, Warning
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const music = useMusicStore()

const searchKeyword = ref('')
const progressValue = ref(0)
const volumeValue = ref(music.volume)
const lyricsContainer = ref<HTMLElement | null>(null)

// v2.9.2：网易云登录与歌单
const neteaseTab = ref<'search' | 'playlists'>('search')
const showLoginDialog = ref(false)
const qrImageUrl = ref('')
const viewingPlaylistId = ref(0)
let qrPollTimer: number | null = null

const currentCover = computed(() => music.currentTrack?.cover || '')

watch(() => music.currentTime, (t) => {
  progressValue.value = t
})

watch(() => music.volume, (v) => {
  volumeValue.value = v
})

// v2.9.2：登录成功后关闭对话框
watch(() => music.neteaseLoggedIn, (logged) => {
  if (logged) {
    showLoginDialog.value = false
    stopQrPolling()
  }
})

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function doSearch() {
  const kw = searchKeyword.value.trim()
  if (kw) {
    music.searchOnline(kw, 30)
  }
}

function scrollToLyric(el: HTMLElement) {
  if (!lyricsContainer.value) return
  const container = lyricsContainer.value
  const elTop = el.offsetTop
  const containerHeight = container.clientHeight
  const targetScroll = elTop - containerHeight / 2 + el.clientHeight / 2
  container.scrollTo({ top: targetScroll, behavior: 'smooth' })
}

// ── v2.9.2：网易云二维码登录 ──

async function startQrLogin() {
  qrImageUrl.value = ''
  const key = await music.getQrKey()
  if (key) {
    // 生成二维码图片 URL（使用网易云登录页 URL 编码为二维码）
    const qrUrl = `https://music.163.com/login?codekey=${key}`
    qrImageUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`
    startQrPolling()
  } else {
    ElMessage.error('获取二维码失败，请重试')
  }
}

function startQrPolling() {
  stopQrPolling()
  qrPollTimer = window.setInterval(async () => {
    const code = await music.checkQrLogin()
    if (code === 803 || code === 800) {
      stopQrPolling()
    }
  }, 2000)
}

function stopQrPolling() {
  if (qrPollTimer) {
    clearInterval(qrPollTimer)
    qrPollTimer = null
  }
}

async function refreshQrCode() {
  await startQrLogin()
}

async function handleLogout() {
  await music.logoutNetease()
  ElMessage.success('已退出网易云登录')
}

// v2.9.2：切换到歌单 Tab 时加载
function onPlaylistTab() {
  if (music.neteaseLoggedIn && music.userPlaylists.length === 0) {
    music.fetchUserPlaylists()
  }
}

// v2.9.2：打开歌单详情
async function openPlaylist(id: number) {
  viewingPlaylistId.value = id
  await music.fetchPlaylistDetail(id)
}

// v2.9.2：监听登录对话框显示
watch(showLoginDialog, (val) => {
  if (val) {
    startQrLogin()
  } else {
    stopQrPolling()
  }
})

onMounted(() => {
  music.checkLoginStatus()
})

onUnmounted(() => {
  stopQrPolling()
})
</script>

<style scoped>
.music-page {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.music-header {
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

.music-actions {
  display: flex;
  gap: 8px;
}

.music-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.glass-card {
  background: var(--mo-surface);
  border: 1px solid var(--mo-border);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(12px);
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--mo-text-1);
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 14px 0;
}

/* 播放器卡片 */
.player-card {
  text-align: center;
  margin-bottom: 16px;
}

.player-cover {
  width: 180px;
  height: 180px;
  margin: 0 auto 16px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--mo-bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-img.spinning {
  animation: spin 20s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.cover-placeholder {
  color: var(--mo-text-3);
}

.player-info {
  margin-bottom: 16px;
}

.track-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin-bottom: 4px;
}

.track-meta {
  font-size: 13px;
  color: var(--mo-text-2);
  margin-bottom: 6px;
}

.track-source {
  display: flex;
  justify-content: center;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.time-label {
  font-size: 12px;
  color: var(--mo-text-3);
  min-width: 40px;
}

.progress-slider {
  flex: 1;
}

.player-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.ctrl-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--mo-border);
  background: var(--mo-bg-2);
  color: var(--mo-text-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.ctrl-btn:hover {
  background: var(--mo-primary);
  color: #fff;
  border-color: var(--mo-primary);
}

.ctrl-btn.active {
  background: var(--mo-primary);
  color: #fff;
  border-color: var(--mo-primary);
}

.play-btn {
  width: 56px;
  height: 56px;
  font-size: 20px;
  background: var(--mo-primary);
  color: #fff;
  border-color: var(--mo-primary);
}

.play-btn:hover {
  opacity: 0.9;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
  color: var(--mo-text-3);
}

.volume-slider {
  width: 80px;
}

/* 歌词卡片 */
.lyrics-card {
  flex: 1;
}

.lyrics-container {
  max-height: 200px;
  overflow-y: auto;
  text-align: center;
  padding: 10px;
}

.lyric-line {
  font-size: 14px;
  color: var(--mo-text-3);
  line-height: 2;
  transition: all 0.3s;
}

.lyric-line.active {
  color: var(--mo-primary);
  font-weight: 600;
  font-size: 16px;
}

.lyrics-empty {
  color: var(--mo-text-3);
  font-size: 14px;
  padding: 30px 0;
}

.lyrics-hint {
  font-size: 12px;
  opacity: 0.7;
}

/* 搜索卡片 */
.search-card {
  margin-bottom: 16px;
}

.search-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-loading {
  text-align: center;
  padding: 20px;
  color: var(--mo-text-3);
}

.search-results {
  max-height: 280px;
  overflow-y: auto;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.search-item:hover {
  background: var(--mo-bg-2);
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.song-cover.placeholder {
  background: var(--mo-bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-3);
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-name {
  font-size: 13px;
  color: var(--mo-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 11px;
  color: var(--mo-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.search-empty {
  text-align: center;
  padding: 20px;
  color: var(--mo-text-3);
  font-size: 13px;
}

/* 播放列表卡片 */
.playlist-card {
  flex: 1;
}

.playlist-count {
  font-size: 12px;
  color: var(--mo-text-3);
  font-weight: 400;
  margin-left: 8px;
}

.playlist-container {
  max-height: 300px;
  overflow-y: auto;
}

.playlist-empty {
  text-align: center;
  padding: 30px 0;
  color: var(--mo-text-3);
  font-size: 13px;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.playlist-item:hover {
  background: var(--mo-bg-2);
}

.playlist-item.active {
  background: rgba(64, 158, 255, 0.1);
}

.playlist-item.active .item-name {
  color: var(--mo-primary);
  font-weight: 600;
}

.item-index {
  width: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--mo-text-3);
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 13px;
  color: var(--mo-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  font-size: 11px;
  color: var(--mo-text-3);
  display: flex;
  align-items: center;
  gap: 6px;
}

.source-tag {
  transform: scale(0.85);
}

.item-remove {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--mo-text-3);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-remove:hover {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

@media (max-width: 900px) {
  .music-body {
    grid-template-columns: 1fr;
  }
}

/* v2.9.2：网易云用户信息 */
.netease-user {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--mo-surface);
  border: 1px solid var(--mo-border);
  border-radius: 20px;
}

.netease-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.netease-nickname {
  font-size: 13px;
  color: var(--mo-text-1);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* v2.9.2：Tab 切换 */
.music-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  background: var(--mo-surface);
  border: 1px solid var(--mo-border);
  border-radius: 10px;
  padding: 4px;
}

.music-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--mo-text-3);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.music-tab:hover {
  color: var(--mo-text-1);
}

.music-tab.active {
  color: #fff;
  background: var(--mo-primary, #409eff);
}

/* v2.9.2：歌单网格 */
.user-playlists-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.playlist-grid-item {
  cursor: pointer;
  transition: transform 0.2s;
}

.playlist-grid-item:hover {
  transform: translateY(-2px);
}

.playlist-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  object-fit: cover;
  background: var(--mo-bg-2);
}

.playlist-cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-3);
}

.playlist-grid-name {
  font-size: 12px;
  color: var(--mo-text-1);
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

.playlist-grid-meta {
  font-size: 11px;
  color: var(--mo-text-3);
  margin-top: 2px;
}

/* v2.9.2：歌单详情 */
.playlist-detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.playlist-detail-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--mo-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-detail-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.playlist-tracks {
  max-height: 350px;
  overflow-y: auto;
}

/* v2.9.2：二维码登录 */
.qr-login-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
}

.qr-image-wrap {
  position: relative;
  width: 200px;
  height: 200px;
}

.qr-image {
  width: 200px;
  height: 200px;
  border-radius: 12px;
  border: 1px solid var(--mo-border);
}

.qr-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  font-size: 13px;
  color: var(--mo-text-1);
}

.qr-overlay.expired {
  color: #f56c6c;
}

.qr-loading {
  width: 200px;
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--mo-text-3);
  font-size: 13px;
}

.qr-tip {
  margin-top: 14px;
  font-size: 13px;
  color: var(--mo-text-2);
  text-align: center;
}

.qr-status {
  margin-top: 6px;
  font-size: 12px;
  color: var(--mo-text-3);
}
</style>
