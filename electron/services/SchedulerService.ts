import * as nodeCron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { ServiceBase } from './ServiceBase'
import { ServiceRegistry } from './ServiceRegistry'

interface JobAction {
  type: 'agent' | 'workflow' | 'skill' | 'notification'
  target_id?: string
  params?: Record<string, unknown>
}

interface SchedulerJob {
  id: string
  name: string
  cron: string
  action: JobAction | string
  enabled: boolean
  created_at: string
  last_run?: string
  last_status?: string
  run_count: number
}

export class SchedulerService extends ServiceBase {
  private jobs: SchedulerJob[] = []
  private tasks = new Map<string, ScheduledTask>()

  constructor() {
    super({
      name: 'scheduler',
      version: '2.0.0',
      description: 'Cron job scheduler powered by node-cron',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    for (const task of this.tasks.values()) task.stop()
    this.tasks.clear()
    this.ready = false
  }

  queryStatus(): { running: boolean; jobs: number; active_tasks: number } {
    return {
      running: this.tasks.size > 0,
      jobs: this.jobs.length,
      active_tasks: this.tasks.size,
    }
  }

  getJobs(): { jobs: SchedulerJob[] } {
    return { jobs: this.jobs.map((j) => ({ ...j })) }
  }

  create(job: Partial<SchedulerJob> & { action?: string }): SchedulerJob {
    const newJob: SchedulerJob = {
      id: job.id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: job.name || 'untitled',
      cron: job.cron || '0 */2 * * *',
      action: job.action || '',
      enabled: job.enabled ?? true,
      created_at: new Date().toISOString(),
      run_count: 0,
    }
    this.jobs.push(newJob)
    if (newJob.enabled) this.scheduleJob(newJob)
    this.emit('scheduler.jobs', { jobs: this.jobs })
    return newJob
  }

  delete(id: string): { success: boolean } {
    const idx = this.jobs.findIndex((j) => j.id === id)
    if (idx === -1) return { success: false }
    this.jobs.splice(idx, 1)
    this.unscheduleJob(id)
    this.emit('scheduler.jobs', { jobs: this.jobs })
    return { success: true }
  }

  toggle(id: string): SchedulerJob | null {
    const job = this.jobs.find((j) => j.id === id)
    if (!job) return null
    job.enabled = !job.enabled
    if (job.enabled) {
      this.scheduleJob(job)
    } else {
      this.unscheduleJob(job.id)
    }
    this.emit('scheduler.jobs', { jobs: this.jobs })
    return { ...job }
  }

  runAction(name: string): { success: boolean; detail?: string } {
    const job = this.jobs.find((j) => j.name === name || j.id === name)
    if (job) {
      this.executeJob(job)
      return { success: true, detail: `Executed job: ${job.name}` }
    }
    this.emit('scheduler.action', { name, timestamp: new Date().toISOString() })
    return { success: true, detail: `Fired ad-hoc action: ${name}` }
  }

  private validateCron(expression: string): boolean {
    return nodeCron.validate(expression)
  }

  private scheduleJob(job: SchedulerJob): void {
    this.unscheduleJob(job.id)
    if (!this.validateCron(job.cron)) {
      console.warn(`[SchedulerService] Invalid cron expression for job "${job.name}": ${job.cron}`)
      return
    }
    try {
      const task = nodeCron.schedule(job.cron, () => this.executeJob(job), {
        timezone: process.env.TZ || 'Asia/Hong_Kong',
      })
      this.tasks.set(job.id, task)
    } catch (err) {
      console.error(`[SchedulerService] Failed to schedule job "${job.name}":`, err)
    }
  }

  private unscheduleJob(jobId: string): void {
    const task = this.tasks.get(jobId)
    if (task) {
      task.stop()
      this.tasks.delete(jobId)
    }
  }

  private executeJob(job: SchedulerJob): void {
    job.last_run = new Date().toISOString()
    job.run_count++
    this.emit('scheduler.executed', {
      id: job.id,
      name: job.name,
      action: job.action,
      timestamp: job.last_run,
    })
    
    this.executeJobAction(job).catch(err => {
      console.error(`[SchedulerService] executeJobAction error:`, err)
      job.last_status = 'failed'
    })
  }

  private parseAction(action: JobAction | string): JobAction | null {
    if (typeof action === 'string') {
      if (action.startsWith('agent:')) {
        return { type: 'agent', target_id: action.substring(6) }
      }
      if (action.startsWith('workflow:')) {
        return { type: 'workflow', target_id: action.substring(9) }
      }
      if (action.startsWith('skill:')) {
        return { type: 'skill', target_id: action.substring(6) }
      }
      return { type: 'notification', params: { message: action } }
    }
    return action
  }

  private async executeJobAction(job: SchedulerJob): Promise<void> {
    const action = this.parseAction(job.action)
    if (!action) {
      console.warn(`[SchedulerService] No valid action for job: ${job.name}`)
      return
    }

    try {
      switch (action.type) {
        case 'agent':
          await this.executeAgentAction(action)
          break
        case 'workflow':
          await this.executeWorkflowAction(action)
          break
        case 'skill':
          await this.executeSkillAction(action)
          break
        case 'notification':
          await this.executeNotificationAction(action)
          break
        default:
          console.warn(`[SchedulerService] Unknown action type: ${action.type}`)
      }
      job.last_status = 'success'
    } catch (err) {
      console.error(`[SchedulerService] Action execution failed for job ${job.name}:`, err)
      job.last_status = 'failed'
    }
  }

  private async executeAgentAction(action: JobAction): Promise<void> {
    const registry = ServiceRegistry.getInstance()
    const agentService = registry.get('agents')
    if (agentService) {
      const task = (action.params?.task as string) || 'Scheduled task'
      const mode = (action.params?.mode as string) || 'chat'
      await (agentService as any).dispatch(task, mode)
    }
  }

  private async executeWorkflowAction(action: JobAction): Promise<void> {
    const registry = ServiceRegistry.getInstance()
    const workflowService = registry.get('workflows')
    if (workflowService && action.target_id) {
      await (workflowService as any).run(action.target_id)
    }
  }

  private async executeSkillAction(action: JobAction): Promise<void> {
    const registry = ServiceRegistry.getInstance()
    const skillService = registry.get('skills')
    if (skillService && action.target_id) {
      await (skillService as any).call(action.target_id, action.params)
    }
  }

  private async executeNotificationAction(action: JobAction): Promise<void> {
    const registry = ServiceRegistry.getInstance()
    const voiceService = registry.get('voice')
    const message = (action.params?.message as string) || 'Scheduled notification'
    if (voiceService) {
      await (voiceService as any).speak(message)
    }
  }
}