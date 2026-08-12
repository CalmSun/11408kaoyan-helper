import { app, BrowserWindow, ipcMain, dialog, nativeTheme, protocol, net, Tray, Menu, nativeImage, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as path from 'path'
import * as fs from 'fs'
import { pathToFileURL } from 'url'

// GitHub 项目地址（设置页展示 + 更新来源说明）
export const GITHUB_REPO_URL = 'https://github.com/CalmSun/11408kaoyan-helper'

// ── 数据目录（v2.8.0）：默认"文档\11408kaoyan-helper"，不在 C 盘应用数据区，可在设置中自定义 ──

const DATA_DIR_CONFIG = path.join(app.getPath('userData'), 'data-dir.json')
let cachedDataDir: string | null = null

/** 默认数据目录：用户文档下的"11408kaoyan-helper"（文档通常不在 C 盘系统区，且用户可自行迁移） */
function defaultDataDir(): string {
  return path.join(app.getPath('documents'), '11408kaoyan-helper')
}

/** 读取已配置的数据目录（带缓存） */
function getDataDir(): string {
  if (cachedDataDir) return cachedDataDir
  try {
    if (fs.existsSync(DATA_DIR_CONFIG)) {
      const cfg = JSON.parse(fs.readFileSync(DATA_DIR_CONFIG, 'utf-8')) as { dir?: string }
      if (cfg.dir && typeof cfg.dir === 'string' && fs.existsSync(cfg.dir)) {
        cachedDataDir = cfg.dir
        return cfg.dir
      }
    }
  } catch {
    // 配置损坏：回退默认目录
  }
  cachedDataDir = defaultDataDir()
  return cachedDataDir
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

/** 自定义背景图存储路径（v2.8.0：移至数据目录） */
function customBgPath(): string {
  return path.join(getDataDir(), 'custom-bg.jpg')
}

/** 自动备份文件路径（数据目录内，应用每次启动覆盖一份最新数据） */
function autoBackupPath(): string {
  return path.join(getDataDir(), 'auto-backup.json')
}

/** 启动迁移：旧版本存于 userData 的背景图与自动备份，迁移到数据目录 */
function migrateLegacyDataFiles(): void {
  try {
    ensureDir(getDataDir())
    const legacyBg = path.join(app.getPath('userData'), 'custom-bg.jpg')
    if (fs.existsSync(legacyBg) && !fs.existsSync(customBgPath())) {
      fs.copyFileSync(legacyBg, customBgPath())
      fs.unlinkSync(legacyBg)
    }
    const legacyBackup = path.join(app.getPath('userData'), 'auto-backup.json')
    if (fs.existsSync(legacyBackup) && !fs.existsSync(autoBackupPath())) {
      fs.copyFileSync(legacyBackup, autoBackupPath())
      fs.unlinkSync(legacyBackup)
    }
  } catch {
    // 迁移失败不影响启动
  }
}

// ── 音乐文件白名单（v2.8.0：协议播放仅放行已选目录内的音频） ──

const MUSIC_EXTS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma', '.opus']
const MUSIC_MAX_FILES = 2000
const musicWhitelist = new Map<string, string>() // token -> 绝对路径
let musicRootDir = ''

function newToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// 注册私有协议：
// - kaoyan-bg://    用户自定义背景图
// - kaoyan-music:// 音乐文件夹内音频（白名单校验，v2.8.0 流式播放不占内存）
// - kaoyan-data://  数据目录内备份文件（自动备份预览/读取）
protocol.registerSchemesAsPrivileged([
  { scheme: 'kaoyan-bg', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'kaoyan-music', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  { scheme: 'kaoyan-data', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false       // 是否真正退出（区分"关闭隐藏到托盘"与"托盘菜单退出"）
let trayHintShown = false    // 托盘提示气泡是否已展示过

// 托盘图标路径：开发环境取项目 resources 目录，打包后取 extraResources 输出目录
function trayIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'tray-icon.png')
    : path.join(__dirname, '../../resources/tray-icon.png')
}

// 窗口背景色跟随系统深浅主题（避免加载瞬间白屏闪烁与深色主题冲突）
function getWindowBgColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#0b1220' : '#e8f0ff'
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '考研助手',
    backgroundColor: getWindowBgColor(),
    frame: false, // v2.6.6：无边框窗口，顶栏与窗口控制按钮全部由渲染层自建
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 关闭按钮默认隐藏到托盘；仅托盘菜单"退出"才真正退出应用
  mainWindow.on('close', (e) => {
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault()
      mainWindow.hide()
      showTrayHint()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 首次隐藏到托盘时给出气泡提示（仅 Windows）
function showTrayHint() {
  if (trayHintShown || !tray || process.platform !== 'win32') return
  try {
    tray.displayBalloon({
      iconType: 'none',
      title: '11408考研助手',
      content: '应用已隐藏到托盘，双击图标可重新打开，右键菜单可完全退出'
    })
    trayHintShown = true
  } catch {
    // 气泡展示失败不影响主流程
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(trayIconPath())
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('11408考研助手')

  const menu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出考研助手',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)

  // 双击托盘图标恢复窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// 单实例锁：避免重复启动多个应用实例
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // 初始化数据目录并迁移旧版本文件（v2.8.0）
    migrateLegacyDataFiles()

    // 自定义背景协议：存在自定义背景文件时才提供内容
    protocol.handle('kaoyan-bg', (request) => {
      const file = customBgPath()
      if (!fs.existsSync(file)) {
        return new Response('not found', { status: 404 })
      }
      return net.fetch(pathToFileURL(file).toString())
    })

    // 音乐协议：仅放行白名单 token 对应的音频文件（流式读取，不占内存）
    protocol.handle('kaoyan-music', (request) => {
      try {
        const url = new URL(request.url)
        const token = decodeURIComponent(url.host + url.pathname).replace(/^\/+/, '').split('/')[0]
        const file = musicWhitelist.get(token)
        if (!file || !fs.existsSync(file)) {
          return new Response('not found', { status: 404 })
        }
        // 二次校验：文件必须仍在已选音乐目录内
        const resolved = path.resolve(file)
        if (!musicRootDir || !resolved.startsWith(path.resolve(musicRootDir) + path.sep)) {
          return new Response('forbidden', { status: 403 })
        }
        return net.fetch(pathToFileURL(resolved).toString())
      } catch {
        return new Response('bad request', { status: 400 })
      }
    })

    // 数据目录协议：仅暴露数据目录内的 json 备份文件
    protocol.handle('kaoyan-data', (request) => {
      try {
        const url = new URL(request.url)
        const name = decodeURIComponent(url.host + url.pathname).replace(/^\/+/, '')
        if (!/^[\w.-]+\.json$/.test(name)) {
          return new Response('forbidden', { status: 403 })
        }
        const file = path.join(getDataDir(), name)
        if (!fs.existsSync(file)) {
          return new Response('not found', { status: 404 })
        }
        return net.fetch(pathToFileURL(file).toString())
      } catch {
        return new Response('bad request', { status: 400 })
      }
    })

    createWindow()
    createTray()

    // 系统主题变化时同步窗口背景色
    nativeTheme.on('updated', () => {
      mainWindow?.setBackgroundColor(getWindowBgColor())
    })

    // 应用内自动更新：不自动下载，由用户在设置页手动触发
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update:available', { version: info.version })
    })
    autoUpdater.on('update-not-available', () => {
      mainWindow?.webContents.send('update:not-available')
    })
    autoUpdater.on('download-progress', (p) => {
      mainWindow?.webContents.send('update:progress', { percent: Math.round(p.percent) })
    })
    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('update:downloaded')
    })
    autoUpdater.on('error', (err) => {
      mainWindow?.webContents.send('update:error', { message: String(err?.message || err) })
    })

    // 启动时自动检测新版本（v2.7.0：延迟静默执行，失败不打扰用户）
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => { /* 开发环境/网络失败静默 */ })
    }, 5000)

    app.on('activate', () => {
      if (mainWindow) {
        mainWindow.show()
      } else if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

// 托盘菜单"退出"触发 before-quit 时放行真正的退出
app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ── 窗口控制（v2.6.6：自建顶栏按钮通过 IPC 控制窗口） ──

ipcMain.on('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('window:toggle-maximize', () => {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
})

// 自建关闭按钮：与原生关闭同语义——隐藏到托盘而非退出
ipcMain.on('window:close-to-tray', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
    showTrayHint()
  }
})

