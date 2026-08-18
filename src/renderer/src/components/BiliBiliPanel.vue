<template>
  <div class="bili-panel">
    <!-- 工具栏：页签切换 + 搜索 + 登录状态 -->
    <div class="bili-toolbar glass-card">
      <div class="bili-tabs">
        <button class="bili-tab" :class="{ active: tab === 'popular' }" @click="switchTab('popular')">
          <el-icon><Promotion /></el-icon> 热门推荐
        </button>
        <button class="bili-tab" :class="{ active: tab === 'fav' }" @click="switchTab('fav')">
          <el-icon><Star /></el-icon> 收藏夹
        </button>
        <button class="bili-tab" :class="{ active: tab === 'search' }" :disabled="!searchedOnce" @click="switchTab('search')">
          <el-icon><Search /></el-icon> 搜索结果
        </button>
      </div>
      <div class="bili-search">
        <input
          v-model="searchKeyword"
          class="bili-search-input"
          placeholder="搜索 B 站视频，回车开始"
          @keyup.enter="doSearch(1)"
        />
        <el-button size="small" type="primary" :loading="searchLoading" @click="doSearch(1)">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
      </div>
      <div class="bili-user">
        <template v-if="user">
          <img v-if="user.face" class="bili-avatar" :src="user.face" alt="头像" />
          <el-icon v-else class="bili-avatar-placeholder"><UserFilled /></el-icon>
          <span class="bili-uname" :title="user.uname">{{ user.uname }}</span>
          <el-button size="small" link @click="logout">退出</el-button>
        </template>
        <el-button v-else size="small" type="primary" plain @click="openLogin">
          <el-icon><User /></el-icon> 登录 B 站
        </el-button>
      </div>
    </div>

    <!-- 热门推荐 -->
    <div v-if="tab === 'popular'" class="bili-content">
      <div class="bili-content-head">
        <span class="bili-content-title"><el-icon><Promotion /></el-icon> 热门视频推荐</span>
        <el-button size="small" :loading="popularLoading" @click="loadPopular(true)">
          <el-icon><Refresh /></el-icon> 换一批
        </el-button>
      </div>
      <div v-if="popularLoading && !popularList.length" class="bili-loading">
        <el-icon class="is-loading" :size="28"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <div v-else class="bili-grid">
        <div v-for="v in popularList" :key="v.bvid" class="bili-card" @click="playVideo(v)">
          <div class="bili-cover-wrap">
            <img class="bili-cover" :src="v.pic" loading="lazy" alt="" />
            <span v-if="v.duration" class="bili-duration">{{ v.duration }}</span>
            <div class="bili-cover-mask">
              <el-icon class="bili-play-icon"><VideoPlay /></el-icon>
            </div>
          </div>
          <div class="bili-card-info">
            <div class="bili-card-title" :title="v.title">{{ v.title }}</div>
            <div class="bili-card-meta">
              <span class="bili-meta-author">{{ v.author }}</span>
              <span class="bili-meta-stat">{{ formatCount(v.play) }} 播放</span>
            </div>
          </div>
        </div>
      </div>
      <div class="bili-load-more" v-if="popularList.length">
        <el-button size="small" :loading="popularLoading" :disabled="!popularHasMore" @click="loadPopular(false)">
          加载更多
        </el-button>
      </div>
    </div>

    <!-- 收藏夹 -->
    <div v-if="tab === 'fav'" class="bili-content">
      <template v-if="!user">
        <div class="bili-empty glass-card">
          <el-icon :size="48"><Star /></el-icon>
          <p>登录后查看 B 站收藏夹</p>
          <el-button type="primary" @click="openLogin"><el-icon><User /></el-icon> 立即登录</el-button>
        </div>
      </template>
      <div v-else class="bili-fav-layout">
        <div class="bili-fav-folders glass-card">
          <h3 class="bili-section-title"><el-icon><FolderOpened /></el-icon> 收藏夹</h3>
          <div v-if="favFoldersLoading" class="bili-loading small">
            <el-icon class="is-loading"><Loading /></el-icon><span>加载中...</span>
          </div>
          <div v-else-if="!favFolders.length" class="bili-folder-empty">暂无收藏夹</div>
          <div
            v-for="f in favFolders"
            :key="f.id"
            class="bili-folder-item"
            :class="{ active: currentFolder?.id === f.id }"
            @click="selectFolder(f)"
          >
            <span class="bili-folder-name" :title="f.title">{{ f.title }}</span>
            <span class="bili-folder-count">{{ f.count }}</span>
          </div>
        </div>
        <div class="bili-fav-main">
          <div v-if="!currentFolder" class="bili-empty glass-card">
            <el-icon :size="48"><FolderOpened /></el-icon>
            <p>从左侧选择一个收藏夹</p>
          </div>
          <template v-else>
            <div class="bili-content-head">
              <span class="bili-content-title">
                <el-icon><FolderOpened /></el-icon> {{ currentFolder.title }}
                <span class="bili-folder-total">{{ currentFolder.count }} 个内容</span>
              </span>
              <el-button size="small" :loading="favListLoading" @click="loadFavList(true)">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
            </div>
            <div v-if="favListLoading && !favList.length" class="bili-loading">
              <el-icon class="is-loading" :size="28"><Loading /></el-icon>
              <span>加载中...</span>
            </div>
            <div v-else-if="!favList.length" class="bili-empty glass-card">
              <el-icon :size="48"><VideoPlay /></el-icon>
              <p>该收藏夹暂无可播放的视频</p>
            </div>
            <div v-else class="bili-grid">
              <div v-for="v in favList" :key="v.bvid" class="bili-card" @click="playVideo(v)">
                <div class="bili-cover-wrap">
                  <img class="bili-cover" :src="v.pic" loading="lazy" alt="" />
                  <span v-if="v.duration" class="bili-duration">{{ v.duration }}</span>
                  <div class="bili-cover-mask">
                    <el-icon class="bili-play-icon"><VideoPlay /></el-icon>
                  </div>
                </div>
                <div class="bili-card-info">
                  <div class="bili-card-title" :title="v.title">{{ v.title }}</div>
                  <div class="bili-card-meta">
                    <span class="bili-meta-author">{{ v.author }}</span>
                    <span class="bili-meta-stat">{{ formatCount(v.play) }} 播放</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="bili-load-more" v-if="favList.length">
              <el-button size="small" :loading="favListLoading" :disabled="!favHasMore" @click="loadFavList(false)">
                加载更多
              </el-button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="tab === 'search'" class="bili-content">
      <div class="bili-content-head">
        <span class="bili-content-title">
          <el-icon><Search /></el-icon> 「{{ lastKeyword }}」的搜索结果
          <span class="bili-folder-total" v-if="searchTotal">约 {{ formatCount(searchTotal) }} 条</span>
        </span>
        <div class="bili-pager">
          <el-button size="small" :disabled="searchPage <= 1 || searchLoading" @click="doSearch(searchPage - 1)">上一页</el-button>
          <span class="bili-page-text">{{ searchPage }} / {{ Math.max(searchNumPages, searchPage) }}</span>
          <el-button size="small" :disabled="searchPage >= searchNumPages || searchLoading" @click="doSearch(searchPage + 1)">下一页</el-button>
        </div>
      </div>
      <div v-if="searchLoading && !searchList.length" class="bili-loading">
        <el-icon class="is-loading" :size="28"><Loading /></el-icon>
        <span>搜索中...</span>
      </div>
      <div v-else-if="!searchList.length" class="bili-empty glass-card">
        <el-icon :size="48"><Search /></el-icon>
        <p>没有找到相关视频</p>
      </div>
      <div v-else class="bili-grid">
        <div v-for="v in searchList" :key="v.bvid" class="bili-card" @click="playVideo(v)">
          <div class="bili-cover-wrap">
            <img class="bili-cover" :src="v.pic" loading="lazy" alt="" />
            <span v-if="v.duration" class="bili-duration">{{ v.duration }}</span>
            <div class="bili-cover-mask">
              <el-icon class="bili-play-icon"><VideoPlay /></el-icon>
            </div>
          </div>
          <div class="bili-card-info">
            <div class="bili-card-title" :title="v.title">{{ v.title }}</div>
            <div class="bili-card-meta">
              <span class="bili-meta-author">{{ v.author }}</span>
              <span class="bili-meta-stat">{{ formatCount(v.play) }} 播放</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 播放器弹窗 -->
    <el-dialog
      v-model="playerVisible"
      :title="currentView?.title || '视频播放'"
      width="920px"
      top="5vh"
      class="bili-player-dialog"
      append-to-body
      destroy-on-close
      @close="onPlayerClose"
    >
      <div class="bili-player-body">
        <div class="bili-player-stage">
          <video
            ref="videoEl"
            class="bili-video"
            :src="videoSrc"
            controls
            autoplay
            preload="metadata"
            playsinline
            @ended="onVideoEnded"
            @error="onVideoError"
          ></video>
          <div v-if="playerLoading" class="bili-player-loading">
            <el-icon class="is-loading" :size="32"><Loading /></el-icon>
            <span>正在获取播放地址...</span>
          </div>
          <div v-if="playerError" class="bili-player-error">
            <el-icon :size="32"><Warning /></el-icon>
            <span>{{ playerError }}</span>
            <el-button size="small" type="primary" @click="retryPlay">重试</el-button>
          </div>
        </div>
        <!-- 播放信息栏：分 P / 清晰度 / 数据 -->
        <div class="bili-player-bar" v-if="currentView">
          <div class="bili-player-bar-left">
            <span class="bili-player-up">
              <el-icon><User /></el-icon> {{ currentView.owner.name }}
            </span>
            <span class="bili-player-stat">{{ formatCount(currentView.stat.view) }} 播放</span>
            <span class="bili-player-stat">{{ formatCount(currentView.stat.danmaku) }} 弹幕</span>
            <span class="bili-player-stat">{{ formatCount(currentView.stat.like) }} 点赞</span>
          </div>
          <div class="bili-player-bar-right">
            <select
              v-if="currentView.pages.length > 1"
              class="bili-select"
              :value="currentPageIdx"
              @change="switchPage(Number(($event.target as HTMLSelectElement).value))"
              title="选择分 P"
            >
              <option v-for="(p, idx) in currentView.pages" :key="p.cid" :value="idx">
                P{{ p.page }} {{ p.part }}（{{ p.duration }}）
              </option>
            </select>
            <select
              v-if="acceptQualities.length > 1"
              class="bili-select"
              :value="currentQn"
              @change="switchQuality(Number(($event.target as HTMLSelectElement).value))"
              title="切换清晰度"
            >
              <option v-for="q in acceptQualities" :key="q.qn" :value="q.qn">{{ q.label }}</option>
            </select>
            <span v-if="qualityLabel" class="bili-quality-tag">{{ qualityLabel }}</span>
          </div>
        </div>
        <!-- 分 P 横向列表（超过 1 P 时） -->
        <div v-if="currentView && currentView.pages.length > 1" class="bili-pages-strip">
          <button
            v-for="(p, idx) in currentView.pages"
            :key="p.cid"
            class="bili-page-chip"
            :class="{ active: idx === currentPageIdx }"
            :title="p.part"
            @click="switchPage(idx)"
          >P{{ p.page }}</button>
        </div>
        <!-- 相关视频推荐 -->
        <div class="bili-related" v-if="relatedList.length">
          <div class="bili-content-head">
            <span class="bili-content-title small"><el-icon><VideoPlay /></el-icon> 相关视频</span>
          </div>
          <div class="bili-grid related">
            <div v-for="v in relatedList" :key="v.bvid" class="bili-card" @click="playVideo(v)">
              <div class="bili-cover-wrap">
                <img class="bili-cover" :src="v.pic" loading="lazy" alt="" />
                <span v-if="v.duration" class="bili-duration">{{ v.duration }}</span>
                <div class="bili-cover-mask">
                  <el-icon class="bili-play-icon"><VideoPlay /></el-icon>
                </div>
              </div>
              <div class="bili-card-info">
                <div class="bili-card-title" :title="v.title">{{ v.title }}</div>
                <div class="bili-card-meta">
                  <span class="bili-meta-author">{{ v.author }}</span>
                  <span class="bili-meta-stat">{{ formatCount(v.play) }} 播放</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 登录弹窗：扫码 / Cookie -->
    <el-dialog v-model="loginVisible" title="登录哔哩哔哩" width="440px" append-to-body @close="stopQrPolling">
      <el-tabs v-model="loginMode">
        <el-tab-pane label="扫码登录" name="qr">
          <div class="bili-login-qr">
            <div class="bili-qr-wrap">
              <img v-if="qrImg" class="bili-qr-img" :src="qrImg" alt="登录二维码" />
              <div v-else class="bili-qr-placeholder">
                <el-icon class="is-loading" v-if="qrLoading"><Loading /></el-icon>
                <span v-else>二维码加载失败</span>
              </div>
              <div v-if="qrExpired" class="bili-qr-expired" @click="startQrLogin">
                <el-icon :size="24"><Refresh /></el-icon>
                <span>二维码已失效，点击刷新</span>
              </div>
            </div>
            <p class="bili-qr-hint">{{ qrHint }}</p>
            <p class="bili-qr-tip">使用哔哩哔哩手机客户端扫码确认登录</p>
          </div>
        </el-tab-pane>
        <el-tab-pane label="Cookie 登录" name="cookie">
          <div class="bili-login-cookie">
            <p class="bili-cookie-tip">
              在浏览器登录 bilibili.com 后，按 F12 打开控制台执行 <code>document.cookie</code>，复制结果粘贴到下方。
            </p>
            <el-input v-model="cookieInput" type="textarea" :rows="4" placeholder="粘贴 Cookie 字符串（需包含 SESSDATA）" />
            <el-button type="primary" class="bili-cookie-btn" :loading="cookieLoading" @click="loginByCookie">
              确认登录
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// v3.5.3：哔哩哔哩面板 —— 学习资料页集成的在线视频模块
// 功能：扫码/Cookie 登录、热门推荐、收藏夹浏览、视频搜索、视频播放（分P/清晰度/相关推荐）
// 全部请求经主进程代理（bili:* IPC），播放流由主进程 webRequest 注入 Referer 绕过防盗链。
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Search, Star, Promotion, User, UserFilled, Refresh, Loading,
  VideoPlay, FolderOpened, Warning
} from '@element-plus/icons-vue'

