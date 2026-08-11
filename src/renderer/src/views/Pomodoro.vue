<template>
  <div class="pomodoro-page fade-in">
    <h1 class="page-title">番茄钟</h1>
    <p class="page-subtitle">专注学习，高效备考</p>

    <div class="pomodoro-container">
      <!-- 模式切换 -->
      <div class="mode-tabs">
        <div
          class="mode-tab"
          :class="{ active: currentMode === 'work' }"
          @click="switchMode('work')"
        >
          专注
        </div>
        <div
          class="mode-tab"
          :class="{ active: currentMode === 'shortBreak' }"
          @click="switchMode('shortBreak')"
        >
          短休息
        </div>
        <div
          class="mode-tab"
          :class="{ active: currentMode === 'longBreak' }"
          @click="switchMode('longBreak')"
        >
          长休息
        </div>
      </div>

      <!-- 计时器 -->
      <div class="timer-section" :class="{ 'timer-pulse': isPulsing }">
        <div class="timer-ring">
          <svg class="progress-ring" width="300" height="300">
            <circle
              class="progress-ring-bg"
              cx="150"
              cy="150"
              r="135"
              fill="none"
              stroke="rgba(255, 255, 255, 0.6)"
              stroke-width="14"
            />
            <circle
              class="progress-ring-fill"
              :class="currentMode"
              cx="150"
              cy="150"
              r="135"
              fill="none"
              stroke-width="14"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="progressOffset"
              transform="rotate(-90 150 150)"
            />
          </svg>
          <div class="timer-center">
            <span class="timer-text" :class="{ 'timer-flash': isFlashing }">{{ formatTime(remainingSeconds) }}</span>
            <span class="timer-mode">{{ modeLabel }}</span>
          </div>
        </div>
      </div>

      <!-- 控制按钮 -->
      <div class="controls">
        <el-button
          v-if="!isRunning"
          type="primary"
          size="large"
          round
          @click="startTimer"
        >
          <el-icon><VideoPlay /></el-icon>
          {{ hasStarted ? '继续' : '开始' }}
        </el-button>
        <el-button
          v-else
          type="warning"
          size="large"
          round
          @click="pauseTimer"
        >
          <el-icon><VideoPause /></el-icon>
          暂停
        </el-button>
        <el-button
          size="large"
          round
          @click="resetTimer"
        >
          <el-icon><RefreshLeft /></el-icon>
          重置
        </el-button>
        <el-button
          type="success"
          size="large"
          round
          @click="skipTimer"
        >
          <el-icon><DArrowRight /></el-icon>
          跳过
        </el-button>
      </div>

      <!-- 科目选择 -->
      <div class="subject-select" v-if="currentMode === 'work'">
        <span class="select-label">学习科目：</span>
        <div class="subject-buttons">
          <div
            v-for="(config, key) in store.SUBJECT_CONFIG"
            :key="key"
            class="subject-btn"
            :class="{ active: selectedSubject === key }"
            :style="selectedSubject === key ? { background: config.color, borderColor: config.color } : {}"
            @click="selectedSubject = key as SubjectType"
          >
            {{ config.shortName }}
          </div>
        </div>
      </div>

      <!-- 今日统计 -->
      <div class="today-stats">
        <div class="stat-item">
          <span class="stat-value">{{ todayPomodoroCount }}</span>
          <span class="stat-label">今日番茄</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ todayStudyHours }}</span>
          <span class="stat-label">学习时长(小时)</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ completedPomodoros }}</span>
          <span class="stat-label">本轮番茄</span>
        </div>
      </div>
    </div>

    <!-- 今日番茄记录 -->
    <GlassCard class="card records-card" v-if="todayRecords.length > 0">
      <h3 class="card-title" style="margin-bottom: 16px;">
        <el-icon><List /></el-icon>
        今日记录
      </h3>
      <div class="records-list">
        <div
          v-for="record in todayRecords"
          :key="record.id"
          class="record-item"
        >
          <div class="record-time">{{ formatRecordTime(record.completedAt) }}</div>
          <div class="record-duration">{{ record.duration }} 分钟</div>
          <el-tag
            v-if="record.subject"
            :color="store.SUBJECT_CONFIG[record.subject].color"
            style="color: #fff; border: none;"
            size="small"
          >
            {{ store.SUBJECT_CONFIG[record.subject].shortName }}
          </el-tag>
        </div>
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMainStore, type SubjectType } from '@/stores'
import { usePomodoroStore } from '@/stores/pomodoro'
import dayjs from 'dayjs'
import {
  VideoPlay,
  VideoPause,
  RefreshLeft,
  DArrowRight,
  List
} from '@element-plus/icons-vue'

const store = useMainStore()
// 计时状态已提升至全局 store：切换页面不会中断计时、不会重置进度
const pmd = usePomodoroStore()

const currentMode = computed(() => pmd.currentMode)
const isRunning = computed(() => pmd.isRunning)
const hasStarted = computed(() => pmd.hasStarted)
const remainingSeconds = computed(() => pmd.remainingSeconds)
const totalSeconds = computed(() => pmd.totalSeconds)
const completedPomodoros = computed(() => pmd.completedPomodoros)
const isPulsing = computed(() => pmd.isPulsing)
const modeLabel = computed(() => pmd.modeLabel)
const selectedSubject = computed({
  get: () => pmd.selectedSubject,
  set: (v) => { pmd.selectedSubject = v }
})

