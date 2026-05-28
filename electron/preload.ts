import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose specific APIs to the Renderer process ---------

// 会话管理 API
const sessionsAPI = {
  list: () => ipcRenderer.invoke('sessions:list'),
  create: (title: string) => ipcRenderer.invoke('sessions:create', title),
  delete: (id: string) => ipcRenderer.invoke('sessions:delete', id),
  update: (id: string, title: string) => ipcRenderer.invoke('sessions:update', id, title),
}

// 消息管理 API
const messagesAPI = {
  list: (sessionId: string) => ipcRenderer.invoke('messages:list', sessionId),
  create: (sessionId: string, role: string, content: string, toolCalls?: string) =>
    ipcRenderer.invoke('messages:create', sessionId, role, content, toolCalls),
}

// 工具管理 API
const toolsAPI = {
  list: () => ipcRenderer.invoke('tools:list'),
  toggle: (toolId: string, enabled: boolean) => ipcRenderer.invoke('tools:toggle', toolId, enabled),
  getConfig: (toolId: string) => ipcRenderer.invoke('tools:getConfig', toolId),
  updateConfig: (toolId: string, config: string) =>
    ipcRenderer.invoke('tools:updateConfig', toolId, config),
}

// LLM API
const llmAPI = {
  chat: (
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number }
  ) => ipcRenderer.invoke('llm:chat', messages, options),

  chatStream: (
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number }
  ) => ipcRenderer.invoke('llm:chatStream', messages, options),

  getModels: () => ipcRenderer.invoke('llm:getModels'),

  onStreamChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: any, chunk: string) => callback(chunk)
    ipcRenderer.on('llm:streamChunk', handler)
    return () => ipcRenderer.removeListener('llm:streamChunk', handler)
  },

  onStreamDone: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('llm:streamDone', handler)
    return () => ipcRenderer.removeListener('llm:streamDone', handler)
  },
}

// 设置 API
const settingsAPI = {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (settings: Record<string, string>) => ipcRenderer.invoke('settings:update', settings),
}

// 基础 IPC 通信
const ipcAPI = {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  sessions: sessionsAPI,
  messages: messagesAPI,
  tools: toolsAPI,
  llm: llmAPI,
  settings: settingsAPI,
  ipc: ipcAPI,
})

// 保留旧的 ipcRenderer 兼容性
contextBridge.exposeInMainWorld('ipcRenderer', ipcAPI)