const api = window.electronAPI

type BiliTab = 'popular' | 'fav' | 'search'
const tab = ref<BiliTab>('popular')

// ── 登录状态 ──
const user = ref<BiliUser | null>(null)

async function refreshLoginStatus(): Promise<void> {
  if (!api) return
  try {
    const res = await api.biliLoginStatus()
    user.value = res.loggedIn && res.user ? res.user : null
  } catch {
    user.value = null
  }
}

async function logout(): Promise<void> {
  if (!api) return
  await api.biliLogout()
  user.value = null
  favFolders.value = []
  favList.value = []
  currentFolder.value = null
  ElMessage.success('已退出 B 站登录')
}

// ── 登录弹窗（扫码 + Cookie） ──
const loginVisible = ref(false)
const loginMode = ref<'qr' | 'cookie'>('qr')
const qrImg = ref('')
const qrLoading = ref(false)
const qrExpired = ref(false)
const qrHint = ref('等待扫码...')
let qrKey = ''
let qrTimer: ReturnType<typeof setInterval> | null = null

function openLogin(): void {
  loginVisible.value = true
  loginMode.value = 'qr'
  startQrLogin()
}

async function startQrLogin(): Promise<void> {
  if (!api) return
  stopQrPolling()
  qrImg.value = ''
  qrExpired.value = false
  qrLoading.value = true
  qrHint.value = '获取二维码中...'
  try {
    const res = await api.biliQrKey()
    qrLoading.value = false
    if (!res.success || !res.qrimg) {
      qrHint.value = res.message || '二维码获取失败，请重试'
      return
    }
    qrImg.value = res.qrimg
    qrKey = res.key || ''
    qrHint.value = '等待扫码...'
    // 二维码有效期 180 秒，每 2 秒轮询一次
    qrTimer = setInterval(async () => {
      if (!qrKey) return
      const check = await api!.biliQrCheck(qrKey)
      const code = check.code
      if (code === 0) {
        stopQrPolling()
        loginVisible.value = false
        ElMessage.success('B 站登录成功')
        await refreshLoginStatus()
        if (tab.value === 'fav') loadFavFolders()
      } else if (code === 86090) {
        qrHint.value = '已扫码，请在手机上确认'
      } else if (code === 86038) {
        stopQrPolling()
        qrExpired.value = true
        qrHint.value = '二维码已失效'
      }
    }, 2000)
  } catch (err) {
    qrLoading.value = false
    qrHint.value = String(err)
  }
}

