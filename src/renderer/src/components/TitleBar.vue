<template>
  <header class="titlebar" :class="{ transparent: transparent }">
    <div class="titlebar-left">
      <el-icon :size="16" class="titlebar-logo"><Reading /></el-icon>
      <span class="titlebar-title">11408考研助手</span>
      <span v-if="!transparent" class="titlebar-page">{{ pageTitle }}</span>

      <!-- v3.1.0：音乐组件移到左侧 -->
      <div class="music-widget" v-if="!transparent">
        <button class="mini-btn" title="选择音乐文件夹" @click="handlePickFolder">
          <el-icon :size="13"><Folder /></el-icon>
        </button>

        <template v-if="music.hasMusic">
          <span class="music-name" :title="music.currentTrack?.name">{{ music.currentTrack?.name }}</span>
          <!-- v3.0.0：顶栏一行歌词显示 -->
          <span
            v-if="music.showLyrics && currentLyricText"
            class="titlebar-lyric"
            :title="currentLyricText"
            @click="goToMusic"
          >{{ currentLyricText }}</span>
          <button class="mini-btn" :title="music.isPlaying ? '暂停' : '播放'" @click="music.toggle()">
            <svg v-if="!music.isPlaying" width="10" height="10" viewBox="0 0 10 10"><path d="M2 1 L9 5 L2 9 Z" fill="currentColor"/></svg>
            <svg v-else width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1" width="2.5" height="8" rx="0.5" fill="currentColor"/><rect x="6" y="1" width="2.5" height="8" rx="0.5" fill="currentColor"/></svg>
          </button>
          <button class="mini-btn" title="下一首" @click="music.next()">
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1 L6 5 L1 9 Z" fill="currentColor"/><rect x="7" y="1" width="2" height="8" rx="0.5" fill="currentColor"/></svg>
          </button>
          <input
            class="mini-volume"
            type="range" min="0" max="100"
            :value="Math.round(music.volume * 100)"
            @input="onVolumeInput"
            title="音量"
          />
          <!-- 播放列表面板 -->
          <el-popover
            placement="bottom-start"
            :width="300"
            trigger="click"
            popper-class="titlebar-popover"
          >
            <template #reference>
              <button class="mini-btn" :class="{ on: music.isPlaying }" title="播放列表">
                <el-icon :size="13"><List /></el-icon>
              </button>
            </template>
            <div class="music-panel">
              <div class="mp-head">
                <span class="mp-title">播放列表</span>
                <span class="mp-count">{{ music.playlist.length }} 首</span>
              </div>
              <div class="mp-controls">
                <button class="mp-ctrl-btn" title="上一首" @click="music.prev()">
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M9 1 L4 5 L9 9 Z" fill="currentColor"/><rect x="1" y="1" width="2" height="8" rx="0.5" fill="currentColor"/></svg>
                </button>
                <button class="mp-ctrl-btn" :title="music.isPlaying ? '暂停' : '播放'" @click="music.toggle()">
                  <svg v-if="!music.isPlaying" width="10" height="10" viewBox="0 0 10 10"><path d="M2 1 L9 5 L2 9 Z" fill="currentColor"/></svg>
                  <svg v-else width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1" width="2.5" height="8" rx="0.5" fill="currentColor"/><rect x="6" y="1" width="2.5" height="8" rx="0.5" fill="currentColor"/></svg>
                </button>
                <button class="mp-ctrl-btn" title="下一首" @click="music.next()">
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1 L6 5 L1 9 Z" fill="currentColor"/><rect x="7" y="1" width="2" height="8" rx="0.5" fill="currentColor"/></svg>
                </button>
                <button
                  class="mp-ctrl-btn"
                  :class="{ 'mp-ctrl-on': music.shuffle }"
                  :title="music.shuffle ? '关闭随机播放' : '开启随机播放'"
                  @click="music.toggleShuffle()"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12"><path d="M1 3 H3.5 L8.5 9 H10.2 M1 9 H3.5 L8.5 3 H10.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M9.2 1.8 L11.4 3 L9.2 4.2 Z" fill="currentColor"/><path d="M9.2 7.8 L11.4 9 L9.2 10.2 Z" fill="currentColor"/></svg>
                </button>
              </div>
              <!-- 播放进度条 -->
              <div class="mp-progress" v-if="music.duration > 0">
                <span class="mp-time">{{ formatTime(music.currentTime) }}</span>
                <input
                  class="mp-progress-bar"
                  type="range"
                  min="0"
                  :max="music.duration"
                  step="0.1"
                  :value="music.currentTime"
                  @input="onProgressInput"
                />
                <span class="mp-time">{{ formatTime(music.duration) }}</span>
              </div>
              <!-- 歌词显示开关 -->
              <div class="mp-lyrics-toggle">
                <button
                  class="mp-lyric-btn"
                  :class="{ active: music.showLyrics }"
                  :title="music.showLyrics ? '隐藏歌词' : '显示歌词'"
                  @click="music.toggleLyrics()"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 3 H10 M2 6 H8 M2 9 H6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                  歌词
                </button>
              </div>
              <!-- 歌词显示 -->
              <div class="mp-lyrics" v-if="music.showLyrics && music.lyricLines.length > 0">
                <div class="mp-lyric-line" :class="{ active: i === music.currentLyricIndex }"
                  v-for="(line, i) in visibleLyrics" :key="i">
                  {{ line.text }}
                </div>
                <div v-if="visibleLyrics.length === 0" class="mp-lyric-empty">暂无歌词</div>
              </div>
              <div class="mp-lyrics mp-lyric-empty" v-else-if="music.showLyrics">暂无歌词（需同目录 .lrc 文件或在线歌曲）</div>
              <div class="mp-list">
                <div
                  v-for="(track, i) in music.playlist"
                  :key="i"
                  class="mp-item"
                  :class="{ active: i === music.currentIndex }"
                  @click="music.playIndex(i)"
                >
                  <span class="mp-item-index">{{ i + 1 }}</span>
                  <span class="mp-item-name" :title="track.name">{{ track.name }}</span>
                  <span class="mp-item-playing" v-if="i === music.currentIndex && music.isPlaying">♪</span>
                  <button class="mp-item-del" title="移除" @click.stop="music.removeTrack(i)">×</button>
                </div>
              </div>
              <div class="mp-actions">
                <button class="mp-action-btn" @click="handlePickFolder">选择文件夹</button>
                <button class="mp-action-btn" @click="handlePickFiles">选择文件</button>
                <button class="mp-action-btn danger" @click="music.clearPlaylist()">清空</button>
              </div>
            </div>
          </el-popover>
        </template>
        <button v-else class="mini-btn music-open" title="选择音乐文件" @click="handlePickFiles">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M9 1 L9 8.2 A2.3 2.3 0 1 1 8 6.3 L8 3 L4 4 L4 9.2 A2.3 2.3 0 1 1 3 7.3 L3 2.5 Z" fill="currentColor"/></svg>
        </button>
      </div>
    </div>

    <!-- v3.1.0：中间区域 - 天气、倒计时、日期居中 -->
    <div class="titlebar-center" v-if="!transparent">
      <!-- 天气组件 -->
      <el-popover
        placement="bottom"
        :width="300"
        trigger="click"
        popper-class="titlebar-popover"
      >
        <template #reference>
          <div class="titlebar-weather" :title="weatherTip">
            <template v-if="weather">
              <span class="weather-icon">{{ weather.icon }}</span>
              <span class="weather-temp">{{ weather.tempC }}°C</span>
              <span class="weather-cond">{{ weather.condition }}</span>
            </template>
            <template v-else>
              <span class="weather-icon">📍</span>
              <span class="weather-cond">{{ weatherLoading ? '天气加载中…' : '选择天气地点' }}</span>
            </template>
          </div>
        </template>
        <!-- 天气详情面板 -->
        <div class="weather-panel">
          <div class="wp-head">
            <span class="wp-city">{{ weatherCity.name }}</span>
            <span class="wp-time" v-if="weather?.obsTime">{{ weather.obsTime }} 观测</span>
          </div>
          <div class="wp-main">
            <span class="wp-icon">{{ weather?.icon || '🌤️' }}</span>
            <div class="wp-main-right">
              <div class="wp-temp">{{ weather?.tempC ?? '--' }}°C <span class="wp-cond">{{ weather?.condition || '暂无数据' }}</span></div>
              <div class="wp-sub">
                今日 {{ weather?.tempMin ?? '--' }}°C ~ {{ weather?.tempMax ?? '--' }}°C
              </div>
            </div>
          </div>
          <div class="wp-grid">
            <div class="wp-cell"><span class="wp-cell-label">湿度</span><span class="wp-cell-value">{{ weather?.humidity ?? '--' }}%</span></div>
            <div class="wp-cell"><span class="wp-cell-label">风速</span><span class="wp-cell-value">{{ weather?.wind ?? '--' }}km/h</span></div>
            <div class="wp-cell"><span class="wp-cell-label">今日气温</span><span class="wp-cell-value">{{ weather?.tempMin ?? '--' }}~{{ weather?.tempMax ?? '--' }}°C</span></div>
          </div>
          <div class="wp-loc">
            <div class="wp-loc-title">选择城市（中国天气网）</div>
            <div class="wp-city-chips">
              <button
                v-for="c in CITY_PRESETS"
                :key="c.id"
                class="wp-chip"
                :class="{ active: weatherCity.id === c.id }"
                @click="selectCity(c)"
              >{{ c.name }}</button>
            </div>
            <div class="wp-custom">
              <input
                v-model="customCity"
                class="wp-input"
                placeholder="搜索城市，如：洛阳"
                @keyup.enter="applyCustomCity"
              />
              <button class="wp-search-btn" @click="applyCustomCity">搜索</button>
            </div>
            <div class="wp-results" v-if="searchResults.length > 0">
              <div
                v-for="r in searchResults"
                :key="r.id"
                class="wp-result-item"
                @click="selectSearchResult(r)"
              >
                <span class="wp-result-name">{{ r.name }}</span>
                <span class="wp-result-prov">{{ r.province }}</span>
              </div>
            </div>
          </div>
          <div class="wp-actions">
            <button class="wp-refresh-btn" :disabled="weatherLoading" @click="refreshWeather">
              {{ weatherLoading ? '刷新中…' : '刷新天气' }}
            </button>
          </div>
        </div>
      </el-popover>

      <span class="titlebar-countdown">距考研 {{ store.daysUntilExam }} 天</span>
      <span class="titlebar-date">{{ todayStr }}</span>
    </div>

    <div class="titlebar-right">
      <!-- v2.9.0：学习资料入口 -->
      <button class="mini-btn materials-btn" v-if="!transparent" title="学习资料（PDF/视频）" @click="goMaterials">
        <el-icon :size="14"><Folder /></el-icon>
      </button>

      <!-- v2.9.0：默认浏览器入口 -->
      <button class="mini-btn browser-btn" v-if="!transparent" title="打开浏览器查资料" @click="openBrowser">
        <el-icon :size="14"><Search /></el-icon>
      </button>

      <!-- v3.1.8：网易云心动模式（随机播放全部歌曲） -->
      <button
        class="mini-btn heartbeat-btn"
        v-if="!transparent"
        :class="{ on: music.heartbeatMode }"
        :title="music.heartbeatMode ? '心动模式播放中（随机播放全部歌曲）' : '心动模式（随机播放全部歌曲）'"
        @click="handleHeartbeat"
      >
        <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 12.5 C7 12.5 1.5 9 1.5 5 A3 3 0 0 1 7 3.5 A3 3 0 0 1 12.5 5 C12.5 9 7 12.5 7 12.5 Z" :fill="music.heartbeatMode ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>
      </button>

      <!-- 护眼模式 -->
      <button class="mini-btn eyecare-btn" :class="{ on: eyeCareOn }" :title="eyeCareOn ? '关闭护眼模式' : '开启护眼模式'" @click="toggleEye">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 2 C9 2 11 6 11 6 C11 6 9 10 6 10 C3 10 1 6 1 6 C1 6 3 2 6 2 Z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="6" r="1.8" fill="currentColor"/></svg>
      </button>

      <!-- v3.1.2：液态玻璃开关 -->
      <button class="mini-btn liquidglass-btn" :class="{ on: liquidGlassOn }" :title="liquidGlassOn ? '关闭液态玻璃效果' : '开启液态玻璃效果'" @click="handleToggleLiquidGlass">
        <svg width="13" height="13" viewBox="0 0 13 13"><defs><linearGradient id="lg-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="50%" stop-color="currentColor" stop-opacity="0.4"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.7"/></linearGradient></defs><rect x="1.5" y="1.5" width="10" height="10" rx="3" fill="url(#lg-grad)" stroke="currentColor" stroke-width="0.8"/><path d="M3 4 Q6.5 2.5 10 4" fill="none" stroke="currentColor" stroke-width="0.8" stroke-opacity="0.6" stroke-linecap="round"/></svg>
      </button>

      <!-- 主题切换 -->
      <button class="mini-btn theme-btn" :title="dark ? '切换到浅色模式' : '切换到深色模式'" @click="handleToggleTheme">
        <el-icon :size="14"><component :is="dark ? Sunny : Moon" /></el-icon>
      </button>

      <!-- v3.1.5：网易云用户信息 popover -->
      <el-popover
        v-if="!transparent && music.neteaseLoggedIn && music.neteaseUser"
        placement="bottom"
        :width="320"
        trigger="click"
        popper-class="titlebar-popover"
      >
        <template #reference>
          <div class="user-mini" :title="music.neteaseUser.nickname">
            <img v-if="music.neteaseUser.avatar" :src="music.neteaseUser.avatar" class="user-mini-avatar" />
            <el-icon v-else :size="14" class="user-mini-icon"><UserFilled /></el-icon>
            <span class="user-mini-name">{{ music.neteaseUser.nickname }}</span>
          </div>
        </template>
        <div class="ncm-user-panel">
          <!-- 用户头像与基本信息 -->
          <div class="ncm-user-header">
            <img v-if="music.neteaseUser.avatar" :src="music.neteaseUser.avatar" class="ncm-user-avatar" />
            <div class="ncm-user-info">
              <div class="ncm-user-name">
                {{ music.neteaseUser.nickname }}
                <el-tag v-if="(music.neteaseUser.vipType || 0) > 0" size="small" type="warning" class="ncm-vip-tag">
                  {{ music.neteaseUser.vipType === 11 ? 'SVIP' : music.neteaseUser.vipType === 5 ? '黑胶VIP' : 'VIP' }}
                </el-tag>
              </div>
              <div class="ncm-user-level" v-if="music.neteaseUserDetail?.level || music.neteaseUser.level">
                Lv.{{ music.neteaseUserDetail?.level || music.neteaseUser.level }}
              </div>
              <div class="ncm-user-sig" v-if="music.neteaseUser.signature || music.neteaseUserDetail?.signature">
                {{ music.neteaseUser.signature || music.neteaseUserDetail?.signature }}
              </div>
            </div>
          </div>

          <!-- v3.3.0：账号信息区 -->
          <div class="ncm-account-info">
            <div class="ncm-account-title">
              <el-icon><User /></el-icon> 账号信息
            </div>
            <div class="ncm-account-row">
              <span class="ncm-account-label">用户 ID</span>
              <span class="ncm-account-value">{{ music.neteaseUser.id }}</span>
            </div>
            <div class="ncm-account-row" v-if="music.neteaseUser.userName">
              <span class="ncm-account-label">账号绑定</span>
              <span class="ncm-account-value">{{ maskAccountName(music.neteaseUser.userName) }}</span>
            </div>
            <div class="ncm-account-row" v-if="music.neteaseUser.expertTags && music.neteaseUser.expertTags.length > 0">
              <span class="ncm-account-label">达人标签</span>
              <span class="ncm-account-value ncm-expert-tags">
                <el-tag v-for="tag in music.neteaseUser.expertTags" :key="tag" size="small" type="success" class="ncm-tag">{{ tag }}</el-tag>
              </span>
            </div>
            <div class="ncm-account-row" v-if="music.neteaseUser.djStatus">
              <span class="ncm-account-label">电台主播</span>
              <span class="ncm-account-value"><el-tag size="small" type="primary">认证主播</el-tag></span>
            </div>
            <div class="ncm-account-row" v-if="music.neteaseUser.createTime">
              <span class="ncm-account-label">注册时间</span>
              <span class="ncm-account-value">{{ formatDate(music.neteaseUser.createTime) }}</span>
            </div>
          </div>

          <!-- 用户统计数据 -->
          <div class="ncm-user-stats" v-if="music.neteaseUserDetail">
            <div class="ncm-stat"><span class="ncm-stat-val">{{ music.neteaseUserDetail.followeds }}</span><span class="ncm-stat-label">粉丝</span></div>
            <div class="ncm-stat"><span class="ncm-stat-val">{{ music.neteaseUserDetail.follows }}</span><span class="ncm-stat-label">关注</span></div>
            <div class="ncm-stat"><span class="ncm-stat-val">{{ music.neteaseUserDetail.playlistCount }}</span><span class="ncm-stat-label">歌单</span></div>
            <div class="ncm-stat"><span class="ncm-stat-val">{{ music.neteaseUserDetail.listenSongs }}</span><span class="ncm-stat-label">听歌</span></div>
          </div>

          <!-- 操作按钮 -->
          <div class="ncm-user-actions">
            <button class="ncm-action-btn" @click="goToMusic">音乐播放</button>
            <button class="ncm-action-btn" @click="refreshUserAccount">刷新信息</button>
            <button class="ncm-action-btn danger" @click="handleNeteaseLogout">退出登录</button>
          </div>
        </div>
      </el-popover>

      <!-- 用户栏（本地用户） -->
      <div v-if="!transparent && userStore.isLoggedIn && !(music.neteaseLoggedIn && music.neteaseUser)" class="user-mini" :title="userStore.displayName" @click="goToSettings">
        <el-icon :size="14" class="user-mini-icon"><UserFilled /></el-icon>
        <span class="user-mini-name">{{ userStore.displayName }}</span>
      </div>

      <!-- 自建窗口控制按钮 -->
      <div class="win-controls">
        <button class="win-btn" title="最小化" @click="minimize">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="4.5" width="8" height="1" rx="0.5" fill="currentColor"/></svg>
        </button>
        <button class="win-btn" :title="isMaximized ? '向下还原' : '最大化'" @click="toggleMaximize">
          <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>
          <svg v-else width="10" height="10" viewBox="0 0 10 10"><rect x="2.5" y="0.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M2.5 2.5 H1 A0.5 0.5 0 0 0 0.5 3 V9 A0.5 0.5 0 0 0 1 9.5 H7 A0.5 0.5 0 0 0 7.5 9 V7.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>
        </button>
        <button class="win-btn win-btn-close" title="关闭" @click="close">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMainStore } from '@/stores'
