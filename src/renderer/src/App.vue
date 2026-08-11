<template>
  <div class="app-container">
    <!-- 弥散渐变背景装饰层，凸显玻璃质感 -->
    <div class="app-bg-decor"></div>
    <SideNav v-if="!isLoginPage" @collapse-change="handleCollapseChange" />
    <div class="main-content" :class="{ expanded: isSidebarCollapsed, 'full-width': isLoginPage }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMainStore } from '@/stores'
import SideNav from '@/components/SideNav.vue'

const route = useRoute()
const store = useMainStore()
const isSidebarCollapsed = ref(false)

const isLoginPage = computed(() => route.path === '/login')

function handleCollapseChange(collapsed: boolean) {
  isSidebarCollapsed.value = collapsed
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
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.main-content {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  background: transparent;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-content.full-width {
  padding: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
