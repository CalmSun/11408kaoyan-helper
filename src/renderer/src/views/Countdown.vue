<template>
  <div class="countdown-page fade-in">
    <h1 class="page-title">考研倒计时</h1>
    <p class="page-subtitle">{{ store.examName }}</p>

    <!-- 主倒计时 -->
    <div class="main-countdown">
      <div class="countdown-ring">
        <svg class="progress-ring" width="280" height="280">
          <circle
            class="progress-ring-bg"
            cx="140"
            cy="140"
            r="125"
            fill="none"
            stroke="#ebeef5"
            stroke-width="12"
          />
          <circle
            class="progress-ring-fill"
            cx="140"
            cy="140"
            r="125"
            fill="none"
            stroke="url(#gradient)"
            stroke-width="12"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="progressOffset"
            transform="rotate(-90 140 140)"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#667eea" />
              <stop offset="100%" stop-color="#764ba2" />
            </linearGradient>
          </defs>
        </svg>
        <div class="countdown-center">
          <span class="countdown-days">{{ store.daysUntilExam }}</span>
          <span class="countdown-unit">天</span>
          <span class="countdown-label">距离考研</span>
        </div>
      </div>
    </div>

    <!-- 详细时间 -->
    <div class="time-detail">
      <div class="time-item">
        <span class="time-value">{{ timeParts.hours }}</span>
        <span class="time-label">时</span>
      </div>
      <div class="time-separator">:</div>
      <div class="time-item">
        <span class="time-value">{{ timeParts.minutes }}</span>
        <span class="time-label">分</span>
      </div>
      <div class="time-separator">:</div>
      <div class="time-item">
        <span class="time-value">{{ timeParts.seconds }}</span>
        <span class="time-label">秒</span>
      </div>
    </div>

    <!-- 考试信息卡片 -->
    <div class="info-cards">
      <div class="info-card">
        <div class="info-icon">
          <el-icon :size="24"><Calendar /></el-icon>
        </div>
        <div class="info-content">
          <span class="info-label">考试日期</span>
          <span class="info-value">{{ store.examDate }}</span>
        </div>
      </div>
      <div class="info-card">
        <div class="info-icon">
          <el-icon :size="24"><Trophy /></el-icon>
        </div>
        <div class="info-content">
          <span class="info-label">已坚持</span>
          <span class="info-value">{{ daysStudied }} 天</span>
        </div>
      </div>
      <div class="info-card">
        <div class="info-icon">
          <el-icon :size="24"><TrendCharts /></el-icon>
        </div>
        <div class="info-content">
          <span class="info-label">进度</span>
          <span class="info-value">{{ progressPercent }}%</span>
        </div>
      </div>
      <div class="info-card">
        <div class="info-icon">
          <el-icon :size="24"><Sunny /></el-icon>
        </div>
        <div class="info-content">
          <span class="info-label">星期</span>
          <span class="info-value">{{ examWeekDay }}</span>
        </div>
      </div>
    </div>

    <!-- 各科目复习建议 -->
    <div class="card subject-tips">
      <h3 class="card-title" style="margin-bottom: 20px;">
        <el-icon><Guide /></el-icon>
        各科目复习建议
      </h3>
      <div class="tips-grid">
        <div class="tip-item">
          <div class="tip-header">
            <span class="tip-dot" :style="{ background: store.SUBJECT_CONFIG.politics.color }"></span>
            <span class="tip-subject">政治</span>
          </div>
          <p class="tip-content">{{ getSubjectTip('politics') }}</p>
        </div>
        <div class="tip-item">
          <div class="tip-header">
            <span class="tip-dot" :style="{ background: store.SUBJECT_CONFIG.english.color }"></span>
            <span class="tip-subject">英语一</span>
          </div>
          <p class="tip-content">{{ getSubjectTip('english') }}</p>
        </div>
        <div class="tip-item">
          <div class="tip-header">
            <span class="tip-dot" :style="{ background: store.SUBJECT_CONFIG.math.color }"></span>
            <span class="tip-subject">数学一</span>
          </div>
          <p class="tip-content">{{ getSubjectTip('math') }}</p>
        </div>
        <div class="tip-item">
          <div class="tip-header">
            <span class="tip-dot" :style="{ background: store.SUBJECT_CONFIG.datastruct.color }"></span>
            <span class="tip-subject">数据结构</span>
          </div>
          <p class="tip-content">{{ getSubjectTip('datastruct') }}</p>
        </div>
        <div class="tip-item">
          <div class="tip-header">
            <span class="tip-dot" :style="{ background: store.SUBJECT_CONFIG.composition.color }"></span>
            <span class="tip-subject">组成原理</span>
          </div>
          <p class="tip-content">{{ getSubjectTip('composition') }}</p>
        </div>
        <div class="tip-item">
          <div class="tip-header">
            <span class="tip-dot" :style="{ background: store.SUBJECT_CONFIG.os.color }"></span>
            <span class="tip-subject">操作系统</span>
          </div>
          <p class="tip-content">{{ getSubjectTip('os') }}</p>
        </div>
        <div class="tip-item">
          <div class="tip-header">
            <span class="tip-dot" :style="{ background: store.SUBJECT_CONFIG.network.color }"></span>
            <span class="tip-subject">计算机网络</span>
          </div>
          <p class="tip-content">{{ getSubjectTip('network') }}</p>
        </div>
      </div>
    </div>

    <!-- 设置考试日期 -->
    <div class="card date-settings">
      <h3 class="card-title" style="margin-bottom: 20px;">
        <el-icon><Setting /></el-icon>
        考试设置
      </h3>
      <div class="settings-form">
        <el-form :model="form" label-width="100px" style="max-width: 500px;">
          <el-form-item label="考试名称">
            <el-input v-model="form.name" placeholder="请输入考试名称" />
          </el-form-item>
          <el-form-item label="考试日期">
            <el-date-picker
              v-model="form.date"
              type="date"
              placeholder="选择考试日期"
              value-format="YYYY-MM-DD"
              style="width: 100%;"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveSettings">保存设置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { useMainStore, SubjectType } from '@/stores'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import {
  Calendar,
  Trophy,
  TrendCharts,
  Sunny,
  Guide,
  Setting
} from '@element-plus/icons-vue'

