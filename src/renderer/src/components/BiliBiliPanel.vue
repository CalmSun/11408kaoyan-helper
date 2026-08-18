<template>
  <div class="bili-panel">
    <!-- 工具栏：页签切换 + 搜索 + 登录状态 -->
    <div class="bili-toolbar glass-card">
      <div class="bili-tabs">
        <button class="bili-tab" :class="{ active: tab === 'rcmd' }" @click="switchTab('rcmd')">
          <el-icon><MagicStick /></el-icon> 个性推荐
        </button>
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

    <!-- 个性推荐（首页 feed/rcmd，登录后按兴趣个性化） -->
    <div v-if="tab === 'rcmd'" class="bili-content">
      <div class="bili-content-head">
        <span class="bili-content-title"><el-icon><MagicStick /></el-icon> 个性推荐</span>
        <el-button size="small" :loading="rcmdLoading" @click="loadRcmd">
          <el-icon><Refresh /></el-icon> 换一批
        </el-button>
      </div>
      <div v-if="rcmdLoading && !rcmdList.length" class="bili-loading">
        <el-icon class="is-loading" :size="28"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <div v-else-if="!rcmdList.length" class="bili-empty glass-card">
        <el-icon :size="48"><MagicStick /></el-icon>
        <p>暂无推荐内容，点击「换一批」重试</p>
      </div>
      <div v-else class="bili-grid cols-6">
        <div v-for="v in rcmdList" :key="v.bvid" class="bili-card" @click="playVideo(v)">
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
      <!-- v3.5.6：热门不自动加载，首次进入提示手动点「换一批」 -->
      <div v-else-if="!popularList.length" class="bili-empty glass-card">
        <el-icon :size="48"><Promotion /></el-icon>
        <p>点击上方「换一批」加载热门视频推荐</p>
      </div>
      <div v-else class="bili-grid cols-6">
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

    <!-- 播放器弹窗（v3.5.4：加大宽度并屏幕水平垂直居中） -->
    <el-dialog
      v-model="playerVisible"
      :title="currentView?.title || '视频播放'"
      width="min(1320px, 96vw)"
      class="bili-player-dialog"
      align-center
      append-to-body
      destroy-on-close
      @close="onPlayerClose"
    >
      <div class="bili-player-body">
        <div class="bili-player-main">
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
            @seeking="onVideoSeeking"
            @timeupdate="onDanmakuTick"
          ></video>
          <!-- v3.5.5：弹幕覆盖层（跟随视频时间轴渲染，可开关） -->
          <div ref="danmakuLayerEl" class="bili-danmaku-layer"></div>
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
            <button
              class="bili-dm-toggle"
              :class="{ on: danmakuEnabled }"
              :title="danmakuEnabled ? '关闭弹幕' : '开启弹幕'"
              @click="toggleDanmaku"
            >
              <el-icon><ChatDotRound /></el-icon> {{ danmakuEnabled ? '弹幕开' : '弹幕关' }}
            </button>
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
        <!-- v3.5.4：视频交互（点赞 / 投币 / 收藏，需登录） -->
        <div class="bili-player-actions" v-if="currentView">
          <button class="bili-action-btn" :class="{ liked: relLiked }" :disabled="relBusy" @click="toggleLike">
            <el-icon><SuccessFilled /></el-icon>
            <span>{{ relLiked ? '已点赞' : '点赞' }}</span>
            <em>{{ formatCount(currentView.stat.like + (relLiked ? 1 : 0)) }}</em>
          </button>
          <el-dropdown trigger="click" :disabled="relBusy" @command="giveCoin">
            <button class="bili-action-btn" :class="{ coined: relCoin > 0 }" :disabled="relBusy">
              <el-icon><Present /></el-icon>
              <span>{{ relCoin > 0 ? `已投 ${relCoin} 币` : '投币' }}</span>
              <em>{{ formatCount(currentView.stat.coin) }}</em>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="1">投 1 个币</el-dropdown-item>
                <el-dropdown-item :command="2">投 2 个币</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <button class="bili-action-btn" :class="{ faved: relFaved }" :disabled="relBusy" @click="toggleFav">
            <el-icon><StarFilled /></el-icon>
            <span>{{ relFaved ? '已收藏' : '收藏' }}</span>
            <em>{{ formatCount(currentView.stat.favorite + (relFaved ? 1 : 0)) }}</em>
          </button>
        </div>
        </div>
        <!-- v3.5.6：右侧栏 —— UP 主卡片 / 投稿 / 相关视频，独立滚动不撑高弹窗 -->
        <div class="bili-player-side" v-if="currentView && (upCard || relatedList.length)">
        <!-- v3.5.5：UP 主卡片（头像 / 粉丝 / 签名 / 查看投稿） -->
        <div class="bili-up-card" v-if="currentView && upCard">
          <img v-if="upCard.face" class="bili-up-face" :src="upCard.face" alt="UP 主头像" />
          <el-icon v-else class="bili-up-face bili-up-face-ph"><UserFilled /></el-icon>
          <div class="bili-up-info">
            <div class="bili-up-name">{{ upCard.name }}</div>
            <div class="bili-up-sign" :title="upCard.sign">{{ upCard.sign || '这个人很懒，什么都没有写~' }}</div>
          </div>
          <div class="bili-up-stats">
            <span>{{ formatCount(upCard.fans) }} 粉丝</span>
            <span>{{ formatCount(upCard.archives) }} 投稿</span>
          </div>
          <el-button size="small" :loading="spaceLoading && !spaceList.length" @click="toggleAuthorVideos">
            <el-icon><Film /></el-icon> {{ authorSectionVisible ? '收起投稿' : '查看投稿' }}
          </el-button>
        </div>
        <!-- v3.5.5：UP 主投稿视频（点击直接播放） -->
        <div class="bili-space" v-if="authorSectionVisible">
          <div class="bili-content-head">
            <span class="bili-content-title small"><el-icon><Film /></el-icon> TA 的投稿</span>
          </div>
          <div v-if="spaceLoading && !spaceList.length" class="bili-loading small">
            <el-icon class="is-loading"><Loading /></el-icon><span>加载中...</span>
          </div>
          <div v-else-if="!spaceList.length" class="bili-folder-empty">暂无投稿视频</div>
          <div v-else class="bili-grid related side-col">
            <div v-for="v in spaceList" :key="v.bvid" class="bili-card" @click="playVideo(v)">
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
                  <span class="bili-meta-stat">{{ formatCount(v.play) }} 播放</span>
                </div>
              </div>
            </div>
          </div>
          <div class="bili-load-more" v-if="spaceList.length && spaceHasMore">
            <el-button size="small" :loading="spaceLoading" @click="loadSpaceVideos(false)">加载更多</el-button>
          </div>
        </div>
        <!-- 相关视频推荐（v3.5.6：移入右侧栏单列展示，独立滚动） -->
        <div class="bili-related" v-if="relatedList.length">
          <div class="bili-content-head">
            <span class="bili-content-title small"><el-icon><VideoPlay /></el-icon> 相关视频</span>
          </div>
          <div class="bili-grid related side-col">
            <div v-for="v in relatedList.slice(0, 10)" :key="v.bvid" class="bili-card" @click="playVideo(v)">
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
  Search, Star, StarFilled, Promotion, User, UserFilled, Refresh, Loading,
  VideoPlay, FolderOpened, Warning, MagicStick, SuccessFilled, Present,
  ChatDotRound, Film
} from '@element-plus/icons-vue'
import { getGlobalStorage, setGlobalStorage } from '@/utils/storage'

