<template>
  <div class="settings-page fade-in">
    <h1 class="page-title">设置</h1>
    <p class="page-subtitle">个性化你的考研助手</p>

    <!-- 考试设置 -->
    <div class="card setting-section">
      <h3 class="section-title">
        <el-icon><AlarmClock /></el-icon>
        考试设置
      </h3>
      <el-form :model="examForm" label-width="120px" style="max-width: 500px;">
        <el-form-item label="考试名称">
          <el-input v-model="examForm.name" placeholder="请输入考试名称" />
        </el-form-item>
        <el-form-item label="考试日期">
          <el-date-picker
            v-model="examForm.date"
            type="date"
            placeholder="选择考试日期"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveExamSettings">保存设置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 番茄钟设置 -->
    <div class="card setting-section">
      <h3 class="section-title">
        <el-icon><Timer /></el-icon>
        番茄钟设置
      </h3>
      <el-form :model="pomodoroForm" label-width="120px" style="max-width: 500px;">
        <el-form-item label="专注时长">
          <el-input-number v-model="pomodoroForm.workDuration" :min="5" :max="60" />
          <span class="unit">分钟</span>
        </el-form-item>
        <el-form-item label="短休息时长">
          <el-input-number v-model="pomodoroForm.shortBreak" :min="1" :max="30" />
          <span class="unit">分钟</span>
        </el-form-item>
        <el-form-item label="长休息时长">
          <el-input-number v-model="pomodoroForm.longBreak" :min="5" :max="60" />
          <span class="unit">分钟</span>
        </el-form-item>
        <el-form-item label="长休息间隔">
          <el-input-number v-model="pomodoroForm.longBreakInterval" :min="2" :max="10" />
          <span class="unit">个番茄后</span>
        </el-form-item>
        <el-form-item label="桌面通知">
          <el-switch v-model="pomodoroForm.enableNotification" />
          <span class="unit-desc">番茄完成/休息结束时推送系统通知</span>
        </el-form-item>
        <el-form-item label="提示音">
          <el-switch v-model="pomodoroForm.enableSound" />
          <span class="unit-desc">播放提示音提醒</span>
        </el-form-item>
        <el-form-item label="标题闪烁">
          <el-switch v-model="pomodoroForm.enableTitleFlash" />
          <span class="unit-desc">切换其他标签页时，浏览器标题闪烁提醒</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="savePomodoroSettings">保存设置</el-button>
          <el-button @click="requestNotificationPermission">测试通知权限</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 通用设置 -->
    <div class="card setting-section">
      <h3 class="section-title">
        <el-icon><Setting /></el-icon>
        通用设置
      </h3>
      <el-form label-width="120px" style="max-width: 500px;">
        <el-form-item label="开机自启动">
          <el-switch v-model="autoLaunch" @change="toggleAutoLaunch" />
          <span class="unit-desc">开机时自动启动考研助手</span>
        </el-form-item>
      </el-form>
    </div>

    <!-- 数据管理 -->
    <div class="card setting-section">
      <h3 class="section-title">
        <el-icon><FolderOpened /></el-icon>
        数据管理
      </h3>
      <p class="section-desc">备份和恢复你的学习数据，防止数据丢失</p>
      
      <div class="data-actions">
        <div class="data-action-item">
          <div class="action-info">
            <h4>导出备份</h4>
            <p>将所有学习数据导出为 JSON 文件保存到本地</p>
          </div>
          <el-button type="primary" @click="exportData">
            <el-icon><Download /></el-icon>
            导出数据
          </el-button>
        </div>
        <div class="data-action-item">
          <div class="action-info">
            <h4>导入备份</h4>
            <p>从之前导出的备份文件恢复数据（会覆盖现有数据）</p>
          </div>
          <el-button type="warning" @click="importData">
            <el-icon><Upload /></el-icon>
            导入数据
          </el-button>
        </div>
        <div class="data-action-item danger">
          <div class="action-info">
            <h4>清除所有数据</h4>
            <p>删除所有学习数据，此操作不可恢复，请谨慎操作</p>
          </div>
          <el-button type="danger" @click="clearAllData">
            <el-icon><Delete /></el-icon>
            清除数据
          </el-button>
        </div>
      </div>
    </div>

    <!-- 账号管理 -->
    <div class="card setting-section">
      <h3 class="section-title">
        <el-icon><User /></el-icon>
        账号管理
      </h3>
      <div class="account-info">
        <div class="info-row">
          <span class="label">当前用户：</span>
          <span class="value">{{ userStore.displayName }}</span>
        </div>
        <div class="info-row" v-if="userStore.isLoggedIn">
          <span class="label">账号类型：</span>
          <el-tag type="success" size="small">已登录</el-tag>
        </div>
        <div class="info-row" v-else>
          <span class="label">账号类型：</span>
          <el-tag type="info" size="small">游客模式</el-tag>
        </div>
      </div>
      <div class="account-actions">
        <el-button type="primary" @click="handleLogout" v-if="userStore.isLoggedIn">
          退出登录
        </el-button>
        <el-button type="warning" @click="goToLogin" v-else>
          登录 / 注册
        </el-button>
        <el-button type="danger" @click="handleDeleteAccount" v-if="userStore.isLoggedIn">
          删除账号
        </el-button>
      </div>
    </div>

    <!-- 关于 -->
    <div class="card setting-section">
      <h3 class="section-title">
        <el-icon><InfoFilled /></el-icon>
        关于
      </h3>
      <div class="about-info">
        <div class="about-item">
          <span class="about-label">应用名称</span>
          <span class="about-value">11408考研助手</span>
        </div>
        <div class="about-item">
          <span class="about-label">版本</span>
          <span class="about-value">v{{ appVersion }}</span>
        </div>
        <div class="about-item">
          <span class="about-label">技术栈</span>
          <span class="about-value">Vue 3 + Electron + TypeScript</span>
        </div>
        <div class="about-item">
          <span class="about-label">数据存储</span>
          <span class="about-value">本地存储（LocalStorage）</span>
        </div>
      </div>
      <p class="about-tip">
        💡 提示：所有数据都保存在本地，请定期导出备份，防止数据丢失。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/stores'
