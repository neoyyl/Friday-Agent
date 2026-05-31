export interface BackendResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface BackendError {
  error: string
}

export function unwrapBackendResponse<T>(res: BackendResponse<T> | T | undefined | null, fallbackName = 'data'): T {
  if (res == null) throw new Error('BackendResponse is null/undefined')
  if (typeof res === 'object' && 'error' in res && res.error) throw new Error(res.error as string)
  if (typeof res === 'object' && 'data' in res && 'success' in res) return (res as BackendResponse<T>).data as T
  return res as T
}

export interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface MessageRecord {
  id: string
  session_id: string
  role: string
  content: string
  tool_calls?: string
  created_at: string
}

export interface Settings {
  apiKey: string
  model: string
  temperature: string
  maxTokens: string
  [key: string]: string
}

export interface Tool {
  id: string
  name: string
  description: string
  category: 'code' | 'file' | 'web' | 'system'
  parameters: ToolParameter[]
  enabled: boolean
}

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  default?: unknown
  enum?: unknown[]
}

export interface ToolExecutionResult {
  success: boolean
  output?: string
  error?: string
  metadata?: Record<string, unknown>
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMOptions {
  model?: string
  temperature?: number
  apiKey?: string
  provider?: string
  baseUrl?: string
  maxTokens?: number
}

export interface LLMResponse {
  role: 'assistant'
  content: string
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
}

export interface BackendStatus {
  process: string
  pid: number
  wsConnected: boolean
  services: Array<{ name: string; ready: boolean; error?: string }>
}

export interface ElectronAPI {
  sessions: {
    list(): Promise<Session[]>
    create(title: string): Promise<Session>
    delete(id: string): Promise<{ success: boolean }>
    update(id: string, title: string): Promise<{ success: boolean }>
  }

  messages: {
    list(sessionId: string, limit?: number, offset?: number): Promise<MessageRecord[]>
    create(sessionId: string, role: string, content: string, toolCalls?: string): Promise<MessageRecord>
  }

  tools: {
    list(): Promise<Tool[]>
    toggle(toolId: string, enabled: boolean): Promise<{ success: boolean }>
    getConfig(toolId: string): Promise<Tool | null>
    updateConfig(toolId: string, config: string): Promise<{ success: boolean }>
  }

