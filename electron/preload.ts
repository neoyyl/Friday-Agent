import { ipcRenderer, contextBridge } from 'electron'

// --------- Original APIs ---------

const sessionsAPI = {
  list: () => ipcRenderer.invoke('sessions:list'),
  create: (title: string) => ipcRenderer.invoke('sessions:create', title),
  delete: (id: string) => ipcRenderer.invoke('sessions:delete', id),
  update: (id: string, title: string) => ipcRenderer.invoke('sessions:update', id, title),
}

const messagesAPI = {
  list: (sessionId: string, limit?: number, offset?: number) => ipcRenderer.invoke('messages:list', sessionId, limit, offset),
  create: (sessionId: string, role: string, content: string, toolCalls?: string) =>
    ipcRenderer.invoke('messages:create', sessionId, role, content, toolCalls),
}

const toolsAPI = {
  list: () => ipcRenderer.invoke('tools:list'),
  toggle: (toolId: string, enabled: boolean) => ipcRenderer.invoke('tools:toggle', toolId, enabled),
  getConfig: (toolId: string) => ipcRenderer.invoke('tools:getConfig', toolId),
  updateConfig: (toolId: string, config: string) =>
    ipcRenderer.invoke('tools:updateConfig', toolId, config),
}

const llmAPI = {
  chat: (
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number; apiKey?: string; provider?: string; baseUrl?: string; maxTokens?: number }
  ) => ipcRenderer.invoke('llm:chat', messages, options),

  chatStream: (
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number; apiKey?: string; provider?: string; baseUrl?: string; maxTokens?: number }
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

const settingsAPI = {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (settings: Record<string, string>) => ipcRenderer.invoke('settings:update', settings),
}

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