function stopQrPolling(): void {
  if (qrTimer) {
    clearInterval(qrTimer)
    qrTimer = null
  }
}

const cookieInput = ref('')
const cookieLoading = ref(false)

async function loginByCookie(): Promise<void> {
  if (!api) return
  if (!cookieInput.value.trim()) {
    ElMessage.warning('请先粘贴 Cookie')
    return
  }
  cookieLoading.value = true
  try {
    const res = await api.biliSetCookie(cookieInput.value.trim())
    if (res.loggedIn && res.user) {
      user.value = res.user
      loginVisible.value = false
      cookieInput.value = ''
      ElMessage.success(`欢迎回来，${res.user.uname}`)
      if (tab.value === 'fav') loadFavFolders()
    } else {
      ElMessage.error(res.message || '登录验证失败')
    }
  } catch (err) {
    ElMessage.error(String(err))
  } finally {
    cookieLoading.value = false
  }
}

// ── 热门推荐 ──
const popularList = ref<BiliVideo[]>([])
const popularPage = ref(1)
const popularHasMore = ref(true)
const popularLoading = ref(false)

async function loadPopular(refresh: boolean): Promise<void> {
  if (!api || popularLoading.value) return
  popularLoading.value = true
  try {
    // 换一批：随机跳页（热门接口无总数，限定前 20 页内随机），避免一直看同一批
    const page = refresh ? 1 + Math.floor(Math.random() * 20) : popularPage.value + 1
    const res = await api.biliPopular(page, 20)
    if (!res.success) throw new Error(res.message || '加载失败')
    popularList.value = refresh ? (res.list || []) : [...popularList.value, ...(res.list || [])]
    popularPage.value = page
    popularHasMore.value = !!res.hasMore
  } catch (err) {
    ElMessage.error(`热门视频加载失败: ${(err as Error).message || err}`)
  } finally {
    popularLoading.value = false
  }
}

