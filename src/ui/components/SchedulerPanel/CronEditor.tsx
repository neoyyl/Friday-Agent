import { useState, useMemo } from 'react'

interface CronEditorProps {
  value: string
  onChange: (cron: string) => void
}

const FREQUENCIES = [
  { id: 'once', label: '执行一次' },
  { id: 'hourly', label: '每小时' },
  { id: 'daily', label: '每天' },
  { id: 'weekday', label: '工作日' },
  { id: 'weekly', label: '每周' },
  { id: 'monthly', label: '每月' },
]

const WEEKDAYS = [
  { id: '0', label: '日' },
  { id: '1', label: '一' },
  { id: '2', label: '二' },
  { id: '3', label: '三' },
  { id: '4', label: '四' },
  { id: '5', label: '五' },
  { id: '6', label: '六' },
]

function generateCron(freq: string, hour: string, minute: string, dayOfWeek: string, dayOfMonth: string): string {
  switch (freq) {
    case 'once': return `${minute} ${hour} ${dayOfMonth} * *`
    case 'hourly': return `${minute} * * * *`
    case 'daily': return `${minute} ${hour} * * *`
    case 'weekday': return `${minute} ${hour} * * 1-5`
    case 'weekly': return `${minute} ${hour} * * ${dayOfWeek || '1'}`
    case 'monthly': return `${minute} ${hour} ${dayOfMonth || '1'} * *`
    default: return `${minute} ${hour} * * *`
  }
}

function describeCron(freq: string, hour: string, minute: string, dayOfWeek: string, dayOfMonth: string): string {
  const h = parseInt(hour)
  const m = parseInt(minute)
  const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

  switch (freq) {
    case 'once': return `在 ${timeStr}（${dayOfMonth}日）执行一次`
    case 'hourly': return `每小时的第 ${m} 分钟执行`
    case 'daily': return `每天 ${timeStr} 执行`
    case 'weekday': return `工作日 ${timeStr} 执行`
    case 'weekly': return `每周${WEEKDAYS.find(d => d.id === String(dayOfWeek))?.label || '一'} ${timeStr} 执行`
    case 'monthly': return `每月 ${dayOfMonth || '1'} 日 ${timeStr} 执行`
    default: return `${timeStr} 执行`
  }
}

export function CronEditor({ value, onChange }: CronEditorProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [freq, setFreq] = useState('daily')
  const [hour, setHour] = useState('09')
  const [minute, setMinute] = useState('00')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [dayOfMonth, setDayOfMonth] = useState('1')

  // Initialize from existing cron value
  useMemo(() => {
    if (value) {
      const parts = value.split(' ')
      if (parts.length >= 5) {
        setMinute(parts[0])
        setHour(parts[1])
        setDayOfMonth(parts[2])
        const dow = parts[4]
        if (dow === '*') {
          if (parts[1] === '*' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
            setFreq('hourly')
          } else if (parts[2] === '*' && parts[3] === '*') {
            setFreq('daily')
          } else {
            setFreq('monthly')
          }
        } else if (dow === '1-5') {
          setFreq('weekday')
        } else {
          setFreq('weekly')
          setDayOfWeek(dow)
        }
      }
    }
  }, [value])

  const handleSimpleChange = (newFreq: string, newHour?: string, newMinute?: string, newDow?: string, newDom?: string) => {
    const h = newHour ?? hour
    const m = newMinute ?? minute
    const dow = newDow ?? dayOfWeek
    const dom = newDom ?? dayOfMonth
    const cron = generateCron(newFreq, h, m, dow, dom)
    setFreq(newFreq)
    if (newHour !== undefined) setHour(newHour)
    if (newMinute !== undefined) setMinute(newMinute)
    if (newDow !== undefined) setDayOfWeek(newDow)
    if (newDom !== undefined) setDayOfMonth(newDom)
    onChange(cron)
  }

  const description = describeCron(freq, hour, minute, dayOfWeek, dayOfMonth)
  const isAdvanced = mode === 'advanced'

  return (
    <div style={{
      padding: '12px', borderRadius: '8px',
      border: '1px solid var(--border)', background: 'var(--bg-elevated)',
      marginBottom: '8px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
          {isAdvanced ? 'Cron 表达式' : '定时配置'}
        </div>
        <button
          onClick={() => setMode(isAdvanced ? 'simple' : 'advanced')}
          style={{
            padding: '3px 8px', borderRadius: '4px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-dim)', cursor: 'pointer', fontSize: '10px',
          }}
        >
          {isAdvanced ? '切换到简单模式' : '切换到高级模式'}
        </button>
      </div>

      {!isAdvanced ? (
        <>
          {/* Frequency */}
          <div style={{
            display: 'flex', gap: '4px', marginBottom: '12px',
            flexWrap: 'wrap',
          }}>
            {FREQUENCIES.map(f => (
              <button
                key={f.id}
                onClick={() => handleSimpleChange(f.id)}
                style={{
                  padding: '5px 10px', borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: freq === f.id ? 'var(--accent)' : 'transparent',
                  color: freq === f.id ? '#fff' : 'var(--text-dim)',
                  cursor: 'pointer', fontSize: '11px',
                  fontWeight: freq === f.id ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Time picker */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
              执行时间
            </label>
            <input
              type="time"
              value={`${hour}:${minute}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':')
                handleSimpleChange(freq, h, m)
              }}
              style={{
                padding: '6px 10px', borderRadius: '6px',
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: '13px', outline: 'none',
              }}
            />
          </div>

          {/* Weekly day picker */}
          {freq === 'weekly' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
                选择星期
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {WEEKDAYS.map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleSimpleChange(freq, undefined, undefined, d.id)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      border: '1px solid var(--border)',
                      background: dayOfWeek === d.id ? 'var(--accent)' : 'transparent',
                      color: dayOfWeek === d.id ? '#fff' : 'var(--text-dim)',
                      cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div style={{
            padding: '8px 10px', borderRadius: '6px',
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.2)',
            fontSize: '11px', color: '#a78bfa',
          }}>
            <span style={{ fontWeight: 600 }}>预览:</span> {description}
          </div>
        </>
      ) : (
        <>
          <input
            type="text"
            value={value || '0 9 * * *'}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0 9 * * *"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: '6px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', fontSize: '13px', fontFamily: 'monospace',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
            格式: 分 时 日 月 周<br />
            示例: <code style={{ color: 'var(--text)' }}>0 9 * * *</code> = 每天 09:00
          </div>
        </>
      )}
    </div>
  )
}