import { useUserStore } from '@/stores/user'
import { useMusicStore } from '@/stores/music'
import { isDark, toggleTheme, eyeCare, toggleEyeCare, liquidGlass, toggleLiquidGlass } from '@/utils/theme'
import {
  weather,
  weatherLoading,
  weatherCity,
  initWeather,
  fetchWeather,
  setCity,
  searchCities,
  CITY_PRESETS,
  type WeatherCity
} from '@/utils/weather'
import { ElMessage } from 'element-plus'
import { Reading, Sunny, Moon, UserFilled, Folder, List, Search, Headset, User } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

interface Props {
  transparent?: boolean
}
defineProps<Props>()

const route = useRoute()
const router = useRouter()
const store = useMainStore()
const userStore = useUserStore()
const music = useMusicStore()

const isMaximized = ref(false)
const dark = isDark
const eyeCareOn = eyeCare
const liquidGlassOn = liquidGlass

const pageTitleMap: Record<string, string> = {
  '/dashboard': '首页仪表盘',
  '/countdown': '考研倒计时',
  '/statistics': '数据统计',
  '/outline': '知识大纲',
  '/algorithms': '算法模板库',
  '/formulas': '公式速查',
  '/examscores': '真题成绩',
  '/pomodoro': '番茄钟',
  '/plan': '每日计划',
  '/flashcards': '背诵卡片',
  '/dictionary': '单词词典',
  '/music': '音乐播放',
  '/materials': '学习资料',
  '/settings': '设置'
}

