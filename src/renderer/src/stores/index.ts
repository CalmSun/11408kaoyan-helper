import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { getStorage, setStorage } from '@/utils/storage'
import { todayLocal, toLocalDate } from '@/utils/date'
import dayjs from 'dayjs'

/** 判断计划是否创建于指定本地日期（统一本地日期比较，避免 UTC 时区错位） */
function isPlanCreatedOnDate(iso: string, date: string): boolean {
  return toLocalDate(iso) === date
}

// 考研科目类型 - 11408
export type SubjectType = 
  | 'politics'      // 政治
  | 'english'       // 英语一
  | 'math'          // 数学一
  | 'cs408'         // 计算机学科专业基础（408）

// 科目配置
export const SUBJECT_CONFIG: Record<SubjectType, { name: string; shortName: string; color: string; tagType: string }> = {
  politics: { name: '政治', shortName: '政治', color: '#f87171', tagType: 'danger' },
  english: { name: '英语一', shortName: '英语', color: '#34d399', tagType: 'success' },
  math: { name: '数学一', shortName: '数学', color: '#fbbf24', tagType: 'warning' },
  cs408: { name: '408 计算机专业基础', shortName: '408', color: '#3b82f6', tagType: 'primary' }
}

export interface PlanItem {
  id: string
  title: string
  subject?: SubjectType
  completed: boolean
  createdAt: string
  completedAt?: string
  recurring?: boolean // 是否为循环待办
  completedDates?: string[] // 已完成日期列表（仅用于循环计划，格式 YYYY-MM-DD）
}

export interface Flashcard {
  id: string
  front: string
  back: string
  category: string
  createdAt: string
  reviewCount: number
  correctCount: number
}

export interface PomodoroRecord {
  id: string
  date: string
  duration: number // 分钟
  subject?: SubjectType
  completedAt: string
}

export interface DailyStudyRecord {
  date: string
  studyMinutes: number
  pomodoroCount: number
  mistakeReviewed: number
  planCompleted: number
  planTotal: number
}

// 每日计划快照：某一天全部计划（含循环与普通）的实际完成状态
export interface DailyPlanSnapshotItem {
  title: string
  subject?: SubjectType
  completed: boolean
  completedAt?: string
}

export interface DailyPlanSnapshot {
  date: string // YYYY-MM-DD（本地日期）
  items: DailyPlanSnapshotItem[]
}

// 11408 知识大纲节点
export interface OutlineNode {
  id: string
  subject: SubjectType
  title: string
  children?: OutlineNode[]
  progress: number // 0-100
  notes?: string
}

// 算法模板
export interface AlgorithmTemplate {
  id: string
  name: string
  category: string
  subject: SubjectType
  description: string
  code: string
  timeComplexity: string
  spaceComplexity: string
  tags: string[]
}

// 公式/核心概念
export interface FormulaItem {
  id: string
  name: string
  subject: SubjectType
  category: string
  content: string
  description: string
  example?: string
}

// 各科真题满分（408 满分 150 分）
export const SUBJECT_FULL_SCORE: Record<SubjectType, number> = {
  politics: 100,
  english: 100,
  math: 150,
  cs408: 150
}

// 历年真题分数记录
export interface ExamScoreRecord {
  id: string
  subject: SubjectType
  year: number        // 2009-2026
  score: number       // 实际得分
  fullScore: number   // 该科目满分
  remark?: string     // 备注
  createdAt: string
}

