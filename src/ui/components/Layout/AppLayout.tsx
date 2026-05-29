import { useState, useEffect } from 'react'
import { SidePanel } from '../SidePanel/SidePanel'
import { CenterArea } from '../CenterArea/CenterArea'
import { ThemeSwitcher } from '../ThemeSwitcher/ThemeSwitcher'
import { KernelStatus } from '../KernelStatus/KernelStatus'
import { AgentPanel } from '../AgentPanel/AgentPanel'

// All sidebar buttons: L1, L2, Agents, Skills, Scheduler, SelfHeal
const sidebarButtons = [
  { id: 'l1', label: 'L1', icon: '⚡', color: 'var(--warm)' },
  { id: 'l2', label: 'L2', icon: '🧠', color: 'var(--cool)' },
  { id: 'agents', label: 'Agents', icon: '🤖', color: 'var(--accent)' },
  { id: 'skills', label: 'Skills', icon: '🧩', color: '#8b5cf6' },
  { id: 'scheduler', label: 'Schedules', icon: '📅', color: '#f97316' },
  { id: 'health', label: 'SelfHeal', icon: '🩺', color: '#22c55e' },
]

export default function AppLayout() {
  const [activePanel, setActivePanel] = useState<string | null>(null)

  const togglePanel = (panel: string) => {
    setActivePanel(activePanel === panel ? null : panel)
  }

  const isLayerPanel = activePanel === 'l1' || activePanel === 'l2'

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh' }}>
      {/* Left sidebar: all buttons + panels */}
      <div style={{
        display: 'flex',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Button column */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 4px',
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
          width: '56px',
          flexShrink: 0,
        }}>
          {sidebarButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => togglePanel(btn.id)}
              className={`layer-btn ${activePanel === btn.id ? 'active' : ''}`}
              title={btn.label}
              style={{
                '--btn-color': btn.color,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                border: activePanel === btn.id
                  ? `1.5px solid ${btn.color}`
                  : '1.5px solid transparent',
                background: activePanel === btn.id
                  ? `color-mix(in srgb, ${btn.color} 15%, transparent)`
                  : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                if (activePanel !== btn.id) {
                  e.currentTarget.style.background = 'var(--bg-elevated)'
                }
              }}
              onMouseLeave={(e) => {
                if (activePanel !== btn.id) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <span style={{
                fontSize: '16px',
                lineHeight: 1,
                filter: activePanel === btn.id ? 'none' : 'grayscale(40%)',
                transition: 'filter 0.15s',
              }}>{btn.icon}</span>
              <span style={{
                fontSize: '9px',
                marginTop: '2px',
                color: activePanel === btn.id ? btn.color : 'var(--text-dim)',
                fontWeight: activePanel === btn.id ? 600 : 400,
                letterSpacing: '0.02em',
                transition: 'color 0.15s',
              }}>{btn.label}</span>
              {/* Active indicator dot */}
              {activePanel === btn.id && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: btn.color,
                }} />
              )}
            </button>
          ))}
        </div>

        {/* L1/L2 layer panels (from SidePanel) */}
        {isLayerPanel && (
          <SidePanel activeLayer={activePanel === 'l1' ? 'l1' : 'l2'} onLayerChange={(layer) => setActivePanel(layer)} />
        )}

        {/* Right panels for Agents/Skills/Scheduler */}
        {activePanel === 'agents' && (
          <div style={{
            width: '360px',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg)',
            overflow: 'auto',
            flexShrink: 0,
          }}>
            <AgentPanel />
          </div>
        )}
        {activePanel === 'skills' && (
          <div style={{
            width: '360px',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg)',
            overflow: 'auto',
            flexShrink: 0,
          }}>
            <SkillMarket />
          </div>
        )}
        {activePanel === 'scheduler' && (
          <div style={{
            width: '360px',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg)',
            overflow: 'auto',
            flexShrink: 0,
          }}>
            <SchedulerPanel />
          </div>
        )}
        {activePanel === 'health' && (
          <div style={{
            width: '360px',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg)',
            overflow: 'auto',
            flexShrink: 0,
          }}>
            <SelfHealPanel />
          </div>
        )}
      </div>

      {/* Center area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CenterArea />
      </div>

      {/* Kernel status - floating bottom-right */}
      <div style={{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        zIndex: 100,
      }}>
        <KernelStatus />
      </div>

      {/* Settings button */}
      <ThemeSwitcher />
    </div>
  )
}

// ==================== SkillMarket ====================

