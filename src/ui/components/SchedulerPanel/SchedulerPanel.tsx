import { useState, useEffect } from 'react'
import { CronEditor } from './CronEditor'

const BACKEND_API = {
  get scheduler() { return window.electronAPI?.backend?.scheduler },
  get triggers() { return window.electronAPI?.backend?.triggers },
  get workflows() { return window.electronAPI?.backend?.workflows },
}

interface JobItem {
  id?: string
  name?: string
  expression?: string
  next_run?: string
  last_run?: string
  enabled?: boolean
  trigger?: string
  condition?: string
  description?: string
  steps?: number | Array<Record<string, unknown>>
  [key: string]: unknown
}

interface SchedulerForm {
  name: string
  trigger_type: string
  trigger_args: { minute?: string; hour?: string; day?: string; month?: string; day_of_week?: string; raw?: string; [key: string]: unknown }
  action_name: string
  event_pattern?: string
  condition?: Record<string, unknown>
  steps?: Array<{ name: string; action: string }>
}

export function SchedulerPanel() {
  const [tab, setTab] = useState<'jobs' | 'triggers' | 'workflows'>('jobs')
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [triggers, setTriggers] = useState<JobItem[]>([])
  const [workflows, setWorkflows] = useState<JobItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<SchedulerForm>({ name: '', trigger_type: 'cron', trigger_args: {}, action_name: '' })
  const [saving, setSaving] = useState(false)
  const [cronExpr, setCronExpr] = useState('0 9 * * *')

  const load = async () => {
    try {
      const [jr, tr, wr] = await Promise.all([
        BACKEND_API.scheduler?.jobs(),
        BACKEND_API.triggers?.list(),
        BACKEND_API.workflows?.list(),
      ])
      if (jr && !jr.error) setJobs((Array.isArray(jr) ? jr : (jr as any).data?.jobs || []) as JobItem[])
      if (tr && !tr.error) setTriggers((Array.isArray(tr) ? tr : (tr as any).data?.triggers || []) as JobItem[])
      if (wr && !wr.error) setWorkflows((Array.isArray(wr) ? wr : (wr as any).data?.workflows || []) as JobItem[])
    } catch (err) {
      console.error('[SchedulerPanel] load failed:', err)
    }
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (type: string, id: string) => {
    try {
      if (type === 'job') await BACKEND_API.scheduler?.toggle(id)
      if (type === 'trigger') await BACKEND_API.triggers?.toggle(id)
      load()
    } catch (err) {
      console.error('[SchedulerPanel] toggle failed:', err)
    }
  }

  const handleDelete = async (type: string, id: string) => {
    try {
      if (type === 'job') await BACKEND_API.scheduler?.delete(id)
      if (type === 'trigger') await BACKEND_API.triggers?.delete(id)
      load()
    } catch (err) {
      console.error('[SchedulerPanel] delete failed:', err)
    }
  }

  const handleRun = async (type: string, id: string) => {
    try {
      if (type === 'workflow') await BACKEND_API.workflows?.run(id)
      if (type === 'job') await BACKEND_API.scheduler?.runAction(id)
    } catch (err) {
      console.error('[SchedulerPanel] run failed:', err)
    }
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (tab === 'jobs') {
        await BACKEND_API.scheduler?.create({
          name: form.name,
          trigger_type: form.trigger_type,
          trigger_args: form.trigger_args,
          action_name: form.action_name || 'event',
        } as any)
      } else if (tab === 'triggers') {
        await BACKEND_API.triggers?.create({
          name: form.name,
          event_pattern: form.event_pattern || 'scheduler.health_report',
          condition: form.condition || { type: 'threshold', field: 'disk_free', operator: '<', value: 20 },
          action_name: form.action_name || 'notifier.warning',
        } as any)
      } else if (tab === 'workflows') {
        await BACKEND_API.workflows?.create({
          name: form.name,
          steps: (form.steps || [{ name: 'step1', action: form.action_name || 'event' }]) as unknown as number,
        } as any)
      }
      setShowCreate(false)
      setForm({ name: '', trigger_type: 'cron', trigger_args: {}, action_name: '' })
      load()
    } catch (err) {
      console.error('[SchedulerPanel] create failed:', err)
    }
    setSaving(false)
  }

  const renderForm = () => (
    <div style={{
      padding: '12px', borderRadius: '8px',
      border: '1px solid var(--border)', background: 'var(--bg-elevated)',
      marginBottom: '12px',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
        新建{tab === 'jobs' ? '定时任务' : tab === 'triggers' ? '触发器' : '工作流'}
      </div>
      <input
        placeholder="名称"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        style={{
          width: '100%', padding: '6px 8px', borderRadius: '4px',
          border: '1px solid var(--border)', background: 'var(--bg)',
          color: 'var(--text)', fontSize: '12px', marginBottom: '6px', boxSizing: 'border-box',
        }}
      />
      {tab === 'jobs' && (
        <CronEditor
          value={cronExpr}
          onChange={(cron) => {
            setCronExpr(cron)
            const parts = cron.split(' ')
            if (parts.length >= 5) {
              setForm({ ...form, trigger_args: { minute: parts[0], hour: parts[1], day: parts[2] || '*', month: parts[3] || '*', day_of_week: parts[4] || '*' } })
            }
          }}
        />
      )}
      {tab === 'triggers' && (
        <input
          placeholder="事件模式 (如 scheduler.health_report)"
          value={form.event_pattern || ''}
          onChange={(e) => setForm({ ...form, event_pattern: e.target.value })}
          style={{
            width: '100%', padding: '6px 8px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'var(--bg)',
            color: 'var(--text)', fontSize: '12px', marginBottom: '6px', boxSizing: 'border-box',
          }}
        />
      )}
      <input
        placeholder="动作名称"
        value={form.action_name}
        onChange={(e) => setForm({ ...form, action_name: e.target.value })}
        style={{
          width: '100%', padding: '6px 8px', borderRadius: '4px',
          border: '1px solid var(--border)', background: 'var(--bg)',
          color: 'var(--text)', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={handleCreate} disabled={saving || !form.name.trim()}
          style={{
            flex: 1, padding: '6px', borderRadius: '4px',
            border: '1px solid #f97316', background: 'color-mix(in srgb, #f97316 15%, transparent)',
            color: '#f97316', cursor: (saving || !form.name.trim()) ? 'wait' : 'pointer',
            fontSize: '12px', fontWeight: 600,
          }}
        >
          {saving ? '创建中...' : '创建'}
        </button>
        <button onClick={() => setShowCreate(false)}
          style={{
            padding: '6px 12px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12px',
          }}
        >
          取消
        </button>
      </div>
    </div>
  )

  const renderItem = (item: any, type: string) => (
    <div key={item.id} style={{
      padding: '10px 12px', borderRadius: '8px',
      border: '1px solid var(--border)', background: 'var(--bg-elevated)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>{item.name || item.id}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '1px' }}>
            {item.expression || item.trigger || item.condition || item.description || `${item.steps?.length || 0} 步`}
          </div>
          {(item.next_run || item.last_run) && (
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
              {item.next_run ? `下次: ${item.next_run}` : ''}
              {item.last_run ? `上次: ${item.last_run}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>
          {type === 'workflow' && (
            <button onClick={() => handleRun(type, item.id)}
              style={{
                padding: '3px 6px', borderRadius: '3px',
                border: '1px solid #22c55e40', background: 'transparent',
                color: '#22c55e', cursor: 'pointer', fontSize: '9px',
              }}
            >
              运行
            </button>
          )}
          {item.enabled !== undefined && (
            <button onClick={() => handleToggle(type, item.id)}
              style={{
                padding: '3px 6px', borderRadius: '3px',
                border: '1px solid var(--border)',
                background: item.enabled ? 'rgba(34,197,94,0.15)' : 'transparent',
                color: item.enabled ? '#22c55e' : 'var(--text-dim)',
                cursor: 'pointer', fontSize: '9px',
              }}
            >
              {item.enabled ? '启用' : '禁用'}
            </button>
          )}
          <button onClick={() => handleDelete(type, item.id)}
            style={{
              padding: '3px 6px', borderRadius: '3px',
              border: '1px solid #ef444440', background: 'transparent',
              color: '#ef4444', cursor: 'pointer', fontSize: '9px',
            }}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>调度管理</h3>
        <button onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: '4px 8px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: 'pointer', fontSize: '11px',
          }}
        >
          {showCreate ? '取消' : '+ 新建'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {(['jobs', 'triggers', 'workflows'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setShowCreate(false) }}
            style={{
              padding: '4px 12px', borderRadius: '4px',
              border: '1px solid var(--border)',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-dim)',
              cursor: 'pointer', fontSize: '11px',
            }}
          >
            {t === 'jobs' ? '定时任务' : t === 'triggers' ? '触发器' : '工作流'}
          </button>
        ))}
      </div>

      {showCreate && renderForm()}

      {tab === 'jobs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {jobs.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>暂无定时任务</div>
          ) : jobs.map((j: any) => renderItem(j, 'job'))}
        </div>
      )}

      {tab === 'triggers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {triggers.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>暂无触发器</div>
          ) : triggers.map((t: any) => renderItem(t, 'trigger'))}
        </div>
      )}

      {tab === 'workflows' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {workflows.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>暂无工作流</div>
          ) : workflows.map((w: any) => renderItem(w, 'workflow'))}
        </div>
      )}
    </div>
  )
}