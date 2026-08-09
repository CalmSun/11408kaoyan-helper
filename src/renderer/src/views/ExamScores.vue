<template>
  <div class="exam-scores-page fade-in">
    <div class="page-header">
      <div>
        <h1 class="page-title">真题成绩</h1>
        <p class="page-subtitle">记录历年（2009-2026）真题分数，追踪各科进步轨迹</p>
      </div>
      <el-button type="primary" @click="openAddDialog">
        <el-icon><Plus /></el-icon>
        录入分数
      </el-button>
    </div>

    <!-- 各科汇总卡片 -->
    <div class="subject-summary-grid">
      <div
        v-for="subject in subjectList"
        :key="subject.key"
        class="summary-card"
        :style="{ borderTopColor: subject.color }"
      >
        <div class="summary-header">
          <span class="summary-name" :style="{ color: subject.color }">{{ subject.name }}</span>
          <el-tag size="small" :color="subject.color" style="color:#fff;border:none;">满分 {{ subject.fullScore }}</el-tag>
        </div>
        <div class="summary-stats" v-if="getSubjectStats(subject.key)">
          <div class="stat-cell">
            <span class="stat-num" :style="{ color: subject.color }">{{ getSubjectStats(subject.key)!.avg }}</span>
            <span class="stat-txt">平均分</span>
          </div>
          <div class="stat-cell">
            <span class="stat-num">{{ getSubjectStats(subject.key)!.max }}</span>
            <span class="stat-txt">最高分</span>
          </div>
          <div class="stat-cell">
            <span class="stat-num">{{ getSubjectStats(subject.key)!.count }}</span>
            <span class="stat-txt">已练年份</span>
          </div>
        </div>
        <div class="summary-stats" v-else>
          <span class="no-data">暂无记录</span>
        </div>
      </div>
    </div>

    <!-- 总分趋势图 -->
    <div class="card chart-card">
      <div class="card-header">
        <h3 class="card-title">
          <el-icon><TrendCharts /></el-icon>
          各科历年真题分数趋势（2009-2026）
        </h3>
      </div>
      <div ref="trendChartRef" class="chart-container"></div>
    </div>

    <!-- 记录列表 -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">
          <el-icon><List /></el-icon>
          分数记录
        </h3>
        <el-select v-model="filterSubject" placeholder="按科目筛选" clearable style="width: 160px;">
          <el-option label="全部科目" value="" />
          <el-option
            v-for="subject in subjectList"
            :key="subject.key"
            :label="subject.name"
            :value="subject.key"
          />
        </el-select>
      </div>

      <el-table :data="filteredRecords" stripe style="width: 100%;" empty-text="暂无记录，点击右上角「录入分数」添加">
        <el-table-column prop="year" label="年份" width="90" sortable>
          <template #default="{ row }">{{ row.year }}</template>
        </el-table-column>
        <el-table-column label="科目" width="140">
          <template #default="{ row }">
            <el-tag :color="getSubjectColor(row.subject)" style="color:#fff;border:none;" size="small">
              {{ getSubjectName(row.subject) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="得分" width="110">
          <template #default="{ row }">
            <span class="score-text">{{ row.score }}</span>
            <span class="full-score-text"> / {{ row.fullScore }}</span>
          </template>
        </el-table-column>
        <el-table-column label="得分率" width="180">
          <template #default="{ row }">
            <el-progress
              :percentage="getScoreRate(row)"
              :color="getScoreColor(getScoreRate(row))"
              :stroke-width="10"
            />
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column label="录入时间" width="110">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 录入/编辑弹窗 -->
    <el-dialog v-model="showDialog" :title="isEditing ? '编辑分数' : '录入分数'" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="科目" required>
          <el-select v-model="form.subject" placeholder="选择科目" style="width: 100%;">
            <el-option
              v-for="subject in subjectList"
              :key="subject.key"
              :label="`${subject.name}（满分 ${subject.fullScore}）`"
              :value="subject.key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="年份" required>
          <el-select v-model="form.year" placeholder="选择年份" style="width: 100%;">
            <el-option
              v-for="year in yearOptions"
              :key="year"
              :label="`${year} 年`"
              :value="year"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="得分" required>
          <el-input-number
            v-model="form.score"
            :min="0"
            :max="getMaxScore(form.subject)"
            :step="1"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="选填，如：选择题错5个" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useMainStore, ExamScoreRecord, SubjectType, SUBJECT_FULL_SCORE } from '@/stores'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { Plus, TrendCharts, List, Edit, Delete } from '@element-plus/icons-vue'

const store = useMainStore()

// 科目列表（来自 store 配置）
const subjectList = computed(() =>
  (Object.keys(store.SUBJECT_CONFIG) as SubjectType[]).map(key => ({
    key,
    name: store.SUBJECT_CONFIG[key].name,
    color: store.SUBJECT_CONFIG[key].color,
    fullScore: SUBJECT_FULL_SCORE[key]
  }))
)

// 年份 2009-2026（倒序，最近的年份在前）
const yearOptions = computed(() => {
  const years = []
  for (let y = 2026; y >= 2009; y--) {
    years.push(y)
  }
  return years
})

// 弹窗状态
const showDialog = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const filterSubject = ref<SubjectType | ''>('')

const form = reactive({
  subject: 'politics' as SubjectType,
  year: 2026,
  score: 0,
  remark: ''
})

// 趋势图
const trendChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null

const filteredRecords = computed(() => {
  let list = store.examScores
  if (filterSubject.value) {
    list = list.filter(r => r.subject === filterSubject.value)
  }
  return list.slice().sort((a, b) => a.year - b.year)
})

// 各科统计（平均分/最高分/已练年份数）
function getSubjectStats(subject: SubjectType) {
  const records = store.examScores.filter(r => r.subject === subject)
  if (records.length === 0) return null
  const scores = records.map(r => r.score)
  const sum = scores.reduce((a, b) => a + b, 0)
  return {
    avg: (sum / scores.length).toFixed(1),
    max: Math.max(...scores),
    min: Math.min(...scores),
    count: records.length
  }
}



function getSubjectColor(subject: SubjectType) {
  return store.SUBJECT_CONFIG[subject]?.color || '#667eea'
}

function getSubjectName(subject: SubjectType) {
  return store.SUBJECT_CONFIG[subject]?.name || subject
}

function getMaxScore(subject: SubjectType) {
  return SUBJECT_FULL_SCORE[subject] || 100
}

function getScoreRate(row: ExamScoreRecord) {
  return Math.round((row.score / row.fullScore) * 100)
}

function getScoreColor(rate: number) {
  if (rate >= 80) return '#67c23a'
  if (rate >= 60) return '#e6a23c'
  return '#f56c6c'
}

function formatDate(dateStr: string) {
  return dayjs(dateStr).format('YYYY-MM-DD')
}

function openAddDialog() {
  isEditing.value = false
  editingId.value = ''
  form.subject = 'politics'
  form.year = yearOptions.value[0]
  form.score = 0
  form.remark = ''
  showDialog.value = true
}

function openEditDialog(row: ExamScoreRecord) {
  isEditing.value = true
  editingId.value = row.id
  form.subject = row.subject
  form.year = row.year
  form.score = row.score
  form.remark = row.remark || ''
  showDialog.value = true
}

function handleSubmit() {
  if (!form.subject) {
    ElMessage.warning('请选择科目')
    return
  }
  if (!form.year) {
    ElMessage.warning('请选择年份')
    return
  }
  const maxScore = getMaxScore(form.subject)
  if (form.score < 0 || form.score > maxScore) {
    ElMessage.warning(`得分需在 0-${maxScore} 之间`)
    return
  }

  // 检查重复：同科目同年份已有记录
  const duplicate = store.examScores.find(r => r.subject === form.subject && r.year === form.year && r.id !== editingId.value)
  if (duplicate) {
    ElMessage.warning(`${form.year} 年 ${getSubjectName(form.subject)} 已有记录，请直接编辑该记录`)
    return
  }

  if (isEditing.value) {
    store.updateExamScore(editingId.value, {
      subject: form.subject,
      year: form.year,
      score: form.score,
      fullScore: maxScore,
      remark: form.remark
    })
    ElMessage.success('分数已更新')
  } else {
    store.addExamScore({
      subject: form.subject,
      year: form.year,
      score: form.score,
      remark: form.remark
    })
    ElMessage.success('分数录入成功')
  }
  showDialog.value = false
  nextTick(() => initTrendChart())
}

function handleDelete(row: ExamScoreRecord) {
  ElMessageBox.confirm(
    `确定删除 ${row.year} 年 ${getSubjectName(row.subject)} 的分数记录吗？`,
    '删除确认',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    store.deleteExamScore(row.id)
    ElMessage.success('已删除')
    nextTick(() => initTrendChart())
  }).catch(() => {})
}

