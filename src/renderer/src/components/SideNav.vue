<template>
  <div class="side-nav-wrap">
    <div class="side-nav" :class="{ collapsed: isCollapsed }">
      <div class="nav-header">
        <div class="logo">
          <el-icon :size="26" class="logo-icon"><Reading /></el-icon>
          <span v-show="!isCollapsed" class="logo-text">11408考研助手</span>
        </div>
        <div v-show="!isCollapsed" class="exam-countdown-mini">
          <span class="countdown-number">{{ store.daysUntilExam }}</span>
          <span class="countdown-label">天</span>
        </div>
      </div>

      <!-- 扁平菜单（v2.6.6：取消分组分类，统一悬浮卡片风格） -->
      <div class="nav-menu">
        <div
          v-for="item in allItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          :title="isCollapsed ? item.title : ''"
          @click="navigateTo(item.path)"
        >
          <el-icon :size="19">
            <component :is="item.icon" />
          </el-icon>
          <span v-show="!isCollapsed" class="nav-text">{{ item.title }}</span>
        </div>
      </div>

      <div class="nav-footer">
        <!-- 主题切换与用户栏已移入顶栏（v2.7.0），侧栏仅保留提示 -->
        <div class="study-tip">
          <el-icon :size="16" class="study-tip-icon"><Warning /></el-icon>
          <span>一战成硕！</span>
        </div>
      </div>
    </div>

    <!-- 折叠按钮置于外层 wrapper，避免被面板 overflow:hidden 裁剪 -->
    <div
      class="collapse-btn"
      :class="{ 'on-collapsed': isCollapsed }"
      @click="toggleCollapse"
      :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
    >
      <el-icon :size="14">
        <component :is="isCollapsed ? DArrowRight : DArrowLeft" />
      </el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMainStore } from '@/stores'
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
  DArrowRight
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const store = useMainStore()

const isCollapsed = ref(false)

const emit = defineEmits<{
  (e: 'collapse-change', collapsed: boolean): void
}>()

// 全部菜单项（v2.6.6：取消分组分类，按使用频率平铺）
const allItems = [
  { path: '/dashboard', title: '首页仪表盘', icon: HomeFilled },
  { path: '/countdown', title: '考研倒计时', icon: AlarmClock },
  { path: '/plan', title: '每日计划', icon: List },
  { path: '/pomodoro', title: '番茄钟', icon: Timer },
  { path: '/statistics', title: '数据统计', icon: DataLine },
  { path: '/outline', title: '知识大纲', icon: Guide },
  { path: '/algorithms', title: '算法模板库', icon: Cpu },
  { path: '/formulas', title: '公式速查', icon: Operation },
  { path: '/examscores', title: '真题成绩', icon: DataAnalysis },
  { path: '/flashcards', title: '背诵卡片', icon: Collection },
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
</script>

<style scoped>
/* 悬浮卡片式侧边导航外层：承载面板与折叠按钮，避免按钮被裁剪 */
.side-nav-wrap {
  position: relative;
  flex-shrink: 0;
  height: 100%;
  padding: 16px 12px 16px 16px;
  box-sizing: border-box;
}

/* 悬浮卡片式侧边导航：四周留白 + 大圆角玻璃面板，不再贴边 */
.side-nav {
  position: relative;
  z-index: 2;
  width: 224px;
  height: 100%;
  background: var(--side-nav-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--glass-border);
  border-radius: var(--mo-radius-lg);
  box-shadow: var(--glass-shadow);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease;
  overflow: hidden;
  contain: layout style;
}

.side-nav.collapsed {
  width: 68px;
}

.nav-header {
  padding: 20px 16px;
}

.side-nav.collapsed .nav-header {
  padding: 16px 10px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.side-nav.collapsed .logo {
  justify-content: center;
  margin-bottom: 0;
}

.logo-icon {
  color: var(--mo-primary);
}

.logo-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--side-nav-text-1);
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.exam-countdown-mini {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 10px 14px;
  background: var(--mo-surface);
  border-radius: var(--mo-radius-sm);
  border: 1px solid var(--glass-border);
}

.countdown-number {
  font-size: 26px;
  font-weight: 700;
  color: var(--mo-primary);
  font-family: 'DIN Alternate', 'Menlo', 'Consolas', monospace;
}

.countdown-label {
  font-size: 12px;
  color: var(--side-nav-text-2);
}

/* 折叠按钮：吸附在面板右侧边缘（外层定位，不被裁剪） */
.collapse-btn {
  position: absolute;
  top: 90px;
  right: 1px; /* 贴住面板右边缘中点 */
  width: 22px;
  height: 22px;
  background: var(--side-nav-collapse-bg);
  border: 1px solid var(--glass-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--side-nav-text-2);
  z-index: 10;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  box-shadow: 0 2px 8px rgba(31, 64, 130, 0.18);
}

.collapse-btn:hover {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.nav-menu {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.side-nav.collapsed .nav-menu {
  padding: 10px 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 14px;
  border-radius: var(--mo-radius-sm);
  color: var(--side-nav-text-2);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  font-size: 14px;
  white-space: nowrap;
}

.side-nav.collapsed .nav-item {
  justify-content: center;
  padding: 9px;
}

.nav-item:hover {
  background: var(--side-nav-hover);
  color: var(--side-nav-text-1);
}

.nav-item.active {
  background: var(--mo-gradient);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
}

.nav-text {
  flex: 1;
}

.nav-footer {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.side-nav.collapsed .nav-footer {
  padding: 12px 8px;
  align-items: center;
}

/* 主题切换 */
.theme-section {
  width: 100%;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: var(--mo-radius-sm);
  background: var(--mo-surface);
  border: 1px solid var(--glass-border);
  color: var(--side-nav-text-2);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  font-size: 13px;
  white-space: nowrap;
}

.side-nav.collapsed .theme-toggle {
  justify-content: center;
  padding: 9px;
}

.theme-toggle:hover {
  background: var(--side-nav-hover);
  color: var(--mo-primary);
}

.theme-text {
  flex: 1;
}

/* 用户信息 */
.user-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s ease;
  min-width: 0;
}

.user-info:hover {
  background: var(--side-nav-hover);
}

.user-icon {
  color: var(--mo-primary);
}

.user-name {
  font-size: 13px;
  color: var(--side-nav-text-2);
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
  color: var(--side-nav-text-3);
}

.study-tip-icon {
  color: var(--mo-primary-light);
}
</style>
