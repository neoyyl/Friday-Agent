import { useEffect } from 'react'
import { useKernelDataStore } from '../../../stores/kernelDataStore'

const levelColor = (level: string) => {
  switch (level) {
    case 'green': return '#22c55e'
    case 'yellow': return '#eab308'
    case 'orange': return '#f97316'
    default: return 'var(--text-dim)'
  }
}

const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.min(value / max * 100, 100) : 0
  return (
    <div style={{
      width: '100%', height: '6px', borderRadius: '3px',
      background: 'var(--bg)', overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: '3px',
        background: color, transition: 'width 0.5s ease',
      }} />
    </div>
  )
}

export function GPUMonitor() {
  const { gpu, gpuLoading, loadGPU } = useKernelDataStore()

  useEffect(() => { loadGPU() }, [loadGPU])

  const data = gpu

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>GPU 监控</h3>
        <button onClick={loadGPU} disabled={gpuLoading}
          style={{
            padding: '4px 8px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: gpuLoading ? 'wait' : 'pointer', fontSize: '11px',
          }}
        >
          {gpuLoading ? '...' : '刷新'}
        </button>
      </div>

      {gpuLoading && !data ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>检测 GPU...</div>
      ) : !data?.available ? (
        <div style={{
          textAlign: 'center', padding: '32px',
          color: 'var(--text-dim)', fontSize: '12px',
        }}>
          {data?.error || '未检测到 NVIDIA GPU'}
        </div>
      ) : (
        <div>
          <div style={{
            padding: '12px', borderRadius: '8px',
            border: `1px solid ${levelColor(data.level)}40`,
            background: `color-mix(in srgb, ${levelColor(data.level)} 8%, transparent)`,
            marginBottom: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>{data.summary}</span>
              {data.warnings?.length > 0 && (
                <span style={{ fontSize: '10px', color: '#f97316' }}>{data.warnings.length} 告警</span>
              )}
            </div>
            <Bar value={data.used_vram_mb} max={data.total_vram_mb} color={levelColor(data.level)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-dim)' }}>显存 {data.used_vram_mb}/{data.total_vram_mb} MB</span>
              <span style={{ color: levelColor(data.level), fontWeight: 600 }}>{data.vram_percent}%</span>
            </div>
          </div>

          {data.gpus?.map((gpu: any, i: number) => (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              marginBottom: '6px',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px', marginBottom: '6px' }}>
                GPU {gpu.index}: {gpu.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>温度</span>
                  <span style={{ color: gpu.temperature > 80 ? '#ef4444' : gpu.temperature > 65 ? '#f97316' : 'var(--text)', fontWeight: 600 }}>
                    {gpu.temperature}°C
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>利用率</span>
                  <span style={{ color: gpu.utilization > 90 ? '#ef4444' : 'var(--text)', fontWeight: 600 }}>
                    {gpu.utilization}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>显存</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                    {gpu.memory?.used_mb}/{gpu.memory?.total_mb} MB
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>功耗</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                    {gpu.power || '-'} W
                  </span>
                </div>
              </div>
              <div style={{ marginTop: '6px' }}>
                <Bar value={gpu.memory?.used_mb || 0} max={gpu.memory?.total_mb || 1} color={gpu.utilization > 90 ? '#ef4444' : '#22c55e'} />
              </div>
            </div>
          ))}

          {data.warnings?.length > 0 && (
            <div style={{
              padding: '10px 12px', borderRadius: '8px',
              border: '1px solid #f9731640', background: 'color-mix(in srgb, #f97316 5%, transparent)',
              fontSize: '11px',
            }}>
              {data.warnings.map((w: string, i: number) => (
                <div key={i} style={{ color: '#f97316', padding: '2px 0' }}>{w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
