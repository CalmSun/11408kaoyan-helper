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
      <div class="timer-section">
        <div class="timer-ring">
          <svg class="progress-ring" width="300" height="300">
            <circle
              class="progress-ring-bg"
              cx="150"
              cy="150"
              r="135"
              fill="none"
              stroke="#ebeef5"
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
            <span class="timer-text">{{ formatTime(remainingSeconds) }}</span>
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
    <div class="card records-card" v-if="todayRecords.length > 0">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useMainStore, SubjectType } from '@/stores'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import {
  VideoPlay,
  VideoPause,
  RefreshLeft,
  DArrowRight,
  List
} from '@element-plus/icons-vue'

type PomodoroMode = 'work' | 'shortBreak' | 'longBreak'

const store = useMainStore()

const currentMode = ref<PomodoroMode>('work')
const isRunning = ref(false)
const hasStarted = ref(false)
const selectedSubject = ref<SubjectType>('datastruct')
const completedPomodoros = ref(0)

const workDuration = computed(() => store.pomodoroSettings.workDuration * 60)
const shortBreakDuration = computed(() => store.pomodoroSettings.breakDuration * 60)
const longBreakDuration = computed(() => store.pomodoroSettings.longBreakDuration * 60)

const remainingSeconds = ref(workDuration.value)
const totalSeconds = ref(workDuration.value)

let timer: number | null = null
let titleFlashTimer: number | null = null
let timerStartAt: number = 0     // 计时开始时的绝对时间戳
let timerRemainingAtStart: number = 0  // 计时开始时的剩余秒数
let audioContext: AudioContext | null = null  // 复用单一 AudioContext 实例

const circumference = 2 * Math.PI * 135

const progressOffset = computed(() => {
  const progress = remainingSeconds.value / totalSeconds.value
  return circumference * progress
})

const modeLabel = computed(() => {
  const labels: Record<PomodoroMode, string> = {
    work: '专注学习中',
    shortBreak: '短暂休息',
    longBreak: '长休息'
  }
  return labels[currentMode.value]
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

function getDuration(mode: PomodoroMode): number {
  switch (mode) {
    case 'work': return workDuration.value
    case 'shortBreak': return shortBreakDuration.value
    case 'longBreak': return longBreakDuration.value
  }
}

function switchMode(mode: PomodoroMode) {
  if (isRunning.value) {
    pauseTimer()
  }
  currentMode.value = mode
  hasStarted.value = false
  remainingSeconds.value = getDuration(mode)
  totalSeconds.value = getDuration(mode)
}

function startTimer() {
  if (isRunning.value) return
  isRunning.value = true
  hasStarted.value = true
  
  timerStartAt = Date.now()
  timerRemainingAtStart = remainingSeconds.value
  
  timer = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - timerStartAt) / 1000)
    remainingSeconds.value = Math.max(0, timerRemainingAtStart - elapsed)
    
    if (remainingSeconds.value === 0) {
      completeTimer()
    }
  }, 200)  // 使用更短的间隔以提高精度
}

function pauseTimer() {
  isRunning.value = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function resetTimer() {
  pauseTimer()
  hasStarted.value = false
  remainingSeconds.value = getDuration(currentMode.value)
  totalSeconds.value = getDuration(currentMode.value)
}

function skipTimer() {
  completeTimer()
}

function completeTimer() {
  pauseTimer()
  
  // 如果是工作模式，记录番茄
  if (currentMode.value === 'work') {
    store.addPomodoroRecord(
      totalSeconds.value / 60,
      selectedSubject.value
    )
    completedPomodoros.value++
    ElMessage.success('🎉 完成一个番茄！休息一下吧~')
    
    // 发送通知
    sendNotification('番茄钟完成', '专注时间结束，休息一下吧！', 'work')
    
    // 每4个番茄后长休息
    if (completedPomodoros.value % store.pomodoroSettings.longBreakInterval === 0) {
      switchMode('longBreak')
    } else {
      switchMode('shortBreak')
    }
  } else {
    ElMessage.info('休息结束，继续加油！')
    
    // 发送通知
    sendNotification('休息结束', '休息完成，继续专注学习吧！', 'break')
    
    switchMode('work')
  }
}

// 发送通知
function sendNotification(title: string, body: string, type: 'work' | 'break') {
  // 播放提示音
  if (store.pomodoroSettings.enableSound) {
    playNotificationSound()
  }
  
  // 桌面通知
  if (store.pomodoroSettings.enableNotification) {
    showDesktopNotification(title, body)
  }
  
  // 页面标题闪烁
  if (store.pomodoroSettings.enableTitleFlash) {
    startTitleFlash(title)
  }
}

// 播放提示音
function playNotificationSound() {
  // 复用单一 AudioContext 实例，避免泄漏
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  oscillator.frequency.value = 800
  oscillator.type = 'sine'
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
  
  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.5)
}