  llm: {
    chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>
    chatStream(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>
    getModels(): Promise<ModelInfo[]>
    onStreamChunk(callback: (chunk: string) => void): () => void
    onStreamDone(callback: () => void): () => void
  }

  settings: {
    get(): Promise<Settings>
    update(settings: Record<string, string>): Promise<Settings>
  }

  ipc: {
    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void
    off(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void
    send(channel: string, ...args: unknown[]): void
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
  }

  backend: {
    start(): Promise<BackendResponse<{ status: string }>>
    stop(): Promise<BackendResponse<{ success: boolean }>>
    status(): Promise<BackendStatus>
    get<T = unknown>(path: string): Promise<BackendError | BackendResponse<T>>
    post<T = unknown>(path: string, body?: unknown): Promise<BackendError | BackendResponse<T>>
    put<T = unknown>(path: string, body?: unknown): Promise<BackendError | BackendResponse<T>>
    del<T = unknown>(path: string): Promise<BackendError | BackendResponse<T>>

    agents: {
      list(): Promise<BackendResponse<AgentListResponse>>
      stats(): Promise<BackendResponse<AgentStatsResponse>>
      dispatch(task: string, mode: string, options?: Record<string, unknown>): Promise<BackendResponse<DispatchResultResponse>>
      history(): Promise<BackendResponse<HistoryResponse>>
    }

    skills: {
      list(): Promise<BackendResponse<SkillListResponse>>
      stats(): Promise<BackendResponse<SkillStatsResponse>>
      call(id: string, params?: Record<string, unknown>): Promise<BackendResponse<unknown>>
      reload(id: string): Promise<BackendResponse<{ success: boolean }>>
      find(capability: string): Promise<BackendResponse<{ skills: Array<{ id: string; name: string; version: string }> }>>
      scan(): Promise<BackendResponse<{ loaded: number }>>
    }

    scheduler: {
      status(): Promise<BackendResponse<SchedulerStatusResponse>>
      jobs(): Promise<BackendResponse<{ jobs: SchedulerJobResponse[] }>>
      create(job: Partial<SchedulerJobResponse>): Promise<BackendResponse<SchedulerJobResponse>>
      delete(id: string): Promise<BackendResponse<{ success: boolean }>>
      toggle(id: string): Promise<BackendResponse<SchedulerJobResponse | null>>
      runAction(name: string): Promise<BackendResponse<{ success: boolean }>>
    }

    triggers: {
      list(): Promise<BackendResponse<{ triggers: TriggerResponse[] }>>
      create(trigger: Partial<TriggerResponse>): Promise<BackendResponse<TriggerResponse>>
      delete(id: string): Promise<BackendResponse<{ success: boolean }>>
      toggle(id: string): Promise<BackendResponse<TriggerResponse | null>>
      presets(): Promise<BackendResponse<TriggerPreset[]>>
    }

    workflows: {
      list(): Promise<BackendResponse<{ workflows: WorkflowDefResponse[] }>>
      create(workflow: Partial<WorkflowDefResponse>): Promise<BackendResponse<WorkflowDefResponse>>
      run(id: string): Promise<BackendResponse<{ success: boolean; instance_id: string }>>
      instances(): Promise<BackendResponse<{ instances: WorkflowInstanceResponse[] }>>
    }

    emotion: {
      analyze(text: string): Promise<BackendResponse<EmotionResultResponse>>
      state(): Promise<BackendResponse<EmotionStateResponse>>
    }

    voice: {
      speak(text: string, tone?: string): Promise<BackendResponse<{ success: boolean }>>
      stop(): Promise<BackendResponse<{ success: boolean }>>
      status(): Promise<BackendResponse<TTSStateResponse>>
      speakers(): Promise<BackendResponse<{ speakers: SpeakerInfoResponse[] }>>
      register(name: string, config?: Record<string, unknown>): Promise<BackendResponse<SpeakerInfoResponse>>
      deleteSpeaker(name: string): Promise<BackendResponse<{ success: boolean }>>
      currentSpeaker(): Promise<BackendResponse<SpeakerInfoResponse | null>>
      identify(data: unknown): Promise<BackendResponse<{ speaker: string; confidence: number }>>
      transcribe(audioBase64: string, lang?: string): Promise<BackendResponse<{ text: string; lang: string }>>
    }

    dispatch: {
      stats(): Promise<BackendResponse<DispatchStatsResponse>>
      insights(): Promise<BackendResponse<DispatchInsightResponse[]>>
    }

    log: {
      list(): Promise<BackendResponse<ExecutionRecordResponse[]>>
      report(): Promise<BackendResponse<ExecutionReportResponse>>
    }

    timing: {
      readiness(): Promise<BackendResponse<TimingReadinessResponse>>
      shouldNotify(data: unknown): Promise<BackendResponse<boolean>>
    }

    self_heal: {
      check(): Promise<BackendResponse<HealCheckResponse>>
      fix(): Promise<BackendResponse<HealFixResponse>>
    }

    personality: {
      get(): Promise<BackendResponse<{ content: string }>>
    }

    memory: {
      list(): Promise<BackendResponse<MemoryListResponse>>
      context(): Promise<BackendResponse<MemoryContextResponse>>
      save(data: { role: string; content: string; emotion?: string; topic?: string }): Promise<BackendResponse<{ success: boolean }>>
    }

    gpu: {
      status(): Promise<BackendResponse<GPUStatusResponse>>
    }

    obsidian: {
      config(): Promise<BackendResponse<ObsidianConfigResponse>>
      notes(folder?: string): Promise<BackendResponse<{ notes: ObsidianNoteResponse[]; vault: string }>>
      write(data: { title: string; content: string; tags?: string[]; folder?: string }): Promise<BackendResponse<{ path: string }>>
    }

    onEvent(callback: (event: string, data: unknown) => void): () => void
  }
}

export interface UpdateAPI {
  check(): Promise<{ status: string; version?: string }>
  install(): Promise<{ success: boolean }>
  onStatus(callback: (status: { status: string; version?: string; percent?: number; error?: string }) => void): () => void
}

// --- Response sub-types (to keep the ElectronAPI readable) ---

interface AgentListResponse { agents: Array<{ id: string; name: string; description: string; capabilities: string[] }> }
interface AgentStatsResponse { total: number; active: number }
interface DispatchResultResponse { agent_id: string; result: string }
interface HistoryResponse { history: Array<{ id: string; agent_id: string; task: string; status: string }> }

interface SkillListResponse { skills: Array<{ id: string; name: string; version: string; description: string; icon: string; capabilities: string[]; call_count: number; status: string }> }
interface SkillStatsResponse { total: number; loaded: number }

interface SchedulerJobResponse { id: string; name: string; cron: string; action: string; enabled: boolean; created_at: string }
interface SchedulerStatusResponse { running: boolean; jobs: number }

interface TriggerResponse { id: string; name: string; type: string; enabled: boolean; created_at: string }
interface TriggerPreset { type: string; name: string; config: Record<string, unknown> }

interface WorkflowDefResponse { id: string; name: string; steps: number; created_at: string }
interface WorkflowInstanceResponse { id: string; workflow_id: string; status: string; started_at: string }

interface EmotionResultResponse { emotion: string; confidence: number }
interface EmotionStateResponse { current: string; history: Array<{ emotion: string; timestamp: string }>; intensity: number }

interface SpeakerInfoResponse { name: string; alias?: string; tone?: string; similarity?: number }
interface TTSStateResponse { playing: boolean; current?: string; queue: string[] }

interface DispatchStatsResponse { total: number; by_agent: Record<string, number>; by_status: Record<string, number> }
interface DispatchInsightResponse { type: string; message: string; timestamp: string }

interface ExecutionRecordResponse { id: string; timestamp: string; action: string; result: string; status: string }
interface ExecutionReportResponse { summary?: string; stats?: Record<string, number> }

interface TimingReadinessResponse { ready: boolean; reason?: string }

interface HealCheckResponse { issues: Array<{ id: string; severity: string; message: string }>; healthy: boolean; score: number }
interface HealFixResponse { fixed: number; failed: number; fixes: Array<{ issue: string; status: string }> }

interface MemoryListResponse { context: Array<{ role: string; content: string }>; facts: string[] }
interface MemoryContextResponse { context: Array<{ role: string; content: string }>; facts: string[] }

interface GPUStatusResponse { available: boolean; name?: string; memory_total?: number; memory_used?: number; utilization?: number; temperature?: number }

interface ObsidianConfigResponse { vault_path: string; exists: boolean; configured: boolean }
interface ObsidianNoteResponse { name: string; path: string; size: number; modified: number }

declare global {
  interface Window {
    electronAPI?: ElectronAPI & { update?: UpdateAPI }
  }
}
