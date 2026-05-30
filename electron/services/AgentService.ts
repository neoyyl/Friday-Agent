import { ServiceBase } from './ServiceBase'

interface AgentRecord {
  id: string
  name: string
  description: string
  capabilities: string[]
  enabled: boolean
  call_count: number
}

interface DispatchRecord {
  id: string
  agent_id: string
  task: string
  mode: string
  result: string
  status: string
  timestamp: string
}

export class AgentService extends ServiceBase {
  private agents: AgentRecord[] = []
  private dispatchHistory: DispatchRecord[] = []

  constructor() {
    super({
      name: 'agents',
      version: '1.0.0',
      description: 'Agent registry & orchestration',
    })
  }

  async init(): Promise<void> {
    this.agents = [
      { id: 'assistant', name: 'General Assistant', description: 'General-purpose AI assistant', capabilities: ['chat', 'reasoning'], enabled: true, call_count: 0 },
      { id: 'coder', name: 'Coder Agent', description: 'Code generation & analysis', capabilities: ['code', 'debug'], enabled: true, call_count: 0 },
      { id: 'researcher', name: 'Research Agent', description: 'Web research & analysis', capabilities: ['search', 'summarize'], enabled: true, call_count: 0 },
    ]
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
  }

  list(): { agents: AgentRecord[] } {
    return { agents: this.agents }
  }

  getStats(): { total: number; active: number } {
    return {
      total: this.agents.length,
      active: this.agents.filter((a) => a.enabled).length,
    }
  }

  async dispatch(task: string, mode: string, _options?: Record<string, unknown>): Promise<{ agent_id: string; result: string }> {
    const agent = this.agents.find((a) => a.enabled)
    if (!agent) throw new Error('No available agents')
    agent.call_count++

    const record: DispatchRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agent_id: agent.id,
      task,
      mode,
      result: `Dispatched to ${agent.name}`,
      status: 'completed',
      timestamp: new Date().toISOString(),
    }
    this.dispatchHistory.unshift(record)

    return { agent_id: agent.id, result: record.result }
  }

  getHistory(): { history: DispatchRecord[] } {
    return { history: this.dispatchHistory.slice(0, 50) }
  }
}