// ── 收藏夹 ──
const favFolders = ref<{ id: number; title: string; count: number; cover: string }[]>([])
const favFoldersLoading = ref(false)
const currentFolder = ref<{ id: number; title: string; count: number; cover: string } | null>(null)
const favList = ref<BiliVideo[]>([])
const favPage = ref(1)
const favHasMore = ref(true)
const favListLoading = ref(false)

async function loadFavFolders(): Promise<void> {
  if (!api) return
  favFoldersLoading.value = true
  try {
    const res = await api.biliFavFolders()
    if (!res.success) throw new Error(res.message || '获取收藏夹失败')
    favFolders.value = res.folders || []
    if (favFolders.value.length && !currentFolder.value) {
      selectFolder(favFolders.value[0])
    }
  } catch (err) {
    ElMessage.error((err as Error).message || String(err))
  } finally {
    favFoldersLoading.value = false
  }
}

function selectFolder(f: { id: number; title: string; count: number; cover: string }): void {
  if (currentFolder.value?.id === f.id) return
  currentFolder.value = f
  favList.value = []
  favPage.value = 1
  favHasMore.value = true
  loadFavList(true)
}

async function loadFavList(refresh: boolean): Promise<void> {
  if (!api || !currentFolder.value || favListLoading.value) return
  favListLoading.value = true
  try {
    const page = refresh ? 1 : favPage.value + 1
    const res = await api.biliFavList(currentFolder.value.id, page)
    if (!res.success) throw new Error(res.message || '加载失败')
    favList.value = refresh ? (res.list || []) : [...favList.value, ...(res.list || [])]
    favPage.value = page
    favHasMore.value = !!res.hasMore
  } catch (err) {
    ElMessage.error(`收藏夹内容加载失败: ${(err as Error).message || err}`)
  } finally {
    favListLoading.value = false
  }
}