const pageTitle = computed(() => pageTitleMap[route.path] ?? '')
const todayStr = computed(() => dayjs().format('YYYY年MM月DD日 ddd'))

// v2.9.0：歌词显示窗口（当前行上下各2行）
const visibleLyrics = computed(() => {
  const lines = music.lyricLines
  if (!lines || lines.length === 0) return []
  const idx = music.currentLyricIndex
  if (idx < 0) return lines.slice(0, 5)
  const start = Math.max(0, idx - 2)
  const end = Math.min(lines.length, idx + 3)
  return lines.slice(start, end)
})

// v3.0.0：顶栏一行当前歌词
const currentLyricText = computed(() => {
  const lines = music.lyricLines
  if (!lines || lines.length === 0) return ''
  const idx = music.currentLyricIndex
  if (idx < 0 || idx >= lines.length) return ''
  return lines[idx].text || ''
})

// v3.0.0：点击歌词跳转到音乐页面
function goToMusic() {
  router.push('/music')
}

// v2.9.2：格式化播放时间
function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// v2.9.2：拖动进度条调节播放进度
function onProgressInput(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(val)) {
    music.seek(val)
  }
}

const weatherTip = computed(() =>
  weather.value
    ? `${weather.value.condition} · 湿度 ${weather.value.humidity}% · 风速 ${weather.value.wind}km/h（点击查看详情）`
    : '点击查看天气 / 选择地点'
)

