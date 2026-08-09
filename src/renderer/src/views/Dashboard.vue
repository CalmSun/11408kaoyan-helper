<template>
  <div class="dashboard fade-in">
    <!-- 欢迎区域 -->
    <div class="welcome-section">
      <div class="welcome-left">
        <h1 class="welcome-title">{{ greeting }}，考研人 📚</h1>
        <p class="welcome-subtitle">{{ todayStr }} · {{ weekDay }}</p>
      </div>
      <div class="welcome-right">
        <div class="exam-badge">
          <span class="badge-label">距离考研还有</span>
          <span class="badge-days">{{ store.daysUntilExam }}</span>
          <span class="badge-unit">天</span>
        </div>
      </div>
    </div>

    <!-- 数据概览卡片 -->
    <div class="stats-grid">
      <div class="stat-card stat-card-primary">
        <div class="stat-icon">
          <el-icon :size="28"><Timer /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ store.todayStudyMinutes }}</span>
          <span class="stat-label">今日学习（分钟）</span>
        </div>
      </div>
      <div class="stat-card stat-card-success">
        <div class="stat-icon">
          <el-icon :size="28"><Promotion /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ store.todayPomodoroCount }}</span>
          <span class="stat-label">今日番茄数</span>
        </div>
      </div>
      <div class="stat-card stat-card-warning">
        <div class="stat-icon">
          <el-icon :size="28"><List /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ store.todayPlanCompleted }}/{{ store.todayPlanTotal }}</span>
          <span class="stat-label">今日计划完成</span>
        </div>
      </div>
      <div class="stat-card stat-card-danger">
        <div class="stat-icon">
          <el-icon :size="28"><Clock /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ store.totalStudyHours }}</span>
          <span class="stat-label">累计学习（小时）</span>
        </div>
      </div>
    </div>

    <!-- 下方两栏 -->
    <div class="content-grid">
      <!-- 今日计划 -->
      <div class="card plan-card">
        <div class="card-header">
          <h3 class="card-title">
            <el-icon><List /></el-icon>
            今日计划
          </h3>
          <el-button type="primary" link @click="goToPlan">
            查看全部 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
        <div class="plan-list" v-if="todayPlans.length > 0">
          <div
            v-for="plan in todayPlans.slice(0, 5)"
            :key="plan.id"
            class="plan-item"
            :class="{ completed: isPlanCompletedToday(plan) }"
          >
            <el-checkbox :model-value="isPlanCompletedToday(plan)" @change="togglePlan(plan.id)" />
            <span class="plan-title">{{ plan.title }}</span>
            <el-tag
              v-if="plan.subject"
              :color="store.SUBJECT_CONFIG[plan.subject].color"
              style="color: #fff; border: none;"
              size="small"
            >
              {{ store.SUBJECT_CONFIG[plan.subject].shortName }}
            </el-tag>
          </div>
        </div>
        <div class="empty-state" v-else>
          <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
          <p>今天还没有计划，去添加一个吧~</p>
          <el-button type="primary" @click="goToPlan">添加计划</el-button>
        </div>
      </div>

      <!-- 各科目学习时长 -->
      <div class="card study-hours-card">
        <div class="card-header">
          <h3 class="card-title">
            <el-icon><Clock /></el-icon>
            各科学习时长
          </h3>
          <el-button type="primary" link @click="goToStatistics">
            统计详情 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
        <div class="study-stats">
          <div
            v-for="(config, key) in store.SUBJECT_CONFIG"
            :key="key"
            class="study-stat-item"
          >
            <div class="stat-header">
              <span class="subject-dot" :style="{ background: config.color }"></span>
              <span class="subject-name">{{ config.name }}</span>
              <span class="subject-count">{{ formatHours(store.subjectStudyMinutes[key as SubjectType]) }} h</span>
            </div>
            <el-progress
              :percentage="getStudyPercentage(key as SubjectType)"
              :show-text="false"
              :color="config.color"
              :stroke-width="8"
            />
          </div>
        </div>
        <div class="study-summary">
          <span>累计学习 <strong>{{ store.totalStudyHours }}</strong> 小时</span>
          <span>今日学习 <strong>{{ store.todayStudyMinutes }}</strong> 分钟</span>
        </div>
      </div>
    </div>

    <!-- 快捷入口 -->
    <div class="card quick-access">
      <h3 class="card-title" style="margin-bottom: 20px;">
        <el-icon><Lightning /></el-icon>
        快捷入口
      </h3>
      <div class="quick-grid">
        <div class="quick-item" @click="goToOutline">
          <div class="quick-icon outline-icon">
            <el-icon :size="32"><Guide /></el-icon>
          </div>
          <span>知识大纲</span>
        </div>
        <div class="quick-item" @click="goToAlgorithms">
          <div class="quick-icon algo-icon">
            <el-icon :size="32"><Cpu /></el-icon>
          </div>
          <span>算法模板</span>
        </div>
        <div class="quick-item" @click="goToFormulas">
          <div class="quick-icon formula-icon">
            <el-icon :size="32"><Operation /></el-icon>
          </div>
          <span>公式速查</span>
        </div>
        <div class="quick-item" @click="goToPomodoro">
          <div class="quick-icon pomodoro-icon">
            <el-icon :size="32"><Timer /></el-icon>
          </div>
          <span>番茄钟</span>
        </div>
        <div class="quick-item" @click="goToExamScores">
          <div class="quick-icon exam-icon">
            <el-icon :size="32"><DataAnalysis /></el-icon>
          </div>
          <span>真题成绩</span>
        </div>
        <div class="quick-item" @click="goToFlashcards">
          <div class="quick-icon flashcard-icon">
            <el-icon :size="32"><Collection /></el-icon>
          </div>
          <span>背诵卡片</span>
        </div>
        <div class="quick-item" @click="goToDictionary">
          <div class="quick-icon dict-icon">
            <el-icon :size="32"><Reading /></el-icon>
          </div>
          <span>单词词典</span>
        </div>
        <div class="quick-item" @click="goToPlan">
          <div class="quick-icon plan-icon">
            <el-icon :size="32"><List /></el-icon>
          </div>
          <span>每日计划</span>
        </div>
        <div class="quick-item" @click="goToStatistics">
          <div class="quick-icon stat-icon">
            <el-icon :size="32"><DataLine /></el-icon>
          </div>
          <span>学习统计</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore, SubjectType } from '@/stores'
