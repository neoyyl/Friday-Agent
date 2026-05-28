import { useState } from 'react'
import { useLanguageStore } from '../../../stores/languageStore'

interface StreamEntry {
  id: number
  type: string
  content: string
  time: string
  color: string
  status?: string
}

const l1Data: StreamEntry[] = [
  { id: 1, type: 'USER MESSAGE', content: '帮我写一个函数', time: '14:32:01', color: 'var(--warm)' },
  { id: 2, type: 'TOOL CALL', content: 'code_generator', time: '14:32:05', color: 'var(--cool)', status: 'done' },
  { id: 3, type: 'ASSISTANT', content: '已生成 add() 函数', time: '14:32:15', color: 'var(--cool)' },
  { id: 4, type: 'USER MESSAGE', content: '请添加单元测试', time: '14:33:22', color: 'var(--warm)' },
  { id: 5, type: 'TOOL CALL', content: 'test_generator', time: '14:33:25', color: 'var(--cool)', status: 'running' },
]

const l2Data: StreamEntry[] = [
  { id: 1, type: 'HEARTBEAT', content: '检查记忆更新...', time: '14:32:00', color: 'var(--warm)', status: 'active' },
  { id: 2, type: 'MEMORY SYNC', content: '同步 3 条新记忆', time: '14:32:10', color: 'var(--cool)', status: 'completed' },
  { id: 3, type: 'SELF-CHECK', content: '系统状态正常', time: '14:32:20', color: 'var(--dim)', status: 'completed' },
  { id: 4, type: 'INDEX UPDATE', content: '更新向量索引...', time: '14:32:30', color: 'var(--cool)', status: 'active' },
]

const layers = [
  { id: 'l1', label: 'L1', icon: '⚡', color: 'var(--warm)' },
  { id: 'l2', label: 'L2', icon: '🧠', color: 'var(--cool)' },
]

export function SidePanel() {
  const [activeLayer, setActiveLayer] = useState<string | null>(null)
  const { t } = useLanguageStore()

  const isActive = activeLayer !== null

  const toggleLayer = (layerId: string) => {
    if (activeLayer === layerId) {
      setActiveLayer(null)
    } else {
      setActiveLayer(layerId)
    }
  }

  const getData = () => {
    if (activeLayer === 'l1') return l1Data
    if (activeLayer === 'l2') return l2Data
    return []
  }

  return (
    <div className={`side-panel ${isActive ? 'open' : ''}`}>
      {/* 层级按钮 */}
      <div className="layer-buttons">
        {layers.map((layer) => (
          <button
            key={layer.id}
            className={`layer-btn ${activeLayer === layer.id ? 'active' : ''}`}
            onClick={() => toggleLayer(layer.id)}
            title={layer.id === 'l1' ? t('LAYER1') : t('LAYER2')}
            style={{ '--btn-color': layer.color } as React.CSSProperties}
          >
            <span className="layer-icon">{layer.icon}</span>
            <span className="layer-label">{layer.label}</span>
          </button>
        ))}
      </div>

      {/* 面板内容 */}
      {isActive && (
        <div className="panel panel-left">
          <div className="panel-identity">
            <div className="brand-mark"></div>
            <div className="brand-copy">
              <div className="eyebrow">
                {activeLayer === 'l1' ? t('LAYER1') : t('LAYER2')}
              </div>
              <div className="brand-title">
                {activeLayer === 'l1' ? t('THOUGHT_STREAM') : t('BACKGROUND_TASKS')}
              </div>
            </div>
            <button 
              className="collapse-btn"
              onClick={() => setActiveLayer(null)}
            >
              ✕
            </button>
          </div>

          <div className="panel-stats">
            <div className="stat">
              <div className="stat-label">{t('STATUS')}</div>
              <div className="stat-value live">
                <span className="live-dot"></span>
                {t('ACTIVE')}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">{activeLayer === 'l1' ? t('MESSAGES') : t('HEARTBEAT')}</div>
              <div className="stat-value">{activeLayer === 'l1' ? '12' : 'tick'}</div>
            </div>
          </div>

          <div className="stream">
            <div className="stream-inner">
              {getData().map((entry) => (
                <div key={entry.id} className="stream-line">
                  <div className="line-header">
                    <div className="line-dot" style={{ background: entry.color }}></div>
                    <div className="line-type">{entry.type}</div>
                    <div className="line-time">{entry.time}</div>
                  </div>
                  <div className="line-text">{entry.content}</div>
                  {entry.status && (
                    <div className={`line-tool ${entry.status === 'done' || entry.status === 'completed' ? 'done' : ''}`}>
                      {entry.status === 'running' || entry.status === 'active' ? (
                        <span className="tool-spinner"></span>
                      ) : null}
                      <span className="tool-name">{entry.status}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