const api = window.electronAPI

type BiliTab = 'rcmd' | 'popular' | 'fav' | 'search'
const tab = ref<BiliTab>('rcmd')

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

// ── 个性推荐（v3.5.4：首页 feed/rcmd，WBI 签名；v3.5.5：4x6 布局，换一批递增 fresh_idx） ──
const rcmdList = ref<BiliVideo[]>([])
const rcmdLoading = ref(false)
let rcmdIdx = 0

async function loadRcmd(): Promise<void> {
  if (!api || rcmdLoading.value) return
  rcmdLoading.value = true
  rcmdIdx++
  try {
    // 每批 24 条（6 列 x 4 行），fresh_idx 递增保证换一批拿到新内容
    const res = await api.biliRcmd(24, rcmdIdx)
    if (!res.success) throw new Error(res.message || '加载失败')
    rcmdList.value = res.list || []
  } catch (err) {
    ElMessage.error(`推荐加载失败: ${(err as Error).message || err}`)
  } finally {
    rcmdLoading.value = false
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
    // v3.5.6：每页 24 条（6 列 x 4 行）
    const res = await api.biliPopular(page, 24)
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
    // v3.5.4：查询点赞/投币/收藏状态（异步，不阻塞播放）
    loadRelation(res.video.aid)
    // v3.5.5：UP 主卡片与弹幕（异步加载，不阻塞起播）
    loadUpCard(res.video.owner.mid)
    loadDanmaku(res.video.pages[0]?.cid || 0)
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
    if (!res.success) throw new Error(res.message || '播放地址获取失败')
    acceptQualities.value = res.acceptQuality || []
    qualityLabel.value = res.qualityLabel || ''
    if (res.quality) currentQn.value = res.quality
    if (res.mode === 'dash' && res.dash && res.dash.video.length) {
      // v3.5.5：DASH 音视频分离流，经 MSE + 回环代理播放（支持高清晰度）
      await startDash(res.dash.video, res.dash.audio || [])
    } else {
      stopDash()
      if (!res.durl || !res.durl.length) throw new Error('未获取到播放地址（版权受限或清晰度不足）')
      segments = res.durl
      videoSrc.value = segments[0].url
    }
    playerLoading.value = false
  } catch (err) {
    playerLoading.value = false
    playerError.value = (err as Error).message || String(err)
  }
}

