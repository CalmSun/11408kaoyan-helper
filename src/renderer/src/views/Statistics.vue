<template>
  <div class="statistics-page fade-in">
    <h1 class="page-title">数据统计</h1>
    <p class="page-subtitle">记录你的每一份努力</p>

    <!-- 总览数据 -->
    <div class="overview-grid">
      <div class="overview-card">
        <div class="overview-icon icon-purple">
          <el-icon :size="28"><Timer /></el-icon>
        </div>
        <div class="overview-info">
          <span class="overview-value">{{ totalStudyHours }}</span>
          <span class="overview-label">总学习时长（小时）</span>
        </div>
      </div>
      <div class="overview-card">
        <div class="overview-icon icon-green">
          <el-icon :size="28"><Promotion /></el-icon>
        </div>
        <div class="overview-info">
          <span class="overview-value">{{ totalPomodoroCount }}</span>
          <span class="overview-label">总番茄数</span>
        </div>
      </div>
      <div class="overview-card">
        <div class="overview-icon icon-orange">
          <el-icon :size="28"><Collection /></el-icon>
        </div>
        <div class="overview-info">
          <span class="overview-value">{{ store.flashcards.length }}</span>
          <span class="overview-label">背诵卡片</span>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-grid">
      <!-- 学习时长趋势 -->
      <div class="card chart-card">
        <h3 class="chart-title">
          <el-icon><TrendCharts /></el-icon>
          近7天学习时长
        </h3>
        <div ref="studyChartRef" class="chart-container"></div>
      </div>

      <!-- 各科目分布 -->
      <div class="card chart-card">
        <h3 class="chart-title">
          <el-icon><PieChart /></el-icon>
          各科目学习占比
        </h3>
        <div ref="subjectChartRef" class="chart-container"></div>
      </div>
    </div>

    <div class="charts-grid">
      <!-- 番茄数统计 -->
      <div class="card chart-card">
        <h3 class="chart-title">
          <el-icon><Histogram /></el-icon>
          每日番茄数
        </h3>
        <div ref="pomodoroChartRef" class="chart-container"></div>
      </div>

      <!-- 各科目学习时长 -->
      <div class="card chart-card">
        <h3 class="chart-title">
          <el-icon><DataAnalysis /></el-icon>
          各科目学习时长
        </h3>
        <div ref="subjectHoursChartRef" class="chart-container"></div>
      </div>
    </div>

    <!-- 学习日历 -->
    <div class="card calendar-card">
      <h3 class="chart-title">
        <el-icon><Calendar /></el-icon>
        学习日历
      </h3>
      <div class="calendar-grid">
        <div
          v-for="day in calendarDays"
          :key="day.date"
          class="calendar-day"
          :class="day.level"
          :title="`${day.date}: 学习 ${day.minutes} 分钟`"
        >
        </div>
      </div>
      <div class="calendar-legend">
        <span>少</span>
        <div class="legend-level level-0"></div>
        <div class="legend-level level-1"></div>
        <div class="legend-level level-2"></div>
        <div class="legend-level level-3"></div>
        <div class="legend-level level-4"></div>
        <span>多</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useMainStore } from '@/stores'
import { isDark } from '@/utils/theme'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart as PieChartView } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import dayjs from 'dayjs'
import {
  Timer,
  Promotion,
  Collection,
  TrendCharts,
  PieChart,
  Histogram,
  DataAnalysis,
  Calendar
} from '@element-plus/icons-vue'

// 按需注册所需的图表与组件，减小打包体积
echarts.use([LineChart, BarChart, PieChartView, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const store = useMainStore()

const studyChartRef = ref<HTMLElement>()
const subjectChartRef = ref<HTMLElement>()
const pomodoroChartRef = ref<HTMLElement>()
const subjectHoursChartRef = ref<HTMLElement>()

let studyChart: echarts.ECharts | null = null
let subjectChart: echarts.ECharts | null = null
let pomodoroChart: echarts.ECharts | null = null
let subjectHoursChart: echarts.ECharts | null = null

const totalStudyHours = computed(() => {
  const minutes = store.pomodoroRecords.reduce((sum, r) => sum + r.duration, 0)
  return (minutes / 60).toFixed(1)
})

const totalPomodoroCount = computed(() => store.pomodoroRecords.length)

// 近7天数据
const last7Days = computed(() => {
  const days = []
  for (let i = 6; i >= 0; i--) {
    days.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))
  }
  return days
})

const studyMinutesByDay = computed(() => {
  return last7Days.value.map(date => {
    const dayRecords = store.pomodoroRecords.filter(r => r.date === date)
    return dayRecords.reduce((sum, r) => sum + r.duration, 0)
  })
})

