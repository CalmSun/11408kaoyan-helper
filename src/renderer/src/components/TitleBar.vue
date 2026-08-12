<template>
  <header class="titlebar" :class="{ transparent: transparent }">
    <div class="titlebar-left">
      <el-icon :size="16" class="titlebar-logo"><Reading /></el-icon>
      <span class="titlebar-title">11408考研助手</span>
      <span v-if="!transparent" class="titlebar-page">{{ pageTitle }}</span>
    </div>

    <div class="titlebar-right">
      <span v-if="!transparent" class="titlebar-countdown">距考研 {{ store.daysUntilExam }} 天</span>
      <span class="titlebar-date">{{ todayStr }}</span>

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
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMainStore } from '@/stores'
import { Reading } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

interface Props {
  transparent?: boolean
}
defineProps<Props>()

const route = useRoute()
const store = useMainStore()

const isMaximized = ref(false)

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
