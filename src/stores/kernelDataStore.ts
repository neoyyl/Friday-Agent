import { create } from 'zustand'

interface KernelDataState {
  perception: any | null
  gpu: any | null
  logs: any[]
  logReport: any | null
  memoryContext: string
  memoryFacts: any[]
  obsidianConfig: any | null
  obsidianNotes: any[]
  speakers: any[]
  currentSpeaker: any | null

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
  registerSpeaker: (name: string, config: any) => Promise<void>
  deleteSpeaker: (name: string) => Promise<void>
}

function api(path: string): any {
  const parts = path.split('.')
  let obj: any = (window as any).electronAPI?.kernel
  for (const p of parts) {
    if (!obj) return undefined
    obj = obj[p]
  }
  return typeof obj === 'function' ? obj : undefined
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
      const ctx = await api('get')?.('/api/perception/context')
      if (ctx && !ctx.error) set({ perception: ctx })
    } catch {}
    set({ perceptionLoading: false })
  },

  loadGPU: async () => {
    set({ gpuLoading: true })
    try {
      const r = await api('gpu.status')?.()
      if (r && !r.error) set({ gpu: r })
    } catch {}
    set({ gpuLoading: false })
  },

  loadLogs: async () => {
    set({ logsLoading: true })
    try {
      const [lr, rr] = await Promise.all([
        api('log.list')?.(),
        api('log.report')?.(),
      ])
      if (lr && !lr.error) set({ logs: Array.isArray(lr) ? lr : (lr.logs || lr.data?.logs || []) })
      if (rr && !rr.error) set({ logReport: rr.data || rr })
    } catch {}
    set({ logsLoading: false })
  },

  loadMemory: async () => {
    set({ memoryLoading: true })
    try {
      const [ctxRes, listRes] = await Promise.all([
        api('memory.context')?.(),
        api('memory.list')?.(),
      ])
      if (ctxRes && !ctxRes.error) {
        const c = ctxRes.context || ctxRes.data?.context || ''
        set({ memoryContext: typeof c === 'string' ? c : JSON.stringify(c, null, 2) })
      }
      if (listRes && !listRes.error) {
        const f = listRes.facts || listRes.data?.facts || []
        set({ memoryFacts: Array.isArray(f) ? f : [] })
      }
    } catch {}
    set({ memoryLoading: false })
  },

  loadObsidian: async () => {
    set({ obsidianLoading: true })
    try {
      const [cfg, notesRes] = await Promise.all([
        api('obsidian.config')?.(),
        api('obsidian.notes')?.(),
      ])
      if (cfg && !cfg.error) set({ obsidianConfig: cfg })
      if (notesRes && !notesRes.error) set({ obsidianNotes: notesRes.notes || [] })
    } catch {}
    set({ obsidianLoading: false })
  },

  loadSpeakers: async () => {
    set({ speakerLoading: true })
    try {
      const [s, c] = await Promise.all([
        api('voice.speakers')?.(),
        api('voice.currentSpeaker')?.(),
      ])
      if (s && !s.error) set({ speakers: Array.isArray(s) ? s : (s.speakers || s.data?.speakers || []) })
      if (c && !c.error) set({ currentSpeaker: c.data || c })
    } catch {}
    set({ speakerLoading: false })
  },

  writeObsidianNote: async (title, content, tags, folder) => {
    try {
      const r = await api('obsidian.write')?.({ title, content, tags, folder })
      if (r && !r.error) {
        set((state) => ({ obsidianNotes: [...state.obsidianNotes, { name: title }] }))
        return true
      }
    } catch {}
    return false
  },

  registerSpeaker: async (name, config) => {
    try {
      await api('voice.register')?.(name, config)
      set((state) => ({ speakers: [...state.speakers, { name, ...config }] }))
    } catch {}
  },

  deleteSpeaker: async (name) => {
    try {
      await api('voice.deleteSpeaker')?.(name)
      set((state) => ({ speakers: state.speakers.filter((s: any) => s.name !== name) }))
    } catch {}
  },
}))
