import os from 'os'
import { execSync } from 'child_process'
import path from 'path'
import { ServiceBase } from './ServiceBase'
import type { PerceptionData } from './types'

export class PerceptionService extends ServiceBase {
  private projectRoot = ''

  constructor() {
    super({
      name: 'perception',
      version: '1.0.0',
      description: 'System & project perception monitoring',
    })
  }

  async init(): Promise<void> {
    this.projectRoot = process.env.APP_ROOT || ''
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
  }

  getWindowContext(): { title: string; platform: string; memory: { total: number; free: number } } {
    return {
      title: 'Friday Agent',
      platform: os.platform(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
      },
    }
  }

  getGitContext(): PerceptionData['git'] | null {
    if (!this.projectRoot) return null
    try {
      const root = this.findGitRoot(this.projectRoot)
      if (!root) return null
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf-8', timeout: 3000 }).trim()
      const logRaw = execSync('git log --oneline -5 --format="%h|%s|%an|%ai"', { cwd: root, encoding: 'utf-8', timeout: 3000 }).trim()
      const dirty = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8', timeout: 3000 }).trim().length > 0
      const recent_commits = logRaw.split('\n').filter(Boolean).map((line) => {
        const [hash, ...rest] = line.split('|')
        return { hash, message: rest.slice(0, -2).join('|'), author: rest[rest.length - 2] || '', date: rest[rest.length - 1] || '' }
      })
      return { branch, recent_commits, dirty }
    } catch {
      return null
    }
  }

  getProjectContext(): PerceptionData['project'] | null {
    if (!this.projectRoot) return null
    return { name: path.basename(this.projectRoot), path: this.projectRoot }
  }

  getFullContext(): PerceptionData {
    return {
      os: {
        platform: os.platform(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
        },
        cpu: {
          load: os.loadavg()[0],
          cores: os.cpus().length,
        },
      },
      git: this.getGitContext() ?? undefined,
      project: this.getProjectContext() ?? undefined,
    }
  }

  private findGitRoot(dir: string): string | null {
    try {
      const result = execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf-8', timeout: 3000 }).trim()
      return result || null
    } catch {
      return null
    }
  }
}
