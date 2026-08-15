import { app, BrowserWindow, ipcMain, dialog, nativeTheme, protocol, net, Tray, Menu, nativeImage, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as path from 'path'
import * as fs from 'fs'
import { pathToFileURL } from 'url'

// v3.1.2：全局未捕获异常处理，防止主进程崩溃弹窗
process.on('uncaughtException', (err) => {
  console.error('[Main] uncaughtException:', err.message)
})
process.on('unhandledRejection', (reason) => {
  console.error('[Main] unhandledRejection:', String(reason))
})

// GitHub 项目地址（设置页展示 + 更新来源说明）
export const GITHUB_REPO_URL = 'https://github.com/CalmSun/11408kaoyan-helper'

// ── 数据目录（v2.8.0）：默认"文档\11408kaoyan-helper"，不在 C 盘应用数据区，可在设置中自定义 ──

const DATA_DIR_CONFIG = path.join(app.getPath('userData'), 'data-dir.json')
const MUSIC_FOLDER_CONFIG = path.join(app.getPath('userData'), 'music-folder.json')
// v2.9.0：资料文件夹配置
const MATERIALS_FOLDER_CONFIG = path.join(app.getPath('userData'), 'materials-folder.json')
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

// v2.9.0：资料文件夹（PDF/MP4 等）
const MATERIAL_EXTS = ['.pdf', '.mp4', '.mp3', '.txt', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.epub', '.mobi']
const MATERIALS_MAX_FILES = 2000
const materialsWhitelist = new Map<string, string>() // token -> 绝对路径
let materialsRootDir = ''

function newToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// v3.0.0：根据文件扩展名返回 MIME 类型（用于资料协议响应头）
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.json': 'application/json',
    '.epub': 'application/epub+zip',
    '.mobi': 'application/x-mobipocket-ebook'
  }
  return map[ext] || 'application/octet-stream'
}

