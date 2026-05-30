import { AppEventBus } from './EventBus'
import type { ServiceManifest, ServiceStatus } from './types'

export abstract class ServiceBase {
  protected eventBus: AppEventBus
  protected ready = false
  protected error: string | null = null

  constructor(protected manifest: ServiceManifest) {
    this.eventBus = AppEventBus.getInstance()
  }

  abstract init(): Promise<void>
  abstract shutdown(): Promise<void>

  get name(): string {
    return this.manifest.name
  }

  get isReady(): boolean {
    return this.ready
  }

  getStatus(): ServiceStatus {
    return {
      name: this.manifest.name,
      ready: this.ready,
      error: this.error ?? undefined,
    }
  }

  getManifest(): ServiceManifest {
    return this.manifest
  }

  protected emit(event: string, data: unknown): void {
    this.eventBus.emitEvent(event, data)
  }

  protected setReady(): void {
    this.ready = true
    this.error = null
  }

  protected setError(err: string): void {
    this.ready = false
    this.error = err
  }
}
