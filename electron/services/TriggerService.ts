import { ServiceBase } from './ServiceBase'

interface Trigger {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
  enabled: boolean
  created_at: string
}

export class TriggerService extends ServiceBase {
  private triggers: Trigger[] = []

  constructor() {
    super({
      name: 'triggers',
      version: '1.0.0',
      description: 'Event-driven trigger engine',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.triggers = []
    this.ready = false
  }

  list(): { triggers: Trigger[] } {
    return { triggers: [...this.triggers] }
  }

  create(trigger: Partial<Trigger>): Trigger {
    const newTrigger: Trigger = {
      id: trigger.id || `trg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trigger.name || 'untitled',
      type: trigger.type || 'manual',
      config: trigger.config || {},
      enabled: trigger.enabled ?? true,
      created_at: new Date().toISOString(),
    }
    this.triggers.push(newTrigger)
    this.emit('triggers.updated', { triggers: this.triggers })
    return newTrigger
  }

  delete(id: string): { success: boolean } {
    const idx = this.triggers.findIndex((t) => t.id === id)
    if (idx === -1) return { success: false }
    this.triggers.splice(idx, 1)
    this.emit('triggers.updated', { triggers: this.triggers })
    return { success: true }
  }

  toggle(id: string): Trigger | null {
    const trigger = this.triggers.find((t) => t.id === id)
    if (!trigger) return null
    trigger.enabled = !trigger.enabled
    this.emit('triggers.updated', { triggers: this.triggers })
    return { ...trigger }
  }

  presets(): Array<{ type: string; name: string; config: Record<string, unknown> }> {
    return [
      { type: 'threshold', name: '磁盘空间不足', config: { field: 'disk_free', operator: '<', value: 20 } },
      { type: 'threshold', name: 'CPU 负载过高', config: { field: 'cpu_load', operator: '>', value: 80 } },
      { type: 'cron', name: '每日报告', config: { schedule: '0 9 * * *', action: 'daily_report' } },
    ]
  }
}