// ── 搜索 ──
const searchKeyword = ref('')
const lastKeyword = ref('')
const searchedOnce = ref(false)
const searchList = ref<BiliVideo[]>([])
const searchPage = ref(1)
const searchTotal = ref(0)
const searchNumPages = ref(0)
const searchLoading = ref(false)

async function doSearch(page: number): Promise<void> {
  if (!api) return
  const kw = searchKeyword.value.trim()
  if (!kw) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  if (page < 1) return
  searchLoading.value = true
  try {
    const res = await api.biliSearch(kw, page)
    if (!res.success) throw new Error(res.message || '搜索失败')
    searchList.value = res.list || []
    searchPage.value = page
    searchTotal.value = res.total || 0
    searchNumPages.value = res.numPages || 0
    lastKeyword.value = kw
    searchedOnce.value = true
    tab.value = 'search'
    if (!searchList.value.length) ElMessage.info('没有找到相关视频')
  } catch (err) {
    ElMessage.error(`搜索失败: ${(err as Error).message || err}`)
  } finally {
    searchLoading.value = false
  }
}

// ── 页签切换 ──
function switchTab(t: BiliTab): void {
  tab.value = t
  if (t === 'fav' && user.value && !favFolders.value.length) loadFavFolders()
}

// ── 播放器 ──
const playerVisible = ref(false)
const playerLoading = ref(false)
const playerError = ref('')
const currentView = ref<{
  bvid: string; aid: number; title: string; pic: string; desc: string; duration: string; pubdate: number
  owner: { mid: number; name: string; face: string }
  stat: { view: number; danmaku: number; like: number; coin: number; favorite: number; reply: number }
  pages: { cid: number; page: number; part: string; duration: string }[]
} | null>(null)
const currentPageIdx = ref(0)
const currentQn = ref(64)
const qualityLabel = ref('')
const acceptQualities = ref<{ qn: number; label: string }[]>([])
const videoSrc = ref('')
let segments: { url: string; backupUrl: string[] }[] = []
let segIdx = 0
let triedBackup = false
const videoEl = ref<HTMLVideoElement | null>(null)
const relatedList = ref<BiliVideo[]>([])

