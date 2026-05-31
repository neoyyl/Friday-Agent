import { ServiceBase } from './ServiceBase'
import { EventEmitter } from 'events'

interface AgentRecord {
  id: string
  name: string
  description: string
  capabilities: string[]
  enabled: boolean
  call_count: number
  status: 'idle' | 'running' | 'error'
  lastActivity?: string
}

interface DispatchRecord {
  id: string
  agent_id: string
  task: string
  mode: string
  result: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  timestamp: string
  completed_at?: string
}

export class AgentService extends ServiceBase {
  private agents: AgentRecord[] = []
  private dispatchHistory: DispatchRecord[] = []
  private emitter = new EventEmitter()

  constructor() {
    super({
      name: 'agents',
      version: '2.0.0',
      description: 'Agent registry & orchestration',
    })
  }

  async init(): Promise<void> {
    this.agents = [
      { id: 'assistant', name: 'General Assistant', description: '通用 AI 助手', capabilities: ['chat', 'reasoning'], enabled: true, call_count: 0, status: 'idle' },
      { id: 'coder', name: 'Coder Agent', description: '代码生成与分析', capabilities: ['code', 'debug'], enabled: true, call_count: 0, status: 'idle' },
      { id: 'researcher', name: 'Research Agent', description: '网络搜索与信息分析', capabilities: ['search', 'summarize'], enabled: true, call_count: 0, status: 'idle' },
      { id: 'planner', name: 'Planner Agent', description: '任务规划与分解', capabilities: ['plan', 'coordinate'], enabled: true, call_count: 0, status: 'idle' },
    ]
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.emitter.removeAllListeners()
    this.ready = false
  }

  list(): { agents: AgentRecord[] } {
    return { agents: this.agents }
  }

  getStats(): { total: number; active: number; idle: number; running: number } {
    return {
      total: this.agents.length,
      active: this.agents.filter((a) => a.enabled).length,
      idle: this.agents.filter((a) => a.status === 'idle').length,
      running: this.agents.filter((a) => a.status === 'running').length,
    }
  }

  async dispatch(task: string, mode: string, _options?: Record<string, unknown>): Promise<{ agent_id: string; result: string }> {
    const agent = this.agents.find((a) => a.enabled && a.status === 'idle')
    if (!agent) throw new Error('No available agents')

    const record: DispatchRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agent_id: agent.id,
      task,
      mode,
      result: '',
      status: 'running',
      timestamp: new Date().toISOString(),
    }
    this.dispatchHistory.unshift(record)

    agent.status = 'running'
    agent.lastActivity = record.timestamp
    this.emitter.emit('agent:status', { agentId: agent.id, status: 'running' })

    try {
      const result = await this.executeWithAgent(agent, task, mode)
      record.status = 'completed'
      record.result = result
      record.completed_at = new Date().toISOString()
      agent.status = 'idle'
      agent.call_count++
      agent.lastActivity = record.completed_at
      this.emitter.emit('agent:status', { agentId: agent.id, status: 'idle' })
      return { agent_id: agent.id, result }
    } catch (err) {
      record.status = 'failed'
      record.result = err instanceof Error ? err.message : 'Dispatch failed'
      record.completed_at = new Date().toISOString()
      agent.status = 'error'
      agent.lastActivity = record.completed_at
      this.emitter.emit('agent:status', { agentId: agent.id, status: 'error' })
      return { agent_id: agent.id, result: record.result }
    }
  }

  private async executeWithAgent(agent: AgentRecord, task: string, mode: string): Promise<string> {
    switch (agent.id) {
      case 'planner':
        return `任务已分解为多个子任务: 1) 分析需求 2) 收集信息 3) 执行操作 4) 汇总结果。原始任务: ${task}`
      case 'coder':
        return `代码代理已接收任务: ${task}。模式: ${mode}。分析代码结构并生成解决方案。`
      case 'researcher':
        return `研究代理正在搜索: ${task}。收集相关信息并整理摘要。`
      default:
        return `${agent.name} 已处理任务: ${task} (模式: ${mode})`
    }
  }

  onStatusChange(listener: (data: { agentId: string; status: string }) => void): () => void {
    this.emitter.on('agent:status', listener)
    return () => this.emitter.off('agent:status', listener)
  }

  getHistory(): { history: DispatchRecord[] } {
    return { history: this.dispatchHistory.slice(0, 50) }
  }

  cancelDispatch(dispatchId: string): boolean {
    const record = this.dispatchHistory.find((r) => r.id === dispatchId)
    if (!record || record.status !== 'running') return false
    record.status = 'failed'
    record.result = 'Cancelled by user'
    record.completed_at = new Date().toISOString()
    const agent = this.agents.find((a) => a.id === record.agent_id)
    if (agent) {
      agent.status = 'idle'
      this.emitter.emit('agent:status', { agentId: agent.id, status: 'idle' })
    }
    return true
  }
}
