import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import App from './App.vue'
import router from './router'
import GlassCard from './components/GlassCard.vue'
import { initStorage } from './utils/storage'
import { useMainStore } from './stores'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

// 图标说明：各视图按需局部导入 @element-plus/icons-vue，
// 不再全局注册 280+ 图标组件，降低运行时开销。

app.component('GlassCard', GlassCard)
app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// v3.3.5：Vue 全局错误捕获（组件渲染、watch、事件处理器等未捕获异常都走这里）
// 过去组件崩溃时用户只看到「点击没反应」，现在会写入日志并弹提示
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue ErrorHandler]', info, err, instance)
  try {
    useMainStore().logError({
      type: 'vue',
      message: `${info}: ${err instanceof Error ? err.message : String(err)}`,
      stack: err instanceof Error ? err.stack : undefined,
      time: Date.now()
    })
  } catch (_) {}
  try {
    // 不直接 import ElMessage，避免与 router 重复初始化
    ElementPlus?.ElMessage?.error?.(
      `运行异常: ${(err instanceof Error ? err.message : String(err)).slice(0, 60)}（详情见设置-报错日志）`
    )
  } catch (_) {}
}

// v3.3.5：全局未处理 Promise rejection 捕获（await 漏写 try/catch）
window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
  console.error('[UnhandledRejection]', ev.reason)
  try {
    useMainStore().logError({
      type: 'runtime',
      message: `未处理的 Promise 异常: ${ev.reason instanceof Error ? ev.reason.message : String(ev.reason)}`,
      stack: ev.reason instanceof Error ? ev.reason.stack : undefined,
      time: Date.now()
    })
  } catch (_) {}
})

// v2.8.1：存储层迁移至 IndexedDB——挂载前完成初始化（载入缓存、迁移旧数据、版本迁移），
// 确保各 store 首次读取即拿到真实数据；初始化异常时内部已降级 localStorage，不阻塞启动
initStorage().finally(() => {
  app.mount('#app')
})
