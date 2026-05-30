import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import { initializeDatabase } from '../src/services/database/index'
import { registerPresetTools } from '../src/services/tools/preset/index'

import { ServiceRegistry } from './services/ServiceRegistry'

import { registerSessionHandlers } from './handlers/sessions'
import { registerMessageHandlers } from './handlers/messages'
import { registerSettingsHandlers } from './handlers/settings'
import { registerToolHandlers } from './handlers/tools'
import { registerLLMHandlers } from './handlers/llm'
import { registerKernelHandlers } from './handlers/kernel'
import { registerUpdateHandlers } from './handlers/update'

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

// ========== Native Service Registry (replaces Python Kernel + KernelBridge) ==========

const serviceRegistry = new ServiceRegistry()

// Forward service events to renderer
serviceRegistry.getEventBus().onEvent((event: string, data: unknown) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('kernel:event', event, data)
  }
})

// ========== 注册所有 IPC Handlers ==========

registerSessionHandlers()
registerMessageHandlers()
registerSettingsHandlers()
registerToolHandlers()
registerLLMHandlers()
registerKernelHandlers(serviceRegistry)
registerUpdateHandlers()

// ========== Window Creation ==========

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'Friday.ico'),
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  initializeDatabase()
  registerPresetTools()
  await serviceRegistry.initAll()
  createWindow()
})

// Cleanup on quit
app.on('before-quit', async () => {
  await serviceRegistry.shutdownAll()
})