// ── v3.5.5：MSE DASH 播放引擎（音视频分离 fMP4；流控避免长视频吃内存） ──
let mediaSource: MediaSource | null = null
let mediaSourceUrl = ''
let dashCtrl: AbortController | null = null
let dashFinished = 0
let dashTrackTotal = 0
const DASH_BUFFER_AHEAD = 90   // 缓冲超前秒数上限：达到即暂停拉流
const DASH_BUFFER_RESUME = 45  // 消耗至该秒数后恢复拉流

/** 选择目标清晰度轨道：精确匹配优先，否则就近向下，再不行取最低档 */
function pickDashTrack(tracks: BiliDashTrack[], qn: number): BiliDashTrack | null {
  if (!tracks.length) return null
  const exact = tracks.filter(t => t.qn === qn)
  if (exact.length) return exact.sort((a, b) => b.bandwidth - a.bandwidth)[0]
  const lower = tracks.filter(t => t.qn < qn)
  const pool = lower.length ? lower : tracks
  return [...pool].sort((a, b) => b.qn - a.qn)[0]
}

/**
 * v3.5.6：组装标准 MSE MIME。
 * B 站返回的 mime_type 形如 `video/mp4; codecs=avc1.640033`（codecs 未加引号），
 * 直接传给 isTypeSupported / addSourceBuffer 会按 RFC 6381 解析失败，
 * 因此只取容器类型，再用独立 codecs 字段重新拼装。
 */
function mseMime(t: BiliDashTrack): string {
  const container = (t.mimeType || '').split(';')[0].trim() || 'video/mp4'
  return t.codecs ? `${container}; codecs="${t.codecs}"` : container
}

