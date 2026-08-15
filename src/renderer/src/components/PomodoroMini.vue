<template>
  <Transition name="mini-scale">
    <div
      v-if="visible"
      ref="rootRef"
      class="pomodoro-mini"
      :class="{ compact: isCompact }"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
    >
      <!-- 拖拽条（头部） -->
      <div
        class="mini-header"
        @pointerdown="onDragStart"
        @contextmenu.prevent
      >
        <div class="header-dots">
          <span /><span /><span />
        </div>
        <span class="header-title" v-if="!isCompact">番茄钟</span>
        <span class="header-title" v-else>{{ formatTime(remainingSeconds) }}</span>
        <div class="header-actions" @pointerdown.stop>
          <el-button link size="small" class="hdr-btn" @click="toggleCompact" :title="isCompact ? '展开' : '收起'">
            <el-icon><ArrowDown v-if="!isCompact" /><ArrowUp v-else /></el-icon>
          </el-button>
          <el-button link size="small" type="primary" class="hdr-btn" @click="goPomodoroPage" title="跳转到番茄钟页面">
            <el-icon><Timer /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 紧凑模式：仅显示小球+时间+模式 -->
      <div v-if="isCompact" class="compact-body" @click="toggleCompact">
        <div class="compact-ring">
          <svg width="56" height="56">
            <circle cx="28" cy="28" r="24" class="compact-ring-bg" />
            <circle
              cx="28" cy="28" r="24" class="compact-ring-fill"
              :class="currentMode"
              :stroke-dasharray="compactCircumference"
              :stroke-dashoffset="compactOffset"
              transform="rotate(-90 28 28)"
            />
          </svg>
          <span class="compact-timer" :class="{ flash: isFlashing }">{{ formatCompact(remainingSeconds) }}</span>
        </div>
      </div>

      <!-- 展开模式：完整卡片功能 -->
      <div v-else class="mini-body" @pointerdown.stop>
        <!-- 模式切换 -->
        <div class="mini-tabs">
          <div class="mini-tab" :class="{ active: currentMode === 'work' }" @click="switchMode('work')">专注</div>
          <div class="mini-tab" :class="{ active: currentMode === 'shortBreak' }" @click="switchMode('shortBreak')">短休</div>
          <div class="mini-tab" :class="{ active: currentMode === 'longBreak' }" @click="switchMode('longBreak')">长休</div>
        </div>

        <!-- 迷你环形进度 + 计时 -->
        <div class="mini-timer" :class="{ pulse: isPulsing }">
          <svg class="mini-ring" width="140" height="140">
            <circle cx="70" cy="70" r="60" class="mini-ring-bg" />
            <circle
              class="mini-ring-fill"
              :class="currentMode"
              cx="70" cy="70" r="60"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="progressOffset"
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div class="mini-timer-center">
            <span class="mini-timer-text" :class="{ flash: isFlashing }">{{ formatTime(remainingSeconds) }}</span>
            <span class="mini-timer-mode">{{ modeLabel }}</span>
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="mini-controls">
          <el-button
            v-if="!isRunning" type="primary" size="small" round @click="startTimer"
          >
            <el-icon><VideoPlay /></el-icon>
            {{ hasStarted ? '继续' : '开始' }}
          </el-button>
          <el-button
            v-else type="warning" size="small" round @click="pauseTimer"
          >
            <el-icon><VideoPause /></el-icon>
            暂停
          </el-button>
          <el-button size="small" round @click="resetTimer">
            <el-icon><RefreshLeft /></el-icon>
          </el-button>
          <el-button type="success" size="small" round @click="skipTimer">
            <el-icon><DArrowRight /></el-icon>
          </el-button>
        </div>

        <!-- 科目选择（仅工作模式） -->
        <div v-if="currentMode === 'work'" class="mini-subjects">
          <div
            v-for="(cfg, key) in store.SUBJECT_CONFIG"
            :key="key"
            class="mini-subj"
            :class="{ active: selectedSubject === key }"
            :style="selectedSubject === key ? { background: cfg.color, borderColor: cfg.color } : {}"
            @click="selectedSubject = key as SubjectType"
          >
            {{ cfg.shortName }}
          </div>
        </div>

        <!-- 今日统计 -->
        <div class="mini-stats">
          <div class="mini-stat">
            <span class="mini-stat-val">{{ todayPomodoroCount }}</span>
            <span class="mini-stat-label">今日</span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-val">{{ todayStudyHours }}</span>
            <span class="mini-stat-label">小时</span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-val">{{ completedPomodoros }}</span>
            <span class="mini-stat-label">本轮</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore, type SubjectType } from '@/stores'
