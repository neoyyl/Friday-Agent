import { ServiceBase } from './ServiceBase'
import type { TimingReadiness } from './types'

export class TimingService extends ServiceBase {
  private readyTime: number | null = null

  constructor() {
    super({
      name: 'timing',
      version: '1.0.0',
      description: 'Timing & readiness utility',
    })
  }

  async init(): Promise<void> {
    this.readyTime = Date.now()
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
  }

  getReadiness(): TimingReadiness {
    const uptime = this.readyTime ? (Date.now() - this.readyTime) / 1000 : 0
    return {
      ready: uptime > 5,
      reason: uptime <= 5 ? 'System still warming up' : undefined,
    }
  }

  shouldNotify(data: { last_notified?: string; interval_hours?: number }): boolean {
    if (!data.last_notified) return true
    const interval = (data.interval_hours || 4) * 60 * 60 * 1000
    const last = new Date(data.last_notified).getTime()
    return Date.now() - last > interval
  }
}
