import { create } from 'zustand'

export interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
  isPinned: boolean
  isArchived: boolean
}

interface SessionState {
  sessions: Session[]
  activeSessionId: string | null
  isLoading: boolean

  setSessions: (sessions: Session[]) => void
  setActiveSession: (id: string) => void
  addSession: (session: Session) => void
  removeSession: (id: string) => void
  updateSessionTitle: (id: string, title: string) => void
  togglePin: (id: string) => void
  toggleArchive: (id: string) => void
  setLoading: (loading: boolean) => void

  loadSessions: () => Promise<void>
  createSession: (title?: string) => Promise<string>
  deleteSession: (id: string) => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isLoading: false,

  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions],
  })),
  removeSession: (id) => set((state) => ({
    sessions: state.sessions.filter((s) => s.id !== id),
    activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
  })),
  updateSessionTitle: (id, title) => set((state) => ({
    sessions: state.sessions.map((s) => (s.id === id ? { ...s, title, updated_at: new Date().toISOString() } : s)),
  })),
  togglePin: (id) => set((state) => ({
    sessions: state.sessions.map((s) => (s.id === id ? { ...s, isPinned: !s.isPinned } : s)),
  })),
  toggleArchive: (id) => set((state) => ({
    sessions: state.sessions.map((s) => (s.id === id ? { ...s, isArchived: !s.isArchived } : s)),
  })),
  setLoading: (loading) => set({ isLoading: loading }),

  loadSessions: async () => {
    set({ isLoading: true })
    try {
      const rawSessions = await window.electronAPI!.sessions.list() as Session[]
      const sessions = rawSessions.map(s => ({
        ...s,
        isPinned: s.isPinned ?? false,
        isArchived: s.isArchived ?? false,
      }))
      set({ sessions })
      const activeSessions = sessions.filter(s => !s.isArchived)
      if (activeSessions.length > 0 && !get().activeSessionId) {
        set({ activeSessionId: activeSessions[0].id })
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  createSession: async (title) => {
    const sessionTitle = title || `新对话 ${new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    try {
      const result = await window.electronAPI!.sessions.create(sessionTitle)
      const newSession: Session = {
        id: (result as any).id || crypto.randomUUID(),
        title: sessionTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isPinned: false,
        isArchived: false,
      }
      get().addSession(newSession)
      set({ activeSessionId: newSession.id })
      return newSession.id
    } catch (error) {
      console.error('Failed to create session:', error)
      const fallbackId = crypto.randomUUID()
      const newSession: Session = {
        id: fallbackId,
        title: sessionTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isPinned: false,
        isArchived: false,
      }
      get().addSession(newSession)
      set({ activeSessionId: fallbackId })
      return fallbackId
    }
  },

  deleteSession: async (id) => {
    try {
      await window.electronAPI!.sessions.delete(id)
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
    get().removeSession(id)
  },
}))