async function playVideo(v: BiliVideo): Promise<void> {
  if (!api || !v.bvid) return
  playerVisible.value = true
  playerLoading.value = true
  playerError.value = ''
  videoSrc.value = ''
  relatedList.value = []
  try {
    const res = await api.biliView(v.bvid)
    if (!res.success || !res.video) throw new Error(res.message || '视频信息获取失败')
    currentView.value = res.video
    currentPageIdx.value = 0
    // 相关视频推荐（异步加载，不阻塞播放）
    api.biliRelated(v.bvid).then(r => {
      if (r.success && currentView.value?.bvid === v.bvid) relatedList.value = r.list || []
    }).catch(() => { /* 相关推荐失败不影响播放 */ })
    await loadStream()
  } catch (err) {
    playerLoading.value = false
    playerError.value = (err as Error).message || String(err)
  }
}

async function loadStream(): Promise<void> {
  if (!api || !currentView.value) return
  playerLoading.value = true
  playerError.value = ''
  triedBackup = false
  segIdx = 0
  try {
    const page = currentView.value.pages[currentPageIdx.value]
    if (!page) throw new Error('视频分 P 信息缺失')
    const res = await api.biliPlayurl(currentView.value.bvid, page.cid, currentQn.value)
    if (!res.success || !res.durl?.length) throw new Error(res.message || '播放地址获取失败')
    segments = res.durl
    acceptQualities.value = res.acceptQuality || []
    qualityLabel.value = res.qualityLabel || ''
    if (res.quality) currentQn.value = res.quality
    videoSrc.value = segments[0].url
    playerLoading.value = false
  } catch (err) {
    playerLoading.value = false
    playerError.value = (err as Error).message || String(err)
  }
}

function retryPlay(): void {
  loadStream()
}