// 数据迁移：将旧的 408 子科目数据合并为 cs408
function migrateOldData() {
  // 迁移 subjectProgress
  const oldProgress = getStorage('subjectProgress', {} as Record<string, number>)
  if (oldProgress && typeof oldProgress === 'object') {
    const hasOld408 = oldProgress.datastruct !== undefined || 
                      oldProgress.composition !== undefined || 
                      oldProgress.os !== undefined || 
                      oldProgress.network !== undefined
    
    if (hasOld408 && oldProgress.cs408 === undefined) {
      // 计算 408 子科目的平均进度
      const subProgress = [
        oldProgress.datastruct || 0,
        oldProgress.composition || 0,
        oldProgress.os || 0,
        oldProgress.network || 0
      ]
      const avg = subProgress.reduce((a, b) => a + b, 0) / subProgress.length
      oldProgress.cs408 = Math.round(avg)
      
      // 删除旧的子科目字段
      delete oldProgress.datastruct
      delete oldProgress.composition
      delete oldProgress.os
      delete oldProgress.network
      
      setStorage('subjectProgress', oldProgress)
    }
  }
  
  // 迁移 examScores：将 408 子科目分数合并为总分
  const oldScores = getStorage('examScores', [] as ExamScoreRecord[])
  if (oldScores && Array.isArray(oldScores)) {
    const hasOld408Scores = oldScores.some(s => 
      ['datastruct', 'composition', 'os', 'network'].includes(s.subject)
    )
    
    if (hasOld408Scores) {
      // 按年份分组 408 子科目分数
      const yearGroups: Record<number, ExamScoreRecord[]> = {}
      const migratedScores: ExamScoreRecord[] = []
      
      oldScores.forEach(score => {
        if (['datastruct', 'composition', 'os', 'network'].includes(score.subject)) {
          if (!yearGroups[score.year]) {
            yearGroups[score.year] = []
          }
          yearGroups[score.year].push(score)
        } else {
          migratedScores.push(score)
        }
      })
      
      // 将每年的 408 子科目分数合并为总分
      Object.entries(yearGroups).forEach(([year, scores]) => {
        const totalScore = scores.reduce((sum, s) => sum + s.score, 0)
        const maxScore = scores.reduce((sum, s) => sum + s.fullScore, 0)
        
        if (totalScore > 0 && maxScore > 0) {
          migratedScores.push({
            id: `migrated_408_${year}`,
            subject: 'cs408',
            year: parseInt(year),
            score: totalScore,
            fullScore: 150, // 408 满分
            remark: `合并自 ${scores.length} 个子科目`,
            createdAt: new Date().toISOString()
          })
        }
      })
      
      setStorage('examScores', migratedScores)
    }
  }
}

// 应用启动时执行数据迁移
migrateOldData()

