<template>
  <div class="side-nav" :class="{ collapsed: isCollapsed }">
    <div class="nav-header">
      <div class="logo">
        <el-icon :size="28" color="#8a9bb5"><Reading /></el-icon>
        <span v-show="!isCollapsed" class="logo-text">11408考研助手</span>
      </div>
      <div v-show="!isCollapsed" class="exam-countdown-mini">
        <span class="countdown-number">{{ store.daysUntilExam }}</span>
        <span class="countdown-label">天</span>
      </div>
    </div>

    <div class="collapse-btn" @click="toggleCollapse" :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'">
      <el-icon :size="16">
        <component :is="isCollapsed ? 'DArrowRight' : 'DArrowLeft'" />
      </el-icon>
    </div>
    
    <div class="nav-menu">
      <div class="nav-group">
        <div v-show="!isCollapsed" class="nav-group-title">概览</div>
        <div
          v-for="item in overviewItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          :title="isCollapsed ? item.title : ''"
          @click="navigateTo(item.path)"
        >
          <el-icon :size="20">
            <component :is="item.icon" />
          </el-icon>
          <span v-show="!isCollapsed" class="nav-text">{{ item.title }}</span>
        </div>
      </div>

      <div class="nav-group">
        <div v-show="!isCollapsed" class="nav-group-title">11408 专业课</div>
        <div
          v-for="item in majorItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          :title="isCollapsed ? item.title : ''"
          @click="navigateTo(item.path)"
        >
          <el-icon :size="20">
            <component :is="item.icon" />
          </el-icon>
          <span v-show="!isCollapsed" class="nav-text">{{ item.title }}</span>
        </div>
      </div>

      <div class="nav-group">
        <div v-show="!isCollapsed" class="nav-group-title">学习工具</div>
        <div
          v-for="item in toolItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          :title="isCollapsed ? item.title : ''"
          @click="navigateTo(item.path)"
        >
          <el-icon :size="20">
            <component :is="item.icon" />
          </el-icon>
          <span v-show="!isCollapsed" class="nav-text">{{ item.title }}</span>
        </div>
      </div>

      <div class="nav-group">
        <div v-show="!isCollapsed" class="nav-group-title">公共课</div>
        <div
          v-for="item in publicItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          :title="isCollapsed ? item.title : ''"
          @click="navigateTo(item.path)"
        >
          <el-icon :size="20">
            <component :is="item.icon" />
          </el-icon>
          <span v-show="!isCollapsed" class="nav-text">{{ item.title }}</span>
        </div>
      </div>
    </div>
    
    <div v-show="!isCollapsed" class="nav-footer">
      <!-- 用户信息 -->
      <div class="user-section">
        <div class="user-info" @click="goToSettings" :title="userStore.displayName">
          <el-icon :size="18" color="#8a9bb5"><UserFilled /></el-icon>
          <span class="user-name">{{ userStore.displayName }}</span>
        </div>
        <el-button
          type="danger"
          link
          size="small"
          @click.stop="handleLogout"
          v-if="userStore.isLoggedIn"
        >
          退出
        </el-button>
      </div>
      <div class="study-tip">
        <el-icon :size="16" color="#c9a26a"><Warning /></el-icon>
        <span>一战成硕！</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMainStore } from '@/stores'
import { useUserStore } from '@/stores/user'
import {
  HomeFilled,
  AlarmClock,
  Timer,
  List,
  Collection,
  DataLine,
  DataAnalysis,
  Reading,
  Setting,
  Warning,
  Guide,
  Cpu,
  Operation,
  DArrowLeft,
  DArrowRight,
  UserFilled
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const store = useMainStore()
const userStore = useUserStore()

const isCollapsed = ref(false)

const emit = defineEmits<{
  (e: 'collapse-change', collapsed: boolean): void
}>()

const overviewItems = [
  { path: '/dashboard', title: '首页仪表盘', icon: HomeFilled },
  { path: '/countdown', title: '考研倒计时', icon: AlarmClock },
  { path: '/statistics', title: '数据统计', icon: DataLine }
]

const majorItems = [
  { path: '/outline', title: '知识大纲', icon: Guide },
  { path: '/algorithms', title: '算法模板库', icon: Cpu },
  { path: '/formulas', title: '公式速查', icon: Operation },
  { path: '/examscores', title: '真题成绩', icon: DataAnalysis }
]

const toolItems = [
  { path: '/pomodoro', title: '番茄钟', icon: Timer },
  { path: '/plan', title: '每日计划', icon: List },
  { path: '/flashcards', title: '背诵卡片', icon: Collection }
]

const publicItems = [
  { path: '/dictionary', title: '单词词典', icon: Reading },
  { path: '/settings', title: '设置', icon: Setting }
]

function isActive(path: string) {
  return route.path === path
}

function navigateTo(path: string) {
  router.push(path)
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
  emit('collapse-change', isCollapsed.value)
}

function goToSettings() {
  router.push('/settings')
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.side-nav {
  position: relative;
  z-index: 1;
  width: 220px;
  height: 100%;
  background: linear-gradient(180deg, #474e5d 0%, #4a4438 100%);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.side-nav.collapsed {
  width: 64px;
}

.nav-header {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.side-nav.collapsed .nav-header {
  padding: 16px 12px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.side-nav.collapsed .logo {
  justify-content: center;
  margin-bottom: 0;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.exam-countdown-mini {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 12px 16px;
  background: rgba(138, 155, 181, 0.15);
  border-radius: 10px;
  border: 1px solid rgba(138, 155, 181, 0.3);
}

.countdown-number {
  font-size: 28px;
  font-weight: 700;
  color: #c4956a;
  font-family: 'DIN Alternate', 'Menlo', 'Consolas', monospace;
}

.countdown-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

/* 折叠按钮 */
.collapse-btn {
  position: absolute;
  top: 80px;
  right: -12px;
  width: 24px;
  height: 24px;
  background: #16213e;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.6);
  z-index: 10;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.collapse-btn:hover {
  background: #8a9bb5;
  color: #fff;
  border-color: #8a9bb5;
}

.nav-menu {
  flex: 1;
  padding: 12px 12px;
  overflow-y: auto;
  overflow-x: hidden;
}

.side-nav.collapsed .nav-menu {
  padding: 12px 8px;
}

.nav-group {
  margin-bottom: 16px;
}

.nav-group-title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  padding: 8px 16px 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  margin-bottom: 2px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  white-space: nowrap;
}

.side-nav.collapsed .nav-item {
  justify-content: center;
  padding: 10px;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
}

.nav-item.active {
  background: linear-gradient(135deg, #8a9bb5 0%, #c4956a 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(138, 155, 181, 0.4);
}

.nav-text {
  flex: 1;
}

.nav-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

/* 用户信息 */
.user-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s ease;
  min-width: 0;
}

.user-info:hover {
  background: rgba(255, 255, 255, 0.06);
}

.user-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.study-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