const store = useMainStore()

const form = reactive({
  date: store.examDate,
  name: store.examName
})

const timeParts = ref({
  hours: '00',
  minutes: '00',
  seconds: '00'
})

let timer: number | null = null

const circumference = 2 * Math.PI * 125

const progressPercent = computed(() => {
  // 假设备考周期为一年
  const totalDays = 365
  const passed = totalDays - store.daysUntilExam
  const percent = Math.min(100, Math.max(0, (passed / totalDays) * 100))
  return Math.round(percent)
})

const progressOffset = computed(() => {
  return circumference * (1 - progressPercent.value / 100)
})

const examWeekDay = computed(() => {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[dayjs(store.examDate).day()]
})

const daysStudied = computed(() => {
  return store.dailyRecords.length
})

function updateTime() {
  const now = dayjs()
  const exam = dayjs(store.examDate).endOf('day')
  const diff = exam.diff(now)
  
  if (diff <= 0) {
    timeParts.value = { hours: '00', minutes: '00', seconds: '00' }
    return
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60) % 24)
  const minutes = Math.floor(diff / (1000 * 60) % 60)
  const seconds = Math.floor(diff / 1000 % 60)
  
  timeParts.value = {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0')
  }
}

function getSubjectTip(subject: SubjectType): string {
  const days = store.daysUntilExam
  const tips: Record<SubjectType, Record<string, string>> = {
    politics: {
      early: '现在可以先了解马原、毛中特的基本框架，不用死记硬背，重在理解。',
      mid: '开始系统学习知识点，配合1000题练习，重点关注选择题。',
      late: '集中背诵肖四肖八，时政也要跟上，大题模板要熟练。',
      final: '最后冲刺！肖四大题必须背熟，保持手感，调整心态。'
    },
    english: {
      early: '重点背单词！每天坚持背，词汇量是基础。可以开始做阅读真题了。',
      mid: '真题精读，每篇都要吃透。开始准备作文模板和翻译练习。',
      late: '真题二刷三刷，作文要动手写，完型新题型也不能丢。',
      final: '保持做题手感，作文模板背熟，单词再过一遍。'
    },
    math: {
      early: '打基础！教材+基础班视频，例题一定要自己做一遍。',
      mid: '强化阶段，660/880刷起来，注意总结题型和方法。',
      late: '真题+模拟卷，严格限时做，错题一定要搞懂。',
      final: '回顾错题和公式，保持计算手感，不要钻偏题怪题。'
    },
    datastruct: {
      early: '理解基本数据结构（线性表、栈队列、树、图），代码要动手写。',
      mid: '重点攻克算法题，排序查找、图的算法要熟练，多做真题。',
      late: '真题反复做，总结常考题型，算法代码要能默写。',
      final: '回顾核心算法和易错点，保持代码手感，重点知识再过一遍。'
    },
    composition: {
      early: '建立整体框架，理解各章节基本概念，存储系统是重点。',
      mid: '深入学习CPU、存储、指令系统，计算题要多练，注意细节。',
      late: '真题+大题专项训练，流水线、Cache、虚存是高频考点。',
      final: '查漏补缺，公式和概念再过一遍，保持做题手感。'
    },
    os: {
      early: '理解五大管理功能，进程同步、内存管理是重中之重。',
      mid: '重点攻克PV操作、页面置换、磁盘调度等经典算法。',
      late: '真题研究透，大题要动手写，注意答题规范和步骤。',
      final: '回顾核心概念和算法，错题再看一遍，保持状态。'
    },
    network: {
      early: '理解五层体系结构，每层的功能和协议要搞清楚。',
      mid: '重点掌握数据链路层、网络层、传输层，TCP/IP是核心。',
      late: '真题+计算题专项，CRC、拥塞控制、滑动窗口要熟练。',
      final: '各层协议再过一遍，重点公式和概念记牢，调整心态。'
    }
  }
  
  if (days > 180) return tips[subject].early
  if (days > 90) return tips[subject].mid
  if (days > 30) return tips[subject].late
  return tips[subject].final
}