import { useUserStore } from '@/stores/user'
import { exportAllData, importAllData, clearAllStorage } from '@/utils/storage'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  AlarmClock,
  Timer,
  FolderOpened,
  Download,
  Upload,
  Delete,
  InfoFilled,
  User,
  Setting
} from '@element-plus/icons-vue'

const store = useMainStore()
const userStore = useUserStore()
const router = useRouter()

// 从 package.json 读取版本号（通过 Vite define 注入）
const appVersion = __APP_VERSION__

// 开机自启动
const autoLaunch = ref(false)

async function loadAutoLaunch() {
  if ((window as any).electronAPI?.getAutoLaunch) {
    try {
      const res = await (window as any).electronAPI.getAutoLaunch()
      autoLaunch.value = res.enabled
    } catch (e) {
      console.error('读取开机自启状态失败:', e)
    }
  }
}

async function toggleAutoLaunch(enabled: boolean) {
  if ((window as any).electronAPI?.setAutoLaunch) {
    try {
      await (window as any).electronAPI.setAutoLaunch(enabled)
      ElMessage.success(enabled ? '已开启开机自启动' : '已关闭开机自启动')
    } catch (e) {
      console.error('设置开机自启失败:', e)
      autoLaunch.value = !enabled
      ElMessage.error('设置失败，请重试')
    }
  } else {
    autoLaunch.value = false
    ElMessage.warning('浏览器模式下不支持开机自启动')
  }
}

const examForm = reactive({
  name: store.examName,
  date: store.examDate
})

const pomodoroForm = reactive({
  workDuration: store.pomodoroSettings.workDuration,
  shortBreak: store.pomodoroSettings.breakDuration,
  longBreak: store.pomodoroSettings.longBreakDuration,
  longBreakInterval: store.pomodoroSettings.longBreakInterval,
  enableNotification: store.pomodoroSettings.enableNotification,
  enableSound: store.pomodoroSettings.enableSound,
  enableTitleFlash: store.pomodoroSettings.enableTitleFlash
})

function saveExamSettings() {
  if (!examForm.date) {
    ElMessage.warning('请选择考试日期')
    return
  }
  store.setExamDate(examForm.date, examForm.name)
  ElMessage.success('设置已保存')
}

function savePomodoroSettings() {
  store.updatePomodoroSettings({
    workDuration: pomodoroForm.workDuration,
    breakDuration: pomodoroForm.shortBreak,
    longBreakDuration: pomodoroForm.longBreak,
    longBreakInterval: pomodoroForm.longBreakInterval,
    enableNotification: pomodoroForm.enableNotification,
    enableSound: pomodoroForm.enableSound,
    enableTitleFlash: pomodoroForm.enableTitleFlash
  })
  ElMessage.success('设置已保存')
}

