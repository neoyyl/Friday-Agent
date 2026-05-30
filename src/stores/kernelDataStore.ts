import { create } from 'zustand'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PerceptionData {
  timestamp?: string
  active_window?: {
    process_name?: string
    window_title?: string
    is_vscode?: boolean
    vscode_parse?: { file?: string; project?: string }
    rect?: { width: number; height: number }
  }
  git?: {
    is_git_repo: boolean
    branch?: string
    repo_root?: string
    unstaged_count?: number
    staged_count?: number
    untracked_count?: number
    recent_commits?: Array<{ hash: string; message: string }>
  }
  project?: {
    name?: string
    type?: string
    language?: string
    dependency_count?: number
    entry_files?: string[]
    build_files?: string[]
  }
  formatted?: string
  [key: string]: unknown
}

interface GPUInfo {
  available?: boolean
  name?: string
  memory?: number
  [key: string]: unknown
}

interface LogEntry {
  id?: string
  timestamp?: string
  action?: string
  result?: string
  [key: string]: unknown
}

interface LogReportData {
  total?: number
  success?: number
  failed?: number
  [key: string]: unknown
}

interface MemoryFact {
  id?: string
  content?: string
  topic?: string
  timestamp?: string
  [key: string]: unknown
}

interface ObsidianCfg {
  vault_path?: string
  exists?: boolean
  [key: string]: unknown
}

interface ObsidianNoteItem {
  name?: string
  path?: string
  size?: number
  modified?: number
  [key: string]: unknown
}

interface SpeakerData {
  name?: string
  config?: Record<string, unknown>
  [key: string]: unknown
}

interface KernelDataState {
  perception: PerceptionData | null
  gpu: GPUInfo | null
  logs: LogEntry[]
  logReport: LogReportData | null
  memoryContext: string
  memoryFacts: MemoryFact[]
  obsidianConfig: ObsidianCfg | null
  obsidianNotes: ObsidianNoteItem[]
  speakers: SpeakerData[]
  currentSpeaker: SpeakerData | null

  perceptionLoading: boolean
  gpuLoading: boolean
  logsLoading: boolean
  memoryLoading: boolean
  obsidianLoading: boolean
  speakerLoading: boolean

  loadPerception: () => Promise<void>
  loadGPU: () => Promise<void>
  loadLogs: () => Promise<void>
  loadMemory: () => Promise<void>
  loadObsidian: () => Promise<void>
  loadSpeakers: () => Promise<void>

  writeObsidianNote: (title: string, content: string, tags: string[], folder: string) => Promise<boolean>
  registerSpeaker: (name: string, config: Record<string, unknown>) => Promise<void>
  deleteSpeaker: (name: string) => Promise<void>
}

function api(path: string): ((...args: unknown[]) => Promise<unknown>) | undefined {
  const parts = path.split('.')
  let obj: Record<string, unknown> | undefined = window.electronAPI?.kernel as Record<string, unknown> | undefined
  for (const p of parts) {
    if (!obj) return undefined
    obj = obj[p] as Record<string, unknown> | undefined
  }
  return typeof obj === 'function' ? (obj as (...args: unknown[]) => Promise<unknown>) : undefined
}

/** Simple helper to safely get nested array from API response */
function extractArray(raw: unknown, ...keys: string[]): unknown[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if ('data' in obj && obj.data) {
      const data = obj.data as Record<string, unknown>
      for (const k of keys) {
        if (Array.isArray(data[k])) return data[k] as unknown[]
      }
    }
    for (const k of keys) {
      if (Array.isArray(obj[k])) return obj[k] as unknown[]
    }
  }
  return []
}

