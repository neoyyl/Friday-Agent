import { useState, useEffect } from 'react'
import { useKernelDataStore } from '../../../stores/kernelDataStore'

export function MemoryBrowser() {
  const [tab, setTab] = useState<'context' | 'facts'>('context')
  const { memoryContext, memoryFacts, memoryLoading, loadMemory } = useKernelDataStore()

  useEffect(() => { loadMemory() }, [loadMemory])

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>记忆浏览器</h3>
        <button
          onClick={loadMemory}
          disabled={memoryLoading}
          style={{
            padding: '4px 8px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: memoryLoading ? 'wait' : 'pointer', fontSize: '11px',
          }}
        >
          {memoryLoading ? '加载中...' : '刷新'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {([{ id: 'context', label: '对话上下文' }, { id: 'facts', label: '关键信息' }] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
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

      {memoryLoading && !memoryContext && !memoryFacts.length ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>加载中...</div>
      ) : tab === 'context' ? (
        <div>
          {memoryContext ? (
            <div style={{
              padding: '12px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              fontSize: '12px', color: 'var(--text)', lineHeight: 1.6,
              whiteSpace: 'pre-wrap', maxHeight: '500px', overflow: 'auto',
            }}>
              {memoryContext}
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>
              暂无对话记忆
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {memoryFacts.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>
              暂无关键信息
            </div>
          ) : memoryFacts.map((fact: any, i: number) => (
            <div key={fact.id || i} style={{
              padding: '10px 12px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>
                {fact.content || fact.text || JSON.stringify(fact).slice(0, 100)}
              </div>
              {fact.role && (
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {fact.role} · {fact.timestamp ? new Date(fact.timestamp).toLocaleString() : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
