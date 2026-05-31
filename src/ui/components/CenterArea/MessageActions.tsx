import { useState, useRef, useEffect } from 'react'

interface MessageActionsProps {
  role: 'user' | 'assistant'
  content: string
  onEdit?: () => void
  onDelete?: () => void
  onRegenerate?: () => void
  isEditing?: boolean
}

export function MessageActions({ role, content, onEdit, onDelete, onRegenerate, isEditing }: MessageActionsProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
    } catch { /* fallback */ }
    setOpen(false)
  }

  const handleAction = (cb?: () => void) => {
    cb?.()
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1,
          padding: '2px 4px', borderRadius: '4px', opacity: open ? 1 : 0.4,
        }}
        title="更多操作"
      >
        ⋯
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 50,
          minWidth: '120px', padding: '4px', borderRadius: '6px',
          border: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {[
            { label: '复制', icon: '📋', action: handleCopy },
            ...(role === 'user' && onEdit ? [{ label: isEditing ? '取消编辑' : '编辑', icon: '✏️', action: () => handleAction(onEdit) }] : []),
            ...(onDelete ? [{ label: '删除', icon: '🗑️', action: () => handleAction(onDelete) }] : []),
            ...(onRegenerate ? [{ label: '重新生成', icon: '🔄', action: () => handleAction(onRegenerate) }] : []),
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', padding: '6px 8px', borderRadius: '4px',
                border: 'none', background: 'transparent',
                color: 'var(--text)', cursor: 'pointer', fontSize: '11px',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