/** 视频已缓冲的前瞻秒数（供流控判断） */
function bufferedAhead(): number {
  const el = videoEl.value
  if (!el) return 0
  try {
    const buf = el.buffered
    for (let i = buf.length - 1; i >= 0; i--) {
      if (el.currentTime >= buf.start(i) - 1 && el.currentTime <= buf.end(i)) {
        return buf.end(i) - el.currentTime
      }
    }
  } catch { /* ignore */ }
  return 0
}

function stopDash(): void {
  if (dashCtrl) { dashCtrl.abort(); dashCtrl = null }
  if (mediaSourceUrl) {
    try { URL.revokeObjectURL(mediaSourceUrl) } catch { /* ignore */ }
    mediaSourceUrl = ''
  }
  mediaSource = null
  dashFinished = 0
  dashTrackTotal = 0
}

async function startDash(videoTracks: BiliDashTrack[], audioTracks: BiliDashTrack[]): Promise<void> {
  if (!api || !videoEl.value) throw new Error('播放器未就绪')
  // v3.5.6：仅在 MSE 可解码的轨道中选轨，避免选中不支持的编码
  const supportedVideo = videoTracks.filter(t => t.baseUrl && MediaSource.isTypeSupported(mseMime(t)))
  const vTrack = pickDashTrack(supportedVideo.length ? supportedVideo : videoTracks, currentQn.value)
  if (!vTrack || !vTrack.baseUrl) throw new Error('无可用视频轨道')
  const vMime = mseMime(vTrack)
  if (!MediaSource.isTypeSupported(vMime)) {
    throw new Error(`不支持的视频编码（${vTrack.codecs || vTrack.mimeType}），请尝试降低清晰度`)
  }
  const aTrack = audioTracks.length
    ? [...audioTracks].sort((a, b) => b.bandwidth - a.bandwidth)[0]
    : null
  const aMime = aTrack ? mseMime(aTrack) : ''
  const audioUsable = !!(aTrack && aTrack.baseUrl && MediaSource.isTypeSupported(aMime))
  // 经主进程回环代理拉流：规避 CORS 并携带防盗链头
  const [vTok, aTok] = await Promise.all([
    api.biliStreamToken(vTrack.baseUrl),
    audioUsable && aTrack ? api.biliStreamToken(aTrack.baseUrl) : Promise.resolve(null)
  ])
  if (!vTok.success || !vTok.token || !vTok.baseUrl) throw new Error(vTok.message || '流代理获取失败')
  stopDash()
  dashCtrl = new AbortController()
  const ctrl = dashCtrl
  const ms = new MediaSource()
  mediaSource = ms
  mediaSourceUrl = URL.createObjectURL(ms)
  videoSrc.value = '' // DASH 模式不走 :src 直连绑定，避免 error 处理器误判
  videoEl.value.src = mediaSourceUrl
  ms.addEventListener('sourceopen', () => {
    try {
      const vSb = ms.addSourceBuffer(vMime)
      dashTrackTotal = 1
      pumpTrack(`${vTok.baseUrl}?token=${vTok.token}`, vSb, ctrl)
      if (audioUsable && aTrack && aTok && aTok.success && aTok.token && aTok.baseUrl) {
        const aSb = ms.addSourceBuffer(aMime)
        dashTrackTotal = 2
        pumpTrack(`${aTok.baseUrl}?token=${aTok.token}`, aSb, ctrl)
      }
    } catch (err) {
      playerError.value = `播放初始化失败：${(err as Error).message || err}`
    }
  }, { once: true })
}