// v2.8.2：保存用户选择的音乐文件夹路径
function saveMusicFolder(folderPath: string): void {
  try {
    fs.writeFileSync(MUSIC_FOLDER_CONFIG, JSON.stringify({ folder: folderPath }, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to save music folder:', err)
  }
}

// v2.8.2：加载上次选择的音乐文件夹路径
function loadMusicFolder(): string | null {
  try {
    if (fs.existsSync(MUSIC_FOLDER_CONFIG)) {
      const cfg = JSON.parse(fs.readFileSync(MUSIC_FOLDER_CONFIG, 'utf-8')) as { folder?: string }
      if (cfg.folder && typeof cfg.folder === 'string' && fs.existsSync(cfg.folder)) {
        return cfg.folder
      }
    }
  } catch {
    // 配置损坏：返回 null
  }
  return null
}

// v2.9.0：保存/加载资料文件夹路径
function saveMaterialsFolder(folderPath: string): void {
  try {
    fs.writeFileSync(MATERIALS_FOLDER_CONFIG, JSON.stringify({ folder: folderPath }, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to save materials folder:', err)
  }
}

function loadMaterialsFolder(): string | null {
  try {
    if (fs.existsSync(MATERIALS_FOLDER_CONFIG)) {
      const cfg = JSON.parse(fs.readFileSync(MATERIALS_FOLDER_CONFIG, 'utf-8')) as { folder?: string }
      if (cfg.folder && typeof cfg.folder === 'string' && fs.existsSync(cfg.folder)) {
        return cfg.folder
      }
    }
  } catch {
    // 配置损坏：返回 null
  }
  return null
}

// 注册私有协议：
// - kaoyan-bg://    用户自定义背景图
// - kaoyan-music:// 音乐文件夹内音频（白名单校验，v2.8.0 流式播放不占内存）
// - kaoyan-data://  数据目录内备份文件（自动备份预览/读取）
// - kaoyan-material:// 资料文件夹内文件（PDF/MP4 等，v2.9.0）
protocol.registerSchemesAsPrivileged([
  { scheme: 'kaoyan-bg', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'kaoyan-music', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  { scheme: 'kaoyan-data', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'kaoyan-material', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
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

    // v3.1.2：音乐协议改用流式读取（原 net.fetch 可能导致 Array buffer allocation failed）
    protocol.handle('kaoyan-music', (request) => {
      try {
        const url = new URL(request.url)
        const token = decodeURIComponent(url.host + url.pathname).replace(/^\/+/, '').split('/')[0]
        const file = musicWhitelist.get(token)
        if (!file || !fs.existsSync(file)) {
          return new Response('not found', { status: 404 })
        }
        const resolved = path.resolve(file)
        if (!musicRootDir || !resolved.startsWith(path.resolve(musicRootDir) + path.sep)) {
          return new Response('forbidden', { status: 403 })
        }
        const stat = fs.statSync(resolved)
        const total = stat.size
        const rangeHeader = request.headers.get('range')
        const mime = getMimeType(resolved)

        if (rangeHeader) {
          const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
          if (match) {
            let start = match[1] ? parseInt(match[1], 10) : 0
            let end = match[2] ? parseInt(match[2], 10) : total - 1
            if (start >= total) start = total - 1
            if (end >= total) end = total - 1
            if (start > end) {
              return new Response('range not satisfiable', {
                status: 416,
                headers: { 'Content-Range': `bytes */${total}` }
              })
            }
            const stream = fs.createReadStream(resolved, { start, end })
            const body = new ReadableStream({
              start(controller) {
                stream.on('data', chunk => { try { controller.enqueue(chunk) } catch { /* ignore */ } })
                stream.on('end', () => { try { controller.close() } catch { /* ignore */ } })
                stream.on('error', () => { try { controller.close() } catch { /* ignore */ } })
              },
              cancel() { try { stream.destroy() } catch { /* ignore */ } }
            })
            return new Response(body, {
              status: 206,
              headers: {
                'Content-Type': mime,
                'Content-Length': String(end - start + 1),
                'Content-Range': `bytes ${start}-${end}/${total}`,
                'Accept-Ranges': 'bytes'
              }
            })
          }
        }
        const stream = fs.createReadStream(resolved)
        const body = new ReadableStream({
          start(controller) {
            stream.on('data', chunk => { try { controller.enqueue(chunk) } catch { /* ignore */ } })
            stream.on('end', () => { try { controller.close() } catch { /* ignore */ } })
            stream.on('error', () => { try { controller.close() } catch { /* ignore */ } })
          },
          cancel() { try { stream.destroy() } catch { /* ignore */ } }
        })
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(total),
            'Accept-Ranges': 'bytes'
          }
        })
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

    // v3.0.0：资料协议：显式支持 Range 请求（视频拖动进度/快速加载），
    // 此前用 net.fetch(file://) 在部分 Electron 版本下 Range 支持不稳定，
    // 改用 fs.createReadStream + 206 Partial Content 确保 seek 正常。
    protocol.handle('kaoyan-material', (request) => {
      try {
        const url = new URL(request.url)
        const token = decodeURIComponent(url.host + url.pathname).replace(/^\/+/, '').split('/')[0]
        const file = materialsWhitelist.get(token)
        if (!file || !fs.existsSync(file)) {
          return new Response('not found', { status: 404 })
        }
        const resolved = path.resolve(file)
        if (!materialsRootDir || !resolved.startsWith(path.resolve(materialsRootDir) + path.sep)) {
          return new Response('forbidden', { status: 403 })
        }
        const stat = fs.statSync(resolved)
        const total = stat.size
        const rangeHeader = request.headers.get('range')
        const mime = getMimeType(resolved)

        if (rangeHeader) {
          const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
          if (match) {
            let start = match[1] ? parseInt(match[1], 10) : 0
            let end = match[2] ? parseInt(match[2], 10) : total - 1
            if (start >= total) start = total - 1
            if (end >= total) end = total - 1
            if (start > end) {
              return new Response('range not satisfiable', {
                status: 416,
                headers: { 'Content-Range': `bytes */${total}` }
              })
            }
            const stream = fs.createReadStream(resolved, { start, end })
            const body = new ReadableStream({
              start(controller) {
                stream.on('data', chunk => { try { controller.enqueue(chunk) } catch { /* ignore */ } })
                stream.on('end', () => { try { controller.close() } catch { /* ignore */ } })
                stream.on('error', () => { try { controller.close() } catch { /* ignore */ } })
              },
              cancel() { try { stream.destroy() } catch { /* ignore */ } }
            })
            return new Response(body, {
              status: 206,
              headers: {
                'Content-Type': mime,
                'Content-Length': String(end - start + 1),
                'Content-Range': `bytes ${start}-${end}/${total}`,
                'Accept-Ranges': 'bytes'
              }
            })
          }
        }
        // 无 Range：返回完整文件
        const stream = fs.createReadStream(resolved)
        const body = new ReadableStream({
          start(controller) {
            stream.on('data', chunk => { try { controller.enqueue(chunk) } catch { /* ignore */ } })
            stream.on('end', () => { try { controller.close() } catch { /* ignore */ } })
            stream.on('error', () => { try { controller.close() } catch { /* ignore */ } })
          },
          cancel() { try { stream.destroy() } catch { /* ignore */ } }
        })
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(total),
            'Accept-Ranges': 'bytes'
          }
        })
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

  // v2.8.2：保存用户选择的音乐文件夹路径
  saveMusicFolder(root)

  return { success: true, canceled: false, files }
})

// v2.8.2：恢复上次选择的音乐文件夹
ipcMain.handle('music:restore-folder', async () => {
  const folderPath = loadMusicFolder()
  if (!folderPath) {
    return { success: false, canceled: false, files: [] }
  }
  const root = folderPath

  // 检查文件夹是否仍然存在
  if (!fs.existsSync(root)) {
    return { success: false, canceled: false, files: [] }
  }

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

// v2.8.2：读取本地歌词文件（.lrc）
ipcMain.handle('music:read-lyric', async (_e, trackName: string) => {
  if (!musicRootDir || !trackName) {
    return { success: false, content: '' }
  }

  // 尝试查找同名 .lrc 文件
  const audioPath = path.join(musicRootDir, trackName)
  const lrcPath = audioPath.replace(/\.[^.]+$/, '.lrc')

  try {
    if (fs.existsSync(lrcPath)) {
      const content = fs.readFileSync(lrcPath, 'utf-8')
      return { success: true, content }
    }
  } catch (err) {
    console.error('Failed to read lyric:', err)
  }

  return { success: false, content: '' }
})

// ── v2.9.0：资料文件夹（PDF/MP4 等阅读观看）──
// v2.9.2：返回树形结构，保留原文件夹层级

interface MaterialTreeNode {
  name: string
  type: 'folder' | 'file'
  path: string // 相对路径
  children?: MaterialTreeNode[]
  url?: string
  ext?: string
  size?: number
}

function scanMaterialsFolder(root: string): MaterialTreeNode[] {
  function walk(dir: string, relPath: string): MaterialTreeNode[] {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const nodes: MaterialTreeNode[] = []
    const folders: MaterialTreeNode[] = []
    const files: MaterialTreeNode[] = []
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      const childRel = relPath ? `${relPath}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        const children = walk(full, childRel)
        if (children.length > 0) {
          folders.push({ name: entry.name, type: 'folder', path: childRel, children })
        }
      } else if (entry.isFile() && MATERIAL_EXTS.includes(path.extname(entry.name).toLowerCase())) {
        try {
          const token = newToken()
          materialsWhitelist.set(token, full)
          const stat = fs.statSync(full)
          files.push({
            name: entry.name,
            type: 'file',
            path: childRel,
            url: `kaoyan-material://${token}`,
            ext: path.extname(entry.name).toLowerCase(),
            size: stat.size
          })
        } catch {
          // 跳过异常文件
        }
      }
    }
    // 文件夹在前，文件在后，各自按名称排序
    folders.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    files.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    nodes.push(...folders, ...files)
    return nodes
  }
  materialsWhitelist.clear()
  return walk(root, '')
}

ipcMain.handle('materials:pick-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '选择资料文件夹'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true, files: [] }
  }
  const root = result.filePaths[0]
  materialsWhitelist.clear()
  materialsRootDir = root
  saveMaterialsFolder(root)
  const files = scanMaterialsFolder(root)
  return { success: true, canceled: false, files, folder: root }
})

ipcMain.handle('materials:restore-folder', async () => {
  const folderPath = loadMaterialsFolder()
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { success: false, canceled: false, files: [], folder: '' }
  }
  materialsWhitelist.clear()
  materialsRootDir = folderPath
  const files = scanMaterialsFolder(folderPath)
  return { success: true, canceled: false, files, folder: folderPath }
})

ipcMain.handle('materials:list-files', async () => {
  if (!materialsRootDir || !fs.existsSync(materialsRootDir)) {
    return { success: false, files: [], folder: '' }
  }
  materialsWhitelist.clear()
  const files = scanMaterialsFolder(materialsRootDir)
  return { success: true, files, folder: materialsRootDir }
})

// ── v2.9.0：默认浏览器打开外部链接 ──

ipcMain.handle('open-external-url', async (_e, url: string) => {
  try {
    if (!url || !/^https?:\/\//i.test(url)) {
      return { success: false, message: '无效的URL' }
    }
    await shell.openExternal(url)
    return { success: true }
  } catch (err) {
    return { success: false, message: String(err) }
  }
})

// ── v3.1.3：网易云音乐 API 重构（参考 NeteaseCloudMusicApi Enhanced 官方实现）──

import * as crypto from 'crypto'

const NETEASE_PRESET_KEY = Buffer.from('0CoJUm6Qyw8W8jud', 'utf8')
const NETEASE_IV = Buffer.from('0102030405060708', 'utf8')
const NETEASE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`
// base62 字符集（与官方一致）
const NETEASE_BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
// 常见中国 IP 段（官方推荐 116.25.146.177），用于 X-Real-IP / X-Forwarded-For 伪装避免 460 cheating
const CN_IPS = ['116.25.146.177', '183.232.231.172', '112.65.208.134', '120.196.165.24', '180.101.49.11']

// v2.9.2：网易云 Cookie 持久化路径
const NETEASE_COOKIE_PATH = path.join(app.getPath('userData'), 'netease-cookies.json')
// 内存 Cookie 存储
const neteaseCookies = new Map<string, string>()

/** v3.1.3：生成随机十六进制字符串 */
function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex')
}

/** v3.1.3：生成设备 ID（与官方 WNMCID 格式一致） */
function generateDeviceId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let randomString = ''
  for (let i = 0; i < 6; i++) {
    randomString += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${randomString}.${Date.now().toString()}.01.0`
}

