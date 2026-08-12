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
import './style.css'

const app = createApp(App)
const pinia = createPinia()

// 图标说明：各视图按需局部导入 @element-plus/icons-vue，
// 不再全局注册 280+ 图标组件，降低运行时开销。

app.component('GlassCard', GlassCard)
app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// v2.8.1：存储层迁移至 IndexedDB——挂载前完成初始化（载入缓存、迁移旧数据、版本迁移），
// 确保各 store 首次读取即拿到真实数据；初始化异常时内部已降级 localStorage，不阻塞启动
initStorage().finally(() => {
  app.mount('#app')
})
