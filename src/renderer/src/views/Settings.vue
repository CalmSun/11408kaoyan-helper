<template>
  <div class="settings-page fade-in">
    <h1 class="page-title">设置</h1>
    <p class="page-subtitle">个性化你的考研助手</p>

    <!-- 考试设置 -->
    <GlassCard class="card setting-section">
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
    </GlassCard>

    <!-- 番茄钟设置 -->
    <GlassCard class="card setting-section">
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
        <el-form-item label="提示音音量" v-if="pomodoroForm.enableSound">
          <el-slider
            v-model="pomodoroForm.soundVolume"
            :min="0"
            :max="100"
            :step="1"
            :format-tooltip="(val: number) => `${val}%`"
            style="width: 300px;"
          />
          <span class="unit-desc">{{ pomodoroForm.soundVolume }}%</span>
        </el-form-item>
        <el-form-item label="标题闪烁">
          <el-switch v-model="pomodoroForm.enableTitleFlash" />
          <span class="unit-desc">切换其他标签页时，浏览器标题闪烁提醒</span>
        </el-form-item>
        <el-form-item label="强制全屏">
          <el-switch v-model="pomodoroForm.forceFullscreen" />
          <span class="unit-desc">开启即生效，进入全屏隐藏系统任务栏减少干扰（全局设置）</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="savePomodoroSettings">保存设置</el-button>
          <el-button @click="requestNotificationPermission">测试通知权限</el-button>
        </el-form-item>
      </el-form>
    </GlassCard>

    <!-- 通用设置 -->
    <GlassCard class="card setting-section">
      <h3 class="section-title">
        <el-icon><Setting /></el-icon>
        通用设置
      </h3>
      <el-form label-width="120px" style="max-width: 500px;">
        <el-form-item label="外观主题">
          <el-radio-group v-model="currentThemeMode" @change="handleThemeChange">
            <el-radio-button value="light">浅色</el-radio-button>
            <el-radio-button value="dark">深色</el-radio-button>
            <el-radio-button value="system">跟随系统</el-radio-button>
          </el-radio-group>
          <span class="unit-desc">侧边栏底部也可一键切换深浅色</span>
        </el-form-item>
        <el-form-item label="浅色背景">
          <el-button type="primary" plain :loading="bgBusy" @click="chooseCustomBg">选择图片</el-button>
          <el-button :disabled="!customBgOn || bgBusy" @click="resetCustomBg">恢复默认</el-button>
          <span class="unit-desc">自定义浅色模式的全屏背景图（深色模式不受影响）</span>
        </el-form-item>
        <!-- v3.0.0：增强液态玻璃模式 -->
        <el-form-item label="液态玻璃">
          <el-switch v-model="liquidGlassOn" @change="handleLiquidGlassChange" />
          <span class="unit-desc">开启增强版液态玻璃效果（更强模糊、动态高光、流动背景）</span>
        </el-form-item>
        <el-form-item label="开机自启动">
          <el-switch v-model="autoLaunch" @change="toggleAutoLaunch" />
          <span class="unit-desc">开机时自动启动考研助手</span>
        </el-form-item>
      </el-form>
    </GlassCard>

    <!-- v3.3.3：音乐播放设置 -->
    <GlassCard class="card setting-section">
      <h3 class="section-title">
        <el-icon><Headset /></el-icon>
        音乐播放
      </h3>
      <el-form label-width="120px" style="max-width: 500px;">
        <el-form-item label="在线音质">
          <el-select
            v-model="musicQualityLevel"
            @change="handleQualityChange"
            style="width: 200px;"
          >
            <el-option label="标准 (128kbps)" value="standard" />
            <el-option label="较高 (192kbps)" value="higher" />
            <el-option label="极高 (320kbps MP3)" value="exhigh" />
            <el-option label="无损 (FLAC)" value="lossless" />
            <el-option label="Hi-Res (母带级)" value="hires" />
          </el-select>
          <span class="unit-desc">影响在线歌曲播放音质（无损/Hi-Res 需登录 VIP 账号）</span>
        </el-form-item>
      </el-form>
    </GlassCard>

    <!-- 数据管理 -->
    <GlassCard class="card setting-section">
      <h3 class="section-title">
        <el-icon><FolderOpened /></el-icon>
        数据管理
      </h3>
      <p class="section-desc">所有学习数据实时存储于本地 LocalStorage，退出时自动保存。可导出数据文件迁移到其他设备。</p>
      
      <div class="data-actions">
        <div class="data-action-item">
          <div class="action-info">
            <h4>导出备份</h4>
            <p>将所有学习数据导出为 JSON 文件<br/>
            <span class="muted" style="font-size:12px;color:var(--mo-text-3)">固定保存位置：D:\下载\文档\11408kaoyan-helper\</span></p>
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
    </GlassCard>

    <!-- 项目与更新 -->
    <GlassCard class="card setting-section">
      <h3 class="section-title">
        <el-icon><Link /></el-icon>
        项目与更新
      </h3>
      <div class="about-info">
        <div class="about-item">
          <span class="about-label">项目地址</span>
          <el-link type="primary" :underline="false" @click="openGithub">
            github.com/CalmSun/11408kaoyan-helper
          </el-link>
        </div>
        <div class="about-item">
          <span class="about-label">当前版本</span>
          <span class="about-value">v{{ appVersion }}</span>
        </div>
        <div class="about-item" v-if="latestVersion">
          <span class="about-label">最新版本</span>
          <span class="about-value">v{{ latestVersion }}</span>
        </div>
        <div class="about-item" v-if="downloadProgress >= 0">
          <span class="about-label">下载进度</span>
          <span class="about-value">{{ downloadProgress }}%</span>
        </div>
      </div>
      <div class="update-actions">
        <el-button type="primary" :loading="checkingUpdate" @click="handleCheckUpdate">
          <el-icon><RefreshRight /></el-icon>
          检测更新
        </el-button>
        <el-button
          type="success"
          v-if="updateAvailable"
          :loading="downloadingUpdate"
          @click="handleDownloadUpdate"
        >
          <el-icon><Download /></el-icon>
          下载更新
        </el-button>
        <el-button type="warning" v-if="updateDownloaded" @click="handleInstallUpdate">
          <el-icon><Upload /></el-icon>
          安装并重启
        </el-button>
        <el-button @click="openGithub">
          <el-icon><Link /></el-icon>
          打开项目主页
        </el-button>
      </div>
      <p class="about-tip">
        💡 提示：检测到新版本后可一键下载并安装；安装时应用会自动重启。开发环境下无法在线更新。
      </p>
    </GlassCard>

    <!-- 关于 -->
    <GlassCard class="card setting-section">
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
    </GlassCard>

    <!-- v3.3.5：报错日志 -->
    <GlassCard class="card setting-section">
      <h3 class="section-title">
        <el-icon><Warning /></el-icon>
        报错日志
        <span class="log-count-badge" v-if="store.errorLogs.length > 0">{{ store.errorLogs.length }}</span>
        <el-button
          size="small"
          link
          type="danger"
          style="margin-left: auto;"
          @click="handleClearLogs"
          :disabled="store.errorLogs.length === 0"
        >
          <el-icon><CircleClose /></el-icon> 清空日志
        </el-button>
        <el-button
          size="small"
          link
          type="primary"
          @click="handleCopyLogs"
          :disabled="store.errorLogs.length === 0"
          style="margin-left: 8px;"
        >
          <el-icon><DocumentCopy /></el-icon> 复制全部
        </el-button>
      </h3>
      <p class="section-desc">
        记录路由加载、组件渲染、异步异常等运行时错误。遇到「点击没反应」「页面空白」等问题时，可将下方日志发给开发者定位。
      </p>
      <div v-if="store.errorLogs.length === 0" class="logs-empty">
        <el-icon :size="36"><CircleCheck /></el-icon>
        <p>暂无报错记录，运行一切正常 ✅</p>
      </div>
      <div v-else class="logs-list">
        <div
          v-for="(log, idx) in store.errorLogs"
          :key="idx"
          class="log-item"
          :class="'log-type-' + log.type"
        >
          <div class="log-header">
            <el-tag size="small" :type="logTagType(log.type)" effect="light">{{ logTypeLabel(log.type) }}</el-tag>
            <span class="log-time">{{ formatLogTime(log.time) }}</span>
            <el-button
              size="small"
              link
              type="primary"
              class="log-copy-btn"
              @click="copySingleLog(log)"
            >复制</el-button>
          </div>
          <div class="log-message">{{ log.message }}</div>
          <div v-if="log.stack" class="log-stack" @click="toggleStack(idx)">
            <el-icon class="stack-arrow" :class="{ expanded: expandedStacks.has(idx) }"><ArrowRight /></el-icon>
            <span>展开堆栈</span>
          </div>
          <pre v-if="log.stack && expandedStacks.has(idx)" class="log-stack-content">{{ log.stack }}</pre>
        </div>
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/stores'
import { useUserStore } from '@/stores/user'
import { useMusicStore } from '@/stores/music'
import { exportAllData, importAllData, clearAllStorage } from '@/utils/storage'
import { themeMode, setThemeMode, applyCustomBg, initCustomBg, CUSTOM_BG_URL, type ThemeMode, liquidGlass, setLiquidGlass } from '@/utils/theme'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  AlarmClock,
  Timer,
  Download,
  Upload,
  Delete,
  InfoFilled,
  User,
  Setting,
  Link,
  Box,
  Headset,
  Warning,
  CircleClose,
  DocumentCopy,
  CircleCheck,
  ArrowRight
} from '@element-plus/icons-vue'