/** 单轨道拉流泵：流式读取 → 按缓冲水位节流追加到 SourceBuffer */
async function pumpTrack(url: string, sb: SourceBuffer, ctrl: AbortController): Promise<void> {
  try {
    const resp = await fetch(url, { signal: ctrl.signal })
    if (!resp.ok || !resp.body) throw new Error(`流拉取失败（HTTP ${resp.status}）`)
    const reader = resp.body.getReader()
    for (;;) {
      if (ctrl.signal.aborted) return
      while (!ctrl.signal.aborted && bufferedAhead() > DASH_BUFFER_AHEAD) {
        await waitEvent(videoEl.value!, 'timeupdate', ctrl, 1000)
      }
      if (ctrl.signal.aborted) return
      const { done, value } = await reader.read()
      if (done) break
      if (sb.updating) await waitEvent(sb, 'updateend', ctrl)
      if (ctrl.signal.aborted) return
      sb.appendBuffer(value)
      await waitEvent(sb, 'updateend', ctrl)
    }
    dashFinished++
    if (dashFinished >= dashTrackTotal && mediaSource && mediaSource.readyState === 'open') {
      try { mediaSource.endOfStream() } catch { /* ignore */ }
    }
  } catch (err) {
    if (ctrl.signal.aborted) return
    playerError.value = `视频流加载失败：${(err as Error).message || err}，可尝试切换清晰度或重试`
  }
}

/** 等待事件或轮询超时（abort 时立即返回），用于流控节流 */
function waitEvent(target: EventTarget, ev: string, ctrl: AbortController, pollMs = 0): Promise<void> {
  return new Promise(resolve => {
    let timer: ReturnType<typeof setInterval> | null = null
    const cleanup = () => {
      target.removeEventListener(ev, onEvent)
      ctrl.signal.removeEventListener('abort', onAbort)
      if (timer) clearInterval(timer)
      resolve()
    }
    const onEvent = () => cleanup()
    const onAbort = () => cleanup()
    target.addEventListener(ev, onEvent, { once: true })
    ctrl.signal.addEventListener('abort', onAbort, { once: true })
    if (pollMs > 0) timer = setInterval(cleanup, pollMs)
  })
}

function retryPlay(): void {
  loadStream()
}

function switchPage(idx: number): void {
  if (!currentView.value || idx === currentPageIdx.value) return
  currentPageIdx.value = idx
  // v3.5.5：分 P 的弹幕独立，切换后重载
  loadDanmaku(currentView.value.pages[idx]?.cid || 0)
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
  stopDash()
  try { videoEl.value?.pause() } catch { /* ignore */ }
  videoSrc.value = ''
  segments = []
  segIdx = 0
  playerLoading.value = false
  playerError.value = ''
  relLiked.value = false
  relCoin.value = 0
  relFaved.value = false
  // v3.5.5：清理弹幕与 UP 主卡片状态
  clearDanmakuLayer()
  danmakuAll = []
  danmakuPtr = 0
  danmakuLastTime = 0
  upCard.value = null
  authorSectionVisible.value = false
  spaceList.value = []
}

// ── v3.5.4：视频交互（点赞 / 投币 / 收藏） ──
const relLiked = ref(false)
const relCoin = ref(0)
const relFaved = ref(false)
const relBusy = ref(false)

/** 登录后查询当前用户对该视频的交互状态（失败静默，不影响播放） */
async function loadRelation(aid: number): Promise<void> {
  relLiked.value = false
  relCoin.value = 0
  relFaved.value = false
  if (!api || !aid) return
  try {
    const r = await api.biliRelation(aid)
    if (r.success) {
      relLiked.value = !!r.like
      relCoin.value = r.coin || 0
      relFaved.value = !!r.favorite
    }
  } catch { /* 未登录或接口异常时按钮保持默认态 */ }
}

function requireBiliLogin(): boolean {
  if (user.value) return true
  ElMessage.info('请先登录 B 站')
  openLogin()
  return false
}