// 强制全屏（v2.7.0 引入；v2.8.0 开启即生效，与番茄钟运行状态解耦）
ipcMain.on('window:set-fullscreen', (_e, on: boolean) => {
  if (!mainWindow) return
  mainWindow.setFullScreen(!!on)
})

// ── 音乐文件夹选择（v2.8.0：仅扫描文件名清单，播放走协议流式读取，大文件夹不占内存） ──

ipcMain.handle('music:pick-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择音乐文件夹',
    properties: ['openDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true, files: [] }
  }

  const root = result.filePaths[0]
  const names: string[] = []

  function walk(dir: string) {
    if (names.length >= MUSIC_MAX_FILES) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (names.length >= MUSIC_MAX_FILES) return
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && MUSIC_EXTS.includes(path.extname(entry.name).toLowerCase())) {
        try {
          // 只记录相对路径，不读文件内容
          names.push(path.relative(root, full))
        } catch {
          // 跳过异常文件
        }
      }
    }
  }

  walk(root)
  if (names.length === 0) {
    return { success: true, canceled: false, files: [] }
  }

  names.sort((a, b) => a.localeCompare(b, 'zh-CN'))

  // 重建白名单：token -> 绝对路径
  musicWhitelist.clear()
  musicRootDir = root
  const files = names.map(rel => {
    const token = newToken()
    musicWhitelist.set(token, path.join(root, rel))
    return { name: rel, url: `kaoyan-music://${token}` }
  })

  return { success: true, canceled: false, files }
})