const store = useMainStore()
const userStore = useUserStore()
const musicStore = useMusicStore()
const router = useRouter()

// 从 package.json 读取版本号（通过 Vite define 注入）
const appVersion = __APP_VERSION__

// v3.3.3：在线歌曲音质等级
const musicQualityLevel = ref(musicStore.qualityLevel)
function handleQualityChange(level: string) {
  musicStore.setQualityLevel(level)
  const labelMap: Record<string, string> = {
    standard: '标准',
    higher: '较高',
    exhigh: '极高',
    lossless: '无损',
    hires: 'Hi-Res'
  }
  ElMessage.success(`音质已切换为：${labelMap[level] || level}（下一首生效）`)
}

// 外观主题
const currentThemeMode = ref<ThemeMode>(themeMode.value)

function handleThemeChange(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.add('theme-anim')
  setThemeMode(mode)
  window.setTimeout(() => root.classList.remove('theme-anim'), 350)
  ElMessage.success(mode === 'system' ? '已切换为跟随系统主题' : mode === 'dark' ? '已切换为深色模式' : '已切换为浅色模式')
}

// v3.0.0：液态玻璃模式
const liquidGlassOn = ref(liquidGlass.value)

function handleLiquidGlassChange(on: boolean) {
  setLiquidGlass(on)
  ElMessage.success(on ? '已开启液态玻璃效果' : '已关闭液态玻璃效果')
}

