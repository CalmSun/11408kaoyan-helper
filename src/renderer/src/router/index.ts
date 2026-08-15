import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
// v3.2.7：移除未使用的 getCurrentUsername / storageReady（不再需要本地账号登录守卫）

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

// v3.2.7：移除本地账号系统的登录守卫——改用网易云登录替代初始登录
// 所有路由无需强制认证，用户可直接进入主界面；音乐相关功能会在需要时引导网易云登录
router.beforeEach(async (_to, _from, next) => {
  next()
})

export default router
