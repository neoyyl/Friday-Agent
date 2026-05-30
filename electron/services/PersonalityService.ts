import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { ServiceBase } from './ServiceBase'
import type { PersonalityResult } from './types'

export class PersonalityService extends ServiceBase {
  constructor() {
    super({
      name: 'personality',
      version: '1.0.0',
      description: 'Personality & character definition',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
  }

  get(): PersonalityResult {
    const paths = [
      path.join(app.getPath('userData'), 'friday_memory.md'),
      path.join(process.env.APP_ROOT || '', 'friday_memory.md'),
    ]
    for (const p of paths) {
      try {
        if (fs.existsSync(p)) {
          return { content: fs.readFileSync(p, 'utf-8') }
        }
      } catch { /* skip */ }
    }
    return { content: 'You are Friday, a personal AI assistant.' }
  }
}
