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
  restartAttempt: number
  maxRestarts: number
  crashDiagnostics: { stderr: string; error: string } | null

  // Actions
  setStatus: (status: KernelStatusType) => void
  setConnected: (connected: boolean) => void
  setError: (error: string | null) => void
  setAutoStart: (enabled: boolean) => void
  updateFromStatus: (info: any) => void
  setCrashDiagnostics: (diagnostics: { stderr: string; error: string } | null) => void

  // Async actions
  startKernel: () => Promise<void>
  stopKernel: () => Promise<void>
  checkStatus: () => Promise<void>
}

export const useKernelStore = create<KernelState>((set, get) => ({
  status: 'starting',
  connected: true,
  kernelVersion: '1.0.0',
  lastHealth: null,
  port: 0,
  error: null,
  autoStart: true,
  wsConnected: true,
  restartAttempt: 0,
  maxRestarts: 3,
  crashDiagnostics: null,

  setStatus: (status) => set({ status }),
  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error }),
  setAutoStart: (autoStart) => set({ autoStart }),
  setCrashDiagnostics: (diagnostics) => set({ crashDiagnostics: diagnostics }),

  updateFromStatus: (info: any) => {
    const running = info.status === 'running' || info.process === 'running'
    set({
      status: running ? 'running' : (info.status || 'stopped'),
      port: info.port || 5001,
      lastHealth: info.lastHealth || null,
      error: info.error || null,
      wsConnected: info.wsConnected ?? running,
      connected: running,
    })
  },

  startKernel: async () => {
    set({ status: 'starting', error: null })
    try {
      await window.electronAPI!.kernel.start()
      const status = await window.electronAPI!.kernel.status()
      get().updateFromStatus(status)
    } catch (error: any) {
      set({ status: 'error', error: error.message })
    }
  },

  stopKernel: async () => {
    try {
      await window.electronAPI!.kernel.stop()
      set({ status: 'stopped', connected: false, wsConnected: false })
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  checkStatus: async () => {
    try {
      const info = await window.electronAPI!.kernel.status()
      get().updateFromStatus(info)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[KernelStore] checkStatus failed:', msg)
      set({ status: 'error', connected: false })
    }
  },
}))

// Listen for Kernel events and update store accordingly
let eventUnsubscribe: (() => void) | undefined

export function initKernelEventListeners(): void {
  if (eventUnsubscribe) return

  eventUnsubscribe = window.electronAPI?.kernel?.onEvent?.((event: string, data: any) => {
    switch (event) {
      case 'state.changed':
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
