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

// 导入多提供商 LLM 客户端
import { createLLMClient } from '../src/services/llm/clients'
import { getAllProviders } from '../src/services/llm/providers'
import { LLMClient } from '../src/services/llm/types'

// 导入工具管理服务
import {
  getAllTools,
  toggleTool,
  executeTool,
} from '../src/services/tools/index'

import { registerPresetTools } from '../src/services/tools/preset/index'

// 导入 Friday Kernel 桥接
import { KernelManager } from './kernel-manager'
import { KernelBridge } from './kernel-bridge'

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

// ========== Friday Kernel ==========

const KERNEL_PORT = 5001
const KERNEL_ROOT = path.join(process.env.APP_ROOT, 'Friday_Kernel')

const kernelManager = new KernelManager(KERNEL_ROOT, KERNEL_PORT)
const kernelBridge = new KernelBridge({ port: KERNEL_PORT })

// Forward Kernel events to renderer
kernelBridge.on('kernel:event', (event: string, data: any) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('kernel:event', event, data)
  }
})

// ========== Original IPC Handlers ==========

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

// ========== File System API (for SkillMarket) ==========
import fs from 'fs/promises'

ipcMain.handle('fs:readdir', async (_event, dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.filter(e => e.isDirectory()).map(e => e.name)
  } catch (err: any) {
    return []
  }
})

ipcMain.handle('fs:readfile', async (_event, filePath: string) => {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (err: any) {
    throw new Error(`Cannot read file: ${err.message}`)
  }
})

// ========== LLM 多提供商路由 ==========

function resolveClient(options?: { model?: string; temperature?: number; apiKey?: string; provider?: string; baseUrl?: string; maxTokens?: number }): { client: LLMClient; model: string; temperature: number; maxTokens: number } {
  const settings = getSettings()
  const provider = options?.provider || 'openai'
  const apiKey = options?.apiKey || settings.apiKey
  const baseUrl = options?.baseUrl
  let model = options?.model || settings.model || 'gpt-4o'
  const temperature = options?.temperature ?? (parseFloat(settings.temperature) || 0.7)
  const maxTokens = options?.maxTokens ?? (parseInt(settings.maxTokens) || 4096)

  // 直连 API 时去掉 OpenRouter 格式的 provider 前缀（如 "openai/gpt-4o" → "gpt-4o"）
  if (provider !== 'openrouter' && model.includes('/')) {
    model = model.split('/').pop() || model
  }

  const client = createLLMClient(provider, apiKey, baseUrl)
  return { client, model, temperature, maxTokens }
}