// 显示桌面通知
function showDesktopNotification(title: string, body: string) {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/favicon.ico'
      })
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, {
            body: body,
            icon: '/favicon.ico'
          })
        }
      })
    }
  }
}

// 页面标题闪烁
function startTitleFlash(title: string) {
  const originalTitle = document.title
  let isFlashing = true
  
  if (titleFlashTimer) {
    clearInterval(titleFlashTimer)
  }
  
  titleFlashTimer = window.setInterval(() => {
    document.title = isFlashing ? `🔔 ${title}` : originalTitle
    isFlashing = !isFlashing
  }, 1000)
  
  // 10秒后停止闪烁
  setTimeout(() => {
    if (titleFlashTimer) {
      clearInterval(titleFlashTimer)
      titleFlashTimer = null
    }
    document.title = originalTitle
  }, 10000)
  
  // 页面获得焦点时停止闪烁
  window.addEventListener('focus', () => {
    if (titleFlashTimer) {
      clearInterval(titleFlashTimer)
      titleFlashTimer = null
      document.title = originalTitle
    }
  }, { once: true })
}

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
  if (titleFlashTimer) {
    clearInterval(titleFlashTimer)
  }
  // 清理 AudioContext
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
})
</script>

<style scoped>
.pomodoro-page {
  max-width: 700px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
  text-align: center;
}

.page-subtitle {
  font-size: 14px;
  color: #909399;
  margin-bottom: 32px;
  text-align: center;
}

.pomodoro-container {
  background: #fff;
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
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
  color: #606266;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f5f7fa;
}

.mode-tab:hover {
  background: #ebeef5;
}

.mode-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
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
  stroke: #f0f2f5;
}

.progress-ring-fill {
  transition: stroke-dashoffset 1s linear;
}

.progress-ring-fill.work {
  stroke: url(#workGradient);
  stroke: #667eea;
}

.progress-ring-fill.shortBreak {
  stroke: #67c23a;
}

.progress-ring-fill.longBreak {
  stroke: #e6a23c;
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
  color: #303133;
  font-family: 'DIN Alternate', sans-serif;
  line-height: 1;
  margin-bottom: 8px;
}

.timer-mode {
  font-size: 14px;
  color: #909399;
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
  color: #606266;
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
  color: #606266;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #f5f7fa;
  border: 1px solid transparent;
}

.subject-btn:hover {
  background: #ebeef5;
}

.subject-btn.active {
  color: #fff;
}

/* 今日统计 */
.today-stats {
  display: flex;
  justify-content: space-around;
  padding-top: 24px;
  border-top: 1px solid #ebeef5;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #667eea;
  font-family: 'DIN Alternate', sans-serif;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #909399;
}

/* 记录卡片 */
.records-card {
  padding: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
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
  background: #f5f7fa;
  border-radius: 10px;
}

.record-time {
  font-size: 14px;
  color: #606266;
  font-family: 'DIN Alternate', sans-serif;
  min-width: 50px;
}

.record-duration {
  flex: 1;
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}
</style>