// ── 项目与更新（v2.6.7） ──
const GITHUB_PROJECT_URL = 'https://github.com/CalmSun/11408kaoyan-helper'
const checkingUpdate = ref(false)
const downloadingUpdate = ref(false)
const updateAvailable = ref(false)
const updateDownloaded = ref(false)
const latestVersion = ref<string | null>(null)
const downloadProgress = ref(-1)

function openGithub() {
  const api = window.electronAPI
  if (api?.openGithub) {
    api.openGithub()
  } else {
    window.open(GITHUB_PROJECT_URL, '_blank')
  }
}

async function handleCheckUpdate() {
  const api = window.electronAPI
  if (!api?.checkUpdate) {
    ElMessage.warning('当前环境（浏览器）不支持在线更新，请访问项目主页获取最新版本')
    return
  }
  checkingUpdate.value = true
  updateAvailable.value = false
  updateDownloaded.value = false
  latestVersion.value = null
  downloadProgress.value = -1
  try {
    const res = await api.checkUpdate()
    if (!res.success) {
      ElMessage.warning('检测更新失败（开发环境或网络原因），可访问项目主页手动更新')
    }
  } catch {
    ElMessage.warning('检测更新失败，请稍后重试')
  } finally {
    checkingUpdate.value = false
  }
}

