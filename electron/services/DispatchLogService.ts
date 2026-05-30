import path from 'path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { ServiceBase } from './ServiceBase'
import type { DispatchStats, DispatchInsight } from './types'

export class DispatchLogService extends ServiceBase {
  private db: Database.Database | null = null

  constructor() {
    super({
      name: 'dispatch_log',
      version: '1.0.0',
      description: 'Agent dispatch logging',
    })
  }

  async init(): Promise<void> {
    const dbPath = path.join(app.getPath('userData'), 'friday-dispatch-log.db')
    this.db = new Database(dbPath)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dispatch_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        agent TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        duration INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_dispatch_agent ON dispatch_log(agent);
      CREATE INDEX IF NOT EXISTS idx_dispatch_timestamp ON dispatch_log(timestamp);
    `)
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
    this.db?.close()
    this.db = null
  }

  private getDb(): Database.Database {
    if (!this.db) throw new Error('DispatchLogService not initialized')
    return this.db
  }

  getStats(): DispatchStats {
    const byAgent = this.getDb().prepare(
      'SELECT agent, COUNT(*) as count FROM dispatch_log GROUP BY agent'
    ).all() as Array<{ agent: string; count: number }>
    const byStatus = this.getDb().prepare(
      'SELECT status, COUNT(*) as count FROM dispatch_log GROUP BY status'
    ).all() as Array<{ status: string; count: number }>

    const total = byAgent.reduce((s, r) => s + r.count, 0)
    const agentMap: Record<string, number> = {}
    for (const r of byAgent) agentMap[r.agent] = r.count
    const statusMap: Record<string, number> = {}
    for (const r of byStatus) statusMap[r.status] = r.count

    return { total, by_agent: agentMap, by_status: statusMap }
  }

  getInsights(): DispatchInsight[] {
    const recent = this.getDb().prepare(
      'SELECT * FROM dispatch_log ORDER BY timestamp DESC LIMIT 10'
    ).all() as Array<{ id: string; timestamp: string; agent: string; task: string; status: string }>
    return recent.map((r) => ({
      type: 'dispatch',
      message: `[${r.agent}] ${r.task} → ${r.status}`,
      timestamp: r.timestamp,
    }))
  }

  record(entry: { id: string; agent: string; task: string; status: string; result?: string; duration?: number }): void {
    this.getDb().prepare(
      'INSERT INTO dispatch_log (id, agent, task, status, result, duration) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(entry.id, entry.agent, entry.task, entry.status, entry.result || null, entry.duration || null)
  }
}