// 直接读取 skill.json 的函数
async function loadSkillsFromFileSystem(): Promise<any[]> {
  const skills: any[] = []
  const skillsDir = 'F:/Product/Agent/Friday/my-agent-platform/Friday_Kernel/skills'
  
  try {
    const ipc = (window as any).electronAPI?.ipc
    if (!ipc) {
      console.error('[SkillMarket] electronAPI.ipc not available')
      return skills
    }
    
    // 使用 ipc 读取目录
    const dirs = await ipc.invoke('fs:readdir', skillsDir)
    console.log('[SkillMarket] Found dirs:', dirs?.length)
    
    for (const dir of dirs) {
      if (dir === 'examples' || dir === '__pycache__' || dir.startsWith('.')) continue
      
      const skillJsonPath = `${skillsDir}/${dir}/skill.json`
      try {
        const content = await ipc.invoke('fs:readfile', skillJsonPath)
        const manifest = JSON.parse(content)
        skills.push({
          id: manifest.id || dir,
          name: manifest.name || dir,
          version: manifest.version || '?',
          description: manifest.description || '',
          icon: manifest.icon || '🔌',
          capabilities: manifest.capabilities || [],
          directory: dir,
        })
      } catch {
        // skill.json 不存在或解析失败，跳过
      }
    }
  } catch (err) {
    console.error('[SkillMarket] File system read failed:', err)
  }
  
  return skills
}

function SkillMarket() {
  const [skills, setSkills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const reload = () => {
    setLoading(true)
    loadSkillsFromFileSystem()
      .then(setSkills)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>Skill 技能</h3>
        <button
          onClick={reload}
          disabled={loading}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-dim)',
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '11px',
          }}
        >
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>加载中...</div>
      ) : skills.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>
          暂无技能数据
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {skills.map((skill: any, i: number) => (
            <div key={skill.id || i} style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px', marginBottom: '4px' }}>
                {skill.name || skill.id}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {skill.description || skill.manifest?.description || ''}
              </div>
              <div style={{ marginTop: '6px', display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-dim)' }}>
                <span>v{skill.version || skill.manifest?.version || '?'}</span>
                {skill.call_count !== undefined && <span>调用 {skill.call_count}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== SchedulerPanel ====================

function SchedulerPanel() {
  const [tab, setTab] = useState<'jobs' | 'triggers' | 'workflows'>('jobs')
  const [jobs, setJobs] = useState<any[]>([])
  const [triggers, setTriggers] = useState<any[]>([])
  const [workflows, setWorkflows] = useState<any[]>([])

  useEffect(() => {
    const api = (window as any).electronAPI.kernel
    api.scheduler.jobs().then((r: any) => {
      if (r && !r.error) setJobs(Array.isArray(r) ? r : (r.jobs || []))
    })
    api.triggers.list().then((r: any) => {
      if (r && !r.error) setTriggers(Array.isArray(r) ? r : (r.triggers || []))
    })
    api.workflows.list().then((r: any) => {
      if (r && !r.error) setWorkflows(Array.isArray(r) ? r : (r.workflows || []))
    })
  }, [])

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: '16px' }}>调度管理</h3>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {(['jobs', 'triggers', 'workflows'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            {t === 'jobs' ? '定时任务' : t === 'triggers' ? '触发器' : '工作流'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'jobs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {jobs.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>暂无定时任务</div>
          ) : jobs.map((job: any) => (
            <div key={job.id} style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>{job.name || job.id}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  {job.expression || job.trigger} {job.next_run ? `→ ${job.next_run}` : ''}
                </div>
              </div>
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: job.enabled ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)',
                color: job.enabled ? '#22c55e' : '#6b7280',
              }}>
                {job.enabled ? '启用' : '禁用'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'triggers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {triggers.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>暂无触发器</div>
          ) : triggers.map((trigger: any) => (
            <div key={trigger.id} style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>{trigger.name || trigger.id}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{trigger.condition}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'workflows' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {workflows.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>暂无工作流</div>
          ) : workflows.map((wf: any) => (
            <div key={wf.id} style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>{wf.name || wf.id}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {wf.description || `${wf.steps?.length || 0} 步`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== SelfHealPanel ====================

function SelfHealPanel() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [fixResult, setFixResult] = useState<any>(null)

  const runCheck = async () => {
    setLoading(true)
    setFixResult(null)
    try {
      const api = (window as any).electronAPI.kernel.self_heal
      const result = await api.check()
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
      const api = (window as any).electronAPI.kernel.self_heal
      const result = await api.fix()
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
