import { ServiceBase } from './ServiceBase'

export class HealthService extends ServiceBase {
  private startTime = Date.now()

  constructor() {
    super({
      name: 'health',
      version: '1.0.0',
      description: 'Health check & status',
    })
  }

  async init(): Promise<void> {
    this.startTime = Date.now()
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
  }

  check(): { status: string; service: string; uptime: number; version: string } {
    return {
      status: 'ok',
      service: 'friday-backend',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.manifest.version,
    }
  }

  hello(): { message: string; version: string } {
    return {
      message: 'Friday Backend is ready',
      version: this.manifest.version,
    }
  }
}
