<template>
  <div class="plan-page fade-in">
    <div class="page-header">
      <div>
        <h1 class="page-title">每日计划</h1>
        <p class="page-subtitle">{{ todayStr }} · 已完成 {{ completedCount }}/{{ totalCount }} 项</p>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-card">
      <div class="progress-info">
        <span>今日完成进度</span>
        <span class="progress-percent">{{ progressPercent }}%</span>
      </div>
      <el-progress
        :percentage="progressPercent"
        :show-text="false"
        color="url(#progressGradient)"
        :stroke-width="12"
      />
      <svg width="0" height="0">
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#667eea" />
            <stop offset="100%" stop-color="#764ba2" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <!-- 添加计划 -->
    <div class="add-plan-card">
      <el-input
        v-model="newPlanTitle"
        placeholder="添加新的学习计划..."
        size="large"
        @keyup.enter="handleAdd"
      >
        <template #prefix>
          <el-icon><Plus /></el-icon>
        </template>
        <template #append>
          <el-select v-model="newPlanSubject" placeholder="科目" style="width: 110px;">
            <el-option
              v-for="(config, key) in store.SUBJECT_CONFIG"
              :key="key"
              :label="config.shortName"
              :value="key"
            />
            <el-option label="其他" value="" />
          </el-select>
          <el-button type="primary" @click="handleAdd">添加</el-button>
        </template>
      </el-input>
    </div>

    <!-- 计划列表 -->
    <div class="plan-list-card">
      <div class="list-header">
        <h3 class="list-title">
          <el-icon><List /></el-icon>
          今日计划
        </h3>
        <div class="list-actions">
          <el-button
            type="primary"
            link
            size="small"
            @click="completeAll"
            v-if="completedCount < totalCount"
          >
            全部完成
          </el-button>
          <el-button
            type="danger"
            link
            size="small"
            @click="clearCompleted"
            v-if="completedCount > 0"
          >
            清除已完成
          </el-button>
        </div>
      </div>

      <div class="plan-list" v-if="todayPlans.length > 0">
        <div
          v-for="plan in todayPlans"
          :key="plan.id"
          class="plan-item"
          :class="{ completed: plan.completed }"
        >
          <el-checkbox
            :model-value="plan.completed"
            @change="togglePlan(plan.id)"
          />
          <span class="plan-title">{{ plan.title }}</span>
          <el-tag
            v-if="plan.subject"
            :color="store.SUBJECT_CONFIG[plan.subject].color"
            style="color: #fff; border: none;"
            size="small"
          >
            {{ store.SUBJECT_CONFIG[plan.subject].shortName }}
          </el-tag>
          <span class="plan-time" v-if="plan.completed && plan.completedAt">
            {{ formatTime(plan.completedAt) }}
          </span>
          <el-button
            type="danger"
            link
            size="small"
            class="delete-btn"
            @click="deletePlan(plan.id)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>

      <div class="empty-state" v-else>
        <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
        <p>今天还没有计划，添加一个开始学习吧~</p>
      </div>
    </div>

    <!-- 历史计划 -->
    <div class="history-card">
      <div class="history-header" @click="showHistory = !showHistory">
        <h3 class="history-title">
          <el-icon><Clock /></el-icon>
          历史记录
        </h3>
        <el-icon :class="{ rotated: showHistory }">
          <ArrowDown />
        </el-icon>
      </div>
      <div class="history-content" v-show="showHistory">
        <div v-if="historyDays.length > 0" class="history-days">
          <div v-for="day in historyDays" :key="day.date" class="history-day">
            <div class="day-header">
              <span class="day-date">{{ day.date }}</span>
              <span class="day-stats">
                完成 {{ day.completed }}/{{ day.total }}
              </span>
            </div>
            <div class="day-plans">
              <div
                v-for="plan in day.plans"
                :key="plan.id"
                class="history-plan-item"
                :class="{ completed: plan.completed }"
              >
                <el-icon v-if="plan.completed" color="#67c23a"><Check /></el-icon>
                <el-icon v-else color="#c0c4cc"><Close /></el-icon>
                <span>{{ plan.title }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="empty-state" v-else>
          <p style="color: #909399; margin: 0;">暂无历史记录</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useMainStore, SubjectType, PlanItem } from '@/stores'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  Plus,
  List,
  Delete,
  Document,
  Clock,
  ArrowDown,
  Check,
  Close
} from '@element-plus/icons-vue'

