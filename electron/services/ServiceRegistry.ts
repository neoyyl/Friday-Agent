import { AppEventBus } from './EventBus'
import { ServiceBase } from './ServiceBase'
import { PerceptionService } from './PerceptionService'
import { GPUService } from './GPUService'
import { ObsidianService } from './ObsidianService'
import { MemoryService } from './MemoryService'
import { ExecutionLogService } from './ExecutionLogService'
import { ConfigService } from './ConfigService'
import { TimingService } from './TimingService'
import { SelfHealService } from './SelfHealService'
import { DispatchLogService } from './DispatchLogService'
import { PersonalityService } from './PersonalityService'
import { HealthService } from './HealthService'
import { AgentService } from './AgentService'
import { SkillService } from './SkillService'
import { SchedulerService } from './SchedulerService'
import { TriggerService } from './TriggerService'
import { WorkflowService } from './WorkflowService'
import { EmotionService } from './EmotionService'
import { VoiceService } from './VoiceService'

export class ServiceRegistry {
  private services = new Map<string, ServiceBase>()
  private eventBus = AppEventBus.getInstance()

  async initAll(): Promise<void> {
    const allServices: ServiceBase[] = [
      new HealthService(),
      new ConfigService(),
      new PerceptionService(),
      new GPUService(),
      new ObsidianService(),
      new MemoryService(),
      new ExecutionLogService(),
      new DispatchLogService(),
      new TimingService(),
      new SelfHealService(),
      new PersonalityService(),
      new AgentService(),
      new SkillService(),
      new SchedulerService(),
      new TriggerService(),
      new WorkflowService(),
      new EmotionService(),
      new VoiceService(),
    ]

    for (const svc of allServices) {
      this.services.set(svc.name, svc)
    }

    const results = await Promise.allSettled(
      allServices.map((svc) => svc.init().catch((err) => {
        console.error(`[ServiceRegistry] ${svc.name} init failed:`, err)
        svc['setError'](err.message)
      }))
    )

    const loaded = results.filter((r) => r.status === 'fulfilled').length
    console.log(`[ServiceRegistry] Initialized ${loaded}/${allServices.length} services`)
  }

  async shutdownAll(): Promise<void> {
    for (const svc of this.services.values()) {
      try { await svc.shutdown() } catch (err) {
        console.error(`[ServiceRegistry] ${svc.name} shutdown error:`, err)
      }
    }
    this.services.clear()
  }

  get<T extends ServiceBase>(name: string): T | undefined {
    return this.services.get(name) as T | undefined
  }

  getAll(): ServiceBase[] {
    return Array.from(this.services.values())
  }

  getAllStatus(): Array<{ name: string; ready: boolean; error?: string }> {
    return this.getAll().map((s) => s.getStatus())
  }

  getEventBus(): AppEventBus {
    return this.eventBus
  }
}