const backendAPI = {
  start: () => ipcRenderer.invoke('backend:start'),
  stop: () => ipcRenderer.invoke('backend:stop'),
  status: () => ipcRenderer.invoke('backend:status'),
  getStderrLog: () => ipcRenderer.invoke('backend:getStderrLog'),

  get: (path: string) => ipcRenderer.invoke('backend:proxy', 'GET', path),
  post: (path: string, body?: any) => ipcRenderer.invoke('backend:proxy', 'POST', path, body),
  put: (path: string, body?: any) => ipcRenderer.invoke('backend:proxy', 'PUT', path, body),
  del: (path: string) => ipcRenderer.invoke('backend:proxy', 'DELETE', path),

  agents: {
    list: () => ipcRenderer.invoke('backend:agents:list'),
    stats: () => ipcRenderer.invoke('backend:agents:stats'),
    dispatch: (task: string, mode: string, options?: any) =>
      ipcRenderer.invoke('backend:agents:dispatch', task, mode, options),
    history: () => ipcRenderer.invoke('backend:agents:history'),
  },

  skills: {
    list: () => ipcRenderer.invoke('backend:skills:list'),
    stats: () => ipcRenderer.invoke('backend:skills:stats'),
    call: (id: string, params?: any) => ipcRenderer.invoke('backend:skills:call', id, params),
    reload: (id: string) => ipcRenderer.invoke('backend:skills:reload', id),
    find: (capability: string) => ipcRenderer.invoke('backend:skills:find', capability),
    scan: () => ipcRenderer.invoke('backend:skills:scan'),
  },

  scheduler: {
    status: () => ipcRenderer.invoke('backend:scheduler:status'),
    jobs: () => ipcRenderer.invoke('backend:scheduler:jobs'),
    create: (job: any) => ipcRenderer.invoke('backend:scheduler:create', job),
    delete: (id: string) => ipcRenderer.invoke('backend:scheduler:delete', id),
    toggle: (id: string) => ipcRenderer.invoke('backend:scheduler:toggle', id),
    runAction: (name: string) => ipcRenderer.invoke('backend:scheduler:action', name),
  },

  triggers: {
    list: () => ipcRenderer.invoke('backend:triggers:list'),
    create: (trigger: any) => ipcRenderer.invoke('backend:triggers:create', trigger),
    delete: (id: string) => ipcRenderer.invoke('backend:triggers:delete', id),
    toggle: (id: string) => ipcRenderer.invoke('backend:triggers:toggle', id),
    presets: () => ipcRenderer.invoke('backend:triggers:presets'),
  },

  workflows: {
    list: () => ipcRenderer.invoke('backend:workflows:list'),
    create: (workflow: any) => ipcRenderer.invoke('backend:workflows:create', workflow),
    run: (id: string) => ipcRenderer.invoke('backend:workflows:run', id),
    instances: () => ipcRenderer.invoke('backend:workflows:instances'),
  },

  emotion: {
    analyze: (text: string) => ipcRenderer.invoke('backend:emotion:analyze', text),
    state: () => ipcRenderer.invoke('backend:emotion:state'),
  },

  voice: {
    speak: (text: string, tone?: string) => ipcRenderer.invoke('backend:voice:speak', text, tone),
    stop: () => ipcRenderer.invoke('backend:voice:stop'),
    status: () => ipcRenderer.invoke('backend:voice:status'),
    speakers: () => ipcRenderer.invoke('backend:voice:speakers'),
    register: (name: string, config?: any) => ipcRenderer.invoke('backend:voice:register', name, config),
    deleteSpeaker: (name: string) => ipcRenderer.invoke('backend:voice:deleteSpeaker', name),
    currentSpeaker: () => ipcRenderer.invoke('backend:voice:currentSpeaker'),
    identify: (data: any) => ipcRenderer.invoke('backend:voice:identify', data),
    transcribe: (audioBase64: string, lang?: string) =>
      ipcRenderer.invoke('backend:asr:transcribe', audioBase64, lang),
  },

  dispatch: {
    stats: () => ipcRenderer.invoke('backend:dispatch:stats'),
    insights: () => ipcRenderer.invoke('backend:dispatch:insights'),
  },

  log: {
    list: () => ipcRenderer.invoke('backend:log:list'),
    report: () => ipcRenderer.invoke('backend:log:report'),
  },

  timing: {
    readiness: () => ipcRenderer.invoke('backend:timing:readiness'),
    shouldNotify: (data: any) => ipcRenderer.invoke('backend:timing:shouldNotify', data),
  },

  self_heal: {
    check: () => ipcRenderer.invoke('backend:self_heal:check'),
    fix: () => ipcRenderer.invoke('backend:self_heal:fix'),
  },

  personality: {
    get: () => ipcRenderer.invoke('backend:personality:get'),
  },

  memory: {
    list: () => ipcRenderer.invoke('backend:memory:list'),
    context: () => ipcRenderer.invoke('backend:memory:context'),
    save: (data: any) => ipcRenderer.invoke('backend:memory:save', data),
  },

  gpu: {
    status: () => ipcRenderer.invoke('backend:gpu:status'),
  },

  obsidian: {
    config: () => ipcRenderer.invoke('backend:obsidian:config'),
    notes: (folder?: string) => ipcRenderer.invoke('backend:obsidian:notes', folder),
    write: (data: any) => ipcRenderer.invoke('backend:obsidian:write', data),
  },

  onEvent: (callback: (event: string, data: any) => void) => {
    const handler = (_event: any, eventName: string, data: any) => callback(eventName, data)
    ipcRenderer.on('backend:event', handler)
    return () => ipcRenderer.removeListener('backend:event', handler)
  },
}

// --------- Update API (auto-updater) ---------

const updateAPI = {
  check: () => ipcRenderer.invoke('update:check'),
  install: () => ipcRenderer.invoke('update:install'),
  onStatus: (callback: (status: { status: string; version?: string; percent?: number; error?: string }) => void) => {
    const handler = (_event: any, status: any) => callback(status)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  },
}

// --------- Expose to Renderer ---------

contextBridge.exposeInMainWorld('electronAPI', {
  sessions: sessionsAPI,
  messages: messagesAPI,
  tools: toolsAPI,
  llm: llmAPI,
  settings: settingsAPI,
  ipc: ipcAPI,
  backend: backendAPI,
  update: updateAPI,
})

contextBridge.exposeInMainWorld('ipcRenderer', ipcAPI)