// LLM API
ipcMain.handle(
  'llm:chat',
  async (
    _event,
    chatMessages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number; apiKey?: string; provider?: string; baseUrl?: string; maxTokens?: number }
  ) => {
    try {
      const { client, model, temperature, maxTokens } = resolveClient(options)
      const response = await client.chat(
        chatMessages.map((msg) => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        { model, temperature, maxTokens }
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
    options?: { model?: string; temperature?: number; apiKey?: string; provider?: string; baseUrl?: string; maxTokens?: number }
  ) => {
    try {
      const { client, model, temperature, maxTokens } = resolveClient(options)
      let fullContent = ''

      for await (const chunk of client.chatStream(
        chatMessages.map((msg) => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        { model, temperature, maxTokens }
      )) {
        if (chunk.choices[0]?.delta?.content) {
          fullContent += chunk.choices[0].delta.content
          if (win) {
            win.webContents.send('llm:streamChunk', chunk.choices[0].delta.content)
          }
        }
      }

      if (win) {
        win.webContents.send('llm:streamDone')
      }

      return { role: 'assistant', content: fullContent }
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
  return getAllProviders().flatMap(p =>
    p.defaultModels.map(m => ({ id: m.id, name: m.name, provider: p.name }))
  )
})

// ========== Friday Kernel IPC Handlers ==========

// --- Process Management ---
ipcMain.handle('kernel:start', async () => {
  try {
    await kernelManager.start()
    await kernelBridge.connectWebSocket()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('kernel:stop', async () => {
  kernelBridge.disconnectWebSocket()
  await kernelManager.stop()
  return { success: true }
})

ipcMain.handle('kernel:status', () => {
  return {
    ...kernelManager.getStatus(),
    wsConnected: kernelBridge.isWebSocketConnected(),
  }
})

// --- Generic HTTP Proxy ---
ipcMain.handle('kernel:proxy', async (_event, method: string, apiPath: string, body?: any) => {
  try {
    switch (method.toUpperCase()) {
      case 'GET': return await kernelBridge.get(apiPath)
      case 'POST': return await kernelBridge.post(apiPath, body)
      case 'PUT': return await kernelBridge.put(apiPath, body)
      case 'DELETE': return await kernelBridge.delete(apiPath)
      default: return { error: `Unsupported method: ${method}` }
    }
  } catch (error: any) {
    return { error: error.message }
  }
})

// --- Agents ---
ipcMain.handle('kernel:agents:list', async () => {
  try { return await kernelBridge.getAgents() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:agents:stats', async () => {
  try { return await kernelBridge.getAgentStats() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:agents:dispatch', async (_event, task: string, mode: string, options?: any) => {
  try { return await kernelBridge.dispatchAgent(task, mode, options) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:agents:history', async () => {
  try { return await kernelBridge.getDispatchHistory() } catch (e: any) { return { error: e.message } }
})

// --- Skills ---
ipcMain.handle('kernel:skills:list', async () => {
  try { return await kernelBridge.getSkills() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:skills:stats', async () => {
  try { return await kernelBridge.getSkillStats() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:skills:call', async (_event, id: string, params?: any) => {
  try { return await kernelBridge.callSkill(id, params) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:skills:reload', async (_event, id: string) => {
  try { return await kernelBridge.reloadSkill(id) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:skills:find', async (_event, capability: string) => {
  try { return await kernelBridge.findSkillsByCapability(capability) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:skills:scan', async () => {
  try { return await kernelBridge.scanSkills() } catch (e: any) { return { error: e.message } }
})

// --- Scheduler ---
ipcMain.handle('kernel:scheduler:status', async () => {
  try { return await kernelBridge.getSchedulerStatus() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:scheduler:jobs', async () => {
  try { return await kernelBridge.getSchedulerJobs() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:scheduler:create', async (_event, job: any) => {
  try { return await kernelBridge.createSchedulerJob(job) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:scheduler:delete', async (_event, id: string) => {
  try { return await kernelBridge.deleteSchedulerJob(id) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:scheduler:toggle', async (_event, id: string) => {
  try { return await kernelBridge.toggleSchedulerJob(id) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:scheduler:action', async (_event, name: string) => {
  try { return await kernelBridge.runSchedulerAction(name) } catch (e: any) { return { error: e.message } }
})

// --- Triggers ---
ipcMain.handle('kernel:triggers:list', async () => {
  try { return await kernelBridge.getTriggers() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:triggers:create', async (_event, trigger: any) => {
  try { return await kernelBridge.createTrigger(trigger) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:triggers:delete', async (_event, id: string) => {
  try { return await kernelBridge.deleteTrigger(id) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:triggers:toggle', async (_event, id: string) => {
  try { return await kernelBridge.toggleTrigger(id) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:triggers:presets', async () => {
  try { return await kernelBridge.getTriggerPresets() } catch (e: any) { return { error: e.message } }
})

// --- Workflows ---
ipcMain.handle('kernel:workflows:list', async () => {
  try { return await kernelBridge.getWorkflows() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:workflows:create', async (_event, workflow: any) => {
  try { return await kernelBridge.createWorkflow(workflow) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:workflows:run', async (_event, id: string) => {
  try { return await kernelBridge.runWorkflow(id) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:workflows:instances', async () => {
  try { return await kernelBridge.getWorkflowInstances() } catch (e: any) { return { error: e.message } }
})

// --- Emotion ---
ipcMain.handle('kernel:emotion:analyze', async (_event, text: string) => {
  try { return await kernelBridge.analyzeEmotion(text) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:emotion:state', async () => {
  try { return await kernelBridge.getEmotionState() } catch (e: any) { return { error: e.message } }
})

// --- Voice / TTS ---
ipcMain.handle('kernel:voice:speak', async (_event, text: string, tone?: string) => {
  try { return await kernelBridge.speak(text, tone) } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:voice:stop', async () => {
  try { return await kernelBridge.stopSpeaking() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:voice:status', async () => {
  try { return await kernelBridge.getTTSStatus() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:voice:speakers', async () => {
  try { return await kernelBridge.getSpeakers() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:voice:identify', async (_event, data: any) => {
  try { return await kernelBridge.identifySpeaker(data) } catch (e: any) { return { error: e.message } }
})

// --- Dispatch Log ---
ipcMain.handle('kernel:dispatch:stats', async () => {
  try { return await kernelBridge.getDispatchLogStats() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:dispatch:insights', async () => {
  try { return await kernelBridge.getDispatchInsights() } catch (e: any) { return { error: e.message } }
})

// --- Execution Log ---
ipcMain.handle('kernel:log:list', async () => {
  try { return await kernelBridge.getExecutionLog() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:log:report', async () => {
  try { return await kernelBridge.getExecutionReport() } catch (e: any) { return { error: e.message } }
})

// --- Timing ---
ipcMain.handle('kernel:timing:readiness', async () => {
  try { return await kernelBridge.getTimingReadiness() } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:timing:shouldNotify', async (_event, data: any) => {
  try { return await kernelBridge.shouldNotify(data) } catch (e: any) { return { error: e.message } }
})

// --- Self Heal ---
ipcMain.handle('kernel:self_heal:check', async () => {
  try { return await kernelBridge.get('/api/self_heal/check') } catch (e: any) { return { error: e.message } }
})

ipcMain.handle('kernel:self_heal:fix', async () => {
  try { return await kernelBridge.post('/api/self_heal/fix') } catch (e: any) { return { error: e.message } }
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

let kernelAutoStarted = false

app.whenReady().then(() => {
  initializeDatabase()
  registerPresetTools()
  createWindow()

  // Auto-start Kernel after window is ready (only once)
  if (win) {
    win.webContents.on('did-finish-load', () => {
      if (kernelAutoStarted) return
      kernelAutoStarted = true
      kernelBridge.setWindow(win!)
      // Start Kernel in background (non-blocking)
      kernelManager.start()
        .then(() => kernelBridge.connectWebSocket())
        .catch((err) => console.error('[Main] Kernel auto-start failed:', err.message))
    })
  }
})

// Cleanup on quit
app.on('before-quit', async () => {
  kernelBridge.disconnectWebSocket()
  await kernelManager.stop()
})