// ── 天气：城市选择 / 搜索 / 刷新（v2.8.0：国内数据源） ──
const customCity = ref('')
const searchResults = ref<{ id: string; name: string; province: string }[]>([])

async function selectCity(city: WeatherCity) {
  searchResults.value = []
  await setCity(city)
  ElMessage.success(`已切换到「${city.name}」的天气`)
}

async function applyCustomCity() {
  const name = customCity.value.trim()
  if (!name) {
    ElMessage.warning('请输入城市名')
    return
  }
  const results = await searchCities(name)
  if (results.length === 0) {
    ElMessage.warning('未找到该城市，请换个名称试试')
    searchResults.value = []
    return
  }
  if (results.length === 1) {
    // 唯一结果直接选中
    await selectSearchResult(results[0])
    return
  }
  searchResults.value = results
}

async function selectSearchResult(r: { id: string; name: string; province: string }) {
  searchResults.value = []
  customCity.value = ''
  await setCity({ id: r.id, name: r.name })
  ElMessage.success(`已切换到「${r.name}」的天气`)
}

async function refreshWeather() {
  await fetchWeather({ force: true })
  ElMessage.success('天气已刷新')
}

// ── 音乐：选择文件夹 / 文件（v2.7.1） ──
async function handlePickFolder() {
  const count = await music.pickFolder()
  if (count > 0) {
    music.play()
    ElMessage.success(`已加载文件夹中的 ${count} 首音乐`)
  } else if (!window.electronAPI?.pickMusicFolder) {
    // 浏览器环境不支持文件夹选择，降级为多选文件
    ElMessage.warning('当前环境不支持选择文件夹，请改用选择文件')
    await handlePickFiles()
  }
}

