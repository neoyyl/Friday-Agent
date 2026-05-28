import { useState } from 'react'
import { useLanguageStore } from '../../../stores/languageStore'

interface BackgroundTask {
  id: number
  type: 'HEARTBEAT' | 'MEMORY SYNC' | 'SELF-CHECK' | 'INDEX UPDATE' | 'TASK QUEUE'
  content: string
  time: string
  color: string
  status?: 'active' | 'completed' | 'idle'
}

const initialTasks: BackgroundTask[] = [
  {
    id: 1,
    type: 'HEARTBEAT',
    content: '检查记忆更新...',
    time: '14:32:00',
    color: 'var(--warm)',
    status: 'active',
  },
  {
    id: 2,
    type: 'MEMORY SYNC',
    content: '同步 3 条新记忆',
    time: '14:32:10',
    color: 'var(--cool)',
    status: 'completed',
  },
  {
    id: 3,
    type: 'SELF-CHECK',
    content: '系统状态正常',
    time: '14:32:20',
    color: 'var(--dim)',
    status: 'completed',
  },
  {
    id: 4,
    type: 'INDEX UPDATE',
    content: '更新向量索引...',
    time: '14:32:30',
    color: 'var(--cool)',
    status: 'active',
  },
  {
    id: 5,
    type: 'TASK QUEUE',
    content: '处理 2 个待办任务',
    time: '14:32:45',
    color: 'var(--warm)',
    status: 'completed',
  },
  {
    id: 6,
    type: 'HEARTBEAT',
    content: '心跳检测正常',
    time: '14:33:00',
    color: 'var(--warm)',
    status: 'active',
  },
  {
    id: 7,
    type: 'MEMORY SYNC',
    content: '新增 5 条语义记忆',
    time: '14:33:15',
    color: 'var(--cool)',
    status: 'completed',
  },
]

export function L2Panel() {
  const [collapsed, setCollapsed] = useState(false)
  const [tasks] = useState<BackgroundTask[]>(initialTasks)
  const { t } = useLanguageStore()

  return (
    <div className={`panel panel-right ${collapsed ? 'collapsed' : ''}`}>
      {/* 折叠时显示的展开按钮 */}
      {collapsed && (
        <button 
          className="expand-btn expand-btn-right"
          onClick={() => setCollapsed(false)}
          title="展开 L2 面板"
        >
          ◀
        </button>
      )}
      
      <div className="panel-identity">
        <div className="brand-mark"></div>
        <div className="brand-copy">
          <div className="eyebrow">{t('LAYER2')}</div>
          <div className="brand-title">{t('BACKGROUND_TASKS')}</div>
        </div>
        <button 
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
        >
          ▶
        </button>
      </div>
      
      <div className="panel-stats">
        <div className="stat">
          <div className="stat-label">{t('HEARTBEAT')}</div>
          <div className="stat-value live">
            <span className="live-dot"></span>
            tick
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('MEMORY')}</div>
          <div className="stat-value">3</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('QUEUE')}</div>
          <div className="stat-value">2</div>
        </div>
      </div>
      
      <div className="stream">
        <div className="stream-inner">
          {tasks.map((task) => (
            <div key={task.id} className="stream-line">
              <div className="line-header">
                <div className="line-dot" style={{ background: task.color }}></div>
                <div className="line-type">{task.type}</div>
                <div className="line-time">{task.time}</div>
              </div>
              <div className="line-text">{task.content}</div>
              {task.status === 'active' && (
                <div className="line-tool">
                  <span className="tool-spinner"></span>
                  <span className="tool-name">processing...</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
