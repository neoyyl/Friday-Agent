import { ServiceBase } from './ServiceBase'

interface SchedulerJob {
  id: string
  name: string
  cron: string
  action: string
  enabled: boolean
  created_at: string
  last_run?: string
  last_status?: string
}

export class SchedulerService extends ServiceBase {
  private jobs: SchedulerJob[] = []
  private timers = new Map<string, ReturnType<typeof setInterval>>()

  constructor() {
    super({
      name: 'scheduler',
      version: '1.0.0',
      description: 'Cron-like job scheduler',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    for (const timer of this.timers.values()) clearInterval(timer)
    this.timers.clear()
    this.ready = false
  }

  queryStatus(): { running: boolean; jobs: number } {
    return { running: this.timers.size > 0, jobs: this.jobs.length }
  }

  getJobs(): { jobs: SchedulerJob[] } {
    return { jobs: this.jobs.map((j) => ({ ...j })) }
  }

  create(job: Partial<SchedulerJob>): SchedulerJob {
    const newJob: SchedulerJob = {
      id: job.id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: job.name || 'untitled',
      cron: job.cron || '0 * * * *',
      action: job.action || '',
      enabled: job.enabled ?? true,
      created_at: new Date().toISOString(),
    }
    this.jobs.push(newJob)
    this.emit('scheduler.jobs', { jobs: this.jobs })
    return newJob
  }

  delete(id: string): { success: boolean } {
    const idx = this.jobs.findIndex((j) => j.id === id)
    if (idx === -1) return { success: false }
    this.jobs.splice(idx, 1)
    const timer = this.timers.get(id)
    if (timer) { clearInterval(timer); this.timers.delete(id) }
    this.emit('scheduler.jobs', { jobs: this.jobs })
    return { success: true }
  }

  toggle(id: string): SchedulerJob | null {
    const job = this.jobs.find((j) => j.id === id)
    if (!job) return null
    job.enabled = !job.enabled
    this.emit('scheduler.jobs', { jobs: this.jobs })
    return { ...job }
  }

  runAction(name: string): { success: boolean } {
    console.log(`[SchedulerService] Running action: ${name}`)
    return { success: true }
  }
}
