import { ServiceBase } from './ServiceBase'
import { ServiceRegistry } from './ServiceRegistry'
import { workflowPresets, WorkflowPreset } from './WorkflowPresets'
import { executeTool } from '../../src/services/tools'

interface WorkflowStep {
  name: string
  action: 'tool' | 'skill' | 'agent' | 'event'
  target_id?: string
  params?: Record<string, unknown>
}

interface WorkflowDef {
  id: string
  name: string
  description?: string
  steps: WorkflowStep[]
  created_at: string
}

interface WorkflowInstance {
  id: string
  workflow_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  finished_at?: string
  current_step: number
  total_steps: number
  results: Array<{ step: string; success: boolean; error?: string }>
}

export class WorkflowService extends ServiceBase {
  private workflows: WorkflowDef[] = []
  private instances: WorkflowInstance[] = []
  private running = new Set<string>()

  constructor() {
    super({
      name: 'workflows',
      version: '2.1.0',
      description: 'Multi-step workflow orchestration with real execution',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    for (const id of this.running) this.cancelInternal(id)
    this.workflows = []
    this.instances = []
    this.ready = false
  }

  list(): { workflows: WorkflowDef[] } {
    return { workflows: [...this.workflows] }
  }

  create(workflow: Partial<WorkflowDef> & { steps?: WorkflowStep[] | number }): WorkflowDef {
    const steps = typeof workflow.steps === 'number'
      ? Array.from({ length: workflow.steps }, (_, i) => ({
          name: `step${i + 1}`,
          action: 'event' as const,
        }))
      : (workflow.steps || [])
    const newWf: WorkflowDef = {
      id: workflow.id || `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: workflow.name || 'untitled',
      description: workflow.description,
      steps,
      created_at: new Date().toISOString(),
    }
    this.workflows.push(newWf)
    this.emit('workflows.updated', { workflows: this.workflows })
    return newWf
  }

  async run(id: string): Promise<{ success: boolean; instance_id: string }> {
    const wf = this.workflows.find((w) => w.id === id)
    if (!wf) throw new Error(`Workflow not found: ${id}`)
    if (wf.steps.length === 0) throw new Error('Workflow has no steps')

    const instance: WorkflowInstance = {
      id: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workflow_id: id,
      status: 'running',
      started_at: new Date().toISOString(),
      current_step: 0,
      total_steps: wf.steps.length,
      results: [],
    }
    this.instances.unshift(instance)
    this.running.add(instance.id)
    this.emit('workflow.started', { id: instance.id, workflow: wf.name })

    this.executeSteps(instance, wf.steps)
    return { success: true, instance_id: instance.id }
  }

  private async executeSteps(instance: WorkflowInstance, steps: WorkflowStep[]): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      if (!this.running.has(instance.id)) return

      const step = steps[i]
      instance.current_step = i + 1
      this.emit('workflow.step', {
        instance: instance.id,
        step: i + 1,
        total: steps.length,
        name: step.name,
        action: step.action,
      })

      try {
        await this.dispatchStepAction(step)
        instance.results.push({ step: step.name, success: true })
      } catch (err) {
        instance.status = 'failed'
        instance.finished_at = new Date().toISOString()
        instance.results.push({
          step: step.name,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        })
        this.running.delete(instance.id)
        this.emit('workflow.failed', {
          id: instance.id,
          step: step.name,
          error: err instanceof Error ? err.message : String(err),
        })
        return
      }

      await this.delay(200)
    }

    instance.status = 'completed'
    instance.finished_at = new Date().toISOString()
    instance.current_step = steps.length
    this.running.delete(instance.id)
    this.emit('workflow.completed', { id: instance.id, results: instance.results })
  }

  private async dispatchStepAction(step: WorkflowStep): Promise<void> {
    this.emit('workflow.action', {
      name: step.name,
      action: step.action,
      target_id: step.target_id,
      params: step.params,
      timestamp: new Date().toISOString(),
    })

    const params = step.params || {}

    switch (step.action) {
      case 'tool':
        await this.executeToolAction(step.target_id, params)
        break
      case 'skill':
        await this.executeSkillAction(step.target_id, params)
        break
      case 'agent':
        await this.executeAgentAction(step.target_id, params)
        break
      case 'event':
      default:
        await this.delay(100)
        break
    }
  }

  private async executeToolAction(
    toolId: string | undefined,
    params: Record<string, unknown>
  ): Promise<void> {
    if (!toolId) throw new Error('tool id required for tool action')
    const result = await executeTool(toolId, params as any)
    if (!result.success) {
      throw new Error(result.error || 'tool execution failed')
    }
  }

  private async executeSkillAction(
    skillId: string | undefined,
    params: Record<string, unknown>
  ): Promise<void> {
    if (!skillId) throw new Error('skill id required for skill action')
    const registry = ServiceRegistry.getInstance()
    const skillService = registry.get('skills')
    if (skillService) {
      await (skillService as any).call(skillId, params)
    } else {
      throw new Error('SkillService not available')
    }
  }

  private async executeAgentAction(
    agentId: string | undefined,
    params: Record<string, unknown>
  ): Promise<void> {
    if (!agentId) throw new Error('agent id required for agent action')
    const registry = ServiceRegistry.getInstance()
    const agentService = registry.get('agents')
    if (agentService) {
      const task = (params.task as string) || ''
      const mode = (params.mode as string) || 'chat'
      await (agentService as any).dispatch(task, mode)
    } else {
      throw new Error('AgentService not available')
    }
  }

  cancel(id: string): { success: boolean } {
    const instance = this.instances.find((i) => i.id === id)
    if (!instance || instance.status !== 'running') return { success: false }
    this.cancelInternal(id)
    return { success: true }
  }

  private cancelInternal(instanceId: string): void {
    this.running.delete(instanceId)
    const instance = this.instances.find((i) => i.id === instanceId)
    if (instance) {
      instance.status = 'cancelled'
      instance.finished_at = new Date().toISOString()
    }
    this.emit('workflow.cancelled', { id: instanceId })
  }

  getInstances(): { instances: WorkflowInstance[] } {
    return { instances: [...this.instances] }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  listPresets(): { presets: WorkflowPreset[] } {
    return { presets: [...workflowPresets] }
  }

  createFromPreset(presetId: string, params?: Record<string, string>): WorkflowDef {
    const preset = workflowPresets.find(p => p.id === presetId)
    if (!preset) throw new Error(`preset not found: ${presetId}`)

    const steps = preset.steps.map(step => {
      const processedParams = this.interpolateParams(step.params, params || {})
      return { ...step, params: processedParams }
    })

    return this.create({
      name: preset.name,
      description: preset.description,
      steps
    })
  }

  private interpolateParams(
    params: Record<string, unknown> | undefined,
    replacements: Record<string, string>
  ): Record<string, unknown> | undefined {
    if (!params) return undefined
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        let processed = value
        for (const [k, v] of Object.entries(replacements)) {
          processed = processed.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
        }
        result[key] = processed
      } else {
        result[key] = value
      }
    }
    return result
  }
}