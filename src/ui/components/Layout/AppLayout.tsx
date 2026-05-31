import { useState, useEffect } from 'react'
import { SidePanel } from '../SidePanel/SidePanel'
import { CenterArea } from '../CenterArea/CenterArea'
import { ThemeSwitcher } from '../ThemeSwitcher/ThemeSwitcher'
import { AgentPanel } from '../AgentPanel/AgentPanel'
import { SpeakerManager } from '../SpeakerManager/SpeakerManager'
import { MemoryBrowser } from '../MemoryBrowser/MemoryBrowser'
import { ExecutionLog } from '../ExecutionLog/ExecutionLog'
import { PerceptionPanel } from '../PerceptionPanel/PerceptionPanel'
import { GPUMonitor } from '../GPUMonitor/GPUMonitor'
import { ObsidianPanel } from '../ObsidianPanel/ObsidianPanel'
import { SkillMarket } from '../SkillMarket/SkillMarket'
import { SchedulerPanel } from '../SchedulerPanel/SchedulerPanel'
import { SelfHealPanel } from '../SelfHealPanel/SelfHealPanel'
import { SessionList } from '../SidePanel/SessionList'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { useSessionStore } from '../../../stores/sessionStore'

const sidebarButtons = [
  { id: 'conversations', label: 'Chats', icon: '💬', color: 'var(--cool)' },
  { id: 'l1', label: 'L1', icon: '⚡', color: 'var(--warm)' },
  { id: 'l2', label: 'L2', icon: '🧠', color: 'var(--cool)' },
  { id: 'agents', label: 'Agents', icon: '🤖', color: 'var(--accent)' },
  { id: 'skills', label: 'Skills', icon: '🧩', color: '#8b5cf6' },
  { id: 'scheduler', label: 'Schedules', icon: '📅', color: '#f97316' },
  { id: 'health', label: 'SelfHeal', icon: '🩺', color: '#22c55e' },
  { id: 'speaker', label: 'Voice', icon: '🎙️', color: '#a855f7' },
  { id: 'memory', label: 'Memory', icon: '💾', color: '#06b6d4' },
  { id: 'logs', label: 'Logs', icon: '📋', color: '#eab308' },
  { id: 'perception', label: 'Perception', icon: '👁️', color: '#14b8a6' },
  { id: 'gpu', label: 'GPU', icon: '🎮', color: '#3b82f6' },
  { id: 'obsidian', label: 'Obsidian', icon: '📓', color: '#a855f7' },
]

const panelWidth = { width: '360px', borderRight: '1px solid var(--border)', background: 'var(--bg)', overflow: 'auto', flexShrink: 0 } as const

const PANELS: Record<string, React.ReactNode> = {
  conversations: <ErrorBoundary panelName="SessionList"><SessionList /></ErrorBoundary>,
  agents: <ErrorBoundary panelName="AgentPanel"><AgentPanel /></ErrorBoundary>,
  skills: <ErrorBoundary panelName="SkillMarket"><SkillMarket /></ErrorBoundary>,
  scheduler: <ErrorBoundary panelName="SchedulerPanel"><SchedulerPanel /></ErrorBoundary>,
  health: <ErrorBoundary panelName="SelfHealPanel"><SelfHealPanel /></ErrorBoundary>,
  speaker: <ErrorBoundary panelName="SpeakerManager"><SpeakerManager /></ErrorBoundary>,
  memory: <ErrorBoundary panelName="MemoryBrowser"><MemoryBrowser /></ErrorBoundary>,
  logs: <ErrorBoundary panelName="ExecutionLog"><ExecutionLog /></ErrorBoundary>,
  perception: <ErrorBoundary panelName="PerceptionPanel"><PerceptionPanel /></ErrorBoundary>,
  gpu: <ErrorBoundary panelName="GPUMonitor"><GPUMonitor /></ErrorBoundary>,
  obsidian: <ErrorBoundary panelName="ObsidianPanel"><ObsidianPanel /></ErrorBoundary>,
}

export default function AppLayout() {
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const { loadSessions } = useSessionStore()

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const togglePanel = (panel: string) => {
    setActivePanel(activePanel === panel ? null : panel)
  }

  const isLayerPanel = activePanel === 'l1' || activePanel === 'l2'

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh' }}>
      <div style={{ display: 'flex', position: 'relative', flexShrink: 0 }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '4px', padding: '8px 4px', background: 'var(--bg)',
          borderRight: '1px solid var(--border)', width: '56px', flexShrink: 0,
        }}>
          {sidebarButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => togglePanel(btn.id)}
              className={`layer-btn ${activePanel === btn.id ? 'active' : ''}`}
              title={btn.label}
              style={{
                '--btn-color': btn.color,
                position: 'relative', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                width: '48px', height: '48px', borderRadius: '12px',
                border: activePanel === btn.id ? `1.5px solid ${btn.color}` : '1.5px solid transparent',
                background: activePanel === btn.id ? `color-mix(in srgb, ${btn.color} 15%, transparent)` : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s ease',
              } as React.CSSProperties}
              onMouseEnter={(e) => { if (activePanel !== btn.id) e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={(e) => { if (activePanel !== btn.id) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1, filter: activePanel === btn.id ? 'none' : 'grayscale(40%)', transition: 'filter 0.15s' }}>{btn.icon}</span>
              <span style={{ fontSize: '9px', marginTop: '2px', color: activePanel === btn.id ? btn.color : 'var(--text-dim)', fontWeight: activePanel === btn.id ? 600 : 400, letterSpacing: '0.02em', transition: 'color 0.15s' }}>{btn.label}</span>
              {activePanel === btn.id && (
                <span style={{ position: 'absolute', top: '4px', right: '4px', width: '5px', height: '5px', borderRadius: '50%', background: btn.color }} />
              )}
            </button>
          ))}
        </div>

        {isLayerPanel && (
          <SidePanel activeLayer={activePanel === 'l1' ? 'l1' : 'l2'} onLayerChange={(layer) => setActivePanel(layer)} />
        )}

        {!isLayerPanel && activePanel && PANELS[activePanel] && (
          <div style={panelWidth}>{PANELS[activePanel]}</div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CenterArea />
      </div>

      <ThemeSwitcher />
    </div>
  )
}