function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        ElMessage.success('通知权限已授权，将收到桌面通知')
        new Notification('考研助手', {
          body: '通知测试成功！番茄钟完成时会收到类似通知。',
          icon: '/favicon.ico'
        })
      } else {
        ElMessage.warning('通知权限被拒绝，不会收到桌面通知')
      }
    })
  } else {
    ElMessage.error('当前浏览器不支持桌面通知')
  }
}

async function exportData() {
  const data = exportAllData()
  
  // 优先使用 Electron 的文件对话框
  if ((window as any).electronAPI?.exportData) {
    try {
      const result = await (window as any).electronAPI.exportData(data)
      if (result.success) {
        ElMessage.success('数据导出成功！')
        return
      }
    } catch (e) {
      console.error('导出失败:', e)
    }
  }
  
  // 降级：浏览器下载
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `考研助手备份_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('数据导出成功！')
}

async function importData() {
  // 优先使用 Electron 的文件对话框
  if ((window as any).electronAPI?.importData) {
    try {
      const result = await (window as any).electronAPI.importData()
      if (result.success) {
        confirmImport(result.data)
        return
      }
    } catch (e) {
      console.error('导入失败:', e)
    }
  }
  
  // 降级：浏览器文件选择
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const data = event.target?.result as string
      confirmImport(data)
    }
    reader.readAsText(file)
  }
  input.click()
}

function confirmImport(data: string) {
  ElMessageBox.confirm(
    '导入数据会覆盖现有的所有数据，确定要继续吗？',
    '确认导入',
    {
      confirmButtonText: '确定导入',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const success = importAllData(data)
    if (success) {
      ElMessage.success('数据导入成功！页面即将刷新')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } else {
      ElMessage.error('数据导入失败，请检查文件格式')
    }
  }).catch(() => {})
}

function clearAllData() {
  ElMessageBox.confirm(
    '确定要清除所有数据吗？此操作不可恢复！',
    '警告',
    {
      confirmButtonText: '确定清除',
      cancelButtonText: '取消',
      type: 'error'
    }
  ).then(() => {
    clearAllStorage()
    ElMessage.success('数据已清除，页面即将刷新')
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }).catch(() => {})
}

function handleLogout() {
  userStore.logout()
  ElMessage.success('已退出登录')
  router.push('/login')
}

function goToLogin() {
  router.push('/login')
}

function handleDeleteAccount() {
  ElMessageBox.confirm(
    `确定要删除账号「${userStore.displayName}」吗？该操作将删除账号下的所有数据，且不可恢复！`,
    '删除账号',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'error'
    }
  ).then(() => {
    const username = userStore.currentUsername
    userStore.deleteAccount(username)
    ElMessage.success('账号已删除，页面即将刷新')
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }).catch(() => {})
}

onMounted(() => {
  loadAutoLaunch()
  // 番茄钟设置已通过 store 初始化，无需额外加载
})
</script>

<style scoped>
.settings-page {
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--mo-text-3);
  margin-bottom: 24px;
}

.setting-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--mo-text-1);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 20px 0;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.6);
}

.section-desc {
  font-size: 14px;
  color: var(--mo-text-3);
  margin: -10px 0 20px 0;
}

.unit {
  margin-left: 10px;
  font-size: 14px;
  color: var(--mo-text-2);
}

.unit-desc {
  margin-left: 10px;
  font-size: 13px;
  color: var(--mo-text-3);
}

/* 数据管理 */
.data-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.data-action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: var(--mo-surface);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.data-action-item:hover {
  background: rgba(255, 255, 255, 0.6);
}

.data-action-item.danger {
  background: #f5eaea;
}

.data-action-item.danger:hover {
  background: #ecdcdc;
}

.action-info h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin: 0 0 6px 0;
}

.action-info p {
  font-size: 13px;
  color: var(--mo-text-3);
  margin: 0;
}

/* 账号管理 */
.account-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--mo-surface);
  border-radius: 10px;
}

.info-row .label {
  font-size: 14px;
  color: var(--mo-text-3);
  min-width: 80px;
}

.info-row .value {
  font-size: 14px;
  color: var(--mo-text-1);
  font-weight: 600;
}

.account-actions {
  display: flex;
  gap: 12px;
}

/* 关于 */
.about-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.about-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--mo-surface);
  border-radius: 10px;
}

.about-label {
  font-size: 14px;
  color: var(--mo-text-3);
}

.about-value {
  font-size: 14px;
  color: var(--mo-text-1);
  font-weight: 500;
}

.about-tip {
  font-size: 13px;
  color: #f59e0b;
  padding: 12px 16px;
  background: #f3eee4;
  border-radius: 10px;
  margin: 0;
}
</style>