async function handlePickFiles() {
  const count = await music.pickFiles()
  if (count > 0) {
    music.play()
    ElMessage.success(`已加载 ${count} 首音乐`)
  }
}

function minimize() {
  window.electronAPI?.windowMinimize()
}

function toggleMaximize() {
  window.electronAPI?.windowToggleMaximize()
  isMaximized.value = !isMaximized.value
}

function close() {
  window.electronAPI?.windowCloseToTray()
}

function handleToggleTheme() {
  const root = document.documentElement
  root.classList.add('theme-anim')
  toggleTheme()
  window.setTimeout(() => root.classList.remove('theme-anim'), 350)
}

function toggleEye() {
  toggleEyeCare()
}

// v3.1.2：液态玻璃开关
function handleToggleLiquidGlass() {
  toggleLiquidGlass()
}

function goToSettings() {
  router.push('/settings')
}

// v2.9.0：跳转到学习资料页面
function goMaterials() {
  router.push('/materials')
}

// v2.9.0：跳转到音乐播放页面
function goMusic() {
  router.push('/music')
}

// v3.2.0：网易云智能心动模式（使用官方 intelligence list API）
const heartbeatLoading = ref(false)
async function handleHeartbeat() {
  if (heartbeatLoading.value) return
  heartbeatLoading.value = true
  try {
    // 优先尝试智能心动模式（需要当前歌曲和歌单）
    if (music.currentTrack?.source === 'online' && music.currentTrack.id && music.userPlaylists.length > 0) {
      // 使用第一个歌单作为播放列表
      const playlistId = music.userPlaylists[0].id
      const success = await music.startIntelligenceMode(music.currentTrack.id, playlistId)
      if (success) {
        ElMessage.success('智能心动模式已开启')
        return
      }
    }
    
    // 智能心动模式失败时降级到随机播放模式
    const res = await music.startHeartbeatMode()
    if (res.success) {
      ElMessage.success(res.message)
    } else {
      ElMessage.warning(res.message)
    }
  } finally {
    heartbeatLoading.value = false
  }
}