const pomodoroCountByDay = computed(() => {
  return last7Days.value.map(date => {
    return store.pomodoroRecords.filter(r => r.date === date).length
  })
})

// 各科目学习时长
const subjectStudyData = computed(() => {
  const result: { name: string; value: number }[] = []
  
  Object.entries(store.SUBJECT_CONFIG).forEach(([key, config]) => {
    const minutes = store.subjectStudyMinutes[key as keyof typeof store.subjectStudyMinutes]
    if (minutes > 0) {
      result.push({
        name: config.name,
        value: Math.round(minutes / 60 * 10) / 10
      })
    }
  })
  
  return result
})

// 各科目颜色
const subjectColors = computed(() => {
  return Object.values(store.SUBJECT_CONFIG).map(c => c.color)
})

// 各科目学习时长（小时）
const subjectHoursData = computed(() => {
  const result: { name: string; value: number }[] = []

  Object.entries(store.SUBJECT_CONFIG).forEach(([key, config]) => {
    const minutes = store.subjectStudyMinutes[key as keyof typeof store.subjectStudyMinutes]
    result.push({
      name: config.shortName,
      value: Math.round(minutes / 60 * 10) / 10
    })
  })

  return result
})

// 学习日历（近90天）
const calendarDays = computed(() => {
  const days = []
  const today = dayjs()
  
  for (let i = 89; i >= 0; i--) {
    const date = today.subtract(i, 'day').format('YYYY-MM-DD')
    const dayRecords = store.pomodoroRecords.filter(r => r.date === date)
    const minutes = dayRecords.reduce((sum, r) => sum + r.duration, 0)
    
    let level = 'level-0'
    if (minutes > 0 && minutes < 60) level = 'level-1'
    else if (minutes >= 60 && minutes < 120) level = 'level-2'
    else if (minutes >= 120 && minutes < 240) level = 'level-3'
    else if (minutes >= 240) level = 'level-4'
    
    days.push({ date, minutes, level })
  }
  
  return days
})

// --- 图表初始化与更新（使用 setOption 复用实例，避免内存泄漏）---

// 图表主题配色：随深浅主题切换，保证坐标轴与网格线可读
const chartColors = computed(() => ({
  axisLine: isDark.value ? 'rgba(255, 255, 255, 0.18)' : '#d8dde2',
  axisLabel: isDark.value ? '#8b95a5' : '#9aa0a8',
  splitLine: isDark.value ? 'rgba(255, 255, 255, 0.08)' : '#e2e6e9',
  legendText: isDark.value ? '#a9b2c1' : '#7d8289',
  pieBorder: isDark.value ? '#171e2c' : '#fff'
}))

function getStudyOption(): EChartsOption {
  return {
    tooltip: {
      trigger: 'axis',
      formatter: '{b}<br/>学习时长: {c} 分钟'
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: last7Days.value.map(d => dayjs(d).format('MM-DD')),
      axisLine: { lineStyle: { color: chartColors.value.axisLine } },
      axisLabel: { color: chartColors.value.axisLabel }
    },
    yAxis: {
      type: 'value',
      name: '分钟',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: chartColors.value.splitLine } },
      axisLabel: { color: chartColors.value.axisLabel }
    },
    series: [{
      data: studyMinutesByDay.value,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        width: 3,
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#3b82f6' },
          { offset: 1, color: '#60a5fa' }
        ])
      },
      itemStyle: { color: '#3b82f6', borderColor: '#fff', borderWidth: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(138, 155, 181, 0.3)' },
          { offset: 1, color: 'rgba(138, 155, 181, 0.05)' }
        ])
      }
    }]
  }
}

function getSubjectOption(): EChartsOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 小时 ({d}%)' },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: chartColors.value.legendText }
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: chartColors.value.pieBorder, borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      labelLine: { show: false },
      data: subjectStudyData.value,
      color: subjectColors.value
    }]
  }
}

function getPomodoroOption(): EChartsOption {
  return {
    tooltip: { trigger: 'axis', formatter: '{b}<br/>番茄数: {c} 个' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: last7Days.value.map(d => dayjs(d).format('MM-DD')),
      axisLine: { lineStyle: { color: chartColors.value.axisLine } },
      axisLabel: { color: chartColors.value.axisLabel }
    },
    yAxis: {
      type: 'value',
      name: '个',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: chartColors.value.splitLine } },
      axisLabel: { color: chartColors.value.axisLabel }
    },
    series: [{
      data: pomodoroCountByDay.value,
      type: 'bar',
      barWidth: '50%',
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#84fab0' },
          { offset: 1, color: '#8fd3f4' }
        ])
      }
    }]
  }
}

