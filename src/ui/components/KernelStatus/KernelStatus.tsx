import { useEffect } from 'react'
import { useKernelStore } from '../../../stores/kernelStore'

export function KernelStatus() {
  const { status, connected, wsConnected, error, startKernel, stopKernel, checkStatus } = useKernelStore()

  useEffect(() => {
    // Check status on mount
    checkStatus()
    // Poll every 10s
    const timer = setInterval(checkStatus, 10000)
    return () => clearInterval(timer)
  }, [])

  const statusColors: Record<string, string> = {
    running: '#22c55e',
    starting: '#eab308',
    stopped: '#6b7280',
    error: '#ef4444',
  }

  const statusLabels: Record<string, string> = {
    running: 'Kernel 运行中',
    starting: 'Kernel 启动中...',
    stopped: 'Kernel 已停止',
    error: 'Kernel 错误',
  }

  return (
    <div className="kernel-status" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 12px',
      borderRadius: '6px',
      background: 'rgba(0,0,0,0.3)',
      fontSize: '12px',
      color: 'var(--text-dim)',
    }}>
      {/* Status dot */}
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: statusColors[status] || '#6b7280',
        boxShadow: status === 'running' ? `0 0 6px ${statusColors[status]}` : 'none',
        animation: status === 'starting' ? 'pulse 1s infinite' : 'none',
      }} />

      {/* Label */}
      <span>{statusLabels[status] || status}</span>

      {/* WebSocket indicator */}
      {connected && (
        <span style={{
          fontSize: '10px',
          color: wsConnected ? 'var(--cool)' : 'var(--text-dim)',
        }}>
          WS{wsConnected ? '●' : '○'}
        </span>
      )}

      {/* Action button */}
      <button
        onClick={() => connected ? stopKernel() : startKernel()}
        style={{
          marginLeft: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          fontSize: '11px',
        }}
        title={connected ? '停止 Kernel' : '启动 Kernel'}
      >
        {connected ? '⏹' : '▶'}
      </button>

      {/* Error tooltip */}
      {error && (
        <span style={{ color: 'var(--error)', fontSize: '10px' }} title={error}>
          ⚠
        </span>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