// v3.1.5：网易云用户详情加载
async function loadNeteaseUserDetail() {
  if (music.neteaseUser?.id) {
    await music.fetchUserDetail(music.neteaseUser.id)
  }
}

// v3.3.0：刷新用户账号信息（含喜欢列表同步）
async function refreshUserAccount() {
  await music.fetchUserAccount()
  if (music.neteaseUser?.id) {
    await music.fetchLikedList(music.neteaseUser.id)
    await music.fetchUserDetail(music.neteaseUser.id)
  }
  ElMessage.success('用户信息已刷新')
}

// v3.3.0：账号名称脱敏（手机/邮箱中间部分隐藏）
function maskAccountName(name: string): string {
  if (!name) return ''
  // 手机号：保留前3后4
  if (/^\d{11}$/.test(name)) {
    return name.slice(0, 3) + '****' + name.slice(7)
  }
  // 邮箱：保留前2字符和@后部分
  if (name.includes('@')) {
    const [local, domain] = name.split('@')
    if (local.length > 2) {
      return local.slice(0, 2) + '***@' + domain
    }
    return name
  }
  // 其他：保留首尾，中间用*替代
  if (name.length > 4) {
    return name.slice(0, 2) + '***' + name.slice(-2)
  }
  return name
}

// v3.3.0：格式化日期（时间戳 → 年月日）
function formatDate(timestamp: number): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// v3.1.5：退出网易云登录
async function handleNeteaseLogout() {
  await music.logoutNetease()
  ElMessage.success('已退出网易云登录')
}

// v2.9.2：打开默认浏览器（默认 Bing 搜索，便于实时查资料）
async function openBrowser() {
  const api = window.electronAPI
  if (api?.openExternalUrl) {
    const res = await api.openExternalUrl('https://www.bing.com')
    if (!res.success) {
      ElMessage.error('打开浏览器失败：' + (res.message || '未知错误'))
    }
  } else {
    window.open('https://www.bing.com', '_blank')
  }
}

function onVolumeInput(e: Event) {
  const target = e.target as HTMLInputElement
  music.setVolume(Number(target.value) / 100)
}

// v3.3.0：监听网易云登录状态变化，自动加载用户详情和账号信息
watch(() => music.neteaseLoggedIn, (logged) => {
  if (logged && music.neteaseUser?.id) {
    loadNeteaseUserDetail()
    music.fetchUserAccount()
    music.fetchLikedList(music.neteaseUser.id)
  }
})

onMounted(() => {
  initWeather()
  // v3.3.0：如果已登录网易云，加载用户详情和账号信息
  if (music.neteaseLoggedIn && music.neteaseUser?.id) {
    loadNeteaseUserDetail()
    music.fetchUserAccount()
    music.fetchLikedList(music.neteaseUser.id)
  }
})
</script>

<style scoped>
.titlebar {
  height: var(--titlebar-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 16px;
  -webkit-app-region: drag;
  -webkit-user-select: none;
  user-select: none;
  background: var(--titlebar-bg);
  border-bottom: 1px solid var(--titlebar-border);
  color: var(--mo-text-2);
  font-size: 13px;
  position: relative;
  z-index: 50;
  contain: layout style;
}

.titlebar.transparent {
  background: transparent;
  border-bottom-color: transparent;
}

.titlebar-left,
.titlebar-center,
.titlebar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

/* v3.1.0：三栏布局 - 左侧音乐，中间天气，右侧工具 */
.titlebar-left {
  flex: 1;
  justify-content: flex-start;
  min-width: 0;
}

.titlebar-center {
  flex: 1;
  justify-content: center;
  gap: 14px;
}

.titlebar-right {
  flex: 1;
  justify-content: flex-end;
}

.titlebar-logo {
  color: var(--mo-primary);
}

.titlebar-title {
  font-weight: 600;
  color: var(--mo-text-1);
}

.titlebar-page::before {
  content: '/';
  margin-right: 10px;
  color: var(--mo-text-3);
}

.titlebar-countdown {
  color: var(--mo-primary);
  font-weight: 600;
}

.titlebar-date {
  color: var(--mo-text-3);
}

/* 天气展示（可点击查看详情，v2.7.1） */
.titlebar-weather {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--mo-surface);
  border: 1px solid var(--glass-border);
  color: var(--mo-text-2);
  font-size: 12px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.titlebar-weather:hover {
  background: var(--mo-surface-hover);
}

.weather-icon {
  font-size: 13px;
}

.weather-temp {
  font-weight: 600;
  color: var(--mo-text-1);
}

.weather-cond {
  color: var(--mo-text-3);
}

/* 天气详情面板（v2.7.1） */
.weather-panel {
  font-size: 13px;
  color: var(--mo-text-1);
}

.wp-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.wp-city {
  font-size: 15px;
  font-weight: 600;
}

.wp-time {
  font-size: 11px;
  color: var(--mo-text-3);
}

.wp-main {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.wp-icon {
  font-size: 36px;
  line-height: 1;
}

.wp-temp {
  font-size: 22px;
  font-weight: 700;
  font-family: 'DIN Alternate', sans-serif;
}

.wp-cond {
  font-size: 13px;
  font-weight: 400;
  color: var(--mo-text-2);
}

.wp-sub {
  font-size: 12px;
  color: var(--mo-text-3);
}

.wp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.wp-cell {
  background: var(--mo-surface);
  border-radius: 8px;
  padding: 8px 6px;
  text-align: center;
}

.wp-cell-label {
  display: block;
  font-size: 11px;
  color: var(--mo-text-3);
  margin-bottom: 3px;
}

.wp-cell-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--mo-text-1);
}

