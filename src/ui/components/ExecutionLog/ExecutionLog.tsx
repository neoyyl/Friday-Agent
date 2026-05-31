import { useState, useEffect, useCallback } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */

export function ExecutionLog() {
  const [tab, setTab] = useState<'log' | 'report'>('log')
  const [filter, setFilter] = useState('')
  const [logs, setLogs] = useState<any[]>([])
  const [logReport, setLogReport] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const [logsResult, reportResult] = await Promise.all([
        window.electronAPI?.backend?.log?.list(),
        window.electronAPI?.backend?.log?.report(),
      ])
      setLogs(Array.isArray(logsResult) ? logsResult : (logsResult as any)?.data?.logs || [])
      setLogReport(reportResult ?? null)
    } catch (err: any) {
      console.error('[ExecutionLog] load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])

  const report = logReport as Record<string, any> | null

  const filteredLogs = filter
    ? logs.filter((l) =>
        JSON.stringify(l).toLowerCase().includes(filter.toLowerCase())
      )
    : logs

  const levelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return '#ef4444'
      case 'warning': return '#f97316'
      case 'info': return '#22c55e'
      default: return 'var(--text-dim)'
    }
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>执行日志</h3>
        <button onClick={loadLogs} disabled={loading}
          style={{
            padding: '4px 8px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: loading ? 'wait' : 'pointer', fontSize: '11px',
          }}
        >
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {([
          { id: 'log' as const, label: '执行记录' },
          { id: 'report' as const, label: '统计报告' },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '4px 12px', borderRadius: '4px',
              border: '1px solid var(--border)',
              background: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? '#fff' : 'var(--text-dim)',
              cursor: 'pointer', fontSize: '11px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !logs.length && !report ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>加载中...</div>
      ) : tab === 'log' ? (
        <div>
          <input
            placeholder="搜索日志..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: '4px',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              color: 'var(--text)', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box',
            }}
          />
          {filteredLogs.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>暂无日志</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '500px', overflow: 'auto' }}>
              {filteredLogs.map((log: any, i: number) => (
                <div key={log.id || i} style={{
                  padding: '6px 8px', borderRadius: '4px',
                  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                  fontSize: '11px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: levelColor(log.level), flexShrink: 0,
                      }} />
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {log.action || log.event || log.type || '-'}
                      </span>
                      {log.level && (
                        <span style={{ fontSize: '10px', color: levelColor(log.level) }}>
                          {log.level}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  {log.detail && (
                    <div style={{ color: 'var(--text-dim)', marginTop: '2px', paddingLeft: '12px', fontSize: '10px' }}>
                      {typeof log.detail === 'string' ? log.detail : JSON.stringify(log.detail).slice(0, 120)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {report ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {report.summary && (
                <div style={{
                  padding: '12px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                  fontSize: '12px', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {typeof report.summary === 'string' ? report.summary : JSON.stringify(report.summary, null, 2)}
                </div>
              )}
              {report.stats && Object.keys(report.stats).length > 0 && (
                <div style={{
                  padding: '12px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>统计数据</div>
                  {Object.entries(report.stats).map(([k, v]: any) => (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '4px 0', fontSize: '11px',
                    }}>
                      <span style={{ color: 'var(--text-dim)' }}>{k}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
              {!report.summary && !report.stats && (
                <div style={{
                  padding: '12px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                  fontSize: '12px', color: 'var(--text)', whiteSpace: 'pre-wrap',
                }}>
                  {JSON.stringify(report, null, 2)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>暂无报告数据</div>
          )}
        </div>
      )}
    </div>
  )
}