// ── 国内天气服务（v2.8.0：中国天气网数据源，主进程代理避免跨域） ──

const gbkDecoder = new TextDecoder('gbk')

/**
 * 解码天气接口响应（v2.8.1 修复乱码）：
 * 中国天气网不同节点返回编码不一致（部分 GBK、部分 UTF-8），
 * 优先按响应头 charset 声明解码；未声明时先尝试严格 UTF-8，失败回退 GBK。
 */
async function decodeWeatherResponse(res: Response): Promise<string> {
  const buf = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || ''
  if (/charset\s*=\s*(utf-?8)/i.test(contentType)) {
    return new TextDecoder('utf-8').decode(buf)
  }
  if (/charset\s*=\s*(gbk|gb2312|gb18030)/i.test(contentType)) {
    return gbkDecoder.decode(buf)
  }
  try {
    const utf8Text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
    // 少数 GBK 页面恰好能通过 UTF-8 校验：若页面内声明了 gb 系编码则仍按 GBK 解码
    if (/charset\s*=\s*["']?(gbk|gb2312|gb18030)/i.test(utf8Text)) {
      return gbkDecoder.decode(buf)
    }
    return utf8Text
  } catch {
    return gbkDecoder.decode(buf)
  }
}

/** 实时天气：合并实况接口（sk_2d）与今日预报接口（weather_index） */
ipcMain.handle('weather:current', async (_e, cityId: string) => {
  try {
    const id = /^\d{5,12}$/.test(String(cityId || '')) ? cityId : '101010100'
    const ts = Date.now()
    const headers = { Referer: 'http://www.weather.com.cn/' }
    const [skRes, fcRes] = await Promise.all([
      net.fetch(`http://d1.weather.com.cn/sk_2d/${id}.html?_=${ts}`, { headers }),
      net.fetch(`http://d1.weather.com.cn/weather_index/${id}.html?_=${ts}`, { headers }).catch(() => null)
    ])
    if (!skRes.ok) return { success: false, message: `http ${skRes.status}` }
    const skText = await decodeWeatherResponse(skRes)
    const skMatch = skText.match(/var\s+dataSK\s*=\s*(\{[\s\S]*\})/)
    if (!skMatch) return { success: false, message: '解析失败' }
    const data = JSON.parse(skMatch[1]) as Record<string, string>

    // 合并今日最高/最低气温与预报天气（预报接口失败不影响实况）
    if (fcRes && fcRes.ok) {
      try {
        const fcText = await decodeWeatherResponse(fcRes)
        const fcMatch = fcText.match(/var\s+cityDZ\s*=\s*(\{[\s\S]*?\});/)
        if (fcMatch) {
          const fc = JSON.parse(fcMatch[1]) as { weatherinfo?: Record<string, string> }
          const info = fc.weatherinfo || {}
          if (info.temp) data.tempMax = info.temp
          if (info.tempn) data.tempMin = info.tempn
        }
      } catch {
        // 预报解析失败忽略
      }
    }
    return { success: true, data }
  } catch (err) {
    return { success: false, message: String((err as Error)?.message || err) }
  }
})

/** 城市搜索：toy1.weather.com.cn 检索接口 */
ipcMain.handle('weather:search', async (_e, name: string) => {
  try {
    const q = encodeURIComponent(String(name || '').trim())
    if (!q) return { success: false, results: [] }
    const res = await net.fetch(`http://toy1.weather.com.cn/search?cityname=${q}&_=${Date.now()}`, {
      headers: { Referer: 'http://www.weather.com.cn/' }
    })
    if (!res.ok) return { success: false, results: [] }
    const text = await decodeWeatherResponse(res)
    const m = text.match(/\[[\s\S]*\]/)
    if (!m) return { success: true, results: [] }
    const arr = JSON.parse(m[0]) as { ref?: string }[]
    const results = arr
      .map(item => (item.ref || '').split('~'))
      .filter(p => p.length >= 9 && /^\d+$/.test(p[0]))
      .slice(0, 10)
      .map(p => ({ id: p[0], name: p[2], province: p[8] }))
    return { success: true, results }
  } catch (err) {
    return { success: false, results: [], message: String((err as Error)?.message || err) }
  }
})

// ── 数据目录管理（v2.8.0） ──

/** 查询当前数据目录 */
ipcMain.handle('data:get-dir', async () => {
  return { dir: getDataDir() }
})

/** 自定义数据目录：校验可写后迁移背景图与自动备份 */
ipcMain.handle('data:set-dir', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择数据存储目录',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true }
  }
  const dir = result.filePaths[0]
  try {
    ensureDir(dir)
    // 写入测试：确认目录可写
    const probe = path.join(dir, '.kaoyan-probe')
    fs.writeFileSync(probe, 'ok')
    fs.unlinkSync(probe)

    const oldBg = customBgPath()
    const oldBackup = autoBackupPath()
    cachedDataDir = dir
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(DATA_DIR_CONFIG, JSON.stringify({ dir }), 'utf-8')

    // 迁移已有背景图与自动备份（同盘移动，跨盘自动降级为复制）
    if (fs.existsSync(oldBg)) {
      try { fs.renameSync(oldBg, customBgPath()) } catch { fs.copyFileSync(oldBg, customBgPath()) }
    }
    if (fs.existsSync(oldBackup)) {
      try { fs.renameSync(oldBackup, autoBackupPath()) } catch { fs.copyFileSync(oldBackup, autoBackupPath()) }
    }
    return { success: true, dir }
  } catch (err) {
    return { success: false, message: String((err as Error)?.message || err) }
  }
})

