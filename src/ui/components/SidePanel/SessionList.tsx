import { useState, useMemo } from 'react'
import { useSessionStore } from '../../../stores/sessionStore'
import { useLanguageStore } from '../../../stores/languageStore'

export function SessionList() {
  const { sessions, activeSessionId, setActiveSession, createSession, deleteSession, togglePin, toggleArchive } = useSessionStore()
  const { t } = useLanguageStore()
  const [isCreating, setIsCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const sortedSessions = useMemo(() => {
    const filtered = sessions.filter(s => s.isArchived === showArchived)
    const pinned = filtered.filter(s => s.isPinned)
    const unpinned = filtered.filter(s => !s.isPinned)
    return [...pinned, ...unpinned]
  }, [sessions, showArchived])

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sortedSessions
    const q = searchQuery.toLowerCase()
    return sortedSessions.filter(s => s.title.toLowerCase().includes(q))
  }, [sortedSessions, searchQuery])

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const id = await createSession()
      setActiveSession(id)
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelect = (id: string) => {
    setActiveSession(id)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteSession(id)
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id)
      if (remaining.length > 0) {
        setActiveSession(remaining[0].id)
      }
    }
  }

  const handleExport = async () => {
    const sessionId = activeSessionId
    if (!sessionId) return
    try {
      const msgs = await window.electronAPI!.messages.list(sessionId) as Array<{
        role: string; content: string; created_at: string
      }>
      const content = msgs.map(m =>
        `## ${m.role === 'user' ? 'YOU' : 'FRIDAY'} — ${new Date(m.created_at).toLocaleString()}\n\n${m.content}\n`
      ).join('\n---\n\n')
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const session = sessions.find(s => s.id === sessionId)
      a.download = `${session?.title || 'conversation'}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // export failed silently
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const now = new Date()
      const diff = now.getTime() - d.getTime()
      if (diff < 86400000) {
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  return (
    <div className="session-list">
      <div className="session-list-header">
        <span className="session-list-title">{t('CONVERSATIONS')}</span>
        <div className="session-list-actions">
          <button
            className="session-export-btn"
            onClick={handleExport}
            disabled={!activeSessionId}
            title="导出对话"
          >
            ⬇
          </button>
          <button
            className="session-new-btn"
            onClick={handleCreate}
            disabled={isCreating}
            title={t('NEW_CONVERSATION')}
          >
            {isCreating ? '...' : '+'}
          </button>
        </div>
      </div>
      <div className="session-search-bar">
        <input
          type="text"
          className="session-search-input"
          placeholder="搜索会话..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          className={`session-archive-toggle ${showArchived ? 'active' : ''}`}
          onClick={() => setShowArchived(v => !v)}
          title={showArchived ? '显示活跃会话' : '显示归档会话'}
        >
          {showArchived ? '📂 归档' : '📁'}
        </button>
      </div>
      <div className="session-list-items">
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${activeSessionId === session.id ? 'active' : ''} ${session.isPinned ? 'pinned' : ''}`}
            onClick={() => handleSelect(session.id)}
          >
            <div className="session-item-content">
              <span className="session-item-title">{session.title}</span>
              <span className="session-item-time">{formatDate(session.updated_at || session.created_at)}</span>
            </div>
            <div className="session-item-actions">
              <button
                className="session-pin-btn"
                onClick={(e) => { e.stopPropagation(); togglePin(session.id) }}
                title={session.isPinned ? '取消置顶' : '置顶'}
              >
                {session.isPinned ? '📌' : '📍'}
              </button>
              <button
                className="session-archive-btn"
                onClick={(e) => { e.stopPropagation(); toggleArchive(session.id) }}
                title={session.isArchived ? '取消归档' : '归档'}
              >
                {session.isArchived ? '📂' : '📁'}
              </button>
              <button
                className="session-delete-btn"
                onClick={(e) => handleDelete(e, session.id)}
                title={t('DELETE')}
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {filteredSessions.length === 0 && (
          <div className="session-empty">
            {searchQuery ? '没有匹配的会话' : '没有会话'}
          </div>
        )}
      </div>
      <style>{`
        .session-list {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg);
        }
        .session-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
        }
        .session-list-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-dim);
          font-family: "JetBrains Mono", ui-monospace, monospace;
        }
        .session-new-btn {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-dim);
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .session-new-btn:hover {
          border-color: var(--warm);
          color: var(--warm);
        }
        .session-list-actions {
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .session-export-btn {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-dim);
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .session-export-btn:hover:not(:disabled) {
          border-color: var(--cool);
          color: var(--cool);
        }
        .session-export-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .session-search-bar {
          padding: 6px 12px;
          border-bottom: 1px solid var(--border);
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .session-search-input {
          flex: 1;
          width: 100%;
          padding: 5px 8px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--bg-elevated);
          color: var(--text);
          font-size: 11px;
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s ease;
        }
        .session-search-input:focus {
          border-color: var(--cool);
        }
        .session-search-input::placeholder {
          color: var(--text-dim);
        }
        .session-archive-toggle {
          flex-shrink: 0;
          padding: 3px 6px;
          border-radius: 4px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-dim);
          font-size: 10px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .session-archive-toggle:hover {
          border-color: var(--cool);
          color: var(--cool);
        }
        .session-archive-toggle.active {
          background: color-mix(in srgb, var(--cool) 12%, transparent);
          border-color: var(--cool);
          color: var(--cool);
        }
        .session-list-items {
          flex: 1;
          overflow-y: auto;
          padding: 6px;
        }
        .session-item {
          display: flex;
          align-items: center;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 2px;
        }
        .session-item:hover {
          background: var(--bg-elevated);
        }
        .session-item.active {
          background: color-mix(in srgb, var(--cool) 12%, transparent);
        }
        .session-item.pinned {
          background: color-mix(in srgb, var(--warm) 6%, transparent);
        }
        .session-item-actions {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .session-pin-btn,
        .session-archive-btn {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: none;
          background: transparent;
          font-size: 11px;
          cursor: pointer;
          opacity: 0;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .session-item:hover .session-pin-btn,
        .session-item:hover .session-archive-btn {
          opacity: 1;
        }
        .session-item.pinned .session-pin-btn {
          opacity: 1;
        }
        .session-pin-btn:hover,
        .session-archive-btn:hover {
          background: rgba(128, 128, 128, 0.1);
        }
        .session-item-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .session-item-title {
          font-size: 12px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .session-item.active .session-item-title {
          color: var(--cool);
        }
        .session-item-time {
          font-size: 9px;
          color: var(--text-dim);
          font-family: "JetBrains Mono", ui-monospace, monospace;
        }
        .session-delete-btn {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: none;
          background: transparent;
          color: var(--text-dim);
          font-size: 14px;
          cursor: pointer;
          opacity: 0;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .session-item:hover .session-delete-btn {
          opacity: 1;
        }
        .session-delete-btn:hover {
          background: rgba(224, 120, 120, 0.15);
          color: #e07878;
        }
        .session-empty {
          padding: 24px 12px;
          text-align: center;
          color: var(--text-dim);
          font-size: 11px;
        }
      `}</style>
    </div>
  )
}