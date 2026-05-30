import { ipcRenderer, contextBridge } from 'electron'

// --------- Original APIs ---------

const sessionsAPI = {
  list: () => ipcRenderer.invoke('sessions:list'),
  create: (title: string) => ipcRenderer.invoke('sessions:create', title),
  delete: (id: string) => ipcRenderer.invoke('sessions:delete', id),
  update: (id: string, title: string) => ipcRenderer.invoke('sessions:update', id, title),
}

const messagesAPI = {
  list: (sessionId: string) => ipcRenderer.invoke('messages:list', sessionId),
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

// --------- Friday Kernel API (Native mode — no subprocess) ---------

const kernelAPI = {
  start: () => ipcRenderer.invoke('kernel:start'),
  stop: () => ipcRenderer.invoke('kernel:stop'),
  status: () => ipcRenderer.invoke('kernel:status'),
  getStderrLog: () => ipcRenderer.invoke('kernel:getStderrLog'),

  get: (path: string) => ipcRenderer.invoke('kernel:proxy', 'GET', path),
  post: (path: string, body?: any) => ipcRenderer.invoke('kernel:proxy', 'POST', path, body),
  put: (path: string, body?: any) => ipcRenderer.invoke('kernel:proxy', 'PUT', path, body),
  del: (path: string) => ipcRenderer.invoke('kernel:proxy', 'DELETE', path),

  agents: {
    list: () => ipcRenderer.invoke('kernel:agents:list'),
    stats: () => ipcRenderer.invoke('kernel:agents:stats'),
    dispatch: (task: string, mode: string, options?: any) =>
      ipcRenderer.invoke('kernel:agents:dispatch', task, mode, options),
    history: () => ipcRenderer.invoke('kernel:agents:history'),
  },

  skills: {
    list: () => ipcRenderer.invoke('kernel:skills:list'),
    stats: () => ipcRenderer.invoke('kernel:skills:stats'),
    call: (id: string, params?: any) => ipcRenderer.invoke('kernel:skills:call', id, params),
    reload: (id: string) => ipcRenderer.invoke('kernel:skills:reload', id),
    find: (capability: string) => ipcRenderer.invoke('kernel:skills:find', capability),
    scan: () => ipcRenderer.invoke('kernel:skills:scan'),
  },

  scheduler: {
    status: () => ipcRenderer.invoke('kernel:scheduler:status'),
    jobs: () => ipcRenderer.invoke('kernel:scheduler:jobs'),
    create: (job: any) => ipcRenderer.invoke('kernel:scheduler:create', job),
    delete: (id: string) => ipcRenderer.invoke('kernel:scheduler:delete', id),
    toggle: (id: string) => ipcRenderer.invoke('kernel:scheduler:toggle', id),
    runAction: (name: string) => ipcRenderer.invoke('kernel:scheduler:action', name),
  },

  triggers: {
    list: () => ipcRenderer.invoke('kernel:triggers:list'),
    create: (trigger: any) => ipcRenderer.invoke('kernel:triggers:create', trigger),
    delete: (id: string) => ipcRenderer.invoke('kernel:triggers:delete', id),
    toggle: (id: string) => ipcRenderer.invoke('kernel:triggers:toggle', id),
    presets: () => ipcRenderer.invoke('kernel:triggers:presets'),
  },

  workflows: {
    list: () => ipcRenderer.invoke('kernel:workflows:list'),
    create: (workflow: any) => ipcRenderer.invoke('kernel:workflows:create', workflow),
    run: (id: string) => ipcRenderer.invoke('kernel:workflows:run', id),
    instances: () => ipcRenderer.invoke('kernel:workflows:instances'),
  },

  emotion: {
    analyze: (text: string) => ipcRenderer.invoke('kernel:emotion:analyze', text),
    state: () => ipcRenderer.invoke('kernel:emotion:state'),
  },

  voice: {
    speak: (text: string, tone?: string) => ipcRenderer.invoke('kernel:voice:speak', text, tone),
    stop: () => ipcRenderer.invoke('kernel:voice:stop'),
    status: () => ipcRenderer.invoke('kernel:voice:status'),
    speakers: () => ipcRenderer.invoke('kernel:voice:speakers'),
    register: (name: string, config?: any) => ipcRenderer.invoke('kernel:voice:register', name, config),
    deleteSpeaker: (name: string) => ipcRenderer.invoke('kernel:voice:deleteSpeaker', name),
    currentSpeaker: () => ipcRenderer.invoke('kernel:voice:currentSpeaker'),
    identify: (data: any) => ipcRenderer.invoke('kernel:voice:identify', data),
    transcribe: (audioBase64: string, lang?: string) =>
      ipcRenderer.invoke('kernel:asr:transcribe', audioBase64, lang),
  },

  dispatch: {
    stats: () => ipcRenderer.invoke('kernel:dispatch:stats'),
    insights: () => ipcRenderer.invoke('kernel:dispatch:insights'),
  },

  log: {
    list: () => ipcRenderer.invoke('kernel:log:list'),
    report: () => ipcRenderer.invoke('kernel:log:report'),
  },

  timing: {
    readiness: () => ipcRenderer.invoke('kernel:timing:readiness'),
    shouldNotify: (data: any) => ipcRenderer.invoke('kernel:timing:shouldNotify', data),
  },

  self_heal: {
    check: () => ipcRenderer.invoke('kernel:self_heal:check'),
    fix: () => ipcRenderer.invoke('kernel:self_heal:fix'),
  },

  personality: {
    get: () => ipcRenderer.invoke('kernel:personality:get'),
  },

  memory: {
    list: () => ipcRenderer.invoke('kernel:memory:list'),
    context: () => ipcRenderer.invoke('kernel:memory:context'),
    save: (data: any) => ipcRenderer.invoke('kernel:memory:save', data),
  },

  gpu: {
    status: () => ipcRenderer.invoke('kernel:gpu:status'),
  },

  obsidian: {
    config: () => ipcRenderer.invoke('kernel:obsidian:config'),
    notes: (folder?: string) => ipcRenderer.invoke('kernel:obsidian:notes', folder),
    write: (data: any) => ipcRenderer.invoke('kernel:obsidian:write', data),
  },

  onEvent: (callback: (event: string, data: any) => void) => {
    const handler = (_event: any, eventName: string, data: any) => callback(eventName, data)
    ipcRenderer.on('kernel:event', handler)
    return () => ipcRenderer.removeListener('kernel:event', handler)
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
  kernel: kernelAPI,
  update: updateAPI,
})

contextBridge.exposeInMainWorld('ipcRenderer', ipcAPI)
