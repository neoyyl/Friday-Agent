import { ServiceBase } from './ServiceBase'

interface WorkflowDef {
  id: string
  name: string
  description?: string
  steps: number
  created_at: string
}

interface WorkflowInstance {
  id: string
  workflow_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string
  finished_at?: string
  current_step?: number
}

export class WorkflowService extends ServiceBase {
  private workflows: WorkflowDef[] = []
  private instances: WorkflowInstance[] = []

  constructor() {
    super({
      name: 'workflows',
      version: '1.0.0',
      description: 'Multi-step workflow orchestration',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.workflows = []
    this.instances = []
    this.ready = false
  }

  list(): { workflows: WorkflowDef[] } {
    return { workflows: [...this.workflows] }
  }

  create(workflow: Partial<WorkflowDef>): WorkflowDef {
    const newWf: WorkflowDef = {
      id: workflow.id || `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: workflow.name || 'untitled',
      description: workflow.description,
      steps: workflow.steps || 0,
      created_at: new Date().toISOString(),
    }
    this.workflows.push(newWf)
    this.emit('workflows.updated', { workflows: this.workflows })
    return newWf
  }

  run(id: string): { success: boolean; instance_id: string } {
    const wf = this.workflows.find((w) => w.id === id)
    if (!wf) throw new Error(`Workflow not found: ${id}`)
    const instance: WorkflowInstance = {
      id: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workflow_id: id,
      status: 'running',
      started_at: new Date().toISOString(),
      current_step: 0,
    }
    this.instances.unshift(instance)
    setTimeout(() => {
      instance.status = 'completed'
      instance.finished_at = new Date().toISOString()
      this.emit('workflow.event', { id: instance.id, status: 'completed' })
    }, 500)
    return { success: true, instance_id: instance.id }
  }

  getInstances(): { instances: WorkflowInstance[] } {
    return { instances: [...this.instances] }
  }
}