export const useKernelDataStore = create<KernelDataState>((set) => ({
  perception: null,
  gpu: null,
  logs: [],
  logReport: null,
  memoryContext: '',
  memoryFacts: [],
  obsidianConfig: null,
  obsidianNotes: [],
  speakers: [],
  currentSpeaker: null,

  perceptionLoading: false,
  gpuLoading: false,
  logsLoading: false,
  memoryLoading: false,
  obsidianLoading: false,
  speakerLoading: false,

  loadPerception: async () => {
    set({ perceptionLoading: true })
    try {
      const raw = await api('get')?.('/api/perception/context') as Record<string, unknown> | undefined
      if (raw && !raw.error) {
        const inner = 'data' in raw ? (raw.data as Record<string, unknown>) : raw
        set({ perception: inner as unknown as PerceptionData })
      }
    } catch (err) {
      console.error('[KernelData] loadPerception failed:', err)
    }
    set({ perceptionLoading: false })
  },

  loadGPU: async () => {
    set({ gpuLoading: true })
    try {
      const r = await api('gpu.status')?.() as Record<string, unknown> | undefined
      if (r && !r.error) set({ gpu: r as unknown as GPUInfo })
    } catch (err) {
      console.error('[KernelData] loadGPU failed:', err)
    }
    set({ gpuLoading: false })
  },

  loadLogs: async () => {
    set({ logsLoading: true })
    try {
      const lr = await api('log.list')?.()
      const rr = await api('log.report')?.()
      if (lr) set({ logs: extractArray(lr, 'logs') as LogEntry[] })
      if (rr) {
        const raw = rr as Record<string, unknown>
        set({ logReport: (raw.data ?? raw) as LogReportData })
      }
    } catch (err) {
      console.error('[KernelData] loadLogs failed:', err)
    }
    set({ logsLoading: false })
  },

  loadMemory: async () => {
    set({ memoryLoading: true })
    try {
      const ctxRes = await api('memory.context')?.()
      const listRes = await api('memory.list')?.()
      if (ctxRes) {
        const raw = ctxRes as Record<string, unknown>
        const inner = (raw.data ?? raw) as Record<string, unknown>
        const c = (inner.context ?? '') as string
        set({ memoryContext: typeof c === 'string' ? c : JSON.stringify(c, null, 2) })
      }
      if (listRes) {
        set({ memoryFacts: extractArray(listRes, 'facts') as MemoryFact[] })
      }
    } catch (err) {
      console.error('[KernelData] loadMemory failed:', err)
    }
    set({ memoryLoading: false })
  },

  loadObsidian: async () => {
    set({ obsidianLoading: true })
    try {
      const [cfg, notesRes] = await Promise.all([
        api('obsidian.config')?.(),
        api('obsidian.notes')?.(),
      ])
      if (cfg) set({ obsidianConfig: cfg as unknown as ObsidianCfg })
      if (notesRes) set({ obsidianNotes: extractArray(notesRes, 'notes') as unknown as ObsidianNoteItem[] })
    } catch (err) {
      console.error('[KernelData] loadObsidian failed:', err)
    }
    set({ obsidianLoading: false })
  },

  loadSpeakers: async () => {
    set({ speakerLoading: true })
    try {
      const s = await api('voice.speakers')?.()
      const c = await api('voice.currentSpeaker')?.()
      if (s) set({ speakers: extractArray(s, 'speakers') as SpeakerData[] })
      if (c) {
        const raw = c as Record<string, unknown>
        set({ currentSpeaker: (raw.data ?? raw) as SpeakerData })
      }
    } catch (err) {
      console.error('[KernelData] loadSpeakers failed:', err)
    }
    set({ speakerLoading: false })
  },

  writeObsidianNote: async (title, content, tags, folder) => {
    try {
      const r = await api('obsidian.write')?.({ title, content, tags, folder }) as Record<string, unknown> | undefined
      if (r && !r.error) {
        set((state) => ({ obsidianNotes: [...state.obsidianNotes, { name: title }] }))
        return true
      }
    } catch (err) {
      console.error('[KernelData] writeObsidianNote failed:', err)
    }
    return false
  },

  registerSpeaker: async (name, config) => {
    try {
      await api('voice.register')?.(name, config)
      set((state) => ({ speakers: [...state.speakers, { name, ...config }] }))
    } catch (err) {
      console.error('[KernelData] registerSpeaker failed:', err)
    }
  },

  deleteSpeaker: async (name) => {
    try {
      await api('voice.deleteSpeaker')?.(name)
      set((state) => ({ speakers: state.speakers.filter((s) => s.name !== name) }))
    } catch (err) {
      console.error('[KernelData] deleteSpeaker failed:', err)
    }
  },
}))