async function toggleLike(): Promise<void> {
  if (!api || !currentView.value || relBusy.value) return
  if (!requireBiliLogin()) return
  relBusy.value = true
  try {
    const next = !relLiked.value
    const res = await api.biliLike(currentView.value.aid, next ? 1 : 2)
    if (!res.success) throw new Error(res.message || '操作失败')
    relLiked.value = next
    ElMessage.success(next ? '已点赞' : '已取消点赞')
  } catch (err) {
    ElMessage.error((err as Error).message || String(err))
  } finally {
    relBusy.value = false
  }
}

async function giveCoin(multiply: number | string): Promise<void> {
  if (!api || !currentView.value || relBusy.value) return
  if (!requireBiliLogin()) return
  const n = Number(multiply) || 1
  if (relCoin.value >= 2) {
    ElMessage.info('该视频已投满 2 个币')
    return
  }
  relBusy.value = true
  try {
    const res = await api.biliCoin(currentView.value.aid, n)
    if (!res.success) throw new Error(res.message || '投币失败')
    relCoin.value = Math.min(relCoin.value + n, 2)
    ElMessage.success(`成功投出 ${n} 个币`)
  } catch (err) {
    ElMessage.error((err as Error).message || String(err))
  } finally {
    relBusy.value = false
  }
}

async function toggleFav(): Promise<void> {
  if (!api || !currentView.value || relBusy.value) return
  if (!requireBiliLogin()) return
  relBusy.value = true
  try {
    // 目标收藏夹：默认收藏夹（用户收藏夹列表的首项）
    if (!favFolders.value.length) await loadFavFolders()
    const target = favFolders.value[0]
    if (!target) throw new Error('未找到可用的收藏夹')
    const next = !relFaved.value
    const res = await api.biliFavToggle(currentView.value.aid, target.id, next)
    if (!res.success) throw new Error(res.message || '操作失败')
    relFaved.value = next
    ElMessage.success(next ? `已收藏到「${target.title}」` : '已取消收藏')
  } catch (err) {
    ElMessage.error((err as Error).message || String(err))
  } finally {
    relBusy.value = false
  }
}

// ── v3.5.5：弹幕（跟随视频时间轴渲染，支持开关与偏好持久化） ──
const danmakuLayerEl = ref<HTMLDivElement | null>(null)
const danmakuEnabled = ref(getGlobalStorage<boolean>('kaoyan_bili_danmaku', true))
let danmakuAll: BiliDanmaku[] = []
let danmakuPtr = 0
let danmakuLastTime = 0
let dmTrackRot = 0
const DM_MAX_VISIBLE = 80 // 同屏弹幕上限：超出丢弃，保证渲染流畅

function toggleDanmaku(): void {
  danmakuEnabled.value = !danmakuEnabled.value
  setGlobalStorage('kaoyan_bili_danmaku', danmakuEnabled.value)
  if (!danmakuEnabled.value) clearDanmakuLayer()
}

async function loadDanmaku(cid: number): Promise<void> {
  danmakuAll = []
  danmakuPtr = 0
  danmakuLastTime = 0
  clearDanmakuLayer()
  if (!api || !cid) return
  try {
    const res = await api.biliDanmaku(cid)
    if (res.success) danmakuAll = res.list || []
  } catch { /* 弹幕加载失败不影响播放 */ }
}

function clearDanmakuLayer(): void {
  const layer = danmakuLayerEl.value
  if (layer) layer.innerHTML = ''
}

/** 由 video timeupdate 驱动：补发 (lastTime, currentTime] 区间内的弹幕 */
function onDanmakuTick(): void {
  const el = videoEl.value
  if (!el || !danmakuEnabled.value || !danmakuAll.length) return
  const t = el.currentTime
  if (t < danmakuLastTime) danmakuLastTime = t
  while (danmakuPtr < danmakuAll.length && danmakuAll[danmakuPtr].time <= t) {
    const dm = danmakuAll[danmakuPtr++]
    if (dm.time > danmakuLastTime) spawnDanmaku(dm)
  }
  danmakuLastTime = t
}

