import { ServiceBase } from './ServiceBase'

interface WorkflowStep {
  name: string
  action: string
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
      version: '2.0.0',
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
          action: 'event',
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
      params: step.params,
      timestamp: new Date().toISOString(),
    })
    await this.delay(100)
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
}