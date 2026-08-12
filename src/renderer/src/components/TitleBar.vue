<template>
  <header class="titlebar" :class="{ transparent: transparent }">
    <div class="titlebar-left">
      <el-icon :size="16" class="titlebar-logo"><Reading /></el-icon>
      <span class="titlebar-title">11408考研助手</span>
      <span v-if="!transparent" class="titlebar-page">{{ pageTitle }}</span>
    </div>

    <div class="titlebar-right">
      <!-- 天气展示（v2.7.0） -->
      <div v-if="weather && !transparent" class="titlebar-weather" :title="weatherTip">
        <span class="weather-icon">{{ weather.icon }}</span>
        <span class="weather-temp">{{ weather.tempC }}°C</span>
        <span class="weather-cond">{{ weather.condition }}</span>
      </div>

      <span v-if="!transparent" class="titlebar-countdown">距考研 {{ store.daysUntilExam }} 天</span>
      <span class="titlebar-date">{{ todayStr }}</span>

      <!-- 全局音乐迷你控制（v2.7.0） -->
      <div class="music-mini" v-if="music.hasMusic">
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
      </div>
      <button v-else-if="!transparent" class="mini-btn music-open" title="播放本地音乐" @click="openMusicPicker">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M9 1 L9 8.2 A2.3 2.3 0 1 1 8 6.3 L8 3 L4 4 L4 9.2 A2.3 2.3 0 1 1 3 7.3 L3 2.5 Z" fill="currentColor"/></svg>
      </button>

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
import { weather, initWeather } from '@/utils/weather'
import { Reading, Sunny, Moon, UserFilled } from '@element-plus/icons-vue'
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
  weather.value ? `${weather.value.condition} · 湿度 ${weather.value.humidity}% · 风速 ${weather.value.wind}km/h` : ''
)

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

async function openMusicPicker() {
  const count = await music.pickFiles()
  if (count > 0) {
    music.play()
  }
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

/* 天气展示 */
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

/* 音乐迷你控制 */
.music-mini {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  height: 28px;
  border-radius: 8px;
  background: var(--mo-surface);
  border: 1px solid var(--glass-border);
  -webkit-app-region: no-drag;
}

.music-mini .mini-btn {
  border: none;
  background: transparent;
  width: 22px;
  height: 22px;
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
