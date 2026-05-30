import { describe, it, expect, beforeEach } from 'vitest'
import { useKernelStore } from './kernelStore'

describe('kernelStore', () => {
  beforeEach(() => {
    useKernelStore.setState({
      status: 'stopped',
      connected: false,
      kernelVersion: null,
      lastHealth: null,
      port: 5001,
      error: null,
      autoStart: true,
      wsConnected: false,
    })
  })

  it('starts with default stopped state', () => {
    const state = useKernelStore.getState()
    expect(state.status).toBe('stopped')
    expect(state.connected).toBe(false)
    expect(state.port).toBe(5001)
    expect(state.autoStart).toBe(true)
  })

  it('setStatus updates kernel status', () => {
    useKernelStore.getState().setStatus('running')
    expect(useKernelStore.getState().status).toBe('running')
  })

  it('setConnected updates connection flag', () => {
    useKernelStore.getState().setConnected(true)
    expect(useKernelStore.getState().connected).toBe(true)
  })

  it('setError stores error', () => {
    useKernelStore.getState().setError('connection refused')
    expect(useKernelStore.getState().error).toBe('connection refused')
  })

  it('setAutoStart toggles autoStart', () => {
    useKernelStore.getState().setAutoStart(false)
    expect(useKernelStore.getState().autoStart).toBe(false)
  })

  it('updateFromStatus merges status info', () => {
    useKernelStore.getState().updateFromStatus({
      status: 'running',
      port: 5001,
      wsConnected: true,
    })
    const state = useKernelStore.getState()
    expect(state.status).toBe('running')
    expect(state.connected).toBe(true)
    expect(state.wsConnected).toBe(true)
  })

  it('updateFromStatus with stopped status sets connected false', () => {
    useKernelStore.getState().updateFromStatus({ status: 'stopped' })
    expect(useKernelStore.getState().connected).toBe(false)
  })
})