export const useMainStore = defineStore('main', () => {
  // 考研日期设置
  const examDate = ref<string>(getStorage('examDate', '2026-12-21'))
  const examName = ref<string>(getStorage('examName', '2027年全国硕士研究生招生考试（11408）'))

  // 每日计划
  const plans = ref<PlanItem[]>(getStorage('plans', [] as PlanItem[]))

  // 背诵卡片
  const flashcards = ref<Flashcard[]>(getStorage('flashcards', [] as Flashcard[]))

  // 番茄钟记录
  const pomodoroRecords = ref<PomodoroRecord[]>(getStorage('pomodoroRecords', [] as PomodoroRecord[]))

  // 历年真题分数记录
  const examScores = ref<ExamScoreRecord[]>(getStorage('examScores', [] as ExamScoreRecord[]))

  // 每日学习记录
  const dailyRecords = ref<DailyStudyRecord[]>(getStorage('dailyRecords', [] as DailyStudyRecord[]))

  // 每日计划快照（按本地日期记录当天全部计划的实际完成情况，含循环与普通计划）
  const planSnapshots = ref<DailyPlanSnapshot[]>(getStorage('planSnapshots', [] as DailyPlanSnapshot[]))

  // 11408 复习进度
  const subjectProgress = ref<Record<SubjectType, number>>(getStorage('subjectProgress', {
    politics: 0,
    english: 0,
    math: 0,
    cs408: 0
  }))

  // 应用使用时长统计（分钟）
  const appUsageMinutes = ref<number>(getStorage('appUsageMinutes', 0))
  const appSessionStart = ref<number>(Date.now())

  // 记录应用使用时长
  function recordAppUsage() {
    const elapsed = Math.round((Date.now() - appSessionStart.value) / 60000)
    if (elapsed > 0) {
      appUsageMinutes.value += elapsed
      setStorage('appUsageMinutes', appUsageMinutes.value)
      appSessionStart.value = Date.now()
    }
  }

  // 番茄钟设置
  const pomodoroSettings = ref(getStorage('pomodoroSettings', {
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    enableNotification: true,  // 启用通知
    enableSound: true,          // 启用声音
    enableTitleFlash: true      // 启用页面标题闪烁
  }))

  // 计算倒计时天数
  const daysUntilExam = computed(() => {
    const now = dayjs()
    const exam = dayjs(examDate.value)
    const diff = exam.diff(now, 'day')
    return diff > 0 ? diff : 0
  })

  // 今日学习时长（分钟）
  const todayStudyMinutes = computed(() => {
    const today = todayLocal()
    return pomodoroRecords.value
      .filter(r => r.date === today)
      .reduce((sum, r) => sum + r.duration, 0)
  })

  // 今日番茄数
  const todayPomodoroCount = computed(() => {
    const today = todayLocal()
    return pomodoroRecords.value.filter(r => r.date === today).length
  })

  // 今日学习时长（小时，保留1位小数，v2.7.0 与累计学习统一）
  const todayStudyHours = computed(() => {
    return (todayStudyMinutes.value / 60).toFixed(1)
  })

  // 应用使用时长（小时，保留1位小数，v2.7.0 与累计学习统一）
  const appUsageHours = computed(() => {
    return (appUsageMinutes.value / 60).toFixed(1)
  })

  // 今日完成计划数
  const todayPlanCompleted = computed(() => {
    const today = todayLocal()
    return plans.value.filter(p => {
      if (p.recurring) return (p.completedDates || []).includes(today)
      return p.completed && isPlanCreatedOnDate(p.createdAt, today)
    }).length
  })

  // 今日总计划数（含循环计划）
  const todayPlanTotal = computed(() => {
    const today = todayLocal()
    return plans.value.filter(p => {
      if (p.recurring) return true
      return isPlanCreatedOnDate(p.createdAt, today)
    }).length
  })

  // 各科目学习时长（分钟）
  const subjectStudyMinutes = computed(() => {
    const stats: Record<SubjectType, number> = {
      politics: 0,
      english: 0,
      math: 0,
      cs408: 0
    }
    pomodoroRecords.value.forEach(r => {
      if (r.subject && r.subject in stats) {
        stats[r.subject] += r.duration
      }
    })
    return stats
  })

  // 总学习时长（小时）
  const totalStudyHours = computed(() => {
    const minutes = pomodoroRecords.value.reduce((sum, r) => sum + r.duration, 0)
    return (minutes / 60).toFixed(1)
  })

  // 添加真题分数记录
  function addExamScore(record: Omit<ExamScoreRecord, 'id' | 'createdAt' | 'fullScore'>) {
    const newRecord: ExamScoreRecord = {
      ...record,
      id: Date.now().toString(),
      fullScore: SUBJECT_FULL_SCORE[record.subject],
      createdAt: new Date().toISOString()
    }
    examScores.value.unshift(newRecord)
  }

  // 更新真题分数记录
  function updateExamScore(id: string, updates: Partial<ExamScoreRecord>) {
    const index = examScores.value.findIndex(r => r.id === id)
    if (index !== -1) {
      examScores.value[index] = { ...examScores.value[index], ...updates }
    }
  }

  // 删除真题分数记录
  function deleteExamScore(id: string) {
    examScores.value = examScores.value.filter(r => r.id !== id)
  }

  // 添加计划
  function addPlan(title: string, subject?: SubjectType, recurring: boolean = false) {
    const newPlan: PlanItem = {
      id: Date.now().toString(),
      title,
      subject,
      completed: false,
      createdAt: new Date().toISOString(),
      recurring,
      completedDates: []
    }
    plans.value.unshift(newPlan)
    recordPlanSnapshot()
  }

  // 切换计划完成状态
  function togglePlan(id: string) {
    const plan = plans.value.find(p => p.id === id)
    if (!plan) return

    const today = todayLocal()

    if (plan.recurring) {
      // 循环计划：在 completedDates 数组中添加/移除今天日期
      if (!plan.completedDates) plan.completedDates = []
      const idx = plan.completedDates.indexOf(today)
      if (idx === -1) {
        plan.completedDates.push(today)
      } else {
        plan.completedDates.splice(idx, 1)
      }
      // 同步 completed 字段为今天的完成状态（供 Dashboard 使用）
      plan.completed = plan.completedDates.includes(today)
    } else {
      // 普通计划：直接切换 completed
      plan.completed = !plan.completed
      plan.completedAt = plan.completed ? new Date().toISOString() : undefined
    }
    recordPlanSnapshot()
  }

  // 删除计划
  function deletePlan(id: string) {
    plans.value = plans.value.filter(p => p.id !== id)
    recordPlanSnapshot()
  }

  // 记录当日计划快照：将今天全部计划（循环+普通）的实际完成状态固化为历史
  // 口径与"今日计划"列表一致：循环计划 + 今天创建的普通计划
  function recordPlanSnapshot() {
    const today = todayLocal()
    const items: DailyPlanSnapshotItem[] = plans.value
      .filter(p => p.recurring || toLocalDate(p.createdAt) === today)
      .map(p => {
        if (p.recurring) {
          // 循环计划：取该计划在当天的完成状态（不记录时间，避免歧义）
          return {
            title: p.title,
            subject: p.subject,
            completed: (p.completedDates || []).includes(today),
            completedAt: undefined as string | undefined
          }
        }
        // 普通计划：记录最终完成状态与完成时间
        return {
          title: p.title,
          subject: p.subject,
          completed: p.completed,
          completedAt: p.completedAt
        }
      })

    if (items.length === 0) return

    const existing = planSnapshots.value.find(s => s.date === today)
    if (existing) {
      existing.items = items
    } else {
      planSnapshots.value.push({ date: today, items })
    }
    // 仅保留最近 60 天快照，控制存储体积
    if (planSnapshots.value.length > 60) {
      planSnapshots.value = planSnapshots.value
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 60)
    }
  }

  // 添加番茄钟记录
  function addPomodoroRecord(duration: number, subject?: SubjectType) {
    const record: PomodoroRecord = {
      id: Date.now().toString(),
      date: todayLocal(),
      duration,
      subject,
      completedAt: new Date().toISOString()
    }
    pomodoroRecords.value.push(record)
    updateDailyRecord()
  }

  // 添加背诵卡片
  function addFlashcard(card: Omit<Flashcard, 'id' | 'createdAt' | 'reviewCount' | 'correctCount'>) {
    const newCard: Flashcard = {
      ...card,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      reviewCount: 0,
      correctCount: 0
    }
    flashcards.value.unshift(newCard)
  }

  // 更新背诵卡片
  function updateFlashcard(id: string, updates: Partial<Flashcard>) {
    const index = flashcards.value.findIndex(c => c.id === id)
    if (index !== -1) {
      flashcards.value[index] = { ...flashcards.value[index], ...updates }
    }
  }

  // 删除背诵卡片
  function deleteFlashcard(id: string) {
    flashcards.value = flashcards.value.filter(c => c.id !== id)
  }

  // 更新科目进度
  function setSubjectProgress(subject: SubjectType, progress: number) {
    subjectProgress.value[subject] = Math.max(0, Math.min(100, progress))
  }

  // 更新每日学习记录
  function updateDailyRecord() {
    const today = todayLocal()
    const todayRecord = dailyRecords.value.find(r => r.date === today)
    
    const todayPomodoros = pomodoroRecords.value.filter(r => r.date === today)
    const studyMinutes = todayPomodoros.reduce((sum, r) => sum + r.duration, 0)
    
    if (todayRecord) {
      todayRecord.studyMinutes = studyMinutes
      todayRecord.pomodoroCount = todayPomodoros.length
    } else {
      dailyRecords.value.push({
        date: today,
        studyMinutes,
        pomodoroCount: todayPomodoros.length,
        mistakeReviewed: 0,
        planCompleted: 0,
        planTotal: 0
      })
    }
  }

  // 设置考试日期
  function setExamDate(date: string, name?: string) {
    examDate.value = date
    if (name) examName.value = name
    setStorage('examDate', date)
    setStorage('examName', examName.value)
  }

  // 更新番茄钟设置
  function updatePomodoroSettings(settings: Partial<typeof pomodoroSettings.value>) {
    Object.assign(pomodoroSettings.value, settings)
  }

  // 持久化函数
  function savePlans() { setStorage('plans', plans.value) }
  function saveFlashcards() { setStorage('flashcards', flashcards.value) }
  function savePomodoroRecords() { setStorage('pomodoroRecords', pomodoroRecords.value) }
  function saveExamScores() { setStorage('examScores', examScores.value) }
  function saveDailyRecords() { setStorage('dailyRecords', dailyRecords.value) }
  function saveSubjectProgress() { setStorage('subjectProgress', subjectProgress.value) }
  function savePomodoroSettings() { setStorage('pomodoroSettings', pomodoroSettings.value) }
  function savePlanSnapshots() { setStorage('planSnapshots', planSnapshots.value) }

  // 监听变化自动保存
  watch(plans, savePlans, { deep: true })
  watch(flashcards, saveFlashcards, { deep: true })
  watch(pomodoroRecords, savePomodoroRecords, { deep: true })
  watch(examScores, saveExamScores, { deep: true })
  watch(dailyRecords, saveDailyRecords, { deep: true })
  watch(subjectProgress, saveSubjectProgress, { deep: true })
  watch(planSnapshots, savePlanSnapshots, { deep: true })

  // 启动时补记一次当日快照（覆盖已有计划的初始状态）
  recordPlanSnapshot()

  return {
    // 状态
    examDate,
    examName,
    plans,
    flashcards,
    pomodoroRecords,
    examScores,
    dailyRecords,
    planSnapshots,
    pomodoroSettings,
    subjectProgress,
    // 常量
    SUBJECT_CONFIG,
    // 计算属性
    daysUntilExam,
    todayStudyMinutes,
    todayStudyHours,
    todayPomodoroCount,
    todayPlanCompleted,
    todayPlanTotal,
    subjectStudyMinutes,
    totalStudyHours,
    appUsageMinutes,
    appUsageHours,
    // 方法
    addPlan,
    togglePlan,
    deletePlan,
    addPomodoroRecord,
    addFlashcard,
    updateFlashcard,
    deleteFlashcard,
    setSubjectProgress,
    setExamDate,
    updatePomodoroSettings,
    addExamScore,
    updateExamScore,
    deleteExamScore,
    recordAppUsage,
    recordPlanSnapshot
  }
})
