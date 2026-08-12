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
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

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
import SideNav from '@/components/SideNav.vue'
import TitleBar from '@/components/TitleBar.vue'

// 启动时应用已保存的主题（浅色/深色/跟随系统）与自定义背景
initTheme()
initCustomBg()

const route = useRoute()
const store = useMainStore()
const pmd = usePomodoroStore()
const isSidebarCollapsed = ref(false)

const isLoginPage = computed(() => route.path === '/login')

// v2.7.1：强制全屏改为全局设置（设置-番茄钟设置），在根组件统一监听执行：
// 开启后番茄钟运行时进入全屏隐藏系统任务栏，暂停/结束/关闭时自动退出，
// 切换页面不再影响全屏状态
const forceFullscreenActive = computed(
  () => store.pomodoroSettings.forceFullscreen && pmd.isRunning
)

watch(forceFullscreenActive, (on) => {
  window.electronAPI?.setFullscreen(on)
}, { immediate: true })

// 关闭强制全屏开关时确保退出全屏
watch(() => store.pomodoroSettings.forceFullscreen, (enabled) => {
  if (!enabled) window.electronAPI?.setFullscreen(false)
})

function handleCollapseChange(collapsed: boolean) {
  isSidebarCollapsed.value = collapsed
  document.documentElement.style.setProperty(
    '--side-nav-w',
    collapsed ? 'var(--side-nav-w-collapsed)' : '224px'
  )
}

// 每分钟定时记录应用使用时长（实时累计）
let usageTimer: number | null = null

onMounted(() => {
  // 每60秒记录一次使用时长
  usageTimer = window.setInterval(() => {
    store.recordAppUsage()
  }, 60000)
})

onUnmounted(() => {
  if (usageTimer) {
    clearInterval(usageTimer)
    usageTimer = null
  }
  // 最终保存
  store.recordAppUsage()
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
