import { app, BrowserWindow, ipcMain, dialog, nativeTheme } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

let mainWindow: BrowserWindow | null = null

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

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  // 系统主题变化时同步窗口背景色
  nativeTheme.on('updated', () => {
    mainWindow?.setBackgroundColor(getWindowBgColor())
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
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
