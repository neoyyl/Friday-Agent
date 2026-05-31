import { useState, useEffect } from 'react'
import { useLanguageStore } from '../../../stores/languageStore'

interface StreamEntry {
  id: number
  type: string
  content: string
  time: string
  color: string
  status?: string
}

interface SidePanelProps {
  activeLayer: 'l1' | 'l2'
  onLayerChange: (layer: string | null) => void
}

export function SidePanel({ activeLayer, onLayerChange }: SidePanelProps) {
  const [l1Data, setL1Data] = useState<StreamEntry[]>([])
  const [l2Data, setL2Data] = useState<StreamEntry[]>([])
  const { t } = useLanguageStore()

  // Listen for backend events and populate streams
  useEffect(() => {
    const api = window.electronAPI?.backend
    if (!api?.onEvent) return

    let idCounter = 0
    const maxEntries = 50

    const unsubscribe = api.onEvent((event: string, data: any) => {
      const time = new Date().toLocaleTimeString('en-US', { hour12: false })

      if (event === 'dispatch.event') {
        setL1Data((prev) => {
          const newEntry: StreamEntry = {
            id: ++idCounter,
            type: 'DISPATCH',
            content: data?.task || data?.agent || JSON.stringify(data).slice(0, 80),
            time,
            color: 'var(--cool)',
            status: data?.success ? 'done' : data?.status || 'running',
          }
          return [newEntry, ...prev].slice(0, maxEntries)
        })
      }

      if (event === 'scheduler.event') {
        setL2Data((prev) => {
          const newEntry: StreamEntry = {
            id: ++idCounter,
            type: 'SCHEDULER',
            content: data?.job_name || data?.action || 'Task triggered',
            time,
            color: 'var(--warm)',
            status: 'completed',
          }
          return [newEntry, ...prev].slice(0, maxEntries)
        })
      }

      if (event === 'trigger.event') {
        setL2Data((prev) => {
          const newEntry: StreamEntry = {
            id: ++idCounter,
            type: 'TRIGGER',
            content: data?.trigger_name || data?.condition || 'Condition met',
            time,
            color: 'var(--dim)',
            status: 'active',
          }
          return [newEntry, ...prev].slice(0, maxEntries)
        })
      }

      if (event === 'workflow.event') {
        setL2Data((prev) => {
          const newEntry: StreamEntry = {
            id: ++idCounter,
            type: 'WORKFLOW',
            content: `${data?.workflow_name || 'Workflow'}: ${data?.status || 'started'}`,
            time,
            color: 'var(--cool)',
            status: data?.status === 'completed' ? 'completed' : 'active',
          }
          return [newEntry, ...prev].slice(0, maxEntries)
        })
      }

      if (event === 'emotion.updated' || event === 'emotion.user_input') {
        setL1Data((prev) => {
          const newEntry: StreamEntry = {
            id: ++idCounter,
            type: 'EMOTION',
            content: `${data?.emotion || 'neutral'} (${((data?.confidence || 0.5) * 100).toFixed(0)}%)`,
            time,
            color: 'var(--warm)',
          }
          return [newEntry, ...prev].slice(0, maxEntries)
        })
      }

      if (event === 'state.changed') {
        setL2Data((prev) => {
          const newEntry: StreamEntry = {
            id: ++idCounter,
            type: 'STATE',
            content: `${data?.label || data?.state || 'unknown'}`,
            time,
            color: 'var(--warm)',
            status: 'active',
          }
          return [newEntry, ...prev].slice(0, maxEntries)
        })
      }
    })

    return () => unsubscribe?.()
  }, [])

  const getData = () => {
    if (activeLayer === 'l1') return l1Data
    if (activeLayer === 'l2') return l2Data
    return []
  }

  return (
    <div style={{
      width: '360px',
      borderRight: '1px solid var(--border)',
      background: 'var(--bg)',
      overflow: 'auto',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {activeLayer === 'l1' ? t('LAYER1') : t('LAYER2')}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600, marginTop: '2px' }}>
            {activeLayer === 'l1' ? t('THOUGHT_STREAM') : t('BACKGROUND_TASKS')}
          </div>
        </div>
        <button
          onClick={() => onLayerChange(null)}
          style={{
            width: '28px', height: '28px', borderRadius: '6px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex',
        gap: '16px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        fontSize: '11px',
      }}>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>{t('STATUS')}:</span>{' '}
          <span style={{ color: 'var(--warm)', fontWeight: 600 }}>
            <span style={{
              display: 'inline-block', width: '6px', height: '6px',
              borderRadius: '50%', background: 'var(--warm)', marginRight: '4px',
              animation: 'pulse 2s infinite',
            }} />
            {t('ACTIVE')}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>
            {activeLayer === 'l1' ? t('MESSAGES') : t('HEARTBEAT')}:
          </span>{' '}
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{getData().length}</span>
        </div>
      </div>

      {/* Stream content */}
      <div style={{ padding: '8px 0' }}>
        {getData().length === 0 ? (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: '12px',
          }}>
            {t('WAITING_EVENTS')}
          </div>
        ) : (
          getData().map((entry) => (
            <div key={entry.id} style={{
              padding: '8px 16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: entry.color, flexShrink: 0,
                }} />
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.04em' }}>
                  {entry.type}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                  {entry.time}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: '1.5', paddingLeft: '12px' }}>
                {entry.content}
              </div>
              {entry.status && (
                <div style={{
                  marginTop: '4px', paddingLeft: '12px',
                  fontSize: '10px',
                  color: entry.status === 'done' || entry.status === 'completed'
                    ? '#22c55e' : 'var(--text-dim)',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  {(entry.status === 'running' || entry.status === 'active') && (
                    <span style={{
                      display: 'inline-block', width: '8px', height: '8px',
                      border: '1.5px solid var(--text-dim)', borderTopColor: 'transparent',
                      borderRadius: '50%', animation: 'spin 0.6s linear infinite',
                    }} />
                  )}
                  <span>{entry.status}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