/** 拖动进度条：清空屏幕弹幕并将指针二分定位到新时间点 */
function onVideoSeeking(): void {
  clearDanmakuLayer()
  const el = videoEl.value
  if (!el || !danmakuAll.length) return
  const t = el.currentTime
  let lo = 0
  let hi = danmakuAll.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (danmakuAll[mid].time < t) lo = mid + 1
    else hi = mid
  }
  danmakuPtr = lo
  danmakuLastTime = t
}

function spawnDanmaku(dm: BiliDanmaku): void {
  const layer = danmakuLayerEl.value
  if (!layer || !dm.text) return
  if (layer.childElementCount >= DM_MAX_VISIBLE) return
  const el = document.createElement('div')
  el.className = 'bili-dm'
  el.textContent = dm.text
  el.style.color = dm.color
  if (dm.mode === 4) {
    // 底部固定弹幕
    el.classList.add('bili-dm-stay', 'bili-dm-bottom')
    el.style.bottom = `${(dm.text.length % 3) * 34 + 6}px`
  } else if (dm.mode === 5) {
    // 顶部固定弹幕
    el.classList.add('bili-dm-stay', 'bili-dm-top')
    el.style.top = `${(dm.text.length % 3) * 34 + 6}px`
  } else {
    // 滚动弹幕（mode 1/2/3/6 统一按滚动处理），时长随长度微调
    dmTrackRot = (dmTrackRot + 3) % 10
    el.style.top = `${dmTrackRot * 8 + 2}%`
    el.style.animationDuration = `${Math.min(12, Math.max(6, 6 + dm.text.length * 0.15))}s`
  }
  el.addEventListener('animationend', () => el.remove(), { once: true })
  layer.appendChild(el)
}

// ── v3.5.5：UP 主卡片与投稿 ──
const upCard = ref<BiliUpCard | null>(null)
const authorSectionVisible = ref(false)
const spaceList = ref<BiliVideo[]>([])
const spacePage = ref(1)
const spaceHasMore = ref(false)
const spaceLoading = ref(false)

async function loadUpCard(mid: number): Promise<void> {
  upCard.value = null
  authorSectionVisible.value = false
  spaceList.value = []
  spacePage.value = 1
  spaceHasMore.value = false
  if (!api || !mid) return
  try {
    const res = await api.biliCard(mid)
    if (res.success && res.card) upCard.value = res.card
  } catch { /* UP 主信息获取失败不影响播放 */ }
}

function toggleAuthorVideos(): void {
  authorSectionVisible.value = !authorSectionVisible.value
  if (authorSectionVisible.value && !spaceList.value.length) loadSpaceVideos(true)
}

async function loadSpaceVideos(refresh: boolean): Promise<void> {
  if (!api || !upCard.value || spaceLoading.value) return
  spaceLoading.value = true
  try {
    const page = refresh ? 1 : spacePage.value + 1
    const res = await api.biliSpaceVideos(upCard.value.mid, page)
    if (!res.success) throw new Error(res.message || '获取失败')
    spaceList.value = refresh ? (res.list || []) : [...spaceList.value, ...(res.list || [])]
    spacePage.value = page
    spaceHasMore.value = !!res.hasMore
  } catch (err) {
    ElMessage.error(`投稿视频获取失败: ${(err as Error).message || err}`)
  } finally {
    spaceLoading.value = false
  }
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
  loadRcmd()
})