async function handleDownloadUpdate() {
  const api = window.electronAPI
  if (!api?.downloadUpdate) return
  downloadingUpdate.value = true
  downloadProgress.value = 0
  try {
    const res = await api.downloadUpdate()
    if (!res.success) {
      ElMessage.error('下载更新失败，请稍后重试')
      downloadProgress.value = -1
    }
  } catch {
    ElMessage.error('下载更新失败，请稍后重试')
    downloadProgress.value = -1
  } finally {
    downloadingUpdate.value = false
  }
}

function handleInstallUpdate() {
  window.electronAPI?.installUpdate()
}

// 注册更新事件（主进程推送）
window.electronAPI?.onUpdateEvent((channel, payload) => {
  switch (channel) {
    case 'update:available': {
      updateAvailable.value = true
      const v = (payload as { version?: string })?.version
      latestVersion.value = v || null
      ElMessage.success(v ? `发现新版本 v${v}，点击下载更新` : '发现新版本，点击下载更新')
      break
    }
    case 'update:not-available':
      updateAvailable.value = false
      ElMessage.success('当前已是最新版本')
      break
    case 'update:progress':
      downloadProgress.value = (payload as { percent?: number })?.percent ?? downloadProgress.value
      break
    case 'update:downloaded':
      updateDownloaded.value = true
      downloadingUpdate.value = false
      downloadProgress.value = 100
      ElMessage.success('更新已下载完成，点击"安装并重启"立即安装')
      break
    case 'update:error':
      downloadingUpdate.value = false
      downloadProgress.value = -1
      ElMessage.error('更新失败，可访问项目主页手动更新')
      break
  }
})

// 自定义浅色背景
const customBgOn = ref(false)
const bgBusy = ref(false)

async function refreshCustomBgState() {
  const api = window.electronAPI
  if (api?.getCustomBg) {
    try {
      customBgOn.value = (await api.getCustomBg()).enabled
    } catch {
      customBgOn.value = false
    }
  }
}

async function chooseCustomBg() {
  const api = window.electronAPI
  if (!api?.setCustomBg) {
    ElMessage.warning('当前环境不支持自定义背景')
    return
  }
  bgBusy.value = true
  try {
    const res = await api.setCustomBg()
    if (res.success) {
      customBgOn.value = true
      // 追加时间戳避免浏览器缓存旧图
      applyCustomBg(`${CUSTOM_BG_URL}?t=${Date.now()}`)
      ElMessage.success('已应用自定义背景')
    }
  } finally {
    bgBusy.value = false
  }
}

async function resetCustomBg() {
  const api = window.electronAPI
  if (!api?.clearCustomBg) return
  bgBusy.value = true
  try {
    await api.clearCustomBg()
    customBgOn.value = false
    applyCustomBg(null)
    ElMessage.success('已恢复默认背景')
  } finally {
    bgBusy.value = false
  }
}

onMounted(() => {
  refreshCustomBgState()
  initCustomBg()
})

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
  enableTitleFlash: store.pomodoroSettings.enableTitleFlash,
  forceFullscreen: store.pomodoroSettings.forceFullscreen,
  soundVolume: store.pomodoroSettings.soundVolume
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
    enableTitleFlash: pomodoroForm.enableTitleFlash,
    forceFullscreen: pomodoroForm.forceFullscreen,
    soundVolume: pomodoroForm.soundVolume
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

// ============ v3.3.5：报错日志 ============
import type { AppErrorLog } from '@/stores'
const expandedStacks = ref<Set<number>>(new Set())