.wp-loc {
  border-top: 1px solid var(--glass-border);
  padding-top: 10px;
}

.wp-loc-title {
  font-size: 12px;
  color: var(--mo-text-3);
  margin-bottom: 8px;
}

.wp-city-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.wp-chip {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--mo-surface);
  color: var(--mo-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.wp-chip:hover {
  background: var(--mo-surface-hover);
  color: var(--mo-primary);
}

.wp-chip.active {
  background: var(--mo-primary);
  border-color: var(--mo-primary);
  color: #fff;
}

.wp-custom {
  display: flex;
  gap: 6px;
}

.wp-input {
  flex: 1;
  min-width: 0;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: var(--mo-surface);
  color: var(--mo-text-1);
  font-size: 12px;
  outline: none;
}

.wp-input:focus {
  border-color: var(--mo-primary);
}

.wp-search-btn,
.wp-refresh-btn {
  padding: 5px 14px;
  border-radius: 8px;
  border: none;
  background: var(--mo-primary);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.wp-search-btn:hover,
.wp-refresh-btn:hover {
  opacity: 0.85;
}

.wp-refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.wp-actions {
  margin-top: 10px;
  text-align: right;
}

/* 城市搜索结果（v2.8.0） */
.wp-results {
  margin-top: 8px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  overflow: hidden;
  max-height: 160px;
  overflow-y: auto;
}

.wp-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 12px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.15s ease;
}

.wp-result-item:hover {
  background: var(--mo-surface-hover);
}

.wp-result-name {
  color: var(--mo-text-1);
  font-weight: 500;
}

.wp-result-prov {
  color: var(--mo-text-3);
  font-size: 11px;
}

/* 迷你按钮（音乐/护眼/主题） */
.mini-btn {
  -webkit-app-region: no-drag;
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-border);
  background: var(--mo-surface);
  color: var(--mo-text-2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  padding: 0;
  flex-shrink: 0;
}

.mini-btn:hover {
  background: var(--mo-surface-hover);
  color: var(--mo-primary);
}

.mini-btn.on {
  background: var(--mo-primary);
  border-color: var(--mo-primary);
  color: #fff;
}

/* 音乐组件容器（v2.7.1） */
.music-widget {
  display: flex;
  align-items: center;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.music-name {
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--mo-text-2);
}

/* v3.0.0：顶栏一行歌词显示 */
.titlebar-lyric {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--mo-text-3);
  font-style: italic;
  cursor: pointer;
  padding: 0 4px;
  border-left: 1px solid var(--mo-border);
  transition: color 0.2s;
}

.titlebar-lyric:hover {
  color: var(--mo-primary);
}

.mini-volume {
  width: 60px;
  accent-color: var(--mo-primary);
  cursor: pointer;
}

.music-open {
  width: 28px;
  height: 28px;
}

/* 播放列表面板（v2.7.1） */
.music-panel {
  font-size: 13px;
  color: var(--mo-text-1);
}

.mp-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}

.mp-title {
  font-size: 14px;
  font-weight: 600;
}

.mp-count {
  font-size: 12px;
  color: var(--mo-text-3);
}

.mp-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.mp-ctrl-btn {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: var(--mo-surface);
  color: var(--mo-text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.mp-ctrl-btn:hover {
  background: var(--mo-surface-hover);
  color: var(--mo-primary);
}

.mp-ctrl-btn.mp-ctrl-on {
  background: var(--mo-primary);
  border-color: var(--mo-primary);
  color: #fff;
}

/* v2.9.0：歌词显示 */
.mp-lyrics {
  max-height: 80px;
  overflow-y: auto;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: var(--mo-surface);
  border-radius: 8px;
  text-align: center;
}

.mp-lyric-line {
  font-size: 12px;
  color: var(--mo-text-3);
  line-height: 1.6;
  transition: color 0.2s ease, font-size 0.2s ease;
}

.mp-lyric-line.active {
  color: var(--mo-primary);
  font-weight: 600;
  font-size: 13px;
}

.mp-lyric-empty {
  font-size: 11px;
  color: var(--mo-text-3);
  text-align: center;
  padding: 8px;
}

/* v2.9.2：播放进度条 */
.mp-progress {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  margin-bottom: 6px;
}

.mp-time {
  font-size: 10px;
  color: var(--mo-text-3);
  min-width: 32px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.mp-progress-bar {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--mo-bg-2);
  border-radius: 2px;
  cursor: pointer;
  outline: none;
}

.mp-progress-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--mo-primary, #409eff);
  cursor: pointer;
}

.mp-progress-bar::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--mo-primary, #409eff);
  cursor: pointer;
  border: none;
}

