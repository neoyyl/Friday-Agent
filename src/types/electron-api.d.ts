export interface KernelResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface KernelError {
  error: string
}

export function unwrapKernelResponse<T>(res: KernelResponse<T> | T | undefined | null, fallbackName = 'data'): T {
  if (res == null) throw new Error('KernelResponse is null/undefined')
  if (typeof res === 'object' && 'error' in res && res.error) throw new Error(res.error as string)
  if (typeof res === 'object' && 'data' in res && 'success' in res) return (res as KernelResponse<T>).data as T
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

export interface KernelStatus {
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
    list(sessionId: string): Promise<MessageRecord[]>
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

  kernel: {
    start(): Promise<KernelResponse<{ status: string }>>
    stop(): Promise<KernelResponse<{ success: boolean }>>
    status(): Promise<KernelStatus>
    get<T = unknown>(path: string): Promise<KernelError | KernelResponse<T>>
    post<T = unknown>(path: string, body?: unknown): Promise<KernelError | KernelResponse<T>>
    put<T = unknown>(path: string, body?: unknown): Promise<KernelError | KernelResponse<T>>
    del<T = unknown>(path: string): Promise<KernelError | KernelResponse<T>>

    agents: {
      list(): Promise<KernelResponse<AgentListResponse>>
      stats(): Promise<KernelResponse<AgentStatsResponse>>
      dispatch(task: string, mode: string, options?: Record<string, unknown>): Promise<KernelResponse<DispatchResultResponse>>
      history(): Promise<KernelResponse<HistoryResponse>>
    }

    skills: {
      list(): Promise<KernelResponse<SkillListResponse>>
      stats(): Promise<KernelResponse<SkillStatsResponse>>
      call(id: string, params?: Record<string, unknown>): Promise<KernelResponse<unknown>>
      reload(id: string): Promise<KernelResponse<{ success: boolean }>>
      find(capability: string): Promise<KernelResponse<{ skills: Array<{ id: string; name: string; version: string }> }>>
      scan(): Promise<KernelResponse<{ loaded: number }>>
    }

    scheduler: {
      status(): Promise<KernelResponse<SchedulerStatusResponse>>
      jobs(): Promise<KernelResponse<{ jobs: SchedulerJobResponse[] }>>
      create(job: Partial<SchedulerJobResponse>): Promise<KernelResponse<SchedulerJobResponse>>
      delete(id: string): Promise<KernelResponse<{ success: boolean }>>
      toggle(id: string): Promise<KernelResponse<SchedulerJobResponse | null>>
      runAction(name: string): Promise<KernelResponse<{ success: boolean }>>
    }

    triggers: {
      list(): Promise<KernelResponse<{ triggers: TriggerResponse[] }>>
      create(trigger: Partial<TriggerResponse>): Promise<KernelResponse<TriggerResponse>>
      delete(id: string): Promise<KernelResponse<{ success: boolean }>>
      toggle(id: string): Promise<KernelResponse<TriggerResponse | null>>
      presets(): Promise<KernelResponse<TriggerPreset[]>>
    }

    workflows: {
      list(): Promise<KernelResponse<{ workflows: WorkflowDefResponse[] }>>
      create(workflow: Partial<WorkflowDefResponse>): Promise<KernelResponse<WorkflowDefResponse>>
      run(id: string): Promise<KernelResponse<{ success: boolean; instance_id: string }>>
      instances(): Promise<KernelResponse<{ instances: WorkflowInstanceResponse[] }>>
    }

    emotion: {
      analyze(text: string): Promise<KernelResponse<EmotionResultResponse>>
      state(): Promise<KernelResponse<EmotionStateResponse>>
    }

    voice: {
      speak(text: string, tone?: string): Promise<KernelResponse<{ success: boolean }>>
      stop(): Promise<KernelResponse<{ success: boolean }>>
      status(): Promise<KernelResponse<TTSStateResponse>>
      speakers(): Promise<KernelResponse<{ speakers: SpeakerInfoResponse[] }>>
      register(name: string, config?: Record<string, unknown>): Promise<KernelResponse<SpeakerInfoResponse>>
      deleteSpeaker(name: string): Promise<KernelResponse<{ success: boolean }>>
      currentSpeaker(): Promise<KernelResponse<SpeakerInfoResponse | null>>
      identify(data: unknown): Promise<KernelResponse<{ speaker: string; confidence: number }>>
      transcribe(audioBase64: string, lang?: string): Promise<KernelResponse<{ text: string; lang: string }>>
    }

    dispatch: {
      stats(): Promise<KernelResponse<DispatchStatsResponse>>
      insights(): Promise<KernelResponse<DispatchInsightResponse[]>>
    }

    log: {
      list(): Promise<KernelResponse<ExecutionRecordResponse[]>>
      report(): Promise<KernelResponse<ExecutionReportResponse>>
    }

    timing: {
      readiness(): Promise<KernelResponse<TimingReadinessResponse>>
      shouldNotify(data: unknown): Promise<KernelResponse<boolean>>
    }

    self_heal: {
      check(): Promise<KernelResponse<HealCheckResponse>>
      fix(): Promise<KernelResponse<HealFixResponse>>
    }

    personality: {
      get(): Promise<KernelResponse<{ content: string }>>
    }

    memory: {
      list(): Promise<KernelResponse<MemoryListResponse>>
      context(): Promise<KernelResponse<MemoryContextResponse>>
      save(data: { role: string; content: string; emotion?: string; topic?: string }): Promise<KernelResponse<{ success: boolean }>>
    }

    gpu: {
      status(): Promise<KernelResponse<GPUStatusResponse>>
    }

    obsidian: {
      config(): Promise<KernelResponse<ObsidianConfigResponse>>
      notes(folder?: string): Promise<KernelResponse<{ notes: ObsidianNoteResponse[]; vault: string }>>
      write(data: { title: string; content: string; tags?: string[]; folder?: string }): Promise<KernelResponse<{ path: string }>>
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