// 预生成设备 ID（只生成一次）
const NETEASE_DEVICE_ID = generateDeviceId()

/** 从磁盘加载网易云 Cookie */
function loadNeteaseCookies(): void {
  try {
    if (fs.existsSync(NETEASE_COOKIE_PATH)) {
      const data = JSON.parse(fs.readFileSync(NETEASE_COOKIE_PATH, 'utf-8')) as Record<string, string>
      for (const [k, v] of Object.entries(data)) {
        neteaseCookies.set(k, v)
      }
    }
  } catch { /* ignore */ }
}

/** 保存网易云 Cookie 到磁盘 */
function saveNeteaseCookies(): void {
  try {
    const obj: Record<string, string> = {}
    neteaseCookies.forEach((v, k) => { obj[k] = v })
    fs.writeFileSync(NETEASE_COOKIE_PATH, JSON.stringify(obj, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

/** 解析 Set-Cookie 头并存储 */
function parseSetCookies(setCookie: string | string[] | null): void {
  if (!setCookie) return
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie]
  for (const cookie of cookies) {
    const kv = cookie.split(';')[0].trim()
    const eq = kv.indexOf('=')
    if (eq > 0) {
      const key = kv.slice(0, eq).trim()
      const val = kv.slice(eq + 1).trim()
      if (key && val) neteaseCookies.set(key, val)
    }
  }
  saveNeteaseCookies()
}

/**
 * v3.1.3：构建完整 Cookie 头（参考官方 processCookieObject）
 * 关键：必须包含 _ntes_nuid, NMTID, WNMCID, WEVNSM, __remember_me, deviceId, osver 等
 * 缺少这些 cookie 会触发 -460 风控
 */
function buildCookieHeader(uri = ''): string {
  // 确保基础匿名 cookie 存在
  if (!neteaseCookies.has('_ntes_nuid')) {
    neteaseCookies.set('_ntes_nuid', randomHex(16))
  }
  if (!neteaseCookies.has('_ntes_nnid')) {
    const nuid = neteaseCookies.get('_ntes_nuid') || randomHex(16)
    neteaseCookies.set('_ntes_nnid', `${nuid},${Date.now().toString()}`)
  }
  if (!neteaseCookies.has('WNMCID')) {
    neteaseCookies.set('WNMCID', NETEASE_DEVICE_ID)
  }
  if (!neteaseCookies.has('WEVNSM')) {
    neteaseCookies.set('WEVNSM', '1.0.0')
  }
  if (!neteaseCookies.has('__remember_me')) {
    neteaseCookies.set('__remember_me', 'true')
  }
  if (!neteaseCookies.has('ntes_kaola_ad')) {
    neteaseCookies.set('ntes_kaola_ad', '1')
  }
  // 设备和系统信息（PC 客户端）
  if (!neteaseCookies.has('os')) neteaseCookies.set('os', 'pc')
  if (!neteaseCookies.has('appver')) neteaseCookies.set('appver', '3.1.17.204416')
  if (!neteaseCookies.has('osver')) neteaseCookies.set('osver', 'Microsoft-Windows-10-Professional-build-19045-64bit')
  if (!neteaseCookies.has('channel')) neteaseCookies.set('channel', 'netease')
  if (!neteaseCookies.has('deviceId')) neteaseCookies.set('deviceId', NETEASE_DEVICE_ID)
  // 非登录接口添加 NMTID（匿名访客 ID，每次请求随机生成）
  const isLogin = uri.includes('login')
  if (!isLogin) {
    neteaseCookies.set('NMTID', randomHex(8))
  }

  const parts: string[] = []
  neteaseCookies.forEach((v, k) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`))
  return parts.join('; ')
}

/** 随机中国 IP 用于 X-Real-IP / X-Forwarded-For 伪装 */
function randomCNIP(): string {
  return CN_IPS[Math.floor(Math.random() * CN_IPS.length)]
}

loadNeteaseCookies()

function neteaseAesEncrypt(text: string, key: Buffer): string {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, NETEASE_IV)
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('base64')
}

function neteaseRsaEncrypt(text: string): string {
  const reversed = text.split('').reverse().join('')
  const buf = Buffer.alloc(128, 0)
  const textBuf = Buffer.from(reversed, 'utf8')
  textBuf.copy(buf, 128 - textBuf.length)
  return crypto.publicEncrypt({ key: NETEASE_PUBLIC_KEY, padding: crypto.constants.RSA_NO_PADDING }, buf).toString('hex')
}

/** 生成 16 位 base62 随机密钥 */
function generateSecretKey(): string {
  let key = ''
  for (let i = 0; i < 16; i++) {
    key += NETEASE_BASE62[Math.floor(Math.random() * NETEASE_BASE62.length)]
  }
  return key
}

function neteaseWeapi(data: Record<string, unknown>): { params: string; encSecKey: string } {
  const text = JSON.stringify(data)
  const secretKey = generateSecretKey()
  const params = neteaseAesEncrypt(neteaseAesEncrypt(text, NETEASE_PRESET_KEY), Buffer.from(secretKey, 'utf8'))
  const encSecKey = neteaseRsaEncrypt(secretKey)
  return { params, encSecKey }
}

// v3.1.3：eapi 加密（客户端 API，风控更松）
const EAPI_KEY = Buffer.from('e82ckenh8dichen8', 'utf8')
const EAPI_SALT = '36cd479b6b5'

/** v3.1.3：eapi AES-128-ECB 加密，输出 hex */
function eapiAesEncrypt(text: string): string {
  const cipher = crypto.createCipheriv('aes-128-ecb', EAPI_KEY, null)
  cipher.setAutoPadding(true)
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex')
}

/**
 * v3.1.3：eapi 加密（参考官方 NeteaseCloudMusicApi Enhanced）
 * 流程：MD5(nobody+url+use+text+md5forencrypt) → 拼接 url-salt-text-salt-digest → AES-128-ECB
 */
function neteaseEapi(url: string, data: Record<string, unknown>): { params: string } {
  const text = JSON.stringify(data)
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = crypto.createHash('md5').update(message, 'utf8').digest('hex')
  const raw = `${url}-${EAPI_SALT}-${text}-${EAPI_SALT}-${digest}`
  return { params: eapiAesEncrypt(raw) }
}

/** v3.1.3：生成 requestId（与官方一致：时间戳_4位随机数） */
function generateRequestId(): string {
  return `${Date.now()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
}

/**
 * v3.1.3：eapi 请求（模拟网易云移动端客户端，风控更松）
 * 关键：Cookie 只包含客户端头信息，User-Agent 使用移动端客户端 UA
 */
async function neteaseEapiRequest(path: string, data: Record<string, unknown>): Promise<unknown> {
  const csrf = neteaseCookies.get('__csrf') || ''
  const musicU = neteaseCookies.get('MUSIC_U') || ''
  const musicA = neteaseCookies.get('MUSIC_A') || ''
  // eapi 客户端头信息（放入 Cookie）
  const clientHeader: Record<string, string> = {
    osver: neteaseCookies.get('osver') || 'Microsoft-Windows-10-Professional-build-19045-64bit',
    deviceId: neteaseCookies.get('deviceId') || NETEASE_DEVICE_ID,
    os: neteaseCookies.get('os') || 'pc',
    appver: neteaseCookies.get('appver') || '3.1.17.204416',
    versioncode: '140',
    mobilename: '',
    buildver: Date.now().toString().substring(0, 10),
    resolution: '1920x1080',
    __csrf: csrf,
    channel: neteaseCookies.get('channel') || 'netease',
    requestId: generateRequestId(),
  }
  if (musicU) clientHeader['MUSIC_U'] = musicU
  if (musicA) clientHeader['MUSIC_A'] = musicA
  const cookieStr = Object.entries(clientHeader)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('; ')

  // eapi 数据中需要包含 header
  const eapiData = { ...data, header: clientHeader }
  const { params } = neteaseEapi(`/api${path}`, eapiData)
  const body = new URLSearchParams({ params })
  const url = `https://music.163.com/eapi${path}`
  const ip = randomCNIP()

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://music.163.com/',
      'Origin': 'https://music.163.com',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      // eapi 使用移动端客户端 UA
      'User-Agent': 'NeteaseMusic/9.1.65.240927161425(9001065);Dalvik/2.1.0 (Linux; U; Android 14; 23013RK75C Build/UKQ1.230804.001)',
      'X-Real-IP': ip,
      'X-Forwarded-For': ip,
      'Cookie': cookieStr
    },
    body: body.toString()
  })
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get('set-cookie')
  parseSetCookies(setCookie as string | string[] | null)
  if (!res.ok) {
    throw new Error(`NetEase eapi ${path} HTTP ${res.status}`)
  }
  const json = await res.json() as { code?: number; message?: string }
  // v3.2.4：eapi 若返回无 code 字段或非 200（如喜欢接口 /radio/like 的某些响应），必须抛错，
  // 才能让 neteaseSmartRequest 降级到 weapi（ncm-api-rs 参考实现即用 weapi 处理喜欢）。
  if (json.code !== 200) {
    throw new Error(`NetEase eapi ${path} code=${json.code ?? 'unknown'}${json.message ? ': ' + json.message : ''}`)
  }
  return json
}

/**
 * v3.1.3：智能请求——优先 eapi（客户端，风控松），失败降级 weapi（网页版）
 */
async function neteaseSmartRequest(path: string, data: Record<string, unknown>): Promise<unknown> {
  try {
    return await neteaseEapiRequest(path, data)
  } catch (eapiErr) {
    // eapi 失败时降级到 weapi
    try {
      return await neteaseRequest(path, data)
    } catch {
      // 两个都失败，抛出 eapi 的错误（更可能是风控问题）
      throw eapiErr
    }
  }
}

/**
 * v3.1.3：通用 weapi 请求（参考官方实现）
 * 关键改进：
 * 1. 同时设置 X-Real-IP 和 X-Forwarded-For
 * 2. 完整的浏览器请求头（Accept, Accept-Language 等）
 * 3. Edge 浏览器 User-Agent
 * 4. 完整 cookie（含 _ntes_nuid, NMTID, WNMCID 等）
 */
async function neteaseRequest(path: string, data: Record<string, unknown>): Promise<unknown> {
  const csrf = neteaseCookies.get('__csrf') || ''
  const { params, encSecKey } = neteaseWeapi({ ...data, csrf_token: csrf })
  const body = new URLSearchParams({ params, encSecKey })
  const url = csrf
    ? `https://music.163.com/weapi${path}?csrf_token=${csrf}`
    : `https://music.163.com/weapi${path}`
  const ip = randomCNIP()
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': 'https://music.163.com/',
    'Origin': 'https://music.163.com',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    'X-Real-IP': ip,
    'X-Forwarded-For': ip,
    'Cookie': buildCookieHeader(path)
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body.toString()
  })
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get('set-cookie')
  parseSetCookies(setCookie as string | string[] | null)
  if (!res.ok) {
    throw new Error(`NetEase API ${path} HTTP ${res.status}`)
  }
  const json = await res.json() as { code?: number; message?: string }
  // v3.2.4：与 eapi 一致——无 code 或非 200 视为失败抛错，避免静默返回错误响应
  if (json.code !== 200) {
    throw new Error(`NetEase API ${path} code=${json.code ?? 'unknown'}${json.message ? ': ' + json.message : ''}`)
  }
  return json
}

