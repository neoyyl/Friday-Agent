import { useState, useEffect, useCallback } from 'react'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

interface SkillItem {
  id: string
  name: string
  version: string
  description: string
  icon: string
  capabilities: string[]
  call_count: number
}

function flattenSkill(raw: any): SkillItem {
  const m = raw.manifest || {}
  return {
    id: raw.id || raw.name || m.id || '',
    name: raw.name || raw.id || m.name || '',
    version: raw.version || m.version || '?',
    description: m.description || raw.description || '',
    icon: m.icon || raw.icon || '🔌',
    capabilities: m.capabilities || raw.capabilities || [],
    call_count: raw.call_count ?? 0,
  }
}

async function loadSkillsFromBackend(): Promise<{ data: SkillItem[] } | { error: string }> {
  const backend = window.electronAPI?.backend
  if (!backend?.skills?.list) return { error: 'Backend API not available' }

  try {
    const result = await backend.skills.list()
    if (!result) return { error: 'Empty response from backend' }
    if (result.error) return { error: result.error }

    const rawSkills = result.data?.skills || (Array.isArray(result) ? result : null)
    if (!rawSkills) return { error: `Unexpected response format: ${JSON.stringify(result).slice(0, 200)}` }

    return { data: rawSkills.map(flattenSkill) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export function SkillMarket() {
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const reload = useCallback(async () => {
    setLoadState('loading')
    setErrorMsg('')
    const res = await loadSkillsFromBackend()
    if ('error' in res) {
      setLoadState('error')
      setErrorMsg(res.error)
      setSkills([])
    } else {
      setLoadState('success')
      setSkills(res.data)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const retry = () => { reload() }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>Skill 技能</h3>
        <button
          onClick={retry}
          disabled={loadState === 'loading'}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-dim)',
            cursor: loadState === 'loading' ? 'wait' : 'pointer',
            fontSize: '11px',
          }}
        >
          {loadState === 'loading' ? '加载中...' : '刷新'}
        </button>
      </div>

      {loadState === 'loading' && (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>加载中...</div>
      )}

      {loadState === 'error' && (
        <div>
          <div style={{ color: 'var(--warm)', textAlign: 'center', padding: '24px 16px', fontSize: '13px' }}>
            ⚠️ 技能数据加载失败
          </div>
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '0 16px 16px', fontSize: '11px', wordBreak: 'break-all' }}>
            {errorMsg}
          </div>
        </div>
      )}

      {loadState === 'success' && skills.length === 0 && (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
          暂无技能数据
        </div>
      )}

      {loadState === 'success' && skills.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {skills.map((skill, i) => (
            <div key={skill.id || i} style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span>{skill.icon}</span>
                <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>
                  {skill.name || skill.id}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {skill.description}
              </div>
              <div style={{ marginTop: '6px', display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-dim)' }}>
                <span>v{skill.version}</span>
                {skill.call_count > 0 && <span>调用 {skill.call_count}</span>}
                {skill.capabilities.length > 0 && (
                  <span title={skill.capabilities.join(', ')}>
                    能力 {skill.capabilities.length}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
