import { execSync } from 'child_process'
import { ServiceBase } from './ServiceBase'
import type { GPUInfo, GPUChip } from './types'

const SMI_QUERY = 'nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw,power.limit --format=csv,noheader,nounits'

function parseLine(line: string, index: number): GPUChip | null {
  const parts = line.split(',').map((s) => s.trim())
  if (parts.length < 6) return null
  return {
    index,
    name: parts[0] || 'Unknown',
    temperature: parseFloat(parts[5]) || 0,
    utilization: parseFloat(parts[4]) || 0,
    memory: {
      total_mb: parseFloat(parts[1]) || 0,
      used_mb: parseFloat(parts[2]) || 0,
      free_mb: parseFloat(parts[3]) || 0,
    },
    power: parts[6] && parts[6] !== '[Not Supported]' ? parseFloat(parts[6]) : null,
    maxPower: parts[7] && parts[7] !== '[Not Supported]' ? parseFloat(parts[7]) : null,
  }
}

function computeLevel(gpus: GPUChip[]): GPUInfo['level'] {
  const maxTemp = Math.max(...gpus.map((g) => g.temperature))
  const maxUtil = Math.max(...gpus.map((g) => g.utilization))
  const maxVRAM = Math.max(...gpus.map((g) => {
    if (g.memory.total_mb <= 0) return 0
    return (g.memory.used_mb / g.memory.total_mb) * 100
  }))
  if (maxTemp > 85 || maxVRAM > 95 || maxUtil > 95) return 'red'
  if (maxTemp > 75 || maxVRAM > 80) return 'orange'
  if (maxTemp > 65 || maxVRAM > 60) return 'yellow'
  return 'green'
}

function computeWarnings(gpus: GPUChip[]): string[] {
  const warnings: string[] = []
  for (const g of gpus) {
    if (g.temperature > 80) warnings.push(`GPU ${g.index} 温度过高 (${g.temperature}°C)`)
    if (g.memory.total_mb > 0 && g.memory.used_mb / g.memory.total_mb > 0.85) {
      warnings.push(`GPU ${g.index} 显存使用率过高 (${((g.memory.used_mb / g.memory.total_mb) * 100).toFixed(0)}%)`)
    }
    if (g.utilization > 90) warnings.push(`GPU ${g.index} 使用率接近满载 (${g.utilization}%)`)
    if (g.power !== null && g.maxPower !== null && g.power / g.maxPower > 0.9) {
      warnings.push(`GPU ${g.index} 功耗接近上限 (${g.power}W / ${g.maxPower}W)`)
    }
  }
  return warnings
}

export class GPUService extends ServiceBase {
  constructor() {
    super({
      name: 'gpu',
      version: '2.0.0',
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
    } catch (e) {
      return {
        available: false,
        level: 'green',
        summary: '无可用 GPU',
        used_vram_mb: 0,
        total_vram_mb: 0,
        vram_percent: 0,
        warnings: [],
        gpus: [],
        error: e instanceof Error ? e.message : 'nvidia-smi 调用失败',
      }
    }
  }

  private queryNvidiaSmi(): GPUInfo {
    let raw: string
    try {
      raw = execSync(SMI_QUERY, {
        encoding: 'utf-8',
        timeout: 8000,
      }).trim()
    } catch (e) {
      if (e instanceof Error && e.message.includes('command not found')) {
        throw e
      }
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('No devices were found')) {
        throw e
      }
      throw new Error(`nvidia-smi 调用失败: ${msg}`)
    }

    if (!raw) throw new Error('nvidia-smi 返回为空')

    const lines = raw.split('\n').filter((l) => l.trim())
    const gpus: GPUChip[] = []
    for (let i = 0; i < lines.length; i++) {
      const chip = parseLine(lines[i], i)
      if (chip) gpus.push(chip)
    }

    if (gpus.length === 0) throw new Error('未检测到 NVIDIA GPU')

    const totalVRAM = gpus.reduce((sum, g) => sum + g.memory.total_mb, 0)
    const usedVRAM = gpus.reduce((sum, g) => sum + g.memory.used_mb, 0)
    const vramPercent = totalVRAM > 0 ? Math.round((usedVRAM / totalVRAM) * 100) : 0
    const level = computeLevel(gpus)
    const warnings = computeWarnings(gpus)
    const summary = `${gpus.length} GPU, ${usedVRAM}/${totalVRAM} MB 显存`

    return {
      available: true,
      level,
      summary,
      used_vram_mb: usedVRAM,
      total_vram_mb: totalVRAM,
      vram_percent: vramPercent,
      warnings,
      gpus,
    }
  }
}
