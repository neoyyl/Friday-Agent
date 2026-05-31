export interface ServiceManifest {
  name: string
  version: string
  description: string
  dependencies?: string[]
}

export interface ServiceStatus {
  name: string
  ready: boolean
  error?: string
  stats?: Record<string, unknown>
}

export interface MemoryFact {
  id?: string
  content: string
  role: string
  emotion?: string
  topic?: string
  timestamp?: string
}

export interface MemoryContextResult {
  context: Array<{ role: string; content: string }>
  facts: string[]
}

export interface ObsidianConfig {
  vault_path: string
  exists: boolean
  configured: boolean
}

export interface ObsidianNoteItem {
  name: string
  path: string
  size: number
  modified: number
}

export interface PersonalityResult {
  content: string
}

export interface GPUChip {
  index: number
  name: string
  temperature: number
  utilization: number
  memory: { used_mb: number; total_mb: number; free_mb: number }
  power: number | null
  maxPower: number | null
}

export interface GPUInfo {
  available: boolean
  error?: string
  level: 'green' | 'yellow' | 'orange' | 'red'
  summary: string
  used_vram_mb: number
  total_vram_mb: number
  vram_percent: number
  warnings: string[]
  gpus: GPUChip[]
}

export interface PerceptionData {
  os: {
    platform: string
    hostname: string
    uptime: number
    memory: { total: number; free: number; used: number }
    cpu: { load: number; cores: number }
  }
  git?: {
    branch: string
    recent_commits: Array<{ hash: string; message: string; author: string; date: string }>
    dirty: boolean
  }
  project?: {
    name: string
    path: string
  }
}

export interface ExecutionRecord {
  id: string
  timestamp: string
  action: string
  result: string
  duration?: number
  status: string
}

export interface ExecutionReport {
  summary?: string
  stats?: Record<string, number>
  records?: ExecutionRecord[]
}

export interface LogEntry {
  id: string
  timestamp: string
  level: string
  source: string
  message: string
  data?: unknown
}

export interface DispatchStats {
  total: number
  by_agent: Record<string, number>
  by_status: Record<string, number>
}

export interface DispatchInsight {
  type: string
  message: string
  timestamp: string
}

export interface TimingReadiness {
  ready: boolean
  reason?: string
}

export interface HealIssue {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  category: string
  auto_fixable: boolean
}

export interface HealCheckResult {
  issues: HealIssue[]
  healthy: boolean
  score: number
}

export interface HealFixResult {
  fixed: number
  failed: number
  fixes: Array<{ issue: string; status: 'fixed' | 'failed' | 'skipped'; detail?: string }>
}