import { usePomodoroStore } from '@/stores/pomodoro'
import dayjs from 'dayjs'
import {
  VideoPlay, VideoPause, RefreshLeft, DArrowRight,
  ArrowDown, ArrowUp, Timer
} from '@element-plus/icons-vue'

const props = defineProps<{ visible: boolean }>()

const router = useRouter()
const store = useMainStore()
const pmd = usePomodoroStore()

const rootRef = ref<HTMLElement | null>(null)
const isCompact = ref(loadCompact())
const pos = reactive({ x: 0, y: 0 })

// ── 持久化位置 / 紧凑状态 ──
const POS_KEY = 'pm-mini-pos'
const COMPACT_KEY = 'pm-mini-compact'
function loadCompact(): boolean {
  try { return localStorage.getItem(COMPACT_KEY) === '1' } catch { return false }
}
function saveCompact(v: boolean) {
  try { localStorage.setItem(COMPACT_KEY, v ? '1' : '0') } catch { /* ignore */ }
}
function savePos() {
  try { localStorage.setItem(POS_KEY, JSON.stringify({ x: pos.x, y: pos.y })) } catch { /* ignore */ }
}
function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (typeof p.x === 'number' && typeof p.y === 'number') return p
    }
  } catch { /* ignore */ }
  return null
}

// ── Store 状态映射（完全复用番茄钟页面 store，状态全局共享） ──
const currentMode = computed(() => pmd.currentMode)
const isRunning = computed(() => pmd.isRunning)
const hasStarted = computed(() => pmd.hasStarted)
const remainingSeconds = computed(() => pmd.remainingSeconds)
const totalSeconds = computed(() => pmd.totalSeconds)
const completedPomodoros = computed(() => pmd.completedPomodoros)
const modeLabel = computed(() => pmd.modeLabel)
const isPulsing = computed(() => pmd.isPulsing)
const selectedSubject = computed({
  get: () => pmd.selectedSubject,
  set: (v) => { pmd.selectedSubject = v }
})

const isFlashing = computed(() =>
  isRunning.value && remainingSeconds.value <= 5 && remainingSeconds.value > 0
)

// ── 计算值：环形进度 + 统计 ──
const circumference = 2 * Math.PI * 60
const compactCircumference = 2 * Math.PI * 24

const progressOffset = computed(() => {
  const progress = remainingSeconds.value / totalSeconds.value
  return circumference * progress
})
const compactOffset = computed(() => {
  const progress = remainingSeconds.value / totalSeconds.value
  return compactCircumference * progress
})

const todayRecords = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  return store.pomodoroRecords.filter(r => r.date === today)
})
const todayPomodoroCount = computed(() => todayRecords.value.length)
const todayStudyHours = computed(() => {
  const minutes = todayRecords.value.reduce((s, r) => s + r.duration, 0)
  return (minutes / 60).toFixed(1)
})

