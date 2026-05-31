import { useState, useEffect } from 'react'

export function SelfHealPanel() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [fixResult, setFixResult] = useState<any>(null)

  const runCheck = async () => {
    setLoading(true)
    setFixResult(null)
    try {
      const result = await window.electronAPI?.backend?.self_heal?.check()
      setReport(result)
    } catch (err: any) {
      console.error('[SelfHeal] Check failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const runFix = async () => {
    setFixing(true)
    setFixResult(null)
    try {
      const result = await window.electronAPI?.backend?.self_heal?.fix()
      setFixResult(result)
      runCheck()
    } catch (err: any) {
      console.error('[SelfHeal] Fix failed:', err)
    } finally {
      setFixing(false)
    }
  }

  useEffect(() => { runCheck() }, [])

  const score = report?.score ?? 0
  const scoreColor = score >= 90 ? '#22c55e' : score >= 70 ? '#f97316' : '#ef4444'

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>🩺 系统自检</h3>
        <button
          onClick={runCheck}
          disabled={loading}
          style={{
            padding: '4px 8px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: loading ? 'wait' : 'pointer', fontSize: '11px',
          }}
        >
          {loading ? '检查中...' : '重新检查'}
        </button>
      </div>

      {report && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            textAlign: 'center', padding: '16px', borderRadius: '12px',
            border: `1px solid ${scoreColor}40`,
            background: `color-mix(in srgb, ${scoreColor} 8%, transparent)`,
            marginBottom: '8px',
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: scoreColor }}>{score}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>/ 100</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '8px' }}>
            {[
              { label: '正常', value: report.ok_count, color: '#22c55e' },
              { label: '警告', value: report.warning_count, color: '#f97316' },
              { label: '错误', value: report.error_count, color: '#ef4444' },
            ].map((item) => (
              <div key={item.label} style={{
                textAlign: 'center', padding: '8px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            {Object.entries(report.categories || {}).map(([cat, info]: any) => (
              <div key={cat} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px', borderRadius: '6px',
                background: 'var(--bg-elevated)', fontSize: '11px',
              }}>
                <span style={{ color: 'var(--text)' }}>{cat}</span>
                <span style={{
                  color: info.ok === info.total ? '#22c55e' : info.ok > 0 ? '#f97316' : '#ef4444',
                }}>{info.ok}/{info.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report?.items && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
            检查详情 ({report.items.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '300px', overflow: 'auto' }}>
            {report.items.map((item: any, i: number) => {
              const isBad = item.status !== 'ok'
              return (
                <div key={i} style={{
                  padding: '6px 8px', borderRadius: '4px',
                  border: `1px solid ${isBad ? (item.severity === 'high' ? '#ef4444' : '#f97316') : 'var(--border)'}40`,
                  background: isBad ? `color-mix(in srgb, ${item.severity === 'high' ? '#ef4444' : '#f97316'} 5%, transparent)` : 'var(--bg-elevated)',
                  fontSize: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: isBad ? (item.severity === 'high' ? '#ef4444' : '#f97316') : '#22c55e', fontWeight: 600 }}>
                      {item.status === 'ok' ? '✓' : item.severity === 'high' ? '✗' : '△'} {item.path}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '9px' }}>{item.type}</span>
                  </div>
                  {item.detail && (
                    <div style={{ color: 'var(--text-dim)', marginTop: '2px', fontSize: '9px' }}>{item.detail}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {report && report.error_count > 0 && (
        <button
          onClick={runFix}
          disabled={fixing}
          style={{
            width: '100%', padding: '8px', borderRadius: '6px',
            border: '1px solid #22c55e', background: 'color-mix(in srgb, #22c55e 15%, transparent)',
            color: '#22c55e', cursor: fixing ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 600,
          }}
        >
          {fixing ? '修复中...' : '自动修复缺失目录'}
        </button>
      )}

      {fixResult && (
        <div style={{
          marginTop: '8px', padding: '8px', borderRadius: '6px',
          border: '1px solid var(--border)', background: 'var(--bg-elevated)',
          fontSize: '11px', color: 'var(--text)',
        }}>
          已应用 {fixResult.fixes_applied} 项修复
        </div>
      )}
    </div>
  )
}
