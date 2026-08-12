<template>
  <header class="titlebar" :class="{ transparent: transparent }">
    <div class="titlebar-left">
      <el-icon :size="16" class="titlebar-logo"><Reading /></el-icon>
      <span class="titlebar-title">11408考研助手</span>
      <span v-if="!transparent" class="titlebar-page">{{ pageTitle }}</span>
    </div>

    <div class="titlebar-right">
      <!-- 天气组件（v2.7.1：点击查看详情 + 地点选择） -->
      <el-popover
        v-if="!transparent"
        placement="bottom-end"
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
        <!-- 天气详情面板（v2.8.0：国内数据源 + 城市搜索） -->
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
            <!-- 搜索结果候选（v2.8.0） -->
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

      <span v-if="!transparent" class="titlebar-countdown">距考研 {{ store.daysUntilExam }} 天</span>
      <span class="titlebar-date">{{ todayStr }}</span>

      <!-- 全局音乐组件（v2.7.1：选择文件夹/文件、播放、暂停、下一首、列表选择） -->
      <div class="music-widget" v-if="!transparent">
        <button class="mini-btn" title="选择音乐文件夹" @click="handlePickFolder">
          <el-icon :size="13"><Folder /></el-icon>
        </button>

        <template v-if="music.hasMusic">
          <span class="music-name" :title="music.currentTrack?.name">{{ music.currentTrack?.name }}</span>
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
            placement="bottom-end"
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

      <!-- 护眼模式（v2.7.0） -->
      <button class="mini-btn eyecare-btn" :class="{ on: eyeCareOn }" :title="eyeCareOn ? '关闭护眼模式' : '开启护眼模式'" @click="toggleEye">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 2 C9 2 11 6 11 6 C11 6 9 10 6 10 C3 10 1 6 1 6 C1 6 3 2 6 2 Z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="6" r="1.8" fill="currentColor"/></svg>
      </button>

      <!-- 主题切换（从侧栏移入顶栏 v2.7.0） -->
      <button class="mini-btn theme-btn" :title="dark ? '切换到浅色模式' : '切换到深色模式'" @click="handleToggleTheme">
        <el-icon :size="14"><component :is="dark ? Sunny : Moon" /></el-icon>
      </button>

      <!-- 用户栏（从侧栏移入顶栏 v2.7.0） -->
      <div v-if="!transparent && userStore.isLoggedIn" class="user-mini" :title="userStore.displayName" @click="goToSettings">
        <el-icon :size="14" class="user-mini-icon"><UserFilled /></el-icon>
        <span class="user-mini-name">{{ userStore.displayName }}</span>
      </div>

      <!-- 自建窗口控制按钮（无边框窗口） -->
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMainStore } from '@/stores'
import { useUserStore } from '@/stores/user'
import { useMusicStore } from '@/stores/music'
import { isDark, toggleTheme, eyeCare, toggleEyeCare } from '@/utils/theme'
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
import { Reading, Sunny, Moon, UserFilled, Folder, List } from '@element-plus/icons-vue'
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
  '/settings': '设置'
}

const pageTitle = computed(() => pageTitleMap[route.path] ?? '')
const todayStr = computed(() => dayjs().format('YYYY年MM月DD日 ddd'))

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

function goToSettings() {
  router.push('/settings')
}

function onVolumeInput(e: Event) {
  const target = e.target as HTMLInputElement
  music.setVolume(Number(target.value) / 100)
}

onMounted(() => {
  initWeather()
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
.titlebar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
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

/* 随机播放激活态（v2.8.1） */
.mp-ctrl-btn.mp-ctrl-on {
  background: var(--mo-primary);
  border-color: var(--mo-primary);
  color: #fff;
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
</style>
