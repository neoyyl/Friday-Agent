import { ServiceBase } from './ServiceBase'
import { AppEventBus } from './EventBus'

interface Trigger {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
  enabled: boolean
  created_at: string
  fired_count: number
  last_fired?: string
}

interface TriggerAction {
  name: string
  handler: (event: string, data: unknown) => void
}

export class TriggerService extends ServiceBase {
  private triggers: Trigger[] = []
  private actions = new Map<string, TriggerAction[]>()
  private unsubEventBus: (() => void) | null = null

  constructor() {
    super({
      name: 'triggers',
      version: '2.0.0',
      description: 'Event-driven trigger engine with EventBus subscription',
    })
  }

  async init(): Promise<void> {
    this.unsubEventBus = AppEventBus.getInstance().onEvent((event: string, data: unknown) => {
      this.evaluateTriggers(event, data)
    })
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.unsubEventBus?.()
    this.unsubEventBus = null
    this.triggers = []
    this.actions.clear()
    this.ready = false
  }

  list(): { triggers: Trigger[] } {
    return { triggers: this.triggers.map((t) => ({ ...t })) }
  }

  create(trigger: Partial<Trigger>): Trigger {
    const newTrigger: Trigger = {
      id: trigger.id || `trg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trigger.name || 'untitled',
      type: trigger.type || 'manual',
      config: trigger.config || {},
      enabled: trigger.enabled ?? true,
      created_at: new Date().toISOString(),
      fired_count: 0,
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
      { type: 'event', name: 'GPU 温度告警', config: { event: 'gpu.status', field: 'level', operator: 'in', value: ['orange', 'red'] } },
      { type: 'event', name: '自愈检测告警', config: { event: 'scheduler.health_report', field: 'healthy', operator: '=', value: false } },
    ]
  }

  onAction(name: string, handler: (event: string, data: unknown) => void): () => void {
    const entry: TriggerAction = { name, handler }
    const existing = this.actions.get(name) || []
    existing.push(entry)
    this.actions.set(name, existing)
    return () => {
      const list = this.actions.get(name) || []
      const idx = list.indexOf(entry)
      if (idx !== -1) list.splice(idx, 1)
    }
  }

  private evaluateTriggers(event: string, data: unknown): void {
    for (const trigger of this.triggers) {
      if (!trigger.enabled) continue
      if (this.matchTrigger(trigger, event, data)) {
        this.fireTrigger(trigger, event, data)
      }
    }
  }

  private matchTrigger(trigger: Trigger, event: string, data: unknown): boolean {
    const cfg = trigger.config as Record<string, unknown>
    const triggerType = trigger.type

    if (triggerType === 'event') {
      const expectedEvent = cfg.event as string
      if (expectedEvent && !this.matchGlob(event, expectedEvent)) return false

      const field = cfg.field as string
      const operator = cfg.operator as string
      const expectedValue = cfg.value

      if (field && operator && expectedValue !== undefined && data && typeof data === 'object') {
        const actual = (data as Record<string, unknown>)[field]
        return this.compareValues(actual, operator, expectedValue)
      }
      return true
    }

    console.warn(`[TriggerService] Unknown trigger type: ${triggerType}`)
    return false
  }

  private matchGlob(event: string, pattern: string): boolean {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    return new RegExp(`^${escaped}$`).test(event)
  }

  private compareValues(actual: unknown, operator: string, expected: unknown): boolean {
    if (actual === undefined || actual === null) return false

    switch (operator) {
      case '=': case '==': return String(actual) === String(expected)
      case '!=': return String(actual) !== String(expected)
      case '>': return Number(actual) > Number(expected)
      case '<': return Number(actual) < Number(expected)
      case '>=': return Number(actual) >= Number(expected)
      case '<=': return Number(actual) <= Number(expected)
      case 'in': return Array.isArray(expected) && expected.map(String).includes(String(actual))
      case 'contains': return String(actual).includes(String(expected))
      default: return false
    }
  }

  private fireTrigger(trigger: Trigger, event: string, data: unknown): void {
    trigger.fired_count++
    trigger.last_fired = new Date().toISOString()

    this.emit('trigger.fired', {
      id: trigger.id,
      name: trigger.name,
      event,
      count: trigger.fired_count,
      timestamp: trigger.last_fired,
    })

    const handlers = this.actions.get(trigger.name)
    if (handlers) {
      for (const h of handlers) {
        try { h.handler(event, data) } catch (err) {
          console.error(`[TriggerService] Action "${trigger.name}" handler error:`, err)
        }
      }
    }
  }
}