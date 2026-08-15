<template>
  <div class="app-container">
    <!-- 自定义窗口顶栏（无边框窗口，含自建窗口控制按钮，整条可拖拽移动窗口） -->
    <TitleBar :transparent="isLoginPage" />

    <!-- 背景装饰层：弥散光斑（不模糊整体背景；模糊只发生在卡片自身 backdrop-filter 上） -->
    <div class="app-bg-decor"></div>

    <div class="app-body">
      <SideNav v-if="!isLoginPage" @collapse-change="handleCollapseChange" />
      <main class="main-content" :class="{ 'full-width': isLoginPage }">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <!-- v3.4.1：学习资料页 keep-alive——切换页面再返回时保持原状态（文件树/当前文件/阅读进度等） -->
            <keep-alive :include="['Materials']">
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </main>
    </div>

    <!-- v3.3.0：番茄钟小浮窗（非番茄钟页面显示，可拖动） -->
    <PomodoroMini :visible="showMiniPomodoro" />

    <!-- 番茄钟完成提醒（全局渲染，切换页面后依然弹出） -->
    <Transition name="alert-fade">
      <div v-if="pmd.showAlert" class="alert-overlay" @click="pmd.dismissAlert()">
        <div class="alert-card" @click.stop>
          <div class="alert-icon">{{ pmd.alertIcon }}</div>
          <h2 class="alert-title">{{ pmd.alertMessage }}</h2>
          <p class="alert-subtitle">{{ pmd.alertSubtitle }}</p>
          <el-button type="primary" size="large" round @click="pmd.dismissAlert()" class="alert-btn">
            好的
          </el-button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMainStore } from '@/stores'
import { usePomodoroStore } from '@/stores/pomodoro'
import { initTheme, initCustomBg } from '@/utils/theme'
import { initDataSync } from '@/utils/datasync'
import SideNav from '@/components/SideNav.vue'
import TitleBar from '@/components/TitleBar.vue'
import PomodoroMini from '@/components/PomodoroMini.vue'

// 启动时应用已保存的主题（浅色/深色/跟随系统）与自定义背景
initTheme()
initCustomBg()
// v2.8.0：初始化数据目录同步（加载目录路径、恢复开关、启动定时备份）
initDataSync()

const route = useRoute()
const store = useMainStore()
const pmd = usePomodoroStore()
const isSidebarCollapsed = ref(false)

const isLoginPage = computed(() => route.path === '/login')
const isPomodoroPage = computed(() => route.path === '/pomodoro')
// v3.3.0：小浮窗显示逻辑：非登录页 + 非番茄钟页面；另外用户未开启番茄钟也未使用过的场景不强制显示
const showMiniPomodoro = computed(() => !isLoginPage.value && !isPomodoroPage.value)

// v2.8.0：强制全屏改为开启即生效（与番茄钟运行状态解耦）：
// 开关打开立即进入全屏隐藏系统任务栏，关闭立即退出
watch(() => store.pomodoroSettings.forceFullscreen, (on) => {
  window.electronAPI?.setFullscreen(on)
}, { immediate: true })

function handleCollapseChange(collapsed: boolean) {
  isSidebarCollapsed.value = collapsed
  document.documentElement.style.setProperty(
    '--side-nav-w',
    collapsed ? 'var(--side-nav-w-collapsed)' : '224px'
  )
}

// 每分钟定时记录应用使用时长（实时累计）+ 跨午夜检测（v2.8.2）
let usageTimer: number | null = null
let lastDate = todayLocal()

function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

onMounted(() => {
  // 每60秒记录一次使用时长，并检测是否跨天（跨天时自动固化新一天快照）
  usageTimer = window.setInterval(() => {
    store.recordAppUsage()
    const now = todayLocal()
    if (now !== lastDate) {
      lastDate = now
      store.recordPlanSnapshot()
    }
  }, 60000)
})

// v2.8.2：应用关闭/刷新前固化当日计划快照，防止异常退出丢失最后状态
function handleBeforeUnload() {
  store.recordPlanSnapshot()
}
window.addEventListener('beforeunload', handleBeforeUnload)

onUnmounted(() => {
  if (usageTimer) {
    clearInterval(usageTimer)
    usageTimer = null
  }
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // 最终保存
  store.recordAppUsage()
  store.recordPlanSnapshot()
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* ── 主体区域 ── */
.app-body {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
  z-index: 1;
}

.main-content {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 28px 28px;
  background: transparent;
}

.main-content.full-width {
  padding: 0;
}

/* 路由切换：仅透明度过渡，卡片 GPU 层已固定，避免滤镜重采样闪动 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 番茄钟完成提醒遮罩 */
.alert-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(74, 79, 87, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.alert-card {
  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-filter-pop);
  -webkit-backdrop-filter: var(--glass-filter-pop);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 48px 40px;
  text-align: center;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: alertPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes alertPop {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.alert-icon {
  font-size: 72px;
  margin-bottom: 16px;
  line-height: 1;
}

.alert-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--mo-text-1);
  margin: 0 0 8px 0;
}

.alert-subtitle {
  font-size: 14px;
  color: var(--mo-text-3);
  margin: 0 0 24px 0;
}

.alert-btn {
  min-width: 120px;
}

.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: opacity 0.3s ease;
}

.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
}
</style>
