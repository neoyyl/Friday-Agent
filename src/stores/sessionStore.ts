import { create } from 'zustand'

export interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface SessionState {
  sessions: Session[]
  currentSessionId: string | null
  isLoading: boolean

  // Actions
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (id: string, updates: Partial<Session>) => void
  deleteSession: (id: string) => void
  setCurrentSession: (id: string | null) => void
  setLoading: (loading: boolean) => void

  // Async actions
  loadSessions: () => Promise<void>
  createSession: (title: string) => Promise<Session | null>
  removeSession: (id: string) => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  isLoading: false,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) => {
    set((state) => ({
      sessions: [session, ...state.sessions],
    }))
  },

  updateSession: (id, updates) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, ...updates } : session
      ),
    }))
  },

  deleteSession: (id) => {
    set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
    }))
  },

  setCurrentSession: (id) => set({ currentSessionId: id }),

  setLoading: (loading) => set({ isLoading: loading }),

  loadSessions: async () => {
    const { setLoading, setSessions } = get()
    setLoading(true)
    try {
      const sessions = await (window as any).electronAPI.sessions.list()
      setSessions(sessions)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  },

  createSession: async (title) => {
    const { addSession, setCurrentSession } = get()
    try {
      const session = await (window as any).electronAPI.sessions.create(title)
      addSession(session)
      setCurrentSession(session.id)
      return session
    } catch (error) {
      console.error('Failed to create session:', error)
      return null
    }
  },

  removeSession: async (id) => {
    const { deleteSession } = get()
    try {
      await (window as any).electronAPI.sessions.delete(id)
      deleteSession(id)
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  },
}))