// ── 格式化 ──
function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function formatCompact(sec: number): string {
  // 紧凑模式：最多4字符，超过59分钟用 H.M 显示
  if (sec >= 60 * 100) return `${Math.floor(sec / 3600)}h`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ── 番茄钟操作 ──
function switchMode(m: 'work' | 'shortBreak' | 'longBreak') { pmd.switchMode(m) }
function startTimer() { pmd.startTimer() }
function pauseTimer() { pmd.pauseTimer() }
function resetTimer() { pmd.resetTimer() }
function skipTimer() { pmd.skipTimer() }

// ── 跳转到番茄钟页面（自动隐藏浮窗） ──
function goPomodoroPage() {
  router.push('/pomodoro')
}

// ── 展开/收起 ──
function toggleCompact() {
  isCompact.value = !isCompact.value
  saveCompact(isCompact.value)
  // 切换后可能尺寸变化，需要校正位置防止超出屏幕
  nextTick(() => clampPos())
}

// ── 拖拽：Pointer Events + setPointerCapture + 移动阈值 ──
const DRAG_THRESHOLD = 3
let dragState: {
  pointerId: number
  startX: number
  startY: number
  startPosX: number
  startPosY: number
  moved: boolean
} | null = null

function onDragStart(e: PointerEvent) {
  // 只响应左键
  if (e.button !== 0) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragState = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    startPosX: pos.x,
    startPosY: pos.y,
    moved: false
  }
  ;(e.currentTarget as HTMLElement).addEventListener('pointermove', onDragMove)
  ;(e.currentTarget as HTMLElement).addEventListener('pointerup', onDragEnd)
  ;(e.currentTarget as HTMLElement).addEventListener('pointercancel', onDragEnd)
}
function onDragMove(e: PointerEvent) {
  if (!dragState) return
  const dx = e.clientX - dragState.startX
  const dy = e.clientY - dragState.startY
  if (!dragState.moved) {
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
    dragState.moved = true
  }
  pos.x = dragState.startPosX + dx
  pos.y = dragState.startPosY + dy
  clampPos()
}
function onDragEnd(e: PointerEvent) {
  if (!dragState) return
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(dragState.pointerId)
  } catch { /* ignore */ }
  ;(e.currentTarget as HTMLElement).removeEventListener('pointermove', onDragMove)
  ;(e.currentTarget as HTMLElement).removeEventListener('pointerup', onDragEnd)
  ;(e.currentTarget as HTMLElement).removeEventListener('pointercancel', onDragEnd)
  if (dragState.moved) {
    savePos()
  }
  dragState = null
}

// 限制位置，确保浮窗不超出可视区域
function clampPos() {
  const el = rootRef.value
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (pos.x < 0) pos.x = 0
  if (pos.y < 0) pos.y = 0
  if (pos.x + w > vw) pos.x = vw - w
  if (pos.y + h > vh) pos.y = vh - h
}

// 首次挂载：恢复位置；若没有历史位置则默认左下角（v3.4.1：由右下角改为左下角）
function initPos() {
  const saved = loadPos()
  const el = rootRef.value
  if (!el) return
  if (saved) {
    pos.x = saved.x
    pos.y = saved.y
  } else {
    const margin = 24
    pos.x = margin
    pos.y = window.innerHeight - el.offsetHeight - margin
  }
  clampPos()
}

// 窗口尺寸变化时重新约束位置
function onResize() {
  if (!props.visible) return
  clampPos()
  savePos()
}

// 当可见性变化（比如从番茄钟页面切走）重新显示时，校正越界
watch(() => props.visible, (v) => {
  if (v) {
    nextTick(() => {
      initPos()
    })
  }
})

onMounted(() => {
  window.addEventListener('resize', onResize)
  if (props.visible) {
    nextTick(() => initPos())
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.pomodoro-mini {
  position: fixed;
  z-index: 9990; /* 低于全局 alert-overlay(9999)，高于其他内容 */
  width: 280px;
  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-filter-pop);
  -webkit-backdrop-filter: var(--glass-filter-pop);
  border: 1px solid var(--glass-border);
  border-radius: 18px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.22);
  user-select: none;
  overflow: hidden;
}

.pomodoro-mini.compact {
  width: auto;
}

/* ── 头部拖拽条 ── */
.mini-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent);
  border-bottom: 1px solid var(--mo-border);
  cursor: grab;
  touch-action: none; /* 防止移动端滚动抢占 */
}
.mini-header:active { cursor: grabbing; }

.header-dots {
  display: inline-flex;
  gap: 3px;
  padding: 0 4px;
}
.header-dots span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--mo-text-3);
  opacity: 0.6;
}

