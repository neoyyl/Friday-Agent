import { useState, useEffect, useCallback, useMemo } from 'react'

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

const CATEGORIES = [
  { id: 'all', label: '全部', icon: '📋' },
  { id: 'search', label: '搜索', icon: '🔍' },
  { id: 'file', label: '文件', icon: '📁' },
  { id: 'code', label: '代码', icon: '💻' },
  { id: 'text', label: '文本', icon: '📝' },
  { id: 'ai', label: 'AI', icon: '🤖' },
  { id: 'data', label: '数据', icon: '📊' },
]

export function SkillMarket() {
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [installedSkills, setInstalledSkills] = useState<Set<string>>(new Set())
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

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

  useEffect(() => { reload() }, [reload])

  const filteredSkills = useMemo(() => {
    let result = skills
    if (activeCategory !== 'all') {
      result = result.filter(s =>
        s.capabilities.some(c => c.toLowerCase().includes(activeCategory)) ||
        s.name.toLowerCase().includes(activeCategory)
      )
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.capabilities.some(c => c.toLowerCase().includes(q))
      )
    }
    return result
  }, [skills, activeCategory, searchQuery])

  const handleInstall = async (id: string) => {
    setInstallingId(id)
    setFeedback('')
    try {
      const backend = window.electronAPI?.backend as any
      if (backend?.skills?.install) {
        const result = await backend.skills.install(id)
        if (result && !result.error) {
          setInstalledSkills(prev => new Set(prev).add(id))
          setFeedback(`✅ ${id} 安装成功`)
        } else {
          setFeedback(`❌ 安装失败: ${result?.error || 'unknown'}`)
        }
      } else {
        setInstalledSkills(prev => new Set(prev).add(id))
        setFeedback(`✅ ${id} 安装成功 (模拟)`)
      }
    } catch (err: any) {
      setFeedback(`❌ 安装失败: ${err.message}`)
    }
    setInstallingId(null)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleUninstall = async (id: string) => {
    setInstallingId(id)
    setFeedback('')
    try {
      const backend = window.electronAPI?.backend as any
      if (backend?.skills?.uninstall) {
        const result = await backend.skills.uninstall(id)
        if (result && !result.error) {
          setInstalledSkills(prev => { const s = new Set(prev); s.delete(id); return s })
          setFeedback(`✅ ${id} 卸载成功`)
        } else {
          setFeedback(`❌ 卸载失败: ${result?.error || 'unknown'}`)
        }
      } else {
        setInstalledSkills(prev => { const s = new Set(prev); s.delete(id); return s })
        setFeedback(`✅ ${id} 卸载成功 (模拟)`)
      }
    } catch (err: any) {
      setFeedback(`❌ 卸载失败: ${err.message}`)
    }
    setInstallingId(null)
    setTimeout(() => setFeedback(''), 3000)
  }

  return (
    <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>🧩 技能市场</h3>
        <button onClick={reload} disabled={loadState === 'loading'}
          style={{
            padding: '4px 8px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: loadState === 'loading' ? 'wait' : 'pointer', fontSize: '11px',
          }}
        >
          {loadState === 'loading' ? '...' : '🔄'}
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索技能名称、描述、能力..."
          style={{
            width: '100%', padding: '8px 10px', borderRadius: '6px',
            border: '1px solid var(--border)', background: 'var(--bg)',
            color: 'var(--text)', fontSize: '12px', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '12px',
        overflow: 'auto', flexWrap: 'wrap',
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: '4px 10px', borderRadius: '6px',
              border: '1px solid var(--border)',
              background: activeCategory === cat.id ? 'var(--accent)' : 'transparent',
              color: activeCategory === cat.id ? '#fff' : 'var(--text-dim)',
              cursor: 'pointer', fontSize: '11px',
              display: 'flex', alignItems: 'center', gap: '4px',
              transition: 'all 0.15s',
            }}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          padding: '6px 10px', borderRadius: '6px', marginBottom: '8px',
          background: feedback.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${feedback.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: feedback.startsWith('✅') ? '#22c55e' : '#ef4444',
          fontSize: '11px',
        }}>
          {feedback}
        </div>
      )}

      {/* State: loading */}
      {loadState === 'loading' && (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>
          {skills.length === 0 ? '加载中...' : '刷新中...'}
        </div>
      )}

      {/* State: error */}
      {loadState === 'error' && (
        <div>
          <div style={{ color: 'var(--warm)', textAlign: 'center', padding: '24px 16px', fontSize: '13px' }}>
            ⚠️ 技能数据加载失败
          </div>
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '0 16px 16px', fontSize: '11px', wordBreak: 'break-all' }}>
            {errorMsg}
          </div>
          <div style={{ textAlign: 'center' }}>
            <button onClick={reload} style={{
              padding: '6px 16px', borderRadius: '6px',
              border: '1px solid var(--accent)', background: 'transparent',
              color: 'var(--accent)', cursor: 'pointer', fontSize: '11px',
            }}>
              重试
            </button>
          </div>
        </div>
      )}

      {/* State: empty */}
      {loadState === 'success' && filteredSkills.length === 0 && (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
          {searchQuery || activeCategory !== 'all'
            ? '没有匹配的技能'
            : '暂无可用技能'}
        </div>
      )}

      {/* Skill list */}
      {loadState === 'success' && filteredSkills.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredSkills.map((skill, i) => {
            const isInstalled = installedSkills.has(skill.id)
            const isInstalling = installingId === skill.id

            return (
              <div key={skill.id || i} style={{
                padding: '12px', borderRadius: '8px',
                border: isInstalled ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid var(--border)',
                background: isInstalled ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'var(--bg-elevated)',
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ fontSize: '24px', flexShrink: 0 }}>{skill.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>
                        {skill.name || skill.id}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>v{skill.version}</span>
                      {isInstalled && (
                        <span style={{
                          padding: '1px 6px', borderRadius: '4px',
                          background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                          fontSize: '9px', fontWeight: 600,
                        }}>
                          已安装
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.4, marginBottom: '6px' }}>
                      {skill.description}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {skill.capabilities.map(cap => (
                        <span key={cap} style={{
                          padding: '2px 6px', borderRadius: '4px',
                          background: 'rgba(139,92,246,0.1)', color: '#a78bfa',
                          fontSize: '9px', fontWeight: 500,
                        }}>
                          {cap}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                        {skill.call_count > 0 ? `调用 ${skill.call_count} 次` : '尚未调用'}
                      </span>
                      {isInstalled ? (
                        <button
                          onClick={() => handleUninstall(skill.id)}
                          disabled={!!isInstalling}
                          style={{
                            padding: '4px 12px', borderRadius: '6px',
                            border: '1px solid #ef4444', background: 'transparent',
                            color: '#ef4444', cursor: isInstalling ? 'wait' : 'pointer',
                            fontSize: '10px', fontWeight: 600,
                            opacity: isInstalling ? 0.5 : 1,
                          }}
                        >
                          {isInstalling && installingId === skill.id ? '...' : '卸载'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleInstall(skill.id)}
                          disabled={!!isInstalling}
                          style={{
                            padding: '4px 12px', borderRadius: '6px',
                            border: '1px solid var(--accent)', background: 'var(--accent)',
                            color: '#fff', cursor: isInstalling ? 'wait' : 'pointer',
                            fontSize: '10px', fontWeight: 600,
                            opacity: isInstalling ? 0.5 : 1,
                          }}
                        >
                          {isInstalling && installingId === skill.id ? '...' : '安装'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <div style={{ textAlign: 'center', padding: '8px', fontSize: '10px', color: 'var(--text-dim)' }}>
            共 {filteredSkills.length} 个技能
          </div>
        </div>
      )}
    </div>
  )
}
