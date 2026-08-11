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
    <!-- 提醒遮罩 -->
    <Transition name="fade">
      <div v-if="showAlert" class="alert-overlay" @click="dismissAlert">
        <div class="alert-card" @click.stop>
          <div class="alert-icon">{{ alertIcon }}</div>
          <h2 class="alert-title">{{ alertMessage }}</h2>
          <p class="alert-subtitle">{{ alertSubtitle }}</p>
          <el-button type="primary" size="large" round @click="dismissAlert" class="alert-btn">
            好的
          </el-button>
        </div>
      </div>
    </Transition>
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
const selectedSubject = ref<SubjectType>('cs408')
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

// 提醒相关状态
const showAlert = ref(false)
const alertMessage = ref('')
const alertSubtitle = ref('')
const alertIcon = ref('')
const isPulsing = ref(false)
const isFlashing = ref(false)

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
    const prev = remainingSeconds.value
    remainingSeconds.value = Math.max(0, timerRemainingAtStart - elapsed)
    
    // 倒计时预警：最后5秒
    if (remainingSeconds.value <= 5 && remainingSeconds.value > 0 && remainingSeconds.value !== prev) {
      playCountdownBeep()
      isFlashing.value = true
      triggerVibration([50])
      setTimeout(() => { isFlashing.value = false }, 300)
    }
    
    if (remainingSeconds.value === 0) {
      completeTimer()
    }
  }, 1000)  // 使用绝对时间差计算，1秒间隔足够精确且节省性能
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
    
    const msg = getCompletionMessage(completedPomodoros.value)
    alertMessage.value = msg
    alertSubtitle.value = `已完成 ${completedPomodoros.value} 个番茄`
    alertIcon.value = '🎉'
    
    // 第4的倍数个番茄用长休息图标
    if (completedPomodoros.value % store.pomodoroSettings.longBreakInterval === 0) {
      alertIcon.value = '💪'
      alertSubtitle.value = '太棒了！完成一组番茄，享受长休息吧！'
    }
    
    showAlert.value = true
    isPulsing.value = true
    triggerVibration([200, 100, 200, 100, 200])
    
    // 发送通知（声音区分：工作完成用上升旋律）
    sendNotification('番茄钟完成', alertMessage.value, 'work')
    
    // 每4个番茄后长休息
    if (completedPomodoros.value % store.pomodoroSettings.longBreakInterval === 0) {
      switchMode('longBreak')
    } else {
      switchMode('shortBreak')
    }
  } else {
    // 休息结束
    const isLongBreak = currentMode.value === 'longBreak'
    alertMessage.value = isLongBreak ? '能量充沛，开始新一轮专注吧！' : '休息结束，继续专注学习！'
    alertSubtitle.value = isLongBreak ? '长休息结束，状态满满' : '短休息结束，保持节奏'
    alertIcon.value = '⚡'
    showAlert.value = true
    isPulsing.value = true
    triggerVibration([300, 100, 300])
    
    // 发送通知（声音区分：休息结束用下降旋律）
    sendNotification('休息结束', alertMessage.value, 'break')
    
    switchMode('work')
  }
}

// 发送通知
function sendNotification(title: string, body: string, type: 'work' | 'break') {
  // 播放提示音（根据类型区分旋律）
  if (store.pomodoroSettings.enableSound) {
    playNotificationSound(type)
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

// 播放提示音（声音区分：上升/下降旋律）
function playNotificationSound(type: 'work' | 'break' = 'work') {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  
  const now = audioContext.currentTime
  // 上升旋律（工作完成）: 800→1000→1200  下降旋律（休息结束）: 1200→1000→800
  const freqs = type === 'work' ? [800, 1000, 1200] : [1200, 1000, 800]
  
  for (let round = 0; round < 2; round++) {
    const baseTime = round === 0 ? now : now + 2.5
    freqs.forEach((freq, i) => {
      const osc = audioContext!.createOscillator()
      const gain = audioContext!.createGain()
      osc.connect(gain)
      gain.connect(audioContext!.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const t = baseTime + i * 0.3
      const vol = 0.8 + (i * 0.05)  // 逐音增强
      gain.gain.setValueAtTime(0.01, t)
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.05)
      gain.gain.setValueAtTime(vol, t + (i === 2 ? 0.9 : 0.6))
      gain.gain.exponentialRampToValueAtTime(0.01, t + (i === 2 ? 1.0 : 0.7))
      osc.start(t)
      osc.stop(t + (i === 2 ? 1.0 : 0.7))
    })
  }
}

// 倒计时预警短促提示音
function playCountdownBeep() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  const now = audioContext.currentTime
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  osc.connect(gain)
  gain.connect(audioContext.destination)
  osc.frequency.value = 500
  osc.type = 'sine'
  gain.gain.setValueAtTime(0.5, now)
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
  osc.start(now)
  osc.stop(now + 0.1)
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

// 个性化提醒文案
function getCompletionMessage(count: number): string {
  switch (count) {
    case 1: return '第一个番茄完成！休息一下吧~'
    case 4: return '太棒了！完成一组番茄！'
    case 8: return '超级厉害！已完成8个番茄！'
    case 12: return '专注大师！12个番茄达成！'
    default: return `第 ${count} 个番茄完成！继续保持！`
  }
}

// 关闭提醒遮罩
function dismissAlert() {
  showAlert.value = false
  isPulsing.value = false
}

// 振动反馈
function triggerVibration(pattern: number[]) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern)
  }
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
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  border: 1px solid var(--glass-border);
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
  color: var(--mo-text-2);
  cursor: pointer;
  transition: all 0.3s ease;
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
  transition: all 0.2s ease;
  background: var(--mo-surface);
  border: 1px solid transparent;
}

.subject-btn:hover {
  background: var(--mo-surface-hover);
}

.subject-btn.active {
  color: #fff;
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
/* 提醒遮罩 */
.alert-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(74, 79, 87, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.alert-card {
  background: var(--glass-bg);
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 48px 40px;
  text-align: center;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: alertPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes alertPop {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.alert-icon {
  font-size: 72px;
  margin-bottom: 16px;
  line-height: 1;
}

.alert-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--mo-text-1);
  margin: 0 0 8px 0;
}

.alert-subtitle {
  font-size: 14px;
  color: var(--mo-text-3);
  margin: 0 0 24px 0;
}

.alert-btn {
  min-width: 120px;
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