.header-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: var(--mo-text-2);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pomodoro-mini.compact .header-title {
  font-family: 'DIN Alternate', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: var(--mo-text-1);
}

.header-actions {
  display: inline-flex;
  gap: 2px;
}
.hdr-btn {
  padding: 2px 4px;
  margin: 0;
  color: var(--mo-text-3);
}
.hdr-btn:hover {
  color: var(--mo-text-1);
}

/* ── 紧凑模式小球 ── */
.compact-body {
  padding: 10px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.compact-ring {
  position: relative;
  width: 56px; height: 56px;
}
.compact-ring-bg {
  fill: none;
  stroke: rgba(150, 158, 170, 0.14);
  stroke-width: 4;
}
.compact-ring-fill {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}
.compact-ring-fill.work { stroke: #3b82f6; }
.compact-ring-fill.shortBreak { stroke: #34d399; }
.compact-ring-fill.longBreak { stroke: #fbbf24; }
.compact-timer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'DIN Alternate', sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: var(--mo-text-1);
  line-height: 1;
}

/* ── 展开模式主体 ── */
.mini-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 模式 Tab */
.mini-tabs {
  display: flex;
  justify-content: center;
  gap: 4px;
}
.mini-tab {
  flex: 1;
  padding: 6px 0;
  border-radius: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--mo-text-3);
  background: var(--mo-surface);
  cursor: pointer;
  transition: all 0.15s;
}
.mini-tab:hover {
  background: var(--mo-surface-hover);
}
.mini-tab.active {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  color: #fff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.32);
}

/* 环形进度 */
.mini-timer {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}
.mini-timer.pulse {
  animation: miniPulse 0.5s ease-out 3;
}
@keyframes miniPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
.mini-ring {
  transform: rotate(-90deg);
}
.mini-ring-bg {
  fill: none;
  stroke: rgba(150, 158, 170, 0.12);
  stroke-width: 8;
}
.mini-ring-fill {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}
.mini-ring-fill.work { stroke: #3b82f6; }
.mini-ring-fill.shortBreak { stroke: #34d399; }
.mini-ring-fill.longBreak { stroke: #fbbf24; }

.mini-timer-center {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
.mini-timer-text {
  display: block;
  font-family: 'DIN Alternate', sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: var(--mo-text-1);
  line-height: 1;
  margin-bottom: 3px;
}
.mini-timer-text.flash {
  animation: miniFlash 0.5s ease-in-out infinite alternate;
}
@keyframes miniFlash {
  from { color: var(--mo-text-1); }
  to { color: #ef4444; }
}
.mini-timer-mode {
  font-size: 11px;
  color: var(--mo-text-3);
}

/* 控制按钮 */
.mini-controls {
  display: flex;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}
.mini-controls .el-button {
  --el-button-padding-y: 5px;
  padding-left: 10px;
  padding-right: 10px;
}

/* 科目选择 */
.mini-subjects {
  display: flex;
  justify-content: center;
  gap: 5px;
  flex-wrap: wrap;
}
.mini-subj {
  padding: 4px 8px;
  border-radius: 10px;
  font-size: 11px;
  border: 1px solid var(--mo-border);
  background: var(--mo-surface);
  color: var(--mo-text-2);
  cursor: pointer;
  transition: all 0.15s;
}
.mini-subj:hover { background: var(--mo-surface-hover); }
.mini-subj.active { color: #fff; }

/* 今日统计 */
.mini-stats {
  display: flex;
  justify-content: space-around;
  padding-top: 8px;
  border-top: 1px dashed var(--mo-border);
}
.mini-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.mini-stat-val {
  font-family: 'DIN Alternate', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--mo-text-1);
  line-height: 1;
}
.mini-stat-label {
  font-size: 10px;
  color: var(--mo-text-3);
}

/* ── 紧凑模式计时闪烁 ── */
.compact-timer.flash {
  animation: miniFlash 0.5s ease-in-out infinite alternate;
}

/* ── 进场/退场动画 ── */
.mini-scale-enter-active,
.mini-scale-leave-active {
  transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mini-scale-enter-from,
.mini-scale-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
</style>
