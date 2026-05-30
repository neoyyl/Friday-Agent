import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { ServiceBase } from './ServiceBase'
import type { ObsidianConfig, ObsidianNoteItem } from './types'

export class ObsidianService extends ServiceBase {
  private vaultPath = ''

  constructor() {
    super({
      name: 'obsidian',
      version: '1.0.0',
      description: 'Obsidian vault integration',
    })
  }

  async init(): Promise<void> {
    this.vaultPath = this.discoverVault()
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
  }

  private discoverVault(): string {
    const configPath = path.join(app.getPath('userData'), 'obsidian-vault.json')
    try {
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        if (data.path && fs.existsSync(data.path)) return data.path
      }
    } catch { /* ignore */ }
    return ''
  }

  getConfig(): ObsidianConfig {
    return {
      vault_path: this.vaultPath,
      exists: this.vaultPath ? fs.existsSync(this.vaultPath) : false,
      configured: !!this.vaultPath,
    }
  }

  setVaultPath(vaultPath: string): void {
    this.vaultPath = vaultPath
    const configPath = path.join(app.getPath('userData'), 'obsidian-vault.json')
    fs.writeFileSync(configPath, JSON.stringify({ path: vaultPath }, null, 2), 'utf-8')
  }

  listNotes(folder = ''): { notes: ObsidianNoteItem[]; vault: string } {
    if (!this.vaultPath || !fs.existsSync(this.vaultPath)) {
      return { notes: [], vault: this.vaultPath }
    }
    const searchDir = folder ? path.join(this.vaultPath, folder) : this.vaultPath
    const notes: ObsidianNoteItem[] = []
    try {
      if (!fs.existsSync(searchDir)) return { notes: [], vault: this.vaultPath }
      const entries = fs.readdirSync(searchDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const fullPath = path.join(searchDir, entry.name)
          const stat = fs.statSync(fullPath)
          notes.push({ name: entry.name, path: fullPath, size: stat.size, modified: stat.mtimeMs })
        }
      }
    } catch (err) {
      console.error('[ObsidianService] listNotes error:', err)
    }
    notes.sort((a, b) => b.modified - a.modified)
    return { notes, vault: this.vaultPath }
  }

  writeNote(data: { title: string; content: string; tags?: string[]; folder?: string }): { path: string } {
    const dir = data.folder ? path.join(this.vaultPath, data.folder) : this.vaultPath
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, `${data.title.replace(/[/\\?%*:|"<>]/g, '_')}.md`)
    const header = data.tags?.length ? `---\ntags: [${data.tags.join(', ')}]\n---\n\n` : ''
    fs.writeFileSync(filePath, header + data.content, 'utf-8')
    return { path: filePath }
  }
}