function logTypeLabel(type: string): string {
  const map: Record<string, string> = {
    router: '路由加载',
    vue: 'Vue 渲染',
    runtime: '运行时',
    api: '接口请求'
  }
  return map[type] || type
}
function logTagType(type: string): '' | 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    router: 'danger',
    vue: 'danger',
    runtime: 'warning',
    api: 'warning'
  }
  return map[type] || 'info'
}
function formatLogTime(t: number): string {
  try {
    const d = new Date(t)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return String(t)
  }
}
function toggleStack(idx: number) {
  const s = new Set(expandedStacks.value)
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
  expandedStacks.value = s
}
function buildLogText(log: AppErrorLog): string {
  return `[${logTypeLabel(log.type)}] ${formatLogTime(log.time)}\n${log.message}${log.stack ? '\n' + log.stack : ''}`
}
async function copySingleLog(log: AppErrorLog) {
  try {
    await navigator.clipboard.writeText(buildLogText(log))
    ElMessage.success('已复制该条日志到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选择文本复制')
  }
}
async function handleCopyLogs() {
  try {
    const text = store.errorLogs.map(buildLogText).join('\n\n───────\n\n')
    await navigator.clipboard.writeText(text)
    ElMessage.success(`已复制全部 ${store.errorLogs.length} 条日志`)
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}
function handleClearLogs() {
  ElMessageBox.confirm('确定清空全部报错日志吗？', '清空日志', {
    confirmButtonText: '确定清空',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    store.clearErrorLogs()
    expandedStacks.value = new Set()
    ElMessage.success('日志已清空')
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
  border-bottom: 1px solid var(--glass-border);
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
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.data-action-item:hover {
  background: var(--mo-surface-hover);
}

.data-action-item.danger {
  background: rgba(239, 68, 68, 0.08);
}

.data-action-item.danger:hover {
  background: rgba(239, 68, 68, 0.14);
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

.update-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.about-tip {
  font-size: 13px;
  color: var(--mo-warning);
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.12);
  border-radius: 10px;
  margin: 0;
}

/* 数据目录（v2.8.0） */
.datadir-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.datadir-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--mo-surface);
  border-radius: 10px;
}

.datadir-label {
  font-size: 14px;
  color: var(--mo-text-3);
  min-width: 70px;
  flex-shrink: 0;
}

.datadir-value {
  font-size: 13px;
  color: var(--mo-text-1);
  font-family: Consolas, monospace;
  word-break: break-all;
}

.datadir-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* v3.3.5：报错日志面板 */
.log-count-badge {
  background: var(--el-color-danger);
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  line-height: 1.4;
}

.logs-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--mo-text-3);
}
.logs-empty > p {
  margin-top: 12px;
  font-size: 14px;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 520px;
  overflow-y: auto;
  padding-right: 4px;
}

.log-item {
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--mo-surface);
}
.log-item.log-type-router,
.log-item.log-type-vue {
  border-left: 3px solid var(--el-color-danger);
}
.log-item.log-type-runtime {
  border-left: 3px solid var(--el-color-warning);
}

.log-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.log-time {
  font-size: 12px;
  color: var(--mo-text-3);
  font-family: Consolas, monospace;
}
.log-copy-btn {
  margin-left: auto !important;
}

.log-message {
  font-size: 13px;
  color: var(--mo-text-1);
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
}

.log-stack {
  margin-top: 8px;
  font-size: 12px;
  color: var(--mo-text-3);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  user-select: none;
}
.log-stack:hover {
  color: var(--el-color-primary);
}
.stack-arrow {
  transition: transform 0.15s ease;
  font-size: 12px;
}
.stack-arrow.expanded {
  transform: rotate(90deg);
}

.log-stack-content {
  margin: 8px 0 0 0;
  padding: 10px 12px;
  background: #1f1f1f;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.5;
  border-radius: 8px;
  max-height: 260px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: Consolas, 'Cascadia Code', monospace;
}
</style>
