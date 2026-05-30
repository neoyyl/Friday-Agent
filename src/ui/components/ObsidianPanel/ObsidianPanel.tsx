import { useState, useEffect } from 'react'
import { useKernelDataStore } from '../../../stores/kernelDataStore'

export function ObsidianPanel() {
  const [tab, setTab] = useState<'notes' | 'write'>('notes')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteTags, setNoteTags] = useState('')
  const [noteFolder, setNoteFolder] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const { obsidianConfig, obsidianNotes, obsidianLoading, loadObsidian, writeObsidianNote } = useKernelDataStore()

  useEffect(() => { loadObsidian() }, [loadObsidian])

  const handleWrite = async () => {
    if (!noteTitle.trim()) return
    setSaving(true)
    const ok = await writeObsidianNote(
      noteTitle.trim(),
      noteContent,
      noteTags.split(',').map((t: string) => t.trim()).filter(Boolean),
      noteFolder.trim(),
    )
    setFeedback(ok ? '笔记已写入' : '写入失败')
    if (ok) {
      setNoteTitle('')
      setNoteContent('')
      setNoteTags('')
      setTimeout(() => setFeedback(''), 3000)
    }
    setSaving(false)
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>Obsidian</h3>
        <button onClick={loadObsidian} disabled={obsidianLoading}
          style={{
            padding: '4px 8px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: obsidianLoading ? 'wait' : 'pointer', fontSize: '11px',
          }}
        >
          {obsidianLoading ? '...' : '刷新'}
        </button>
      </div>

      {obsidianConfig && (
        <div style={{
          padding: '8px 12px', borderRadius: '6px',
          border: `1px solid ${obsidianConfig.exists ? '#22c55e40' : '#ef444440'}`,
          background: obsidianConfig.exists ? 'color-mix(in srgb, #22c55e 5%, transparent)' : 'color-mix(in srgb, #ef4444 5%, transparent)',
          marginBottom: '10px', fontSize: '11px',
        }}>
          <span style={{ color: obsidianConfig.exists ? '#22c55e' : '#ef4444' }}>
            {obsidianConfig.exists ? '仓库已连接' : '仓库未找到'}
          </span>
          <span style={{ color: 'var(--text-dim)', marginLeft: '8px' }}>{obsidianConfig.vault_path}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {([
          { id: 'notes' as const, label: '笔记列表' },
          { id: 'write' as const, label: '写笔记' },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
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

      {obsidianLoading && !obsidianConfig ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>加载中...</div>
      ) : tab === 'notes' ? (
        <div>
          {obsidianNotes.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>
              暂无笔记
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '400px', overflow: 'auto' }}>
              {obsidianNotes.map((note: any, i: number) => (
                <div key={i} style={{
                  padding: '8px 10px', borderRadius: '6px',
                  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                  fontSize: '11px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{note.name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                      {note.size ? `${(note.size / 1024).toFixed(1)} KB` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            placeholder="标题（必填）"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: '4px',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box',
            }}
          />
          <input
            placeholder="标签（逗号分隔，如 AI,日报）"
            value={noteTags}
            onChange={(e) => setNoteTags(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: '4px',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box',
            }}
          />
          <input
            placeholder="子目录（如 Daily,Projects）"
            value={noteFolder}
            onChange={(e) => setNoteFolder(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: '4px',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box',
            }}
          />
          <textarea
            placeholder="笔记内容（Markdown）..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={8}
            style={{
              width: '100%', padding: '8px', borderRadius: '4px',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              color: 'var(--text)', fontSize: '12px', resize: 'vertical',
              fontFamily: 'monospace', boxSizing: 'border-box',
            }}
          />
          <button onClick={handleWrite} disabled={saving || !noteTitle.trim()}
            style={{
              padding: '8px', borderRadius: '4px',
              border: '1px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
              color: 'var(--accent)', cursor: (saving || !noteTitle.trim()) ? 'wait' : 'pointer',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            {saving ? '写入中...' : '写入 Obsidian'}
          </button>
          {feedback && (
            <div style={{ fontSize: '11px', color: feedback.includes('失败') ? '#ef4444' : '#22c55e', textAlign: 'center' }}>
              {feedback}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
