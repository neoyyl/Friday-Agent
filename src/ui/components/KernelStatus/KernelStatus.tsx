import { useEffect } from 'react'
import { useKernelStore } from '../../../stores/kernelStore'

const STATUS_COLORS: Record<string, string> = {
  running: '#22c55e',
  starting: '#eab308',
  stopped: '#6b7280',
  error: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  running: '服务运行中',
  starting: '启动中...',
  stopped: '未就绪',
  error: '服务异常',
}

const STYLE_KEYFRAMES = `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`

export function KernelStatus() {
  const { status, error, checkStatus } = useKernelStore()

  useEffect(() => {
    checkStatus()
    const timer = setInterval(checkStatus, 30000)
    return () => clearInterval(timer)
  }, [])

  const statusText = STATUS_LABELS[status] || status

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
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: STATUS_COLORS[status] || '#6b7280',
        boxShadow: status === 'running' ? `0 0 6px ${STATUS_COLORS[status]}` : 'none',
        animation: status === 'starting' ? 'pulse 1s infinite' : 'none',
      }} />

      <span>{statusText}</span>

      {error && (
        <span style={{ color: 'var(--error)', fontSize: '10px', marginLeft: '4px' }} title={error}>
          ⚠ {error}
        </span>
      )}

      <style>{STYLE_KEYFRAMES}</style>
    </div>
  )
}