function switchPage(idx: number): void {
  if (!currentView.value || idx === currentPageIdx.value) return
  currentPageIdx.value = idx
  loadStream()
}

function switchQuality(qn: number): void {
  if (qn === currentQn.value) return
  currentQn.value = qn
  loadStream()
}

/** 多分段（长视频 FLV 分段）自动连播 */
function onVideoEnded(): void {
  if (segIdx < segments.length - 1) {
    segIdx++
    triedBackup = false
    videoSrc.value = segments[segIdx].url
    videoEl.value?.play().catch(() => { /* 自动播放被拦截时等待用户手动播放 */ })
  }
}

/** 播放出错时优先切换备用 CDN 地址 */
function onVideoError(): void {
  if (!videoSrc.value) return // 未设置 src 时不处理（关闭弹窗瞬间可能触发）
  const seg = segments[segIdx]
  if (!triedBackup && seg && seg.backupUrl.length) {
    triedBackup = true
    videoSrc.value = seg.backupUrl[0]
    videoEl.value?.play().catch(() => {})
  } else {
    playerError.value = '视频流加载失败，可能是清晰度受限或网络问题，请尝试切换清晰度'
  }
}

function onPlayerClose(): void {
  // 弹窗关闭：停止播放并清理，释放带宽与内存
  try { videoEl.value?.pause() } catch { /* ignore */ }
  videoSrc.value = ''
  segments = []
  segIdx = 0
  playerLoading.value = false
  playerError.value = ''
}

// ── 工具函数 ──
function formatCount(n: number | string): string {
  const num = typeof n === 'number' ? n : Number(n) || 0
  if (num >= 100000000) return (num / 100000000).toFixed(1) + ' 亿'
  if (num >= 10000) return (num / 10000).toFixed(1) + ' 万'
  return String(num)
}

onMounted(() => {
  refreshLoginStatus()
  loadPopular(true)
})

onBeforeUnmount(() => {
  stopQrPolling()
  try { videoEl.value?.pause() } catch { /* ignore */ }
})
</script>

<style scoped>
/* v3.5.3：B 站面板样式 —— 与学习资料页同一套玻璃拟态变量，保持整体风格一致 */
.bili-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
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
}

/* ── 工具栏 ── */
.bili-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  flex-wrap: wrap;
}

.bili-tabs {
  display: flex;
  gap: 6px;
}

.bili-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--mo-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.bili-tab:hover:not(:disabled) {
  color: var(--mo-text-1);
  background: rgba(59, 130, 246, 0.08);
}

.bili-tab.active {
  color: var(--mo-accent);
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.35);
}

.bili-tab:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.bili-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 220px;
}

.bili-search-input {
  flex: 1;
  max-width: 380px;
  padding: 7px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  color: var(--mo-text-1);
  font-size: 13px;
  outline: none;
  transition: all 0.2s ease;
}

html.dark .bili-search-input {
  background: rgba(255, 255, 255, 0.08);
}

.bili-search-input:focus {
  border-color: var(--mo-accent);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18);
}

.bili-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.bili-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--glass-border);
}

.bili-avatar-placeholder {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.12);
  color: var(--mo-accent);
  padding: 5px;
}

.bili-uname {
  font-size: 13px;
  color: var(--mo-text-1);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 内容区 ── */
.bili-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.bili-content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.bili-content-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--mo-text-1);
}

.bili-content-title.small {
  font-size: 13px;
}

.bili-folder-total {
  font-size: 12px;
  font-weight: 400;
  color: var(--mo-text-2);
}

/* ── 视频卡片网格 ── */
.bili-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 14px;
}

.bili-grid.related {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.bili-card {
  border-radius: var(--mo-radius-sm);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.bili-card:hover {
  transform: translateY(-3px);
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 8px 24px rgba(30, 60, 120, 0.16);
}

.bili-cover-wrap {
  position: relative;
  aspect-ratio: 16 / 9;
  background: rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.bili-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}

.bili-card:hover .bili-cover {
  transform: scale(1.04);
}

.bili-duration {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 7px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  z-index: 2;
}

.bili-cover-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.bili-card:hover .bili-cover-mask {
  opacity: 1;
}

.bili-play-icon {
  font-size: 34px;
  color: #fff;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
}

.bili-card-info {
  padding: 8px 10px 10px;
}

.bili-card-title {
  font-size: 13px;
  line-height: 1.4;
  color: var(--mo-text-1);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}

.bili-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--mo-text-2);
}