// 最后5秒数字闪烁（视觉提醒）
const isFlashing = computed(() =>
  isRunning.value && remainingSeconds.value <= 5 && remainingSeconds.value > 0
)

const circumference = 2 * Math.PI * 135

const progressOffset = computed(() => {
  const progress = remainingSeconds.value / totalSeconds.value
  return circumference * progress
})

const todayRecords = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  return store.pomodoroRecords
    .filter(r => r.date === today)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
})

const todayPomodoroCount = computed(() => todayRecords.value.length)

const todayStudyHours = computed(() => {
  const minutes = todayRecords.value.reduce((sum, r) => sum + r.duration, 0)
  return (minutes / 60).toFixed(1)
})

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function formatRecordTime(dateStr: string): string {
  return dayjs(dateStr).format('HH:mm')
}

function switchMode(mode: 'work' | 'shortBreak' | 'longBreak') {
  pmd.switchMode(mode)
}

function startTimer() {
  pmd.startTimer()
}

function pauseTimer() {
  pmd.pauseTimer()
}

function resetTimer() {
  pmd.resetTimer()
}

function skipTimer() {
  pmd.skipTimer()
}
</script>

<style scoped>
.pomodoro-page {
  max-width: 700px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin-bottom: 4px;
  text-align: center;
}

.page-subtitle {
  font-size: 14px;
  color: var(--mo-text-3);
  margin-bottom: 32px;
  text-align: center;
}

.pomodoro-container {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 32px;
  box-shadow: var(--glass-shadow);
  margin-bottom: 24px;
}

/* 模式切换 */
.mode-tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 32px;
}

.mode-tab {
  padding: 10px 24px;
  border-radius: 25px;
  font-size: 14px;
  color: var(--mo-text-2);
  cursor: pointer;
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease, transform 0.3s ease;
  background: var(--mo-surface);
}

.mode-tab:hover {
  background: var(--mo-surface-hover);
}

.mode-tab.active {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
}

/* 计时器 */
.timer-section {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.timer-ring {
  position: relative;
  width: 300px;
  height: 300px;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-bg {
  stroke: rgba(150, 158, 170, 0.10);
}

.progress-ring-fill {
  transition: stroke-dashoffset 1s linear;
}

.progress-ring-fill.work {
  stroke: url(#workGradient);
  stroke: #3b82f6;
}

.progress-ring-fill.shortBreak {
  stroke: #34d399;
}

.progress-ring-fill.longBreak {
  stroke: #fbbf24;
}

.timer-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.timer-text {
  display: block;
  font-size: 56px;
  font-weight: 700;
  color: var(--mo-text-1);
  font-family: 'DIN Alternate', sans-serif;
  line-height: 1;
  margin-bottom: 8px;
}

.timer-mode {
  font-size: 14px;
  color: var(--mo-text-3);
}

/* 控制按钮 */
.controls {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 32px;
}

.controls .el-button {
  min-width: 100px;
}

/* 科目选择 */
.subject-select {
  margin-bottom: 32px;
  text-align: center;
}

.select-label {
  display: block;
  font-size: 14px;
  color: var(--mo-text-2);
  margin-bottom: 12px;
}

.subject-buttons {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}

.subject-btn {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  color: var(--mo-text-2);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  background: var(--mo-surface);
  border: 1px solid transparent;
}

.subject-btn:hover {
  background: var(--mo-surface-hover);
}

.subject-btn.active {
  color: #fff;
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
}

/* 今日统计 */
.today-stats {
  display: flex;
  justify-content: space-around;
  padding-top: 24px;
  border-top: 1px solid var(--glass-border);
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #60a5fa;
  font-family: 'DIN Alternate', sans-serif;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: var(--mo-text-3);
}

/* 记录卡片 */
.records-card {
  padding: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--mo-text-1);
  display: flex;
  align-items: center;
  gap: 8px;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--mo-surface);
  border-radius: 10px;
}

.record-time {
  font-size: 14px;
  color: var(--mo-text-2);
  font-family: 'DIN Alternate', sans-serif;
  min-width: 50px;
}

.record-duration {
  flex: 1;
  font-size: 14px;
  color: var(--mo-text-1);
  font-weight: 500;
}

/* 倒计时闪烁 */
.timer-flash {
  animation: timerFlash 0.3s ease-in-out;
}

@keyframes timerFlash {
  0% { opacity: 1; }
  50% { opacity: 0.3; color: #ef4444; }
  100% { opacity: 1; }
}

/* 进度环脉冲动画 */
.timer-pulse .progress-ring-fill {
  animation: ringPulse 1s ease-in-out infinite;
}

@keyframes ringPulse {
  0% { stroke-width: 14; }
  50% { stroke-width: 22; opacity: 0.7; }
  100% { stroke-width: 14; }
}

/* 遮罩过渡动画 */
.fade-enter-active {
  transition: opacity 0.3s ease;
}
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