/** 在资源管理器中打开数据目录 */
ipcMain.handle('data:open-dir', async () => {
  try {
    ensureDir(getDataDir())
    await shell.openPath(getDataDir())
    return { success: true }
  } catch {
    return { success: false }
  }
})

/** 同步数据到数据目录（渲染进程定期推送全量数据快照，覆盖写入） */
ipcMain.handle('data:sync', async (_e, json: string) => {
  try {
    ensureDir(getDataDir())
    fs.writeFileSync(autoBackupPath(), json, 'utf-8')
    return { success: true, path: autoBackupPath() }
  } catch (err) {
    return { success: false, message: String((err as Error)?.message || err) }
  }
})

// 学习报告 PDF 导出（v2.7.0：隐藏窗口渲染 HTML 后 printToPDF）
ipcMain.handle('report:export-pdf', async (_event, html: string) => {
  const result = await dialog.showSaveDialog({
    title: '导出学习报告',
    defaultPath: `学习报告_${new Date().toISOString().slice(0, 10)}.pdf`,
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
  })

  if (result.canceled || !result.filePath) {
    return { success: false }
  }

  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    // 等待图表渲染完成
    await new Promise((resolve) => setTimeout(resolve, 800))
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    })
    fs.writeFileSync(result.filePath, pdf)
    return { success: true, path: result.filePath }
  } catch (err) {
    return { success: false, message: String((err as Error)?.message || err) }
  } finally {
    win.destroy()
  }
})