import dayjs from 'dayjs'
import {
  Timer,
  Promotion,
  List,
  Clock,
  ArrowRight,
  Document,
  Lightning,
  Collection,
  Reading,
  DataLine,
  DataAnalysis,
  Guide,
  Cpu,
  Operation
} from '@element-plus/icons-vue'

const router = useRouter()
const store = useMainStore()

const greeting = computed(() => {
  const hour = dayjs().hour()
  if (hour < 6) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  if (hour < 22) return '晚上好'
  return '夜深了'
})

const todayStr = computed(() => dayjs().format('YYYY年MM月DD日'))
const weekDay = computed(() => {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return days[dayjs().day()]
})

const todayPlans = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  // 显示循环计划 + 今天创建的计划
  return store.plans.filter(p => {
    if (p.recurring) return true
    return p.createdAt.startsWith(today)
  })
})

// 计算某科目学习时长占全部学习时长的百分比
function getStudyPercentage(subject: SubjectType) {
  const total = Object.values(store.subjectStudyMinutes).reduce((sum, m) => sum + m, 0)
  if (total === 0) return 0
  return Math.round((store.subjectStudyMinutes[subject] / total) * 100)
}

// 分钟转小时显示
function formatHours(minutes: number) {
  return (minutes / 60).toFixed(1)
}

function togglePlan(id: string) {
  store.togglePlan(id)
}

function isPlanCompletedToday(plan: any): boolean {
  if (plan.recurring) {
    const today = dayjs().format('YYYY-MM-DD')
    return plan.completedDates?.includes(today) || false
  }
  return plan.completed
}

function goToPlan() { router.push('/plan') }
function goToExamScores() { router.push('/examscores') }
function goToPomodoro() { router.push('/pomodoro') }
function goToFlashcards() { router.push('/flashcards') }
function goToDictionary() { router.push('/dictionary') }
function goToStatistics() { router.push('/statistics') }
function goToOutline() { router.push('/outline') }
function goToAlgorithms() { router.push('/algorithms') }
function goToFormulas() { router.push('/formulas') }
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

/* 欢迎区域 */
.welcome-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.welcome-title {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 6px;
}

.welcome-subtitle {
  font-size: 14px;
  color: #909399;
}

.exam-badge {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 16px 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: #fff;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.badge-label {
  font-size: 13px;
  opacity: 0.9;
}

.badge-days {
  font-size: 36px;
  font-weight: 700;
  font-family: 'DIN Alternate', sans-serif;
  line-height: 1;
}

.badge-unit {
  font-size: 16px;
  opacity: 0.9;
}

/* 数据卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.stat-card-primary .stat-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-card-success .stat-icon {
  background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
}

.stat-card-warning .stat-icon {
  background: linear-gradient(135deg, #fccb90 0%, #d57eeb 100%);
}

.stat-card-danger .stat-icon {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  font-family: 'DIN Alternate', sans-serif;
  line-height: 1;
}

.stat-label {
  font-size: 13px;
  color: #909399;
}

/* 内容网格 */
.content-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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

/* 计划列表 */
.plan-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.plan-item:hover {
  background: #ebeef5;
}

.plan-item.completed .plan-title {
  text-decoration: line-through;
  color: #c0c4cc;
}

.plan-title {
  flex: 1;
  font-size: 14px;
  color: #303133;
}

/* 各科学习时长 */
.study-stats {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.study-stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.subject-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.subject-dot.politics { background: #f56c6c; }
.subject-dot.english { background: #67c23a; }
.subject-dot.math { background: #e6a23c; }
.subject-dot.professional { background: #909399; }

.subject-name {
  font-size: 14px;
  color: #606266;
  flex: 1;
}

.subject-count {
  font-size: 13px;
  color: #909399;
}

.study-summary {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  font-size: 13px;
  color: #606266;
}

.study-summary strong {
  color: #667eea;
  font-size: 16px;
  font-family: 'DIN Alternate', sans-serif;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
  color: #909399;
  font-size: 14px;
}

/* 快捷入口 */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 12px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  color: #606266;
}

.quick-item:hover {
  background: #f5f7fa;
  transform: translateY(-2px);
}

.quick-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.outline-icon { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.algo-icon { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.formula-icon { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
.pomodoro-icon { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
.exam-icon { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
.flashcard-icon { background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%); }
.dict-icon { background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); }
.plan-icon { background: linear-gradient(135deg, #fccb90 0%, #d57eeb 100%); }
.stat-icon { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
</style>
