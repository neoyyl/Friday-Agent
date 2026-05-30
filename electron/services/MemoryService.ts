import path from 'path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { ServiceBase } from './ServiceBase'
import type { MemoryFact, MemoryContextResult } from './types'

export class MemoryService extends ServiceBase {
  private db: Database.Database | null = null

  constructor() {
    super({
      name: 'memory',
      version: '1.0.0',
      description: 'Conversation memory storage',
    })
  }

  async init(): Promise<void> {
    const dbPath = path.join(app.getPath('userData'), 'friday-memory.db')
    this.db = new Database(dbPath)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        emotion TEXT,
        topic TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_memory_topic ON memory_facts(topic);
      CREATE INDEX IF NOT EXISTS idx_memory_timestamp ON memory_facts(timestamp);
    `)
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
    this.db?.close()
    this.db = null
  }

  private getDb(): Database.Database {
    if (!this.db) throw new Error('MemoryService not initialized')
    return this.db
  }

  list(): { context: Array<{ role: string; content: string }>; facts: string[] } {
    const rows = this.getDb().prepare(
      'SELECT content, role, topic FROM memory_facts ORDER BY timestamp DESC LIMIT 50'
    ).all() as MemoryFact[]
    const context = rows.map((r) => ({ role: r.role, content: r.content }))
    const facts = rows.filter((r) => r.topic).map((r) => `[${r.topic}] ${r.content}`)
    return { context, facts }
  }

  getContext(): MemoryContextResult {
    const recent = this.getDb().prepare(
      'SELECT content, role FROM memory_facts ORDER BY timestamp DESC LIMIT 20'
    ).all() as MemoryFact[]
    const topics = this.getDb().prepare(
      'SELECT DISTINCT topic FROM memory_facts WHERE topic IS NOT NULL ORDER BY MAX(timestamp) DESC LIMIT 10'
    ).all() as Array<{ topic: string }>
    return {
      context: recent.reverse().map((r) => ({ role: r.role, content: r.content })),
      facts: topics.map((t) => t.topic).filter(Boolean),
    }
  }

  save(data: { role: string; content: string; emotion?: string; topic?: string }): { success: boolean } {
    this.getDb().prepare(
      'INSERT INTO memory_facts (content, role, emotion, topic) VALUES (?, ?, ?, ?)'
    ).run(data.content, data.role, data.emotion || null, data.topic || null)
    return { success: true }
  }

  search(topic?: string): MemoryFact[] {
    if (topic) {
      return this.getDb().prepare(
        'SELECT * FROM memory_facts WHERE topic = ? ORDER BY timestamp DESC LIMIT 20'
      ).all(topic) as MemoryFact[]
    }
    return this.getDb().prepare(
      'SELECT * FROM memory_facts ORDER BY timestamp DESC LIMIT 20'
    ).all() as MemoryFact[]
  }
}
