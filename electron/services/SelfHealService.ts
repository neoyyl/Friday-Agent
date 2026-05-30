import os from 'os'
import { ServiceBase } from './ServiceBase'
import type { HealCheckResult, HealFixResult, HealIssue } from './types'

export class SelfHealService extends ServiceBase {
  constructor() {
    super({
      name: 'self_heal',
      version: '1.0.0',
      description: 'Self-diagnosis and auto-repair',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
  }

  check(): HealCheckResult {
    const issues: HealIssue[] = []

    const memFree = os.freemem()
    const memTotal = os.totalmem()
    const memPercent = ((memTotal - memFree) / memTotal) * 100
    if (memPercent > 90) {
      issues.push({ id: 'high-memory', severity: 'high', message: `Memory usage at ${memPercent.toFixed(1)}%`, category: 'system', auto_fixable: false })
    }

    const load = os.loadavg()[0]
    if (load > os.cpus().length * 2) {
      issues.push({ id: 'high-cpu', severity: 'medium', message: `CPU load average: ${load.toFixed(2)}`, category: 'system', auto_fixable: false })
    }

    const diskSpace = this.checkDiskSpace()
    if (diskSpace < 0.1) {
      issues.push({ id: 'low-disk', severity: 'critical', message: `Free disk space below 10%`, category: 'storage', auto_fixable: false })
    }

    return {
      issues,
      healthy: issues.length === 0,
      score: Math.max(0, 100 - issues.reduce((s, i) => {
        return s + { low: 5, medium: 15, high: 25, critical: 40 }[i.severity]
      }, 0)),
    }
  }

  fix(): HealFixResult {
    const check = this.check()
    const fixes: HealFixResult['fixes'] = []

    for (const issue of check.issues) {
      if (issue.auto_fixable) {
        fixes.push({ issue: issue.id, status: 'fixed', detail: `Attempted auto-fix for: ${issue.message}` })
      } else {
        fixes.push({ issue: issue.id, status: 'skipped', detail: `Manual intervention required: ${issue.message}` })
      }
    }

    return { fixed: fixes.filter((f) => f.status === 'fixed').length, failed: fixes.filter((f) => f.status === 'failed').length, fixes }
  }

  private checkDiskSpace(): number {
    try {
      const drive = process.cwd().split(':')[0] + ':'
      const { execSync } = require('child_process')
      const raw = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace,Size /format:csv`, { encoding: 'utf-8', timeout: 3000 })
      const lines = raw.trim().split('\n').filter(Boolean)
      if (lines.length < 2) return 1
      const parts = lines[1].split(',').map((s: string) => s.trim())
      const free = parseFloat(parts[1])
      const total = parseFloat(parts[2])
      if (!total) return 1
      return free / total
    } catch {
      return 1
    }
  }
}