/** v3.1.3：普通 API 请求（不加密，用于二维码登录等接口） */
async function neteasePlainRequest(path: string, data: Record<string, unknown>): Promise<unknown> {
  const body = new URLSearchParams(data as Record<string, string>)
  const ip = randomCNIP()
  const res = await fetch(`https://music.163.com/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://music.163.com/',
      'Origin': 'https://music.163.com',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
      'X-Real-IP': ip,
      'X-Forwarded-For': ip,
      'Cookie': buildCookieHeader(path)
    },
    body: body.toString()
  })
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get('set-cookie')
  parseSetCookies(setCookie as string | string[] | null)
  if (!res.ok) {
    throw new Error(`NetEase API ${path} HTTP ${res.status}`)
  }
  return res.json()
}

/** v3.1.3：网易云 GET 请求辅助 */
async function neteaseGetRequest(path: string, query: Record<string, string> = {}): Promise<unknown> {
  const params = new URLSearchParams({ ...query, timestamp: Date.now().toString() })
  const ip = randomCNIP()
  const res = await fetch(`https://music.163.com/api${path}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Referer': 'https://music.163.com/',
      'Origin': 'https://music.163.com',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
      'X-Real-IP': ip,
      'X-Forwarded-For': ip,
      'Cookie': buildCookieHeader(path)
    }
  })
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get('set-cookie')
  parseSetCookies(setCookie as string | string[] | null)
  if (!res.ok) throw new Error(`NetEase GET ${path} HTTP ${res.status}`)
  return res.json()
}

ipcMain.handle('netease:search', async (_e, keyword: string, limit = 30, offset = 0) => {
  try {
    const data = await neteaseSmartRequest('/cloudsearch/get/web', {
      s: keyword,
      type: 1,
      limit,
      offset,
      total: true
    }) as { result?: { songs?: Array<{ id: number; name: string; ar?: Array<{ name: string }>; al?: { name: string; picUrl?: string } }>; songCount?: number } }
    const songs = (data.result?.songs || []).map(s => ({
      id: s.id,
      name: s.name,
      artist: (s.ar || []).map(a => a.name).join(' / '),
      album: s.al?.name || '',
      cover: s.al?.picUrl || ''
    }))
    return { success: true, songs, total: data.result?.songCount || 0 }
  } catch (err) {
    return { success: false, songs: [], total: 0, message: String(err) }
  }
})