// 导出数据
ipcMain.handle('export-data', async (_event, data: string) => {
  const result = await dialog.showSaveDialog({
    title: '导出备份数据',
    defaultPath: `考研助手备份_${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  })

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, data, 'utf-8')
    return { success: true, path: result.filePath }
  }
  return { success: false }
})

// 导入数据
ipcMain.handle('import-data', async () => {
  const result = await dialog.showOpenDialog({
    title: '导入备份数据',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    properties: ['openFile']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8')
    return { success: true, data: content }
  }
  return { success: false }
})

// 开机自启动 - 设置
ipcMain.handle('set-auto-launch', async (_event, enabled: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  })
  return { success: true, enabled }
})

// 开机自启动 - 查询状态
ipcMain.handle('get-auto-launch', async () => {
  const settings = app.getLoginItemSettings()
  return { enabled: settings.openAtLogin }
})

// 自定义背景 - 选择图片并应用（复制到数据目录固定文件）
ipcMain.handle('set-custom-bg', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择浅色背景图片',
    filters: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    properties: ['openFile']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false }
  }

  try {
    ensureDir(getDataDir())
    fs.copyFileSync(result.filePaths[0], customBgPath())
    return { success: true }
  } catch {
    return { success: false }
  }
})

// 自定义背景 - 恢复默认
ipcMain.handle('clear-custom-bg', async () => {
  try {
    if (fs.existsSync(customBgPath())) {
      fs.unlinkSync(customBgPath())
    }
    return { success: true }
  } catch {
    return { success: false }
  }
})

// 自定义背景 - 查询是否启用
ipcMain.handle('get-custom-bg', async () => {
  return { enabled: fs.existsSync(customBgPath()) }
})

// ── 应用更新（v2.6.7：设置页检测更新/更新应用） ──

ipcMain.handle('updater:check', async () => {
  try {
    // 开发环境无打包产物，electron-updater 会抛错，这里捕获并返回提示
    const result = await autoUpdater.checkForUpdates()
    return { success: true, version: result?.updateInfo?.version || null }
  } catch (err) {
    return { success: false, message: String((err as Error)?.message || err) }
  }
})

ipcMain.handle('updater:download', async () => {
  try {
    await autoUpdater.downloadUpdate()
    return { success: true }
  } catch (err) {
    return { success: false, message: String((err as Error)?.message || err) }
  }
})

ipcMain.handle('updater:install', async () => {
  // 退出并安装已下载的更新
  autoUpdater.quitAndInstall()
  return { success: true }
})

// 打开 GitHub 项目地址
ipcMain.handle('open-github', async () => {
  await shell.openExternal(GITHUB_REPO_URL)
  return { success: true }
})
