import { create } from 'zustand'

export interface Agent {
  id: string
  name: string
  description: string
  category: string
  capabilities: string[]
  call_count?: number
  avg_duration?: number
  status?: 'idle' | 'busy' | 'error'
}

export interface AgentStats {
  total_agents: number
  total_dispatches: number
  success_rate: number
  avg_duration: number
}

export interface DispatchRecord {
  id: string
  task: string
  agent_id: string
  mode: string
  result: string
  success: boolean
  duration: number
  timestamp: string
}

interface AgentState {
  agents: Agent[]
  stats: AgentStats | null
  dispatchHistory: DispatchRecord[]
  isDispatching: boolean
  lastResult: DispatchRecord | null

  loadAgents: () => Promise<void>
  loadStats: () => Promise<void>
  dispatchTask: (task: string, mode?: string) => Promise<DispatchRecord | null>
  loadHistory: () => Promise<void>
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  stats: null,
  dispatchHistory: [],
  isDispatching: false,
  lastResult: null,

  loadAgents: async () => {
    try {
      const result = await (window as any).electronAPI.kernel.agents.list()
      if (result && !result.error) {
        const agents = Array.isArray(result) ? result :
          (result.agents || Object.values(result).flat() || [])
        set({ agents })
      }
    } catch (e) {
      console.error('Failed to load agents:', e)
    }
  },

  loadStats: async () => {
    try {
      const result = await (window as any).electronAPI.kernel.agents.stats()
      if (result && !result.error) {
        set({ stats: result })
      }
    } catch (e) {
      console.error('Failed to load agent stats:', e)
    }
  },

  dispatchTask: async (task: string, mode: string = 'direct') => {
    set({ isDispatching: true })
    try {
      const result = await (window as any).electronAPI.kernel.agents.dispatch(task, mode)
      if (result && !result.error) {
        const record: DispatchRecord = {
          id: result.id || Date.now().toString(),
          task,
          agent_id: result.agent_id || result.agent || 'unknown',
          mode,
          result: result.result || result.output || JSON.stringify(result),
          success: result.success !== false,
          duration: result.duration || 0,
          timestamp: new Date().toISOString(),
        }
        set((s) => ({
          lastResult: record,
          dispatchHistory: [record, ...s.dispatchHistory].slice(0, 100),
        }))
        return record
      }
      return null
    } catch (e) {
      console.error('Dispatch failed:', e)
      return null
    } finally {
      set({ isDispatching: false })
    }
  },

  loadHistory: async () => {
    try {
      const result = await (window as any).electronAPI.kernel.agents.history()
      if (result && !result.error) {
        const history = Array.isArray(result) ? result :
          (result.history || result.records || [])
        set({ dispatchHistory: history })
      }
    } catch (e) {
      console.error('Failed to load dispatch history:', e)
    }
  },
}))
