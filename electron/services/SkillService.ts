import path from 'path'
import fs from 'fs'
import { ServiceBase } from './ServiceBase'

interface SkillManifest {
  id: string
  name: string
  version: string
  description: string
  entry: string
  class: string
  capabilities: string[]
  icon: string
  author?: string
  license?: string
  tags?: string[]
}

interface SkillInstance {
  id: string
  name: string
  version: string
  description: string
  icon: string
  capabilities: string[]
  call_count: number
  manifest: SkillManifest
  directory: string
  status: 'loaded' | 'error'
}

export class SkillService extends ServiceBase {
  private skillsRoot = ''
  private skills = new Map<string, SkillInstance>()

  constructor() {
    super({
      name: 'skills',
      version: '1.0.0',
      description: 'Skill management & execution',
    })
  }

  async init(): Promise<void> {
    this.skillsRoot = path.join(process.env.APP_ROOT || '', 'Friday_Kernel', 'skills')
    this.scan()
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.skills.clear()
    this.ready = false
  }

  private discoverSkillsDir(): string {
    const candidates = [
      path.join(process.env.APP_ROOT || '', 'Friday_Kernel', 'skills'),
      path.join(process.env.APP_ROOT || '', 'skills'),
    ]
    for (const dir of candidates) {
      if (fs.existsSync(dir)) return dir
    }
    return this.skillsRoot
  }

  scan(): void {
    this.skillsRoot = this.discoverSkillsDir()
    if (!fs.existsSync(this.skillsRoot)) {
      console.warn(`[SkillService] Skills directory not found: ${this.skillsRoot}`)
      return
    }
    const entries = fs.readdirSync(this.skillsRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dirPath = path.join(this.skillsRoot, entry.name)
      const manifestPath = path.join(dirPath, 'skill.json')
      if (!fs.existsSync(manifestPath)) continue
      try {
        const manifest: SkillManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        if (!manifest.id || !manifest.name) continue
        if (this.skills.has(manifest.id)) continue
        this.skills.set(manifest.id, {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version || '?',
          description: manifest.description || '',
          icon: manifest.icon || '🔌',
          capabilities: manifest.capabilities || [],
          call_count: 0,
          manifest,
          directory: dirPath,
          status: 'loaded',
        })
        console.log(`[SkillService] Loaded: ${manifest.name} v${manifest.version}`)
      } catch (err) {
        console.warn(`[SkillService] Failed to load skill from ${entry.name}:`, err)
      }
    }
  }

  list(): { skills: Array<{ id: string; name: string; version: string; description: string; icon: string; capabilities: string[]; call_count: number; status: string }> } {
    return {
      skills: Array.from(this.skills.values()).map((s) => ({
        id: s.id,
        name: s.name,
        version: s.version,
        description: s.description,
        icon: s.icon,
        capabilities: s.capabilities,
        call_count: s.call_count,
        status: s.status,
      })),
    }
  }

  getStats(): { total: number; loaded: number } {
    return {
      total: this.skills.size,
      loaded: Array.from(this.skills.values()).filter((s) => s.status === 'loaded').length,
    }
  }

  async call(id: string, _params?: Record<string, unknown>): Promise<unknown> {
    const skill = this.skills.get(id)
    if (!skill) throw new Error(`Skill not found: ${id}`)
    skill.call_count++
    return { success: true, skill: id, message: `Skill ${skill.name} executed (stub)` }
  }

  reload(id: string): { success: boolean } {
    const skill = this.skills.get(id)
    if (!skill) throw new Error(`Skill not found: ${id}`)
    skill.status = 'loaded'
    return { success: true }
  }

  find(capability: string): { skills: Array<{ id: string; name: string; version: string }> } {
    const matches = Array.from(this.skills.values()).filter((s) =>
      s.capabilities.some((c) => c.toLowerCase().includes(capability.toLowerCase()))
    )
    return { skills: matches.map((s) => ({ id: s.id, name: s.name, version: s.version })) }
  }

  rescan(): { loaded: number } {
    this.skills.clear()
    this.scan()
    return { loaded: this.skills.size }
  }
}