ipcMain.handle('netease:song-url', async (_e, ids: number[]) => {
  try {
    // v3.1.2：优先使用新版 /song/url/v1 接口，失败时降级到旧版
    let data: { data?: Array<{ id: number; url: string | null; br?: number }> }
    try {
      data = await neteaseSmartRequest('/song/url/v1', {
        id: ids.join(','),
        level: 'standard'
      }) as { data?: Array<{ id: number; url: string | null; br?: number }> }
      // 如果 v1 返回空 url，降级到旧版
      if (!data.data || data.data.every(d => !d.url)) {
        throw new Error('v1 returned empty urls')
      }
    } catch {
      data = await neteaseSmartRequest('/song/enhance/player/url', {
        ids,
        br: 320000
      }) as { data?: Array<{ id: number; url: string | null; br?: number }> }
    }
    const urls = (data.data || []).map(d => ({ id: d.id, url: d.url, br: d.br || 0 }))
    return { success: true, urls }
  } catch (err) {
    return { success: false, urls: [], message: String(err) }
  }
})

ipcMain.handle('netease:lyric', async (_e, id: number) => {
  try {
    const data = await neteaseSmartRequest('/song/lyric', {
      id,
      lv: -1,
      kv: -1,
      tv: -1
    }) as { lrc?: { lyric?: string }; tlyric?: { lyric?: string } }
    return { success: true, lyric: data.lrc?.lyric || '', tlyric: data.tlyric?.lyric || '' }
  } catch (err) {
    return { success: false, lyric: '', tlyric: '', message: String(err) }
  }
})

// ── v2.9.2：二维码登录 ──

/** v3.0.0：获取二维码登录 key（新版 /api/login/qr/key）
 *  v3.2.0：修复二维码不显示问题
 *  - 同时尝试 /api/login/qrcode/unikey 与 /api/login/qr/key
 *  - 兼容 qrimg 字段缺少 data URI 前缀的情况
 *  - qrimg 为空时使用 qrurl 通过在线服务生成二维码
 */
ipcMain.handle('netease:qr-key', async () => {
  try {
    // 真实接口：/api/login/qrcode/unikey，返回 { code, unikey }（unikey 在顶层）
    // v3.2.1：修复二维码不显示——原实现读取 data.data?.unikey（响应实际在顶层），且调用了不存在的 /login/qr/create
    let key = ''
    // 兼容 GET/POST 与将 unikey 包裹在 data 下的节点
    try {
      const data1 = await neteaseGetRequest('/login/qrcode/unikey') as { unikey?: string; code?: number; data?: { unikey?: string } }
      key = data1.unikey || data1.data?.unikey || ''
    } catch { /* fallthrough */ }
    if (!key) {
      // GET 未取到时尝试 POST（部分节点要求 POST 且需传 type=3）
      try {
        const data1b = await neteasePlainRequest('/login/qrcode/unikey', { type: 3 }) as { unikey?: string; data?: { unikey?: string } }
        key = data1b.unikey || data1b.data?.unikey || ''
      } catch { /* fallthrough */ }
    }
    if (!key) return { success: false, key: '', qrimg: '', message: '获取二维码 key 失败' }
    // v3.2.1：网易云音乐不返回二维码图片 base64，需自行生成
    // qrurl 由 unikey 本地构造（对齐 ncm-api-rs login_qr_create 实现）
    const qrurl = `https://music.163.com/login?codekey=${key}`
    // 通过在线二维码生成服务生成图片（应用本身已可访问外网加载封面等资源）
    const qrimg = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrurl)}`
    return { success: true, key, qrimg, qrurl }
  } catch (err) {
    return { success: false, key: '', qrimg: '', message: String(err) }
  }
})

/** v3.0.0：检查二维码登录状态
 *  v3.2.1：修复——真实接口为 /api/login/qrcode/client/login（原 /login/qr/check 不存在）
 *  801=等待扫码, 802=扫码待确认, 803=登录成功, 800=过期
 *  登录成功时 cookie 主要通过 Set-Cookie 响应头返回（请求辅助函数已自动入库） */
ipcMain.handle('netease:qr-check', async (_e, key: string) => {
  const tryParse = (data: { code?: number; message?: string; cookie?: string }) => {
    const code = data?.code || 0
    if (code === 803) {
      // 兼容响应体中携带 cookie 字符串的情况
      if (data?.cookie) {
        String(data.cookie).split(';').forEach(pair => {
          const [k, ...v] = pair.trim().split('=')
          if (k && v.length) neteaseCookies.set(k, v.join('='))
        })
      }
      // Set-Cookie 响应头已被 neteaseGetRequest/neteasePlainRequest 解析入库，这里持久化
      saveNeteaseCookies()
    }
    return { success: true, code, message: data?.message || '', cookie: data?.cookie || '' }
  }
  // 真实接口：/api/login/qrcode/client/login，兼容 GET/POST
  try {
    const data = await neteaseGetRequest('/login/qrcode/client/login', { key, type: '3' }) as { code?: number; message?: string; cookie?: string }
    return tryParse(data)
  } catch {
    try {
      const data = await neteasePlainRequest('/login/qrcode/client/login', { key, type: 3 }) as { code?: number; message?: string; cookie?: string }
      return tryParse(data)
    } catch (err) {
      return { success: false, code: 0, message: String(err), cookie: '' }
    }
  }
})

/** 获取当前登录状态 / 用户信息 */
ipcMain.handle('netease:login-status', async () => {
  try {
    const data = await neteaseSmartRequest('/w/nuser/account/get', {}) as {
      code?: number
      profile?: { userId?: number; nickname?: string; avatarUrl?: string; signature?: string; level?: number }
      account?: { id?: number; userName?: string }
    }
    if (data.code === 200 && data.profile) {
      return {
        success: true,
        loggedIn: true,
        user: {
          id: data.profile.userId || 0,
          nickname: data.profile.nickname || '',
          avatar: data.profile.avatarUrl || '',
          signature: data.profile.signature || '',
          level: data.profile.level || 0
        }
      }
    }
    return { success: true, loggedIn: false, user: null }
  } catch (err) {
    return { success: false, loggedIn: false, user: null, message: String(err) }
  }
})

/** 退出登录 */
ipcMain.handle('netease:logout', async () => {
  try {
    await neteaseSmartRequest('/logout', {})
  } catch { /* ignore */ }
  neteaseCookies.clear()
  saveNeteaseCookies()
  return { success: true }
})

/** v3.1.0：通过 Cookie 字符串登录（用户从浏览器复制 Cookie 粘贴） */
ipcMain.handle('netease:set-cookie', async (_e, cookieStr: string) => {
  try {
    if (!cookieStr || typeof cookieStr !== 'string') {
      return { success: false, message: 'Cookie 不能为空' }
    }
    // 解析 Cookie 字符串：key1=value1; key2=value2; ...
    cookieStr.split(';').forEach(pair => {
      const idx = pair.indexOf('=')
      if (idx > 0) {
        const k = pair.substring(0, idx).trim()
        const v = pair.substring(idx + 1).trim()
        if (k && v) neteaseCookies.set(k, v)
      }
    })
    saveNeteaseCookies()
    // 验证登录状态
    const data = await neteaseSmartRequest('/w/nuser/account/get', {}) as {
      code?: number
      profile?: { userId?: number; nickname?: string; avatarUrl?: string }
    }
    if (data.code === 200 && data.profile) {
      return {
        success: true,
        loggedIn: true,
        user: {
          id: data.profile.userId || 0,
          nickname: data.profile.nickname || '',
          avatar: data.profile.avatarUrl || ''
        }
      }
    }
    return { success: true, loggedIn: false, user: null, message: 'Cookie 已保存但登录验证失败，请检查 Cookie 是否有效' }
  } catch (err) {
    return { success: false, message: String(err) }
  }
})

// ── v3.1.9：手机号登录 ──

ipcMain.handle('netease:login-phone', async (_e, phone: string, password: string, countrycode = '86') => {
  try {
    if (!phone || !password) {
      return { success: false, message: '手机号和密码不能为空' }
    }
    const md5Password = crypto.createHash('md5').update(password, 'utf8').digest('hex')
    const data = await neteasePlainRequest('/w/login/cellphone', {
      type: '1',
      https: 'true',
      phone,
      countrycode,
      remember: 'true',
      password: md5Password
    }) as { code?: number; msg?: string; message?: string; profile?: { userId?: number; nickname?: string; avatarUrl?: string } }

    if (data.code === 200 && data.profile) {
      // 验证登录状态
      const accountData = await neteaseSmartRequest('/w/nuser/account/get', {}) as {
        code?: number
        profile?: { userId?: number; nickname?: string; avatarUrl?: string; signature?: string; level?: number }
      }
      if (accountData.code === 200 && accountData.profile) {
        return {
          success: true,
          loggedIn: true,
          user: {
            id: accountData.profile.userId || data.profile.userId || 0,
            nickname: accountData.profile.nickname || data.profile.nickname || '',
            avatar: accountData.profile.avatarUrl || data.profile.avatarUrl || ''
          }
        }
      }
      return {
        success: true,
        loggedIn: true,
        user: {
          id: data.profile.userId || 0,
          nickname: data.profile.nickname || '',
          avatar: data.profile.avatarUrl || ''
        }
      }
    }
    return { success: false, message: data.msg || data.message || `登录失败 (code=${data.code})` }
  } catch (err) {
    return { success: false, message: String(err) }
  }
})

// ── v2.9.2：用户歌单 ──

/** 获取用户歌单列表 */
ipcMain.handle('netease:user-playlist', async (_e, uid: number, limit = 30, offset = 0) => {
  try {
    const data = await neteaseSmartRequest('/user/playlist', {
      uid,
      limit,
      offset,
      includeVideo: true
    }) as {
      playlist?: Array<{
        id: number; name: string; coverImgUrl?: string; playCount?: number
        trackCount?: number; creator?: { nickname?: string }
      }>
      code?: number
    }
    const playlists = (data.playlist || []).map(p => ({
      id: p.id,
      name: p.name,
      cover: p.coverImgUrl || '',
      playCount: p.playCount || 0,
      trackCount: p.trackCount || 0,
      creator: p.creator?.nickname || ''
    }))
    return { success: true, playlists }
  } catch (err) {
    return { success: false, playlists: [], message: String(err) }
  }
})

/** 获取歌单详情（含歌曲列表） */
ipcMain.handle('netease:playlist-detail', async (_e, id: number) => {
  try {
    const data = await neteaseSmartRequest('/v6/playlist/detail', {
      id,
      n: 100000,
      s: 8
    }) as {
      playlist?: {
        id: number; name: string; coverImgUrl?: string; playCount?: number
        trackCount?: number; description?: string
        tracks?: Array<{
          id: number; name: string; ar?: Array<{ name: string }>
          al?: { name: string; picUrl?: string }; dt?: number
        }>
      }
      code?: number
    }
    const pl = data.playlist
    if (!pl) return { success: false, playlist: null, tracks: [], message: '歌单不存在' }
    const tracks = (pl.tracks || []).map(t => ({
      id: t.id,
      name: t.name,
      artist: (t.ar || []).map(a => a.name).join(' / '),
      album: t.al?.name || '',
      cover: t.al?.picUrl || '',
      duration: t.dt || 0
    }))
    return {
      success: true,
      playlist: {
        id: pl.id,
        name: pl.name,
        cover: pl.coverImgUrl || '',
        playCount: pl.playCount || 0,
        trackCount: pl.trackCount || 0,
        description: pl.description || ''
      },
      tracks
    }
  } catch (err) {
    return { success: false, playlist: null, tracks: [], message: String(err) }
  }
})

// v3.1.3：网易云歌曲评论
ipcMain.handle('netease:comments', async (_e, id: number, pageNo = 1, pageSize = 20, sortType = 1) => {
  try {
    const offset = (pageNo - 1) * pageSize
    const data = await neteaseSmartRequest(`/v1/resource/comments/R_SO_4_${id}`, {
      rid: id,
      limit: pageSize,
      offset,
      beforeTime: pageNo > 1 ? String(Date.now()) : '0'
    }) as {
      hotComments?: Array<{
        commentId: number; content: string; time: number; likedCount: number
        user?: { nickname: string; avatarUrl?: string; userId?: number }
        beReplied?: Array<{ content: string; user?: { nickname: string } }>
      }>
      comments?: Array<{
        commentId: number; content: string; time: number; likedCount: number
        user?: { nickname: string; avatarUrl?: string; userId?: number }
        beReplied?: Array<{ content: string; user?: { nickname: string } }>
      }>
      total?: number
      code?: number
    }
    const mapComment = (c: any) => ({
      commentId: c.commentId,
      content: c.content,
      time: c.time,
      likedCount: c.likedCount || 0,
      nickname: c.user?.nickname || '匿名用户',
      avatar: c.user?.avatarUrl || '',
      userId: c.user?.userId || 0,
      repliedContent: c.beReplied?.[0]?.content || '',
      repliedNickname: c.beReplied?.[0]?.user?.nickname || ''
    })
    const allComments = [...(data.hotComments || []), ...(data.comments || [])]
    const hot = sortType === 2 ? allComments : (data.hotComments || [])
    const regular = sortType === 2 ? allComments : (data.comments || [])
    return {
      success: true,
      comments: regular.map(mapComment),
      hotComments: hot.map(mapComment),
      total: data.total || 0
    }
  } catch (err) {
    return { success: false, comments: [], hotComments: [], total: 0, message: String(err) }
  }
})

// ── v3.1.5：热搜列表 ──

ipcMain.handle('netease:hot-search', async () => {
  try {
    const data = await neteaseSmartRequest('/search/hot', { type: 1111 }) as {
      result?: { hots?: Array<{ first: string; second?: number; third?: number; iconUrl?: string }> }
      code?: number
    }
    const hots = (data.result?.hots || []).map((h, i) => ({
      rank: i + 1,
      keyword: h.first,
      score: h.second || 0,
      iconUrl: h.iconUrl || ''
    }))
    return { success: true, hots }
  } catch (err) {
    return { success: false, hots: [], message: String(err) }
  }
})

// ── v3.1.5：排行榜列表 ──

ipcMain.handle('netease:toplist', async () => {
  try {
    const data = await neteaseSmartRequest('/toplist/detail', {}) as {
      list?: Array<{
        id: number; name: string; coverImgUrl?: string; updateFrequency?: string
        description?: string; playCount?: number; tracks?: Array<{ first: string; second: string }>
      }>
      code?: number
    }
    const lists = (data.list || []).map(l => ({
      id: l.id,
      name: l.name,
      cover: l.coverImgUrl || '',
      updateFrequency: l.updateFrequency || '',
      description: l.description || '',
      playCount: l.playCount || 0,
      topTracks: (l.tracks || []).slice(0, 3).map(t => ({ name: t.first, artist: t.second }))
    }))
    return { success: true, lists }
  } catch (err) {
    return { success: false, lists: [], message: String(err) }
  }
})

// ── v3.1.5：排行榜详情（含歌曲列表） ──

ipcMain.handle('netease:toplist-detail', async (_e, id: number) => {
  try {
    const data = await neteaseSmartRequest('/v6/playlist/detail', {
      id,
      n: 100000,
      s: 8
    }) as {
      playlist?: {
        id: number; name: string; coverImgUrl?: string; playCount?: number
        trackCount?: number; description?: string
        tracks?: Array<{
          id: number; name: string; ar?: Array<{ name: string }>
          al?: { name: string; picUrl?: string }; dt?: number
        }>
      }
      code?: number
    }
    const pl = data.playlist
    if (!pl) return { success: false, playlist: null, tracks: [], message: '榜单不存在' }
    const tracks = (pl.tracks || []).map(t => ({
      id: t.id,
      name: t.name,
      artist: (t.ar || []).map(a => a.name).join(' / '),
      album: t.al?.name || '',
      cover: t.al?.picUrl || '',
      duration: t.dt || 0
    }))
    return {
      success: true,
      playlist: {
        id: pl.id,
        name: pl.name,
        cover: pl.coverImgUrl || '',
        playCount: pl.playCount || 0,
        trackCount: pl.trackCount || 0,
        description: pl.description || ''
      },
      tracks
    }
  } catch (err) {
    return { success: false, playlist: null, tracks: [], message: String(err) }
  }
})

// ── v3.1.5：用户详情 ──

ipcMain.handle('netease:user-detail', async (_e, uid: number) => {
  try {
    const data = await neteaseSmartRequest(`/v1/user/detail/${uid}`, {}) as {
      profile?: {
        userId?: number; nickname?: string; avatarUrl?: string; signature?: string
        level?: number; gender?: number; birthday?: number; province?: number; city?: number
        followeds?: number; follows?: number; playlistCount?: number
        eventCount?: number; createdPlaylistCount?: number
      }
      level?: number
      listenSongs?: number
      code?: number
    }
    const p = data.profile
    if (!p) return { success: false, user: null, message: '获取用户详情失败' }
    return {
      success: true,
      user: {
        id: p.userId || 0,
        nickname: p.nickname || '',
        avatar: p.avatarUrl || '',
        signature: p.signature || '',
        level: p.level || data.level || 0,
        gender: p.gender || 0,
        birthday: p.birthday || 0,
        followeds: p.followeds || 0,
        follows: p.follows || 0,
        playlistCount: p.playlistCount || 0,
        listenSongs: data.listenSongs || 0
      }
    }
  } catch (err) {
    return { success: false, user: null, message: String(err) }
  }
})

// ── v3.1.5：账号信息 ──

ipcMain.handle('netease:user-account', async () => {
  try {
    const data = await neteaseSmartRequest('/w/nuser/account/get', {}) as {
      code?: number
      profile?: { userId?: number; nickname?: string; avatarUrl?: string; signature?: string; level?: number; birthday?: number; gender?: number }
      account?: { id?: number; userName?: string; email?: string; phone?: string; alias?: string }
      bound?: Array<{ bindingStatus?: number; bindTime?: number; type?: number; expired?: boolean }>
      viptype?: number
      createTime?: number
      createDays?: number
    }
    if (data.code !== 200 || !data.profile) return { success: false, message: '获取账号信息失败' }
    const bPhone = (data.bound || []).find(b => b.type === 2)
    const bEmail = (data.bound || []).find(b => b.type === 3)
    const bindTime = bPhone?.bindTime
    const emailBindTime = bEmail?.bindTime
    const phoneStr = (bindTime && bindTime > 0 && !bPhone?.expired) ? `${bindTime.toString().slice(0,3)}****${bindTime.toString().slice(-4)}` : ''
    const emailStr = (bEmail && bEmail.bindingStatus === 1 && emailBindTime && emailBindTime > 0) ? `${emailBindTime.toString().slice(0,3)}@***` : ''
    return {
      success: true,
      data: {
        id: data.account?.id || data.profile.userId || 0,
        username: data.account?.userName || '',
        nickname: data.profile.nickname || '',
        phone: phoneStr,
        email: emailStr,
        vipType: data.viptype || 0,
        createTime: data.createTime || 0,
        createDays: data.createDays || 0,
        gender: data.profile.gender || 0,
        birthday: data.profile.birthday || 0
      }
    }
  } catch (err) {
    return { success: false, message: String(err) }
  }
})

// ── v3.1.5：喜欢音乐 ──

ipcMain.handle('netease:like', async (_e, songId: number, like: boolean = true) => {
  try {
    // v3.2.8：根据 NeteaseCloudMusicApiEnhanced(song_like.js) 与 ncm-api-rs(song_like.rs) 源码，
    // /song/like 端点无需易盾反作弊 token（仅发评论等敏感操作需要）。
    // 移除 getAntiCheatToken 调用，改用 neteaseSmartRequest（eapi 优先，weapi 降级），
    // 参数对齐 song_like.js：{ trackId, like }（userid 由 MUSIC_U cookie 标识）。
    await neteaseSmartRequest('/song/like', { trackId: songId, like })
    return { success: true, liked: like }
  } catch (err) {
    return { success: false, liked: false, message: String(err) }
  }
})

// ── v3.1.5：歌曲是否已喜欢（支持单个或批量，传入逗号分隔的 ID 字符串可批量查询）
//  v3.2.0：修复歌曲喜爱状态检查 bug
//  - 兼容两种响应格式：数组 [{songId,liked:1/0}] 与对象 {"id": true/false}
//  - 修复参数名与响应字段映射，确保已喜爱歌曲正确返回 true ──

ipcMain.handle('netease:song-like-status', async (_e, songId: number | string) => {
  try {
    const ids = String(songId)
    const data = await neteaseSmartRequest('/song/like/check', {
      trackIds: ids
    }) as { code?: number; data?: Array<{ songId?: number; liked?: number | boolean }> | { [key: string]: number | boolean } }
    const firstId = ids.split(',')[0]
    const likedMap: Record<string, boolean> = {}
    // 兼容两种响应格式
    if (Array.isArray(data.data)) {
      // 数组格式：[{ songId: 123, liked: 1 }]
      for (const item of data.data) {
        if (item && item.songId !== undefined) {
          likedMap[String(item.songId)] = !!item.liked
        }
      }
    } else if (data.data && typeof data.data === 'object') {
      // 对象格式：{"123": true, "456": false} 或 {"123": 1, "456": 0}
      for (const [k, v] of Object.entries(data.data)) {
        likedMap[k] = !!v
      }
    }
    return { success: true, liked: !!likedMap[firstId], likedMap }
  } catch (err) {
    return { success: false, liked: false, likedMap: {} }
  }
})

// ── v3.2.1：喜欢音乐列表（/api/song/like/get，对齐 ncm-api-rs likelist）
//   原实现使用不存在的 /song/like/check 导致已喜爱歌曲状态始终为 false。
//   正确做法：一次性拉取当前用户已喜欢的全部歌曲 ID，前端按集合成员判断 ──

ipcMain.handle('netease:likelist', async (_e, uid?: number) => {
  try {
    let userId = Number(uid) || 0
    if (!userId) {
      // 未传 uid 时从登录态获取
      const acc = await neteaseSmartRequest('/w/nuser/account/get', {}) as {
        code?: number
        profile?: { userId?: number }
        account?: { id?: number }
      }
      if (acc.code === 200 && acc.profile) {
        userId = acc.profile.userId || acc.account?.id || 0
      }
    }
    if (!userId) return { success: false, ids: [], message: '未登录' }
    const data = await neteaseSmartRequest('/song/like/get', { uid: userId }) as {
      code?: number
      ids?: number[]
      data?: { ids?: number[] } | number[]
    }
    // 兼容多种响应结构：{ ids: [] } | { data: { ids: [] } } | { data: [] }
    let ids: number[] = []
    if (Array.isArray(data.ids)) {
      ids = data.ids
    } else if (Array.isArray(data.data)) {
      ids = data.data
    } else if (data.data && Array.isArray((data.data as { ids?: number[] }).ids)) {
      ids = (data.data as { ids: number[] }).ids
    }
    return { success: true, ids: ids.map(Number).filter(id => id > 0) }
  } catch (err) {
    return { success: false, ids: [], message: String(err) }
  }
})

// ── v3.1.5：心动模式（官方 intelligence list API）
//  v3.2.1：修复 API 参数错误
//  - 旧实现把查询参数 {id,pid,sid} 当作请求体发送，与服务端期望不符
//  - 正确请求体（对齐 NeteaseCloudMusicApiEnhanced playmode_intelligence_list）：
//    { songId, type: 'fromPlayOne', playlistId, startMusicId, count } ──

ipcMain.handle('netease:intelligence-list', async (_e, songId: number, playlistId: number) => {
  try {
    const data = await neteaseSmartRequest('/playmode/intelligence/list', {
      songId: songId,
      type: 'fromPlayOne',
      playlistId: playlistId,
      startMusicId: songId,
      count: 1
    }) as {
      data?: Array<{
        songInfo?: {
          id: number; name: string; ar?: Array<{ name: string }>
          al?: { name: string; picUrl?: string }; dt?: number
        }
        recommended?: boolean
      }>
      code?: number
    }
    const songs = (data.data || [])
      .filter(item => item.songInfo)
      .map(item => {
        const s = item.songInfo!
        return {
          id: s.id,
          name: s.name,
          artist: (s.ar || []).map(a => a.name).join(' / '),
          album: s.al?.name || '',
          cover: s.al?.picUrl || '',
          duration: s.dt || 0,
          recommended: item.recommended || false
        }
      })
    return { success: true, songs }
  } catch (err) {
    return { success: false, songs: [], message: String(err) }
  }
})

// ── v3.2.0：评论点赞（/api/v1/comment/{like|unlike}） ──

ipcMain.handle('netease:comment-like', async (_e, songId: number, commentId: number, like: boolean) => {
  try {
    // v3.2.8：根据 NeteaseCloudMusicApiEnhanced(comment_like.js) 与 ncm-api-rs(comment_like.rs) 源码，
    // 评论点赞无需易盾反作弊 token（仅发评论 comment.js 需要 checkToken='v2'）。
    // 改用 neteaseSmartRequest（eapi 优先，weapi 降级），移除 getAntiCheatToken 调用。
    const path = like ? '/v1/comment/like' : '/v1/comment/unlike'
    // threadId 格式：R_SO_4_{songId}（歌曲资源类型前缀）
    await neteaseSmartRequest(path, {
      threadId: `R_SO_4_${songId}`,
      commentId: String(commentId)
    })
    return { success: true, liked: like }
  } catch (err) {
    return { success: false, liked: !like, message: String(err) }
  }
})

// ── v3.2.2：网易云云盘歌曲列表（/api/v1/cloud/get） ──

ipcMain.handle('netease:cloud-drive', async (_e, pageSize = 50, pageNo = 0) => {
  try {
    const data = await neteaseSmartRequest('/v1/cloud/get', {
      limit: pageSize,
      offset: pageNo * pageSize
    }) as {
      code?: number
      count?: number
      data?: Array<{
        songId?: number
        album?: string
        albumId?: number
        artist?: string
        bitrate?: number
        cover?: number | string
        fileName?: string
        fileSize?: number
        level?: string
        playTime?: number
        simpleSong?: {
          id: number
          name?: string
          ar?: Array<{ name: string; id?: number }>
          al?: { name?: string; picUrl?: string; id?: number }
          dt?: number
        }
        addTime?: number
        version?: number
      }>
    }
    const count = Number(data.count || 0)
    const list = (data.data || []).map(item => {
      const ss = item.simpleSong
      const id = Number(item.songId || ss?.id || 0)
      const name = ss?.name || item.fileName || String(id)
      const artist = ss?.ar?.map(a => a.name).join(' / ') || item.artist || ''
      const album = ss?.al?.name || item.album || ''
      const cover = ss?.al?.picUrl || (item.cover ? String(item.cover) : '')
      const duration = Number(ss?.dt || item.playTime || 0)
      return {
        id,
        name,
        artist,
        album,
        cover,
        duration,
        fileName: item.fileName || '',
        fileSize: Number(item.fileSize || 0),
        addTime: Number(item.addTime || 0),
        level: item.level || ''
      }
    })
    return { success: true, songs: list, count }
  } catch (err) {
    return { success: false, songs: [], count: 0, message: String(err) }
  }
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

// 导出数据（v3.2.7：固定导出路径为 D:\下载\文档\11408kaoyan-helper，不再弹出保存对话框）
ipcMain.handle('export-data', async (_event, data: string) => {
  try {
    // v3.2.7：必须使用 D:\\ 作为根，否则 path.join('D:', ...) 在 Windows 下会变成 D:xxx（相对路径，而非 D:\xxx）
    const exportDir = path.join('D:\\', '下载', '文档', '11408kaoyan-helper')
    fs.mkdirSync(exportDir, { recursive: true })
    const fileName = `考研助手备份_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`
    const filePath = path.join(exportDir, fileName)
    fs.writeFileSync(filePath, data, 'utf-8')
    return { success: true, path: filePath }
  } catch (err) {
    // 固定目录失败时，回退到用户目录（确保功能不失效）
    try {
      const fallbackDir = app.getPath('documents')
      const fileName = `考研助手备份_${new Date().toISOString().slice(0, 10)}.json`
      const filePath = path.join(fallbackDir, fileName)
      fs.writeFileSync(filePath, data, 'utf-8')
      return { success: true, path: filePath, fallback: true }
    } catch (e2) {
      return { success: false, message: String((e2 as Error)?.message || e2) }
    }
  }
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
