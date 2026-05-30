import path from 'path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { ServiceBase } from './ServiceBase'
import type { ExecutionRecord, ExecutionReport, LogEntry } from './types'

export class ExecutionLogService extends ServiceBase {
  private db: Database.Database | null = null

  constructor() {
    super({
      name: 'execution_log',
      version: '1.0.0',
      description: 'Execution & action log storage',
    })
  }

  async init(): Promise<void> {
    const dbPath = path.join(app.getPath('userData'), 'friday-execution-log.db')
    this.db = new Database(dbPath)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS execution_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        result TEXT,
        duration INTEGER,
        status TEXT NOT NULL DEFAULT 'completed'
      );
      CREATE INDEX IF NOT EXISTS idx_log_timestamp ON execution_log(timestamp);
      CREATE TABLE IF NOT EXISTS app_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        level TEXT NOT NULL DEFAULT 'info',
        source TEXT NOT NULL DEFAULT 'app',
        message TEXT NOT NULL,
        data TEXT
      );
    `)
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
    this.db?.close()
    this.db = null
  }

  private getDb(): Database.Database {
    if (!this.db) throw new Error('ExecutionLogService not initialized')
    return this.db
  }

  list(limit = 100): ExecutionRecord[] {
    return this.getDb().prepare(
      'SELECT * FROM execution_log ORDER BY timestamp DESC LIMIT ?'
    ).all(limit) as ExecutionRecord[]
  }

  getReport(): ExecutionReport {
    const stats = this.getDb().prepare(
      "SELECT status, COUNT(*) as count FROM execution_log GROUP BY status"
    ).all() as Array<{ status: string; count: number }>
    const total = stats.reduce((sum, s) => sum + s.count, 0)
    const statusMap: Record<string, number> = {}
    for (const s of stats) statusMap[s.status] = s.count
    return {
      summary: `共 ${total} 条执行记录`,
      stats: statusMap,
    }
  }

  log(record: Omit<ExecutionRecord, 'timestamp'> & { timestamp?: string }): void {
    this.getDb().prepare(
      'INSERT OR REPLACE INTO execution_log (id, timestamp, action, result, duration, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      record.id,
      record.timestamp || new Date().toISOString(),
      record.action,
      record.result,
      record.duration || null,
      record.status,
    )
    this.emit('log.recorded', { id: record.id, action: record.action, status: record.status })
  }

  getAppLogs(limit = 100): LogEntry[] {
    return this.getDb().prepare(
      'SELECT * FROM app_log ORDER BY timestamp DESC LIMIT ?'
    ).all(limit) as LogEntry[]
  }

  addAppLog(level: string, source: string, message: string, data?: unknown): void {
    this.getDb().prepare(
      'INSERT INTO app_log (level, source, message, data) VALUES (?, ?, ?, ?)'
    ).run(level, source, message, data ? JSON.stringify(data) : null)
  }
}
