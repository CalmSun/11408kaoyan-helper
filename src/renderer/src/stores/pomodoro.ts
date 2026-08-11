import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMainStore, SubjectType } from '@/stores'

export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak'

/**
 * 番茄钟全局状态
 * 计时状态提升到 store：切换页面不会中断计时、不会丢失进度；
 * 完成提醒、声音、通知在任意页面均可正常触发。
 */
export const usePomodoroStore = defineStore('pomodoro', () => {
  const mainStore = useMainStore()

  const currentMode = ref<PomodoroMode>('work')
  const isRunning = ref(false)
  const hasStarted = ref(false)
  const selectedSubject = ref<SubjectType>('cs408')
  const completedPomodoros = ref(0)

  const workDuration = computed(() => mainStore.pomodoroSettings.workDuration * 60)
  const shortBreakDuration = computed(() => mainStore.pomodoroSettings.breakDuration * 60)
  const longBreakDuration = computed(() => mainStore.pomodoroSettings.longBreakDuration * 60)

  const remainingSeconds = ref(workDuration.value)
  const totalSeconds = ref(workDuration.value)

  let timer: number | null = null
  let timerStartAt = 0          // 计时开始时的绝对时间戳
  let timerRemainingAtStart = 0 // 计时开始时的剩余秒数
  let audioContext: AudioContext | null = null // 复用单一 AudioContext 实例
  let titleFlashTimer: number | null = null

  // 提醒相关状态（遮罩由根组件渲染，任意页面可弹出）
  const showAlert = ref(false)
  const alertMessage = ref('')
  const alertSubtitle = ref('')
  const alertIcon = ref('')
  const isPulsing = ref(false)

  const modeLabel = computed(() => {
    const labels: Record<PomodoroMode, string> = {
      work: '专注学习中',
      shortBreak: '短暂休息',
      longBreak: '长休息'
    }
    return labels[currentMode.value]
  })

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

      // 倒计时预警：最后5秒（在其他页面也会响铃/振动）
      if (remainingSeconds.value <= 5 && remainingSeconds.value > 0 && remainingSeconds.value !== prev) {
        playCountdownBeep()
        triggerVibration([50])
      }

      if (remainingSeconds.value === 0) {
        completeTimer()
      }
    }, 1000) // 使用绝对时间差计算，1秒间隔足够精确且节省性能
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
      mainStore.addPomodoroRecord(
        totalSeconds.value / 60,
        selectedSubject.value
      )
      completedPomodoros.value++

      const msg = getCompletionMessage(completedPomodoros.value)
      alertMessage.value = msg
      alertSubtitle.value = `已完成 ${completedPomodoros.value} 个番茄`
      alertIcon.value = '🎉'

      // 第4的倍数个番茄用长休息图标
      if (completedPomodoros.value % mainStore.pomodoroSettings.longBreakInterval === 0) {
        alertIcon.value = '💪'
        alertSubtitle.value = '太棒了！完成一组番茄，享受长休息吧！'
      }

      showAlert.value = true
      isPulsing.value = true
      triggerVibration([200, 100, 200, 100, 200])

      // 发送通知（声音区分：工作完成用上升旋律）
      sendNotification('番茄钟完成', alertMessage.value, 'work')

      // 每4个番茄后长休息
      if (completedPomodoros.value % mainStore.pomodoroSettings.longBreakInterval === 0) {
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

  // 关闭提醒遮罩
  function dismissAlert() {
    showAlert.value = false
    isPulsing.value = false
  }

  // 发送通知
  function sendNotification(title: string, body: string, type: 'work' | 'break') {
    if (mainStore.pomodoroSettings.enableSound) {
      playNotificationSound(type)
    }
    if (mainStore.pomodoroSettings.enableNotification) {
      showDesktopNotification(title, body)
    }
    if (mainStore.pomodoroSettings.enableTitleFlash) {
      startTitleFlash(title)
    }
  }

  function ensureAudioContext(): AudioContext {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContext
  }

  // 播放提示音（声音区分：上升/下降旋律）
  function playNotificationSound(type: 'work' | 'break' = 'work') {
    const ctx = ensureAudioContext()

    const now = ctx.currentTime
    // 上升旋律（工作完成）: 800→1000→1200  下降旋律（休息结束）: 1200→1000→800
    const freqs = type === 'work' ? [800, 1000, 1200] : [1200, 1000, 800]

    for (let round = 0; round < 2; round++) {
      const baseTime = round === 0 ? now : now + 2.5
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        const t = baseTime + i * 0.3
        const vol = 0.8 + (i * 0.05) // 逐音增强
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
    const ctx = ensureAudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
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
    let flashing = true

    if (titleFlashTimer) {
      clearInterval(titleFlashTimer)
    }

    titleFlashTimer = window.setInterval(() => {
      document.title = flashing ? `🔔 ${title}` : originalTitle
      flashing = !flashing
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

  // 振动反馈
  function triggerVibration(pattern: number[]) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  }

  return {
    currentMode,
    isRunning,
    hasStarted,
    selectedSubject,
    completedPomodoros,
    remainingSeconds,
    totalSeconds,
    modeLabel,
    showAlert,
    alertMessage,
    alertSubtitle,
    alertIcon,
    isPulsing,
    switchMode,
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer,
    dismissAlert
  }
})
