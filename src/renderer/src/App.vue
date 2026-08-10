<template>
  <div class="app-container">
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
import { ref, computed, onUnmounted } from 'vue'
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

// Record app usage time when the app closes
onUnmounted(() => {
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
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  background: #f5f7fa;
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