.bili-meta-author {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-meta-stat {
  flex-shrink: 0;
}

/* ── 加载 / 空状态 ── */
.bili-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--mo-text-2);
  font-size: 13px;
}

.bili-loading.small {
  padding: 20px 0;
}

.bili-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
  color: var(--mo-text-2);
  text-align: center;
}

.bili-load-more {
  display: flex;
  justify-content: center;
  padding: 4px 0 8px;
}

/* ── 收藏夹布局 ── */
.bili-fav-layout {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.bili-fav-folders {
  width: 220px;
  flex-shrink: 0;
  padding: 12px;
  max-height: 560px;
  overflow-y: auto;
}

.bili-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin-bottom: 10px;
}

.bili-folder-empty {
  font-size: 12px;
  color: var(--mo-text-2);
  text-align: center;
  padding: 16px 0;
}

.bili-folder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--mo-text-2);
  transition: all 0.18s ease;
}

.bili-folder-item:hover {
  background: rgba(59, 130, 246, 0.08);
  color: var(--mo-text-1);
}

.bili-folder-item.active {
  background: rgba(59, 130, 246, 0.14);
  color: var(--mo-accent);
}

.bili-folder-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-folder-count {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
}

.bili-fav-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── 搜索分页 ── */
.bili-pager {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bili-page-text {
  font-size: 12px;
  color: var(--mo-text-2);
  min-width: 48px;
  text-align: center;
}

/* ── 播放器弹窗 ── */
.bili-player-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bili-player-stage {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: var(--mo-radius-sm);
  overflow: hidden;
}

.bili-video {
  width: 100%;
  height: 100%;
  display: block;
}

.bili-player-loading,
.bili-player-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 13px;
  text-align: center;
  padding: 0 20px;
}

.bili-player-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.bili-player-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.bili-player-up {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mo-accent);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-player-stat {
  font-size: 12px;
  color: var(--mo-text-2);
  white-space: nowrap;
}

.bili-player-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bili-select {
  padding: 5px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.4);
  color: var(--mo-text-1);
  font-size: 12px;
  outline: none;
  cursor: pointer;
  max-width: 240px;
}

html.dark .bili-select {
  background: rgba(255, 255, 255, 0.08);
}

.bili-quality-tag {
  font-size: 11px;
  color: var(--mo-accent);
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  white-space: nowrap;
}

.bili-pages-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bili-page-chip {
  padding: 4px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: transparent;
  color: var(--mo-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.bili-page-chip:hover {
  color: var(--mo-text-1);
  border-color: rgba(59, 130, 246, 0.4);
}

.bili-page-chip.active {
  color: #fff;
  background: var(--mo-accent);
  border-color: var(--mo-accent);
}

.bili-related {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px dashed var(--glass-border);
  padding-top: 12px;
}

/* ── 登录弹窗 ── */
.bili-login-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px 0 4px;
}

.bili-qr-wrap {
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: var(--mo-radius-sm);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  background: #fff;
}

.bili-qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.bili-qr-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-2);
  font-size: 13px;
  gap: 6px;
}

.bili-qr-expired {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--mo-text-2);
  font-size: 13px;
  cursor: pointer;
}

.bili-qr-hint {
  font-size: 13px;
  color: var(--mo-accent);
}

.bili-qr-tip {
  font-size: 12px;
  color: var(--mo-text-2);
}

.bili-login-cookie {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 0;
}

.bili-cookie-tip {
  font-size: 12px;
  color: var(--mo-text-2);
  line-height: 1.6;
}

.bili-cookie-tip code {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--mo-accent);
}

.bili-cookie-btn {
  align-self: flex-end;
}

@media (max-width: 900px) {
  .bili-fav-layout {
    flex-direction: column;
  }
  .bili-fav-folders {
    width: 100%;
    max-height: 200px;
  }
}
</style>
