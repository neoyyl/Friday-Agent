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

const api = () => window.electronAPI?.kernel

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  stats: null,
  dispatchHistory: [],
  isDispatching: false,
  lastResult: null,

  loadAgents: async () => {
    try {
      const k = api()
      if (k?.agents?.list) {
        const result = await k.agents.list()
        if (result && !result.error) {
          // 后端返回格式: {success: true, data: {agents: [...]}}
          const agents: Agent[] = (result.data?.agents || []).map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            category: (a as any).category || 'general',
            capabilities: a.capabilities,
            call_count: (a as any).call_count,
            avg_duration: (a as any).avg_duration,
            status: (a as any).status,
          }))
          set({ agents })
        }
        return
      }
    } catch (e) {
      console.error('Failed to load agents:', e)
    }
  },

  loadStats: async () => {
    try {
      const k = api()
      if (k?.agents?.stats) {
        const result = await k.agents.stats()
        if (result && !result.error) {
          // 后端返回格式: {success: true, data: {total, active, busy, total_uses, implemented}}
          // 前端期望格式: {total_agents, total_dispatches, success_rate, avg_duration}
          const d = result.data as Record<string, any> | undefined
          const stats: AgentStats = {
            total_agents: d?.total ?? 0,
            total_dispatches: d?.total_uses ?? d?.active ?? 0,
            success_rate: 0, // 后端没有返回这个字段，暂时设为0
            avg_duration: 0, // 后端没有返回这个字段，暂时设为0
          }
          set({ stats })
        }
      }
    } catch (e) {
      console.error('Failed to load agent stats:', e)
    }
  },

  dispatchTask: async (task: string, mode: string = 'direct') => {
    set({ isDispatching: true })
    try {
      const result = await window.electronAPI!.kernel.agents.dispatch(task, mode)
      if (result && !result.error && result.data) {
        const d = result.data as Record<string, any>
        const record: DispatchRecord = {
          id: d.id || Date.now().toString(),
          task,
          agent_id: d.agent_id || d.agent || 'unknown',
          mode,
          result: d.result || d.output || JSON.stringify(d),
          success: result.success !== false,
          duration: d.duration || 0,
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
      const result = await window.electronAPI!.kernel.agents.history()
      if (result && !result.error) {
        // 后端返回格式: {success: true, data: {history: [...]}}
        const history = (result.data?.history || []) as unknown as DispatchRecord[]
        set({ dispatchHistory: history })
      }
    } catch (e) {
      console.error('Failed to load dispatch history:', e)
    }
  },
}))
