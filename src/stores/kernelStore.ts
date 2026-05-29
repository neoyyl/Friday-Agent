import { create } from 'zustand'

export type KernelStatusType = 'stopped' | 'starting' | 'running' | 'error'

export interface KernelState {
  status: KernelStatusType
  connected: boolean
  kernelVersion: string | null
  lastHealth: string | null
  port: number
  error: string | null
  autoStart: boolean
  wsConnected: boolean

  // Actions
  setStatus: (status: KernelStatusType) => void
  setConnected: (connected: boolean) => void
  setError: (error: string | null) => void
  setAutoStart: (enabled: boolean) => void
  updateFromStatus: (info: any) => void

  // Async actions
  startKernel: () => Promise<void>
  stopKernel: () => Promise<void>
  checkStatus: () => Promise<void>
}

export const useKernelStore = create<KernelState>((set, get) => ({
  status: 'stopped',
  connected: false,
  kernelVersion: null,
  lastHealth: null,
  port: 5001,
  error: null,
  autoStart: true,
  wsConnected: false,

  setStatus: (status) => set({ status }),
  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error }),
  setAutoStart: (autoStart) => set({ autoStart }),

  updateFromStatus: (info: any) => {
    set({
      status: info.status || 'stopped',
      port: info.port || 5001,
      lastHealth: info.lastHealth || null,
      error: info.error || null,
      wsConnected: info.wsConnected || false,
      connected: info.status === 'running',
    })
  },

  startKernel: async () => {
    set({ status: 'starting', error: null })
    try {
      await (window as any).electronAPI.kernel.start()
      // Poll status after start
      const status = await (window as any).electronAPI.kernel.status()
      get().updateFromStatus(status)
    } catch (error: any) {
      set({ status: 'error', error: error.message })
    }
  },

  stopKernel: async () => {
    try {
      await (window as any).electronAPI.kernel.stop()
      set({ status: 'stopped', connected: false, wsConnected: false })
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  checkStatus: async () => {
    try {
      const info = await (window as any).electronAPI.kernel.status()
      get().updateFromStatus(info)
    } catch {
      set({ status: 'error', connected: false })
    }
  },
}))

// Listen for Kernel events and update store accordingly
let eventUnsubscribe: (() => void) | null = null

export function initKernelEventListeners(): void {
  if (eventUnsubscribe) return

  eventUnsubscribe = (window as any).electronAPI?.kernel?.onEvent?.((event: string, data: any) => {
    switch (event) {
      case 'state.changed':
        // Kernel state changed (idle/waking/listening/etc)
        console.log('[KernelEvent] state changed:', data?.state)
        break
      case 'dispatch.event':
        console.log('[KernelEvent] dispatch:', data)
        break
      case 'emotion.updated':
        console.log('[KernelEvent] emotion:', data)
        break
      case 'scheduler.event':
        console.log('[KernelEvent] scheduler:', data)
        break
      case 'trigger.event':
        console.log('[KernelEvent] trigger:', data)
        break
      case 'workflow.event':
        console.log('[KernelEvent] workflow:', data)
        break
      default:
        console.log('[KernelEvent]', event, data)
    }
  })
}
