import { useKernelStore } from '../../../stores/kernelStore'

export function KernelGuard({ children }: { children: React.ReactNode }) {
  const connected = useKernelStore((s) => s.connected)
  if (connected) return <>{children}</>
  return (
    <div style={{
      padding: '32px 16px',
      textAlign: 'center',
      color: 'var(--warm)',
      fontSize: '13px',
    }}>
      ⚡ Kernel 未连接<br />
      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
        请点击右下角 ▶ 启动 Kernel
      </span>
    </div>
  )
}
