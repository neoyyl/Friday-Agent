import { useState } from 'react'

interface ModeSelectorProps {
  value: string
  onChange: (mode: string) => void
}

const MODES = [
  {
    id: 'direct', name: '直连模式', icon: '→',
    desc: '单个 Agent 直接执行任务',
    useCase: '简单任务，快速响应',
    example: '查询天气、翻译文本',
    color: '#22c55e',
  },
  {
    id: 'chain', name: '链式模式', icon: '→→→',
    desc: '多个 Agent 按顺序协作',
    useCase: '复杂任务，多步骤处理',
    example: '研究报告生成、代码审查',
    color: '#3b82f6',
  },
  {
    id: 'parallel', name: '并行模式', icon: '⇉',
    desc: '多个 Agent 同时执行，汇总结果',
    useCase: '可并行的独立子任务',
    example: '多源信息收集、对比分析',
    color: '#a855f7',
  },
  {
    id: 'hybrid', name: '混合模式', icon: '⟐',
    desc: '智能选择最佳执行策略',
    useCase: '不确定复杂度的任务',
    example: '开放式问题回答',
    color: '#f97316',
  },
]

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '6px',
      marginBottom: '8px',
    }}>
      {MODES.map((mode) => {
        const isActive = value === mode.id
        const isExpanded = expanded === mode.id

        return (
          <div
            key={mode.id}
            onClick={() => {
              onChange(mode.id)
              setExpanded(isExpanded ? null : mode.id)
            }}
            style={{
              padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
              border: `1.5px solid ${isActive ? mode.color : 'var(--border)'}`,
              background: isActive ? `color-mix(in srgb, ${mode.color} 12%, transparent)` : 'var(--bg-elevated)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `color-mix(in srgb, ${mode.color} 15%, transparent)`,
                color: mode.color, fontSize: '13px', fontWeight: 700, flexShrink: 0,
              }}>
                {mode.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  {mode.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '1px' }}>
                  {mode.desc}
                </div>
              </div>
              {isActive && (
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: mode.color, flexShrink: 0,
                  boxShadow: `0 0 8px ${mode.color}`,
                }} />
              )}
            </div>

            {isExpanded && (
              <div style={{
                marginTop: '8px', paddingTop: '8px',
                borderTop: '1px solid var(--border)',
                fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6,
              }}>
                <div><strong style={{ color: 'var(--text)' }}>适用场景:</strong> {mode.useCase}</div>
                <div><strong style={{ color: 'var(--text)' }}>示例:</strong> {mode.example}</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
