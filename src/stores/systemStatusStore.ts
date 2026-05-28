import { create } from 'zustand'

export interface SystemStatus {
  // 模型状态
  modelStatus: 'online' | 'offline' | 'loading' | 'error'
  currentModel: string
  lastResponseTime: number | null
  
  // 连接信息
  activeConnections: number
  totalConnections: number
  
  // 内存使用
  memoryUsed: number
  memoryTotal: number
  
  // Token 统计
  totalTokensUsed: number
  sessionTokensUsed: number
  
  // 运行时间
  uptime: number
  lastActivity: Date | null
}

interface SystemStatusState {
  status: SystemStatus
  isLoading: boolean
  
  // Actions
  setStatus: (status: Partial<SystemStatus>) => void
  setLoading: (loading: boolean) => void
  updateModelStatus: (status: SystemStatus['modelStatus']) => void
  incrementConnections: () => void
  decrementConnections: () => void
  addTokensUsed: (count: number) => void
  
  // Async actions
  loadSystemStatus: () => Promise<void>
}

const defaultStatus: SystemStatus = {
  modelStatus: 'online',
  currentModel: 'openai/gpt-4',
  lastResponseTime: null,
  activeConnections: 1,
  totalConnections: 1,
  memoryUsed: 0,
  memoryTotal: 0,
  totalTokensUsed: 0,
  sessionTokensUsed: 0,
  uptime: 0,
  lastActivity: null,
}

export const useSystemStatusStore = create<SystemStatusState>((set, get) => ({
  status: defaultStatus,
  isLoading: false,

  setStatus: (newStatus) => {
    set((state) => ({
      status: { ...state.status, ...newStatus },
    }))
  },

  setLoading: (loading) => set({ isLoading: loading }),

  updateModelStatus: (modelStatus) => {
    set((state) => ({
      status: { ...state.status, modelStatus },
    }))
  },

  incrementConnections: () => {
    set((state) => ({
      status: {
        ...state.status,
        activeConnections: state.status.activeConnections + 1,
        totalConnections: state.status.totalConnections + 1,
      },
    }))
  },

  decrementConnections: () => {
    set((state) => ({
      status: {
        ...state.status,
        activeConnections: Math.max(0, state.status.activeConnections - 1),
      },
    }))
  },

  addTokensUsed: (count) => {
    set((state) => ({
      status: {
        ...state.status,
        totalTokensUsed: state.status.totalTokensUsed + count,
        sessionTokensUsed: state.status.sessionTokensUsed + count,
      },
    }))
  },

  loadSystemStatus: async () => {
    const { setLoading, setStatus } = get()
    setLoading(true)
    try {
      // 模拟获取系统状态
      // 实际项目中应该从 Electron 主进程获取
      const memoryInfo = await (window as any).electronAPI?.system?.getMemoryInfo?.() || {
        used: 0,
        total: 0,
      }
      
      setStatus({
        memoryUsed: memoryInfo.used || 0,
        memoryTotal: memoryInfo.total || 0,
        uptime: Date.now(),
        lastActivity: new Date(),
      })
    } catch (error) {
      console.error('Failed to load system status:', error)
    } finally {
      setLoading(false)
    }
  },
}))
