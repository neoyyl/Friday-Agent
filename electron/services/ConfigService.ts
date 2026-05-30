import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { ServiceBase } from './ServiceBase'

export class ConfigService extends ServiceBase {
  private configPath: string
  private config: Record<string, unknown> = {}

  constructor() {
    super({
      name: 'config',
      version: '1.0.0',
      description: 'Application configuration management',
    })
    this.configPath = path.join(app.getPath('userData'), 'friday_config.json')
  }

  async init(): Promise<void> {
    this.load()
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.save()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8')
        this.config = JSON.parse(raw)
      }
    } catch (err) {
      console.error('[ConfigService] Failed to load config:', err)
      this.config = {}
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch (err) {
      console.error('[ConfigService] Failed to save config:', err)
    }
  }

  get(): Record<string, unknown> {
    return { ...this.config }
  }

  update(updates: Record<string, unknown>): Record<string, unknown> {
    Object.assign(this.config, updates)
    this.save()
    this.emit('config.updated', this.config)
    return this.get()
  }

  getKey(key: string): unknown {
    return this.config[key]
  }

  setKey(key: string, value: unknown): void {
    this.config[key] = value
    this.save()
  }
}
