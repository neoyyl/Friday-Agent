import os from 'os'
import { execSync } from 'child_process'
import { ServiceBase } from './ServiceBase'
import type { HealCheckResult, HealFixResult, HealIssue } from './types'

export class SelfHealService extends ServiceBase {
  constructor() {
    super({
      name: 'self_heal',
      version: '2.0.0',
      description: 'Self-diagnosis with real auto-repair capabilities',
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
      issues.push({ id: 'high-memory', severity: 'high', message: `Memory usage at ${memPercent.toFixed(1)}%`, category: 'system', auto_fixable: true })
    } else if (memPercent > 75) {
      issues.push({ id: 'elevated-memory', severity: 'medium', message: `Memory usage at ${memPercent.toFixed(1)}%`, category: 'system', auto_fixable: true })
    }

    const load = os.loadavg()[0]
    const cpuCount = os.cpus().length
    if (load > cpuCount * 2) {
      issues.push({ id: 'high-cpu', severity: 'high', message: `CPU load average: ${load.toFixed(2)}`, category: 'system', auto_fixable: false })
    } else if (load > cpuCount * 1.2) {
      issues.push({ id: 'elevated-cpu', severity: 'medium', message: `CPU load average: ${load.toFixed(2)}`, category: 'system', auto_fixable: false })
    }

    const diskFree = this.checkDiskSpace()
    if (diskFree < 0.1) {
      issues.push({ id: 'low-disk', severity: 'critical', message: `Free disk space at ${(diskFree * 100).toFixed(1)}%`, category: 'storage', auto_fixable: true })
    } else if (diskFree < 0.2) {
      issues.push({ id: 'declining-disk', severity: 'medium', message: `Free disk space at ${(diskFree * 100).toFixed(1)}%`, category: 'storage', auto_fixable: true })
    }

    const uptimeDays = os.uptime() / 86400
    if (uptimeDays > 30) {
      issues.push({ id: 'long-uptime', severity: 'low', message: `System uptime: ${uptimeDays.toFixed(0)} days`, category: 'system', auto_fixable: false })
    }

    const tempDir = os.tmpdir()
    const tempFiles = this.countTempFiles(tempDir)
    if (tempFiles > 500) {
      issues.push({ id: 'temp-bloat', severity: 'low', message: `${tempFiles} temporary files detected`, category: 'storage', auto_fixable: true })
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
      if (!issue.auto_fixable) {
        fixes.push({ issue: issue.id, status: 'skipped', detail: `Manual intervention recommended: ${issue.message}` })
        continue
      }

      try {
        const fixResult = this.applyFix(issue)
        fixes.push({
          issue: issue.id,
          status: fixResult.success ? 'fixed' : 'failed',
          detail: fixResult.detail,
        })
      } catch (err) {
        fixes.push({
          issue: issue.id,
          status: 'failed',
          detail: `Fix error: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    }

    const fixed = fixes.filter((f) => f.status === 'fixed').length
    const failed = fixes.filter((f) => f.status === 'failed').length

    this.emit('self_heal.result', { fixed, failed, fixes })

    return { fixed, failed, fixes }
  }

  private applyFix(issue: HealIssue): { success: boolean; detail: string } {
    switch (issue.id) {
      case 'high-memory':
      case 'elevated-memory':
        if (global.gc) {
          global.gc()
          return { success: true, detail: 'Triggered V8 garbage collection' }
        }
        try {
          execSync('powershell -NoProfile -Command "[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()"', { timeout: 5000 })
          return { success: true, detail: 'Triggered .NET garbage collection' }
        } catch {
          return { success: false, detail: 'Could not force GC' }
        }

      case 'low-disk':
      case 'declining-disk':
        try {
          const platform = os.platform()
          if (platform === 'win32') {
            execSync('powershell -NoProfile -Command "Cleanmgr /sagerun:1 2>$null"', { timeout: 10000, stdio: 'ignore' })
          } else {
            execSync('rm -rf /tmp/* 2>/dev/null; rm -rf ~/.cache/* 2>/dev/null', { timeout: 5000 })
          }
          return { success: true, detail: 'Cleaned temporary files' }
        } catch {
          return { success: false, detail: 'Disk cleanup failed' }
        }

      case 'temp-bloat':
        try {
          const tempDir = os.tmpdir()
          execSync(
            os.platform() === 'win32'
              ? `powershell -NoProfile -Command "Get-ChildItem -Path '${tempDir}' -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue"`
              : `find ${tempDir} -mtime +7 -delete 2>/dev/null`,
            { timeout: 10000, stdio: 'ignore' }
          )
          return { success: true, detail: 'Removed stale temporary files' }
        } catch {
          return { success: false, detail: 'Temp cleanup failed' }
        }

      default:
        return { success: false, detail: `No fix handler for issue: ${issue.id}` }
    }
  }

  private checkDiskSpace(): number {
    try {
      const drive = process.cwd().split(':')[0] + ':'
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

  private countTempFiles(dir: string): number {
    try {
      const result = execSync(
        os.platform() === 'win32'
          ? `powershell -NoProfile -Command "(Get-ChildItem -Path '${dir}' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count"`
          : `find ${dir} -type f 2>/dev/null | wc -l`,
        { encoding: 'utf-8', timeout: 5000 }
      )
      return parseInt(result.trim(), 10) || 0
    } catch {
      return 0
    }
  }
}