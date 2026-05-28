import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 导入数据库服务
import {
  initializeDatabase,
  getAllSessions,
  createSession as dbCreateSession,
  deleteSession as dbDeleteSession,
  updateSession as dbUpdateSession,
  getMessages,
  createMessage as dbCreateMessage,
  getSettings,
  updateSettings,
} from '../src/services/database/index'

// 导入 OpenRouter API 服务
import { OpenRouterClient, AVAILABLE_MODELS } from '../src/services/llm/openrouter'

// 导入工具管理服务
import {
  getAllTools,
  toggleTool,
  executeTool,
} from '../src/services/tools/index'

import { registerPresetTools } from '../src/services/tools/preset/index'

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

// ========== IPC Handlers ==========

// 会话管理
ipcMain.handle('sessions:list', () => {
  return getAllSessions()
})

ipcMain.handle('sessions:create', (_event, title: string) => {
  const id = Date.now().toString()
  return dbCreateSession(id, title)
})

ipcMain.handle('sessions:delete', (_event, id: string) => {
  return dbDeleteSession(id)
})

ipcMain.handle('sessions:update', (_event, id: string, title: string) => {
  return dbUpdateSession(id, title)
})

// 消息管理
ipcMain.handle('messages:list', (_event, sessionId: string) => {
  return getMessages(sessionId)
})

ipcMain.handle(
  'messages:create',
  (_event, sessionId: string, role: string, content: string, toolCalls?: string) => {
    const id = Date.now().toString()
    return dbCreateMessage(id, sessionId, role, content, toolCalls)
  }
)

// 设置管理
ipcMain.handle('settings:get', () => {
  return getSettings()
})

ipcMain.handle('settings:update', (_event, newSettings: Record<string, string>) => {
  return updateSettings(newSettings)
})

// 工具管理
ipcMain.handle('tools:list', () => {
  return getAllTools()
})

ipcMain.handle('tools:toggle', (_event, toolId: string, enabled: boolean) => {
  toggleTool(toolId, enabled)
  return { success: true }
})

ipcMain.handle('tools:execute', async (_event, toolId: string, params: Record<string, any>) => {
  return executeTool(toolId, params)
})

// LLM API
ipcMain.handle(
  'llm:chat',
  async (
    _event,
    chatMessages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number }
  ) => {
    try {
      const settings = getSettings()
      const apiKey = settings.apiKey

      if (!apiKey) {
        return {
          role: 'assistant',
          content: '请先在设置中配置 OpenRouter API Key。',
        }
      }

      const client = new OpenRouterClient(apiKey)
      const response = await client.chat(
        chatMessages.map((msg) => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        {
          model: options?.model || settings.model,
          temperature: options?.temperature || parseFloat(settings.temperature) || 0.7,
          maxTokens: parseInt(settings.maxTokens) || 4096,
        }
      )

      return response.choices[0].message
    } catch (error) {
      console.error('LLM chat error:', error)
      return {
        role: 'assistant',
        content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }
)

// LLM 流式响应
ipcMain.handle(
  'llm:chatStream',
  async (
    _event,
    chatMessages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number }
  ) => {
    try {
      const settings = getSettings()
      const apiKey = settings.apiKey

      if (!apiKey) {
        return {
          role: 'assistant',
          content: '请先在设置中配置 OpenRouter API Key。',
        }
      }

      const client = new OpenRouterClient(apiKey)
      let fullContent = ''

      for await (const chunk of client.chatStream(
        chatMessages.map((msg) => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        {
          model: options?.model || settings.model,
          temperature: options?.temperature || parseFloat(settings.temperature) || 0.7,
          maxTokens: parseInt(settings.maxTokens) || 4096,
        }
      )) {
        if (chunk.choices[0]?.delta?.content) {
          fullContent += chunk.choices[0].delta.content
          // 发送增量到渲染进程
          if (win) {
            win.webContents.send('llm:streamChunk', chunk.choices[0].delta.content)
          }
        }
      }

      // 发送完成信号
      if (win) {
        win.webContents.send('llm:streamDone')
      }

      return {
        role: 'assistant',
        content: fullContent,
      }
    } catch (error) {
      console.error('LLM stream error:', error)
      return {
        role: 'assistant',
        content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }
)

ipcMain.handle('llm:getModels', () => {
  return AVAILABLE_MODELS
})

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

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // 初始化数据库
  initializeDatabase()

  // 注册预设工具
  registerPresetTools()

  createWindow()
})
