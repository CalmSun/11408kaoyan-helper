import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { getCurrentUsername, storageReady } from '@/utils/storage'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '首页', icon: 'HomeFilled' }
  },
  {
    path: '/countdown',
    name: 'Countdown',
    component: () => import('@/views/Countdown.vue'),
    meta: { title: '考研倒计时', icon: 'AlarmClock' }
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('@/views/Statistics.vue'),
    meta: { title: '数据统计', icon: 'DataLine' }
  },
  // 11408 专业课
  {
    path: '/outline',
    name: 'Outline',
    component: () => import('@/views/Outline.vue'),
    meta: { title: '知识大纲', icon: 'Guide' }
  },
  {
    path: '/algorithms',
    name: 'Algorithms',
    component: () => import('@/views/Algorithms.vue'),
    meta: { title: '算法模板库', icon: 'Cpu' }
  },
  {
    path: '/formulas',
    name: 'Formulas',
    component: () => import('@/views/Formulas.vue'),
    meta: { title: '公式速查', icon: 'Operation' }
  },
  {
    path: '/examscores',
    name: 'ExamScores',
    component: () => import('@/views/ExamScores.vue'),
    meta: { title: '真题成绩', icon: 'DataAnalysis' }
  },
  // 学习工具
  {
    path: '/pomodoro',
    name: 'Pomodoro',
    component: () => import('@/views/Pomodoro.vue'),
    meta: { title: '番茄钟', icon: 'Timer' }
  },
  {
    path: '/plan',
    name: 'Plan',
    component: () => import('@/views/DailyPlan.vue'),
    meta: { title: '每日计划', icon: 'List' }
  },
  {
    path: '/flashcards',
    name: 'Flashcards',
    component: () => import('@/views/Flashcards.vue'),
    meta: { title: '背诵卡片', icon: 'Collection' }
  },
  // 公共课
  {
    path: '/dictionary',
    name: 'Dictionary',
    component: () => import('@/views/Dictionary.vue'),
    meta: { title: '单词词典', icon: 'Reading' }
  },
  // v2.9.0：独立音乐播放页面
  {
    path: '/music',
    name: 'Music',
    component: () => import('@/views/Music.vue'),
    meta: { title: '音乐播放', icon: 'Headset' }
  },
  // v2.9.0：学习资料页面
  {
    path: '/materials',
    name: 'Materials',
    component: () => import('@/views/Materials.vue'),
    meta: { title: '学习资料', icon: 'Folder' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: { title: '设置', icon: 'Setting' }
  },
  // 404 兜底
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫：未登录时跳转到登录页
// v2.8.2：等待存储初始化完成后再判断登录状态，修复重启掉登录问题
router.beforeEach(async (to, _from, next) => {
  // 登录页不需要认证
  if (to.path === '/login' || to.meta.requiresAuth === false) {
    next()
    return
  }
  // 等待存储层就绪（IndexedDB 加载完成）
  await storageReady()
  const username = getCurrentUsername()
  if (!username) {
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

export default router
