import { ServiceBase } from './ServiceBase'
import { EventEmitter } from 'events'
import { executeTool } from '../../src/services/tools'
import { createLLMClient } from '../../src/services/llm/clients'
import { getSettings } from '../../src/services/database/index'

const AGENT_PROMPTS_MODULE: Record<string, string> = {
  chat: `你是一个友善、有用的 AI 助手 named Friday。你的目标是：
1. 理解用户的问题和需求
2. 提供准确、有帮助的回答
3. 保持对话简洁明了
4. 如果不确定，诚实告知用户`,

  code: `你是一个专业的代码助手，擅长：
1. 生成高质量代码（Python, JavaScript, TypeScript, Go 等）
2. 代码审查和优化建议
3. Bug 定位和修复方案
4. 解释代码逻辑和架构
回复格式：以代码为主，附上简要说明。`,

  research: `你是一个研究助手，擅长：
1. 信息搜索和整理
2. 摘要和要点提取
3. 对比分析和总结
4. 提供信息来源
回复格式：结构化输出，包含要点和来源。`,

  plan: `你是一个任务规划专家，擅长：
1. 理解复杂任务需求
2. 将任务分解为可执行的子任务
3. 确定任务依赖和执行顺序
4. 预估时间和资源需求
回复格式：分步骤列出，每个步骤有明确的输入输出。`
}

enum AgentErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',
  TIMEOUT = 'TIMEOUT',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN'
}

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
  readonly AGENT_PROMPTS: Record<string, string>

  constructor() {
    super({
      name: 'agents',
      version: '2.0.0',
      description: 'Agent registry & orchestration',
    })
    this.AGENT_PROMPTS = AGENT_PROMPTS_MODULE
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

  async dispatch(task: string, mode: string, options?: { enableTools?: boolean }): Promise<{ agent_id: string; result: string }> {
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
      const result = await this.executeWithAgent(agent, task, mode, options)
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

  private async executeWithAgent(agent: AgentRecord, task: string, mode: string, options?: { enableTools?: boolean }): Promise<string> {
    if (options?.enableTools) {
      try {
        const toolResult = await this.executeTool(task, mode)
        if (!toolResult.includes('工具执行失败')) {
          return toolResult
        }
      } catch (e) {
        // 工具失败，回退到 LLM
      }
    }

    switch (agent.id) {
      case 'planner':
        return await this.callLLM(task, 'plan')
      case 'coder':
        return await this.callLLM(task, 'code')
      case 'researcher':
        return await this.callLLM(task, 'research')
      default:
        return await this.callLLM(task, 'chat')
    }
  }

  private async executeTool(task: string, mode: string): Promise<string> {
    // 根据模式和任务内容智能选择工具
    let toolId = ''
    let toolParams: Record<string, any> = {}

    if (mode === 'research' && task.toLowerCase().includes('search')) {
      toolId = 'web-search'
      toolParams = { query: task }
    } else if (mode === 'code') {
      // 支持代码执行
      toolId = 'code-executor'
      // 尝试从任务中提取代码
      toolParams = { language: 'javascript', code: task }
    } else {
      // 默认直接调用 LLM
      return await this.callLLM(task, mode)
    }

    const result = await executeTool(toolId, toolParams)
    if (result.success) {
      return `工具执行结果:\n${result.output || '执行成功'}`
    } else {
      return `工具执行失败: ${result.error}`
    }
  }

  private getSystemPromptForMode(mode: string): string {
    return this.AGENT_PROMPTS[mode] || this.AGENT_PROMPTS['chat']
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

  private classifyError(error: Error): AgentErrorType {
    const message = error.message.toLowerCase()
    if (message.includes('api key') || message.includes('auth') || message.includes('认证')) {
      return AgentErrorType.API_KEY_MISSING
    }
    if (message.includes('timeout') || message.includes('timed out') || message.includes('超时')) {
      return AgentErrorType.TIMEOUT
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connection') || message.includes('网络')) {
      return AgentErrorType.NETWORK
    }
    return AgentErrorType.UNKNOWN
  }

  private getErrorMessage(errorType: AgentErrorType): string {
    switch (errorType) {
      case AgentErrorType.API_KEY_MISSING:
        return '错误：请先在设置中配置 API Key'
      case AgentErrorType.TIMEOUT:
        return '错误：请求超时，请重试'
      case AgentErrorType.NETWORK:
        return '错误：网络连接失败，请检查网络'
      default:
        return '错误：LLM 调用失败'
    }
  }

  private async callLLM(task: string, mode: string): Promise<string> {
    const systemPrompt = this.getSystemPromptForMode(mode)
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task }
    ]

    try {
      const response = await this.invokeLLM(messages)
      return response.content || 'LLM 返回为空'
    } catch (error) {
      console.error('[AgentService] LLM call failed:', error)
      if (error instanceof Error) {
        const errorType = this.classifyError(error)
        return this.getErrorMessage(errorType)
      }
      return '错误：LLM 调用失败，请检查网络连接'
    }
  }

  private async invokeLLM(messages: Array<{ role: string; content: string }>): Promise<{ content: string }> {
    const settings = getSettings()
    const apiKey = settings.apiKey
    const provider = settings.provider || 'openai'
    const model = settings.model || 'gpt-4o'
    const temperature = parseFloat(settings.temperature) || 0.7
    
    if (!apiKey) {
      throw new Error('API key not configured')
    }
    
    const baseUrl = this.getProviderBaseUrl(provider)
    const client = createLLMClient(provider, apiKey, baseUrl)
    
    const response = await client.chat(
      messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
      { model, temperature, maxTokens: 4096 }
    )
    
    return {
      content: response.choices[0]?.message?.content || ''
    }
  }

  private getProviderBaseUrl(provider: string): string | undefined {
    const baseUrls: Record<string, string> = {
      'openai': 'https://api.openai.com/v1',
      'anthropic': 'https://api.anthropic.com',
      'google': 'https://generativelanguage.googleapis.com',
      'deepseek': 'https://api.deepseek.com/v1',
      'moonshot': 'https://api.moonshot.cn/v1',
    }
    return baseUrls[provider]
  }
}