function saveSettings() {
  if (!form.date) {
    ElMessage.warning('请选择考试日期')
    return
  }
  store.setExamDate(form.date, form.name)
  ElMessage.success('设置已保存')
}

onMounted(() => {
  updateTime()
  timer = window.setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.countdown-page {
  max-width: 900px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 14px;
  color: #909399;
  margin-bottom: 32px;
}

/* 主倒计时 */
.main-countdown {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.countdown-ring {
  position: relative;
  width: 280px;
  height: 280px;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-fill {
  transition: stroke-dashoffset 0.5s ease;
}

.countdown-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.countdown-days {
  font-size: 72px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-family: 'DIN Alternate', sans-serif;
  line-height: 1;
}

.countdown-unit {
  font-size: 18px;
  color: #606266;
  margin-top: 4px;
}

.countdown-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

/* 详细时间 */
.time-detail {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.time-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.time-value {
  font-size: 36px;
  font-weight: 700;
  color: #303133;
  font-family: 'DIN Alternate', sans-serif;
  min-width: 60px;
  text-align: center;
  background: #fff;
  padding: 8px 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.time-label {
  font-size: 12px;
  color: #909399;
}

.time-separator {
  font-size: 28px;
  font-weight: 700;
  color: #c0c4cc;
  margin-top: -20px;
}

/* 信息卡片 */
.info-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.info-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: #909399;
}

.info-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  font-family: 'DIN Alternate', sans-serif;
}

/* 复习建议 */
.subject-tips {
  margin-bottom: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.tips-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.tip-item {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 12px;
}

.tip-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.tip-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.tip-subject {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.tip-content {
  font-size: 13px;
  color: #606266;
  line-height: 1.7;
  margin: 0;
}

/* 设置区域 */
.date-settings {
  margin-bottom: 24px;
}

.settings-form {
  padding: 0 20px;
}
</style>
