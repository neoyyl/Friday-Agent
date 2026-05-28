import { useState } from 'react'
import { useLanguageStore } from '../../../stores/languageStore'

interface StreamEntry {
  id: number
  type: 'USER MESSAGE' | 'TOOL CALL' | 'ASSISTANT' | 'SYSTEM'
  content: string
  time: string
  color: string
  status?: 'running' | 'done' | 'failed'
}

const initialStreamData: StreamEntry[] = [
  {
    id: 1,
    type: 'USER MESSAGE',
    content: '帮我写一个函数',
    time: '14:32:01',
    color: 'var(--warm)',
  },
  {
    id: 2,
    type: 'TOOL CALL',
    content: 'code_generator',
    time: '14:32:05',
    color: 'var(--cool)',
    status: 'done',
  },
  {
    id: 3,
    type: 'ASSISTANT',
    content: '已生成 add() 函数',
    time: '14:32:15',
    color: 'var(--cool)',
  },
  {
    id: 4,
    type: 'USER MESSAGE',
    content: '请添加单元测试',
    time: '14:33:22',
    color: 'var(--warm)',
  },
  {
    id: 5,
    type: 'TOOL CALL',
    content: 'test_generator',
    time: '14:33:25',
    color: 'var(--cool)',
    status: 'running',
  },
  {
    id: 6,
    type: 'ASSISTANT',
    content: '正在生成测试用例...',
    time: '14:33:30',
    color: 'var(--cool)',
  },
  {
    id: 7,
    type: 'SYSTEM',
    content: '记忆更新：已记录代码生成模式',
    time: '14:34:01',
    color: 'var(--dim)',
  },
]

export function L1Panel() {
  const [collapsed, setCollapsed] = useState(false)
  const [streamData] = useState<StreamEntry[]>(initialStreamData)
  const { t } = useLanguageStore()

  return (
    <div className={`panel panel-left ${collapsed ? 'collapsed' : ''}`}>
      {/* 折叠时显示的展开按钮 */}
      {collapsed && (
        <button 
          className="expand-btn"
          onClick={() => setCollapsed(false)}
          title="展开 L1 面板"
        >
          ▶
        </button>
      )}
      
      <div className="panel-identity">
        <div className="brand-mark"></div>
        <div className="brand-copy">
          <div className="eyebrow">{t('LAYER1')}</div>
          <div className="brand-title">{t('THOUGHT_STREAM')}</div>
        </div>
        <button 
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
        >
          ◀
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
          <div className="stat-label">{t('MESSAGES')}</div>
          <div className="stat-value">12</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('TOKENS')}</div>
          <div className="stat-value">1.2K</div>
        </div>
      </div>
      
      <div className="stream">
        <div className="stream-inner">
          {streamData.map((entry) => (
            <div key={entry.id} className="stream-line">
              <div className="line-header">
                <div className="line-dot" style={{ background: entry.color }}></div>
                <div className="line-type">{entry.type}</div>
                <div className="line-time">{entry.time}</div>
              </div>
              <div className="line-text">{entry.content}</div>
              {entry.type === 'TOOL CALL' && (
                <div className={`line-tool ${entry.status || ''}`}>
                  <span className="tool-spinner"></span>
                  <span className="tool-name">{entry.status === 'done' ? 'completed' : 'running...'}</span>
                  {entry.status === 'done' && <span className="tool-status success">SUCCESS</span>}
                  {entry.status === 'failed' && <span className="tool-status failed">FAILED</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