/* v2.9.2：歌词显示开关 */
.mp-lyrics-toggle {
  display: flex;
  justify-content: flex-end;
  padding: 0 8px 4px;
}

.mp-lyric-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--mo-text-3);
  background: transparent;
  border: 1px solid var(--mo-border);
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.mp-lyric-btn:hover {
  color: var(--mo-text-1);
  border-color: var(--mo-primary, #409eff);
}

.mp-lyric-btn.active {
  color: var(--mo-primary, #409eff);
  border-color: var(--mo-primary, #409eff);
  background: rgba(64, 158, 255, 0.08);
}

.mp-list {
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 8px;
}

.mp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mp-item:hover {
  background: var(--mo-surface-hover);
}

.mp-item.active {
  background: var(--mo-surface-hover);
  color: var(--mo-primary);
}

.mp-item-index {
  width: 18px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--mo-text-3);
  text-align: right;
}

.mp-item.active .mp-item-index {
  color: var(--mo-primary);
}

.mp-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.mp-item-playing {
  color: var(--mo-primary);
  font-size: 12px;
}

.mp-item-del {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--mo-text-3);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.mp-item:hover .mp-item-del {
  opacity: 1;
}

.mp-item-del:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--mo-danger);
}

.mp-actions {
  display: flex;
  gap: 6px;
  border-top: 1px solid var(--glass-border);
  padding-top: 8px;
}

.mp-action-btn {
  flex: 1;
  padding: 5px 0;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: var(--mo-surface);
  color: var(--mo-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.mp-action-btn:hover {
  background: var(--mo-surface-hover);
  color: var(--mo-primary);
}

.mp-action-btn.danger:hover {
  color: var(--mo-danger);
}

/* 用户栏（顶栏） */
.user-mini {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--mo-surface);
  border: 1px solid var(--glass-border);
  color: var(--mo-text-2);
  font-size: 12px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: background-color 0.15s ease;
}

.user-mini:hover {
  background: var(--mo-surface-hover);
}

.user-mini-icon {
  color: var(--mo-primary);
}

.user-mini-name {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 窗口控制按钮（可点击区域，需脱离拖拽区） */
.win-controls {
  display: flex;
  align-items: stretch;
  height: 100%;
  -webkit-app-region: no-drag;
}

.win-btn {
  -webkit-app-region: no-drag;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--mo-text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  padding: 0;
}

.win-btn:hover {
  background: var(--mo-surface-hover);
  color: var(--mo-text-1);
}

.win-btn-close:hover {
  background: var(--mo-danger);
  color: #fff;
}

/* v3.1.5：用户头像（顶栏） */
.user-mini-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

/* v3.1.7：网易云用户详情面板 - 现代化设计 */
.ncm-user-panel {
  font-size: 13px;
  color: var(--mo-text-1);
  background: var(--mo-surface);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--mo-border);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.ncm-user-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--mo-border);
}

.ncm-user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.ncm-user-info {
  flex: 1;
  min-width: 0;
}

.ncm-user-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 2px;
}

.ncm-user-level {
  font-size: 12px;
  color: var(--mo-primary);
  font-weight: 600;
  margin-bottom: 4px;
}

.ncm-user-sig {
  font-size: 12px;
  color: var(--mo-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ncm-user-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px 0;
  margin: 16px 0;
  text-align: center;
  background: var(--mo-bg-2);
  border-radius: 8px;
}

.ncm-stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ncm-stat-val {
  font-size: 14px;
  font-weight: 700;
  color: var(--mo-text-1);
}

.ncm-stat-label {
  font-size: 11px;
  color: var(--mo-text-3);
}

.ncm-user-actions {
  display: flex;
  gap: 10px;
}

.ncm-action-btn {
  flex: 1;
  padding: 8px 0;
  border-radius: 8px;
  border: 1px solid var(--mo-border);
  background: var(--mo-surface);
  color: var(--mo-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.ncm-action-btn:hover {
  background: var(--mo-primary);
  border-color: var(--mo-primary);
  color: #fff;
}

.ncm-action-btn.danger:hover {
  background: var(--mo-danger);
  border-color: var(--mo-danger);
  color: #fff;
}

/* v3.3.0：VIP 标签 */
.ncm-vip-tag {
  margin-left: 6px;
  transform: scale(0.85);
  transform-origin: left center;
}

/* v3.3.0：账号信息区 */
.ncm-account-info {
  margin: 12px 0;
  padding: 12px;
  background: var(--mo-bg-2);
  border-radius: 8px;
  border: 1px solid var(--mo-border);
}

.ncm-account-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--mo-border);
}

.ncm-account-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
}

.ncm-account-label {
  color: var(--mo-text-3);
  flex-shrink: 0;
}

.ncm-account-value {
  color: var(--mo-text-1);
  font-weight: 500;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.ncm-expert-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ncm-tag {
  transform: scale(0.9);
  transform-origin: right center;
}
</style>