onBeforeUnmount(() => {
  stopQrPolling()
  stopDash()
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
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}

/* v3.5.6：推荐/热门固定 6 列（每批 24 条 = 6×4），适配面板宽度 */
.bili-grid.cols-6 {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

/* v3.5.6：播放弹窗右侧栏单列卡片（UP 主投稿 / 相关视频） */
.bili-grid.related.side-col {
  grid-template-columns: 1fr;
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

/* ── 播放器弹窗（v3.5.6：左右分栏，右侧栏承载 UP 主卡片/投稿/相关视频） ── */
.bili-player-body {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.bili-player-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bili-player-side {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 72vh;
  overflow-y: auto;
  padding-right: 2px;
}

/* 窄窗口下右侧栏落到视频下方，避免挤压播放区 */
@media (max-width: 1100px) {
  .bili-player-body {
    flex-direction: column;
  }
  .bili-player-side {
    width: 100%;
    max-height: none;
  }
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

/* v3.5.4：相关视频卡片紧凑化，控制播放弹窗整体高度 */
.bili-grid.related .bili-card-title {
  font-size: 12px;
}

.bili-grid.related .bili-card-meta {
  font-size: 11px;
}

/* ── v3.5.4：点赞 / 投币 / 收藏交互栏 ── */
.bili-player-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 2px;
}

.bili-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  color: var(--mo-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

html.dark .bili-action-btn {
  background: rgba(255, 255, 255, 0.08);
}

.bili-action-btn:hover:not(:disabled) {
  color: var(--mo-accent);
  border-color: rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.1);
}

.bili-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.bili-action-btn em {
  font-style: normal;
  font-size: 12px;
  color: var(--mo-text-3);
}

.bili-action-btn.liked {
  color: var(--mo-accent);
  border-color: rgba(59, 130, 246, 0.45);
  background: rgba(59, 130, 246, 0.14);
}

.bili-action-btn.coined {
  color: var(--mo-warning);
  border-color: rgba(245, 158, 11, 0.45);
  background: rgba(245, 158, 11, 0.12);
}

.bili-action-btn.faved {
  color: var(--mo-danger);
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.1);
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

/* ── v3.5.5：弹幕层 ── */
.bili-danmaku-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 5;
}

/* 弹幕条目为 JS 动态创建，需 :deep 穿透 scoped 作用域 */
:deep(.bili-dm) {
  position: absolute;
  left: 100%;
  white-space: nowrap;
  font-size: 18px;
  line-height: 28px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  will-change: transform;
  animation: bili-dm-scroll linear forwards;
}

@keyframes bili-dm-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-100% - 100vw)); }
}

/* 顶部 / 底部固定弹幕：原位停留数秒后淡出 */
:deep(.bili-dm-stay) {
  left: 50%;
  transform: translateX(-50%);
  animation: bili-dm-stay 4s ease forwards;
}

:deep(.bili-dm-top) { top: 6px; }
:deep(.bili-dm-bottom) { bottom: 6px; }

@keyframes bili-dm-stay {
  0% { opacity: 0; }
  8% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

/* 弹幕开关按钮（播放信息栏右侧） */
.bili-dm-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--mo-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.bili-dm-toggle:hover {
  border-color: var(--mo-accent);
  color: var(--mo-accent);
}

.bili-dm-toggle.on {
  color: var(--mo-accent);
  border-color: var(--mo-accent);
  background: rgba(59, 130, 246, 0.12);
}

/* ── v3.5.5：UP 主卡片与投稿 ── */
.bili-up-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--mo-radius-sm);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(10px);
}

.bili-up-face {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--glass-border);
}

.bili-up-face-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-2);
  font-size: 26px;
  background: rgba(0, 0, 0, 0.05);
}

.bili-up-info {
  flex: 1;
  min-width: 0;
}

.bili-up-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--mo-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-up-sign {
  margin-top: 3px;
  font-size: 12px;
  color: var(--mo-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-up-stats {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: var(--mo-text-2);
  flex-shrink: 0;
}

.bili-space {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* v3.5.6：右侧栏窄列适配 —— 粉丝/投稿统计与按钮换行，避免挤压 */
.bili-player-side .bili-up-card {
  flex-wrap: wrap;
  gap: 10px;
}

.bili-player-side .bili-up-stats {
  flex-direction: row;
  gap: 10px;
}

.bili-load-more {
  display: flex;
  justify-content: center;
}
</style>
