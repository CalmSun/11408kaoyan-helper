import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { getStorage, setStorage } from '@/utils/storage'
import dayjs from 'dayjs'

// 考研科目类型 - 11408
export type SubjectType = 
  | 'politics'      // 政治
  | 'english'       // 英语一
  | 'math'          // 数学一
  | 'datastruct'    // 数据结构
  | 'composition'   // 计算机组成原理
  | 'os'            // 操作系统
  | 'network'       // 计算机网络

// 科目配置
export const SUBJECT_CONFIG: Record<SubjectType, { name: string; shortName: string; color: string; tagType: string }> = {
  politics: { name: '政治', shortName: '政治', color: '#f56c6c', tagType: 'danger' },
  english: { name: '英语一', shortName: '英语', color: '#67c23a', tagType: 'success' },
  math: { name: '数学一', shortName: '数学', color: '#e6a23c', tagType: 'warning' },
  datastruct: { name: '数据结构', shortName: '数据结构', color: '#667eea', tagType: 'primary' },
  composition: { name: '组成原理', shortName: '组成', color: '#909399', tagType: 'info' },
  os: { name: '操作系统', shortName: '操作系统', color: '#f093fb', tagType: '' },
  network: { name: '计算机网络', shortName: '计网', color: '#4facfe', tagType: '' }
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

// 各科真题满分（408 各科按卷面占比：数据结构45/组成原理45/操作系统35/计网25，合计150）
export const SUBJECT_FULL_SCORE: Record<SubjectType, number> = {
  politics: 100,
  english: 100,
  math: 150,
  datastruct: 45,
  composition: 45,
  os: 35,
  network: 25
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

  // 11408 复习进度
  const subjectProgress = ref<Record<SubjectType, number>>(getStorage('subjectProgress', {
    politics: 0,
    english: 0,
    math: 0,
    datastruct: 0,
    composition: 0,
    os: 0,
    network: 0
  }))

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
    const today = dayjs().format('YYYY-MM-DD')
    return pomodoroRecords.value
      .filter(r => r.date === today)
      .reduce((sum, r) => sum + r.duration, 0)
  })

  // 今日番茄数
  const todayPomodoroCount = computed(() => {
    const today = dayjs().format('YYYY-MM-DD')
    return pomodoroRecords.value.filter(r => r.date === today).length
  })

  // 今日完成计划数
  const todayPlanCompleted = computed(() => {
    const today = dayjs().format('YYYY-MM-DD')
    return plans.value.filter(p => p.completed && p.createdAt.startsWith(today)).length
  })

  // 今日总计划数
  const todayPlanTotal = computed(() => {
    const today = dayjs().format('YYYY-MM-DD')
    return plans.value.filter(p => p.createdAt.startsWith(today)).length
  })

  // 各科目学习时长（分钟）
  const subjectStudyMinutes = computed(() => {
    const stats: Record<SubjectType, number> = {
      politics: 0,
      english: 0,
      math: 0,
      datastruct: 0,
      composition: 0,
      os: 0,
      network: 0
    }
    pomodoroRecords.value.forEach(r => {
      if (r.subject) {
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
  }

  // 切换计划完成状态
  function togglePlan(id: string) {
    const plan = plans.value.find(p => p.id === id)
    if (!plan) return

    const today = dayjs().format('YYYY-MM-DD')

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
  }

  // 删除计划
  function deletePlan(id: string) {
    plans.value = plans.value.filter(p => p.id !== id)
  }

  // 添加番茄钟记录
  function addPomodoroRecord(duration: number, subject?: SubjectType) {
    const record: PomodoroRecord = {
      id: Date.now().toString(),
      date: dayjs().format('YYYY-MM-DD'),
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
    const today = dayjs().format('YYYY-MM-DD')
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

  // 监听变化自动保存
  watch(plans, savePlans, { deep: true })
  watch(flashcards, saveFlashcards, { deep: true })
  watch(pomodoroRecords, savePomodoroRecords, { deep: true })
  watch(examScores, saveExamScores, { deep: true })
  watch(dailyRecords, saveDailyRecords, { deep: true })
  watch(subjectProgress, saveSubjectProgress, { deep: true })

  return {
    // 状态
    examDate,
    examName,
    plans,
    flashcards,
    pomodoroRecords,
    examScores,
    dailyRecords,
    pomodoroSettings,
    subjectProgress,
    // 常量
    SUBJECT_CONFIG,
    // 计算属性
    daysUntilExam,
    todayStudyMinutes,
    todayPomodoroCount,
    todayPlanCompleted,
    todayPlanTotal,
    subjectStudyMinutes,
    totalStudyHours,
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
    deleteExamScore
  }
})
