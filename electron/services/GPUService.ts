import { execSync } from 'child_process'
import { ServiceBase } from './ServiceBase'
import type { GPUInfo } from './types'

export class GPUService extends ServiceBase {
  constructor() {
    super({
      name: 'gpu',
      version: '1.0.0',
      description: 'GPU status monitoring',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
  }

  queryStatus(): GPUInfo {
    try {
      return this.queryNvidiaSmi()
    } catch {
      return { available: false }
    }
  }

  private queryNvidiaSmi(): GPUInfo {
    const raw = execSync(
      'nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,driver_version --format=csv,noheader,nounits',
      { encoding: 'utf-8', timeout: 5000 }
    ).trim()

    if (!raw) return { available: false }

    const parts = raw.split(', ').map((s) => s.trim())
    return {
      available: true,
      name: parts[0] || undefined,
      memory_total: parseFloat(parts[1]) || undefined,
      memory_used: parseFloat(parts[2]) || undefined,
      memory_free: parseFloat(parts[3]) || undefined,
      utilization: parseFloat(parts[4]) || undefined,
      temperature: parseFloat(parts[5]) || undefined,
      driver_version: parts[6] || undefined,
    }
  }
}
