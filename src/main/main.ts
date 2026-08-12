import { app, BrowserWindow, ipcMain, dialog, nativeTheme, protocol, net, Tray, Menu, nativeImage } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { pathToFileURL } from 'url'

// 自定义背景图存储路径（userData 目录下固定文件名）
function customBgPath(): string {
  return path.join(app.getPath('userData'), 'custom-bg.jpg')
}

// 注册私有协议：kaoyan-bg:// 用于向渲染进程提供用户自定义背景图
protocol.registerSchemesAsPrivileged([
  { scheme: 'kaoyan-bg', privileges: { standard: true, secure: true, supportFetchAPI: true } }
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
    // 自定义背景协议：存在自定义背景文件时才提供内容
    protocol.handle('kaoyan-bg', (request) => {
      const file = customBgPath()
      if (!fs.existsSync(file)) {
        return new Response('not found', { status: 404 })
      }
      return net.fetch(pathToFileURL(file).toString())
    })

    createWindow()
    createTray()

    // 系统主题变化时同步窗口背景色
    nativeTheme.on('updated', () => {
      mainWindow?.setBackgroundColor(getWindowBgColor())
    })

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

// 自定义背景 - 选择图片并应用（复制到 userData 固定文件）
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