const store = useMainStore()

const newPlanTitle = ref('')
const newPlanSubject = ref<SubjectType | ''>('')
const showHistory = ref(false)

const todayStr = computed(() => dayjs().format('YYYY年MM月DD日'))

const todayPlans = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  return store.plans.filter(p => p.createdAt.startsWith(today))
})

const completedCount = computed(() => todayPlans.value.filter(p => p.completed).length)
const totalCount = computed(() => todayPlans.value.length)
const progressPercent = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((completedCount.value / totalCount.value) * 100)
})

// 历史记录（按日期分组）
const historyDays = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  const historyPlans = store.plans.filter(p => !p.createdAt.startsWith(today))
  
  const dayMap = new Map<string, PlanItem[]>()
  historyPlans.forEach(plan => {
    const date = plan.createdAt.slice(0, 10)
    if (!dayMap.has(date)) {
      dayMap.set(date, [])
    }
    dayMap.get(date)!.push(plan)
  })
  
  const days = Array.from(dayMap.entries()).map(([date, plans]) => ({
    date,
    plans,
    completed: plans.filter(p => p.completed).length,
    total: plans.length
  }))
  
  return days.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
})

function formatTime(dateStr: string) {
  return dayjs(dateStr).format('HH:mm')
}

function handleAdd() {
  if (!newPlanTitle.value.trim()) {
    ElMessage.warning('请输入计划内容')
    return
  }
  store.addPlan(
    newPlanTitle.value.trim(),
    newPlanSubject.value || undefined
  )
  newPlanTitle.value = ''
  ElMessage.success('添加成功')
}

function togglePlan(id: string) {
  store.togglePlan(id)
}

function deletePlan(id: string) {
  store.deletePlan(id)
}

function completeAll() {
  todayPlans.value.forEach(plan => {
    if (!plan.completed) {
      store.togglePlan(plan.id)
    }
  })
  ElMessage.success('全部完成！太棒了 🎉')
}

function clearCompleted() {
  ElMessageBox.confirm('确定要清除已完成的计划吗？', '提示', {
    confirmButtonText: '清除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const today = dayjs().format('YYYY-MM-DD')
    const completedIds = store.plans
      .filter(p => p.completed && p.createdAt.startsWith(today))
      .map(p => p.id)
    completedIds.forEach(id => store.deletePlan(id))
    ElMessage.success('已清除')
  }).catch(() => {})
}
</script>

<style scoped>
.plan-page {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
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
  margin: 0;
}

/* 进度卡片 */
.progress-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
  color: #606266;
}

.progress-percent {
  font-size: 20px;
  font-weight: 700;
  color: #667eea;
  font-family: 'DIN Alternate', sans-serif;
}

/* 添加计划 */
.add-plan-card {
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

/* 计划列表 */
.plan-list-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.list-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.list-actions {
  display: flex;
  gap: 8px;
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #f5f7fa;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.plan-item:hover {
  background: #ebeef5;
}

.plan-item.completed {
  opacity: 0.7;
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

.plan-time {
  font-size: 12px;
  color: #67c23a;
  font-family: 'DIN Alternate', sans-serif;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.plan-item:hover .delete-btn {
  opacity: 1;
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

/* 历史记录 */
.history-card {
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.history-header:hover {
  background: #f5f7fa;
}

.history-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.history-header .el-icon {
  transition: transform 0.3s ease;
  color: #909399;
}

.history-header .el-icon.rotated {
  transform: rotate(180deg);
}

.history-content {
  padding: 0 24px 20px;
  border-top: 1px solid #ebeef5;
}

.history-days {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}

.history-day {
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 10px;
}

.day-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13px;
}

.day-date {
  color: #606266;
  font-weight: 500;
}

.day-stats {
  color: #909399;
}

.day-plans {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-plan-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.history-plan-item.completed {
  color: #67c23a;
  text-decoration: line-through;
}
</style>
