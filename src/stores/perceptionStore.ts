import { create } from 'zustand'

export interface WindowInfo {
  title: string
  process_name: string
  pid: number
  rect?: { x: number; y: number; width: number; height: number }
}

export interface GitInfo {
  branch: string
  status: string
  last_commit?: string
  remote?: string
}

export interface ProjectInfo {
  name: string
  path: string
  language?: string
  files?: number
  structure?: string
}

interface PerceptionState {
  activeWindow: WindowInfo | null
  gitBranch: string | null
  gitInfo: GitInfo | null
  projectStructure: ProjectInfo | null
  lastUpdate: Date | null
  isPolling: boolean
  pollTimer: ReturnType<typeof setInterval> | null

  refresh: () => Promise<void>
  startPolling: (intervalMs?: number) => void
  stopPolling: () => void
}

export const usePerceptionStore = create<PerceptionState>((set, get) => ({
  activeWindow: null,
  gitBranch: null,
  gitInfo: null,
  projectStructure: null,
  lastUpdate: null,
  isPolling: false,
  pollTimer: null,

  refresh: async () => {
    try {
      const api = (window as any).electronAPI.kernel

      // Get active window
      const windowResult = await api.get('/api/perception/window').catch(() => null)
      if (windowResult && !windowResult.error) {
        set({ activeWindow: windowResult })
      }

      // Get git info
      const gitResult = await api.get('/api/perception/git').catch(() => null)
      if (gitResult && !gitResult.error) {
        set({
          gitInfo: gitResult,
          gitBranch: gitResult.branch || null,
        })
      }

      // Get project info
      const projectResult = await api.get('/api/perception/project').catch(() => null)
      if (projectResult && !projectResult.error) {
        set({ projectStructure: projectResult })
      }

      set({ lastUpdate: new Date() })
    } catch (e) {
      console.error('Perception refresh failed:', e)
    }
  },

  startPolling: (intervalMs: number = 5000) => {
    const { pollTimer } = get()
    if (pollTimer) clearInterval(pollTimer)

    // Initial refresh
    get().refresh()

    const timer = setInterval(() => {
      get().refresh()
    }, intervalMs)

    set({ pollTimer: timer, isPolling: true })
  },

  stopPolling: () => {
    const { pollTimer } = get()
    if (pollTimer) {
      clearInterval(pollTimer)
      set({ pollTimer: null, isPolling: false })
    }
  },
}))
