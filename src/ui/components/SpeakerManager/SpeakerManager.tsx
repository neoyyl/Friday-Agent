import { useState, useEffect } from 'react'
import { useKernelDataStore } from '../../../stores/kernelDataStore'

export function SpeakerManager() {
  const [showRegister, setShowRegister] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAlias, setNewAlias] = useState('')
  const [newTone, setNewTone] = useState('default')
  const [saving, setSaving] = useState(false)

  const { speakers, currentSpeaker, speakerLoading, loadSpeakers, registerSpeaker, deleteSpeaker } = useKernelDataStore()

  useEffect(() => { loadSpeakers() }, [loadSpeakers])

  const handleRegister = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const config: any = { alias: newAlias.trim() || newName.trim(), tone: newTone }
    await registerSpeaker(newName.trim(), config)
    setNewName('')
    setNewAlias('')
    setNewTone('default')
    setShowRegister(false)
    setSaving(false)
  }

  const handleDelete = async (name: string) => {
    await deleteSpeaker(name)
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>说话人管理</h3>
        <button
          onClick={() => setShowRegister(!showRegister)}
          style={{
            padding: '4px 8px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: 'pointer', fontSize: '11px',
          }}
        >
          {showRegister ? '取消' : '+ 注册'}
        </button>
      </div>

      {currentSpeaker && (
        <div style={{
          padding: '10px 12px', borderRadius: '8px',
          border: '1px solid #8b5cf640', background: 'color-mix(in srgb, #8b5cf6 8%, transparent)',
          marginBottom: '12px',
        }}>
          <div style={{ fontSize: '10px', color: '#8b5cf6', marginBottom: '4px' }}>当前说话人</div>
          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px' }}>
            {currentSpeaker.alias || currentSpeaker.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
            语气: {currentSpeaker.tone || 'default'} | 相似度: {currentSpeaker.similarity ?? '-'}
          </div>
        </div>
      )}

      {showRegister && (
        <div style={{
          padding: '12px', borderRadius: '8px',
          border: '1px solid var(--border)', background: 'var(--bg-elevated)',
          marginBottom: '12px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>注册说话人</div>
          <input
            placeholder="姓名（必填）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: '4px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', fontSize: '12px', marginBottom: '6px', boxSizing: 'border-box',
            }}
          />
          <input
            placeholder="昵称（选填）"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: '4px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', fontSize: '12px', marginBottom: '6px', boxSizing: 'border-box',
            }}
          />
          <select
            value={newTone}
            onChange={(e) => setNewTone(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: '4px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', fontSize: '12px', marginBottom: '8px',
            }}
          >
            <option value="default">默认语气</option>
            <option value="gentle">温柔</option>
            <option value="energetic">活力</option>
          </select>
          <button
            onClick={handleRegister}
            disabled={saving || !newName.trim()}
            style={{
              width: '100%', padding: '6px', borderRadius: '4px',
              border: '1px solid #8b5cf6', background: 'color-mix(in srgb, #8b5cf6 15%, transparent)',
              color: '#8b5cf6', cursor: (saving || !newName.trim()) ? 'wait' : 'pointer',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            {saving ? '注册中...' : '确认注册'}
          </button>
        </div>
      )}

      {speakerLoading ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>加载中...</div>
      ) : speakers.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>
          暂无说话人，点击上方按钮注册
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {speakers.map((sp: any) => (
            <div key={sp.name} style={{
              padding: '10px 12px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>
                  {sp.alias || sp.name}
                  {sp.is_current && <span style={{ color: '#8b5cf6', marginLeft: '6px', fontSize: '10px' }}>当前</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '1px' }}>
                  样本: {sp.samples || 1} | 语气: {sp.tone || 'default'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {sp.name && (
                  <button
                    onClick={() => handleDelete(sp.name)}
                    style={{
                      padding: '4px 8px', borderRadius: '4px',
                      border: '1px solid #ef444440', background: 'transparent',
                      color: '#ef4444', cursor: 'pointer', fontSize: '10px',
                    }}
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