function getSubjectHoursOption(): EChartsOption {
  return {
    tooltip: { trigger: 'axis', formatter: '{b}<br/>学习时长: {c} 小时' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: subjectHoursData.value.map(d => d.name),
      axisLine: { lineStyle: { color: chartColors.value.axisLine } },
      axisLabel: { color: chartColors.value.axisLabel, rotate: 30 }
    },
    yAxis: {
      type: 'value',
      name: '小时',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: chartColors.value.splitLine } },
      axisLabel: { color: chartColors.value.axisLabel }
    },
    series: [{
      data: subjectHoursData.value.map(d => d.value),
      type: 'bar',
      barWidth: '40%',
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#3b82f6' },
          { offset: 1, color: '#60a5fa' }
        ])
      }
    }]
  }
}

/** 初始化或更新图表：已有实例则 setOption，否则 init */
function updateChart(
  refEl: HTMLElement | undefined,
  instance: echarts.ECharts | null,
  setInstance: (c: echarts.ECharts) => void,
  option: EChartsOption
) {
  if (!refEl) return
  if (!instance) {
    const chart = echarts.init(refEl)
    chart.setOption(option)
    setInstance(chart)
  } else {
    instance.setOption(option, { notMerge: true })
  }
}

function updateAllCharts() {
  nextTick(() => {
    updateChart(studyChartRef.value, studyChart, c => { studyChart = c }, getStudyOption())
    updateChart(subjectChartRef.value, subjectChart, c => { subjectChart = c }, getSubjectOption())
    updateChart(pomodoroChartRef.value, pomodoroChart, c => { pomodoroChart = c }, getPomodoroOption())
    updateChart(subjectHoursChartRef.value, subjectHoursChart, c => { subjectHoursChart = c }, getSubjectHoursOption())
  })
}

function resizeCharts() {
  studyChart?.resize()
  subjectChart?.resize()
  pomodoroChart?.resize()
  subjectHoursChart?.resize()
}

onMounted(() => {
  updateAllCharts()
  window.addEventListener('resize', resizeCharts)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCharts)
  studyChart?.dispose()
  subjectChart?.dispose()
  pomodoroChart?.dispose()
  subjectHoursChart?.dispose()
  studyChart = null
  subjectChart = null
  pomodoroChart = null
  subjectHoursChart = null
})

// 监听数据变化，使用 setOption 更新而非重新 init
watch(() => store.pomodoroRecords.length, () => {
  updateAllCharts()
})

// 主题切换时刷新图表配色
watch(isDark, () => {
  updateAllCharts()
})
</script>

<style scoped>
.statistics-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--mo-text-3);
  margin-bottom: 24px;
}

/* 总览卡片 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.overview-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.overview-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.overview-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.overview-icon.icon-purple {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
}

.overview-icon.icon-green {
  background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
}

.overview-icon.icon-orange {
  background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
}

.overview-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overview-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--mo-text-1);
  font-family: 'DIN Alternate', 'Menlo', 'Consolas', monospace;
  line-height: 1;
}

.overview-label {
  font-size: 13px;
  color: var(--mo-text-3);
}

/* 图表网格 */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  padding: 20px 24px;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--mo-text-1);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 20px 0;
}

.chart-container {
  width: 100%;
  height: 280px;
}

/* 学习日历 */
.calendar-card {
  padding: 24px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  gap: 6px;
  margin-bottom: 16px;
}

.calendar-day {
  aspect-ratio: 1;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.06);
  transition: transform 0.2s ease;
}

.calendar-day:hover {
  transform: scale(1.2);
}

.calendar-day.level-0 { background: rgba(59, 130, 246, 0.06); }
.calendar-day.level-1 { background: rgba(59, 130, 246, 0.25); }
.calendar-day.level-2 { background: rgba(59, 130, 246, 0.45); }
.calendar-day.level-3 { background: rgba(59, 130, 246, 0.65); }
.calendar-day.level-4 { background: rgba(59, 130, 246, 0.85); }

.calendar-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  font-size: 12px;
  color: var(--mo-text-3);
}

.legend-level {
  width: 14px;
  height: 14px;
  border-radius: 3px;
}

.legend-level.level-0 { background: rgba(59, 130, 246, 0.06); }
.legend-level.level-1 { background: rgba(59, 130, 246, 0.25); }
.legend-level.level-2 { background: rgba(59, 130, 246, 0.45); }
.legend-level.level-3 { background: rgba(59, 130, 246, 0.65); }
.legend-level.level-4 { background: rgba(59, 130, 246, 0.85); }
</style>
