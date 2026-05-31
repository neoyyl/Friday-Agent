import { useEffect, useState } from 'react'
import { useAgentStore, Agent } from '../../../stores/agentStore'

export function AgentPanel() {
  const { agents, stats, isDispatching, lastResult, loadAgents, loadStats, dispatchTask } = useAgentStore()
  const [taskInput, setTaskInput] = useState('')
  const [mode, setMode] = useState<string>('direct')

  useEffect(() => {
    loadAgents()
    loadStats()
  }, [])

  const handleDispatch = async () => {
    if (!taskInput.trim() || isDispatching) return
    const result = await dispatchTask(taskInput.trim(), mode)
    if (result) {
      setTaskInput('')
    }
  }

  return (
    <div className="agent-panel" style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>
          Agent 编排
        </h3>
        {stats && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: 'var(--text-dim)' }}>
            <span>Agent: {stats.total_agents}</span>
            <span>调度: {stats.total_dispatches}</span>
            <span>成功率: {(stats.success_rate * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* Task Input */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '12px',
            }}
          >
            <option value="direct">直连</option>
            <option value="chain">链式</option>
            <option value="parallel">并行</option>
            <option value="hybrid">混合</option>
          </select>
          <input
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDispatch()}
            placeholder="输入任务描述..."
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '12px',
            }}
          />
          <button
            onClick={handleDispatch}
            disabled={isDispatching || !taskInput.trim()}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: isDispatching ? 'var(--dim)' : 'var(--accent)',
              color: '#fff',
              cursor: isDispatching ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {isDispatching ? '执行中...' : '调度'}
          </button>
        </div>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          borderRadius: '8px',
          background: lastResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${lastResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          fontSize: '12px',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text)' }}>
            {lastResult.success ? '✅ 调度成功' : '❌ 调度失败'}
          </div>
          <div style={{ color: 'var(--text-dim)', marginBottom: '4px' }}>
            Agent: {lastResult.agent_id} | 耗时: {lastResult.duration}ms
          </div>
          <div style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
            {lastResult.result}
          </div>
        </div>
      )}

      {/* Agent Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
        {agents.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-dim)', padding: '32px' }}>
            暂无 Agent 数据
          </div>
        )}
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  const categoryColors: Record<string, string> = {
    research: '#3b82f6',
    coding: '#8b5cf6',
    writing: '#ec4899',
    academic: '#06b6d4',
    life: '#22c55e',
    memory: '#f59e0b',
    legal: '#ef4444',
    finance: '#10b981',
    marketing: '#f97316',
    data: '#6366f1',
  }

  return (
    <div style={{
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      background: 'var(--bg-elevated)',
      cursor: 'default',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: categoryColors[agent.category] || 'var(--accent)',
        }} />
        <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>
          {agent.name}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: '1.4' }}>
        {agent.description}
      </div>
      {agent.call_count !== undefined && (
        <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-dim)' }}>
          调用 {agent.call_count} 次
        </div>
      )}
    </div>
  )
}