function initTrendChart() {
  if (!trendChartRef.value) return
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }

  const years = yearOptions.value.slice().reverse() // 2009 -> 2026

  // 每年各科分数折线
  const seriesData = subjectList.value.map(subject => ({
    name: subject.name,
    type: 'line' as const,
    smooth: true,
    symbol: 'circle',
    symbolSize: 7,
    connectNulls: true,
    data: years.map(year => {
      const record = store.examScores.find(r => r.subject === subject.key && r.year === year)
      return record ? record.score : null
    })
  }))

  const option = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: subjectList.value.map(s => s.name),
      bottom: 0,
      textStyle: { color: '#606266', fontSize: 11 }
    },
    grid: { left: '3%', right: '4%', bottom: '14%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: years.map(y => `${y}`),
      axisLine: { lineStyle: { color: '#e4e7ed' } },
      axisLabel: { color: '#909399', rotate: 45 }
    },
    yAxis: {
      type: 'value',
      name: '分数',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f5f7fa' } },
      axisLabel: { color: '#909399' }
    },
    series: seriesData.map(s => ({ ...s, lineStyle: { width: 2 } })),
    color: subjectList.value.map(s => s.color)
  }

  trendChart.setOption(option, true)
}

function handleResize() {
  trendChart?.resize()
}

watch(() => store.examScores.length, () => {
  nextTick(() => initTrendChart())
})

onMounted(() => {
  nextTick(() => initTrendChart())
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  trendChart = null
})
</script>

<style scoped>
.exam-scores-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

/* 汇总卡片 */
.subject-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  background: #fff;
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  border-top: 4px solid #667eea;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  gap: 6px;
  flex-wrap: wrap;
}

.summary-name {
  font-size: 15px;
  font-weight: 600;
}

.summary-stats {
  display: flex;
  justify-content: space-between;
}

.stat-cell {
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #303133;
  font-family: 'DIN Alternate', sans-serif;
  line-height: 1.2;
}

.stat-txt {
  font-size: 12px;
  color: #909399;
}

.no-data {
  font-size: 13px;
  color: #c0c4cc;
  margin: 8px 0;
}

/* 图表卡片 */
.card {
  background: #fff;
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
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

.chart-container {
  width: 100%;
  height: 360px;
}

/* 表格分数文本 */
.score-text {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
  font-family: 'DIN Alternate', sans-serif;
}

.full-score-text {
  font-size: 13px;
  color: #909399;
}
</style>
