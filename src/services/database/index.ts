import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tool_calls TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  parameters TEXT,
  result TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_message_id ON tool_calls(message_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
`

export interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  session_id: string
  role: string
  content: string
  tool_calls: string | null
  created_at: string
}

export interface ToolCallRecord {
  id: string
  message_id: string
  tool_id: string
  parameters: string | null
  result: string | null
  success: boolean
  duration_ms: number | null
  created_at: string
}

let db: Database.Database | null = null

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'friday.db')
}

function migrateFromJson(db: Database.Database): void {
  const jsonPath = path.join(app.getPath('userData'), 'agent-platform-data.json')
  if (!fs.existsSync(jsonPath)) return
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

    const count = db.prepare('SELECT COUNT(*) as c FROM sessions').get() as { c: number }
    if (count.c > 0) return

    const insertSession = db.prepare('INSERT OR IGNORE INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
    const insertMessage = db.prepare('INSERT OR IGNORE INTO messages (id, session_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')

    const tx = db.transaction(() => {
      if (Array.isArray(data.sessions)) {
        for (const s of data.sessions) {
          insertSession.run(s.id, s.title || '', s.created_at || new Date().toISOString(), s.updated_at || new Date().toISOString())
        }
      }
      if (data.messages && typeof data.messages === 'object') {
        for (const [sessionId, msgs] of Object.entries(data.messages)) {
          if (Array.isArray(msgs)) {
            for (const m of msgs) {
              insertMessage.run(m.id, sessionId, m.role, m.content || '', m.tool_calls || null, m.created_at || new Date().toISOString())
            }
          }
        }
      }
      if (data.settings && typeof data.settings === 'object') {
        for (const [key, value] of Object.entries(data.settings)) {
          insertSetting.run(key, String(value))
        }
      }
    })
    tx()

    fs.renameSync(jsonPath, jsonPath + '.migrated')
    console.log('[DB] Migrated from JSON to SQLite')
  } catch (err) {
    console.error('[DB] Migration failed:', err)
  }
}

export function initializeDatabase(): void {
  if (db) return

  const dbPath = getDbPath()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)
  db.exec(SCHEMA)
  migrateFromJson(db)
}

function getDb(): Database.Database {
  if (!db) {
    initializeDatabase()
  }
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

// ==================== Sessions ====================

export function getAllSessions(): Session[] {
  return getDb().prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as Session[]
}

export function getSession(id: string): Session | undefined {
  return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined
}

export function createSession(id: string, title: string): Session {
  const now = new Date().toISOString()
  getDb().prepare('INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, title, now, now)
  return { id, title, created_at: now, updated_at: now }
}

export function updateSession(id: string, title: string): Session | null {
  const now = new Date().toISOString()
  const result = getDb().prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?').run(title, now, id)
  if (result.changes === 0) return null
  return getSession(id) || null
}

export function deleteSession(id: string): boolean {
  const result = getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== Messages ====================

export function getMessages(sessionId: string, limit?: number, offset?: number): Message[] {
  let query = 'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC'
  const params: (string | number)[] = [sessionId]
  if (limit !== undefined) {
    query += ' LIMIT ?'
    params.push(limit)
  }
  if (offset !== undefined && offset > 0) {
    query += ' OFFSET ?'
    params.push(offset)
  }
  const rows = getDb().prepare(query).all(...params) as Message[]
  return rows.reverse()
}

export function getMessage(id: string): Message | undefined {
  return getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message | undefined
}

export function createMessage(id: string, sessionId: string, role: string, content: string, toolCalls?: string): Message {
  const now = new Date().toISOString()
  getDb().prepare('INSERT INTO messages (id, session_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, sessionId, role, content, toolCalls || null, now)
  getDb().prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId)
  return { id, session_id: sessionId, role, content, tool_calls: toolCalls || null, created_at: now }
}

export function updateMessage(id: string, updates: Partial<Pick<Message, 'content' | 'tool_calls'>>): Message | null {
  const sets: string[] = []
  const params: any[] = []
  if (updates.content !== undefined) { sets.push('content = ?'); params.push(updates.content) }
  if (updates.tool_calls !== undefined) { sets.push('tool_calls = ?'); params.push(updates.tool_calls) }
  if (sets.length === 0) return null
  params.push(id)
  getDb().prepare(`UPDATE messages SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return getMessage(id) || null
}

export function deleteMessages(sessionId: string): boolean {
  const result = getDb().prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId)
  return result.changes > 0
}

// ==================== Tool Calls ====================

export function getToolCalls(messageId: string): ToolCallRecord[] {
  return getDb().prepare('SELECT * FROM tool_calls WHERE message_id = ? ORDER BY created_at ASC').all(messageId) as ToolCallRecord[]
}

export function createToolCall(record: {
  id: string
  message_id: string
  tool_id: string
  parameters?: string
  result?: string
  success: boolean
  duration_ms?: number
}): ToolCallRecord {
  const now = new Date().toISOString()
  const stmt = getDb().prepare('INSERT INTO tool_calls (id, message_id, tool_id, parameters, result, success, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  stmt.run(record.id, record.message_id, record.tool_id, record.parameters || null, record.result || null, record.success ? 1 : 0, record.duration_ms || null, now)
  return { ...record, created_at: now, parameters: record.parameters || null, result: record.result || null, duration_ms: record.duration_ms || null }
}

export function getToolCallStats(): { total: number; success: number; failed: number } {
  const row = getDb().prepare('SELECT COUNT(*) as total, SUM(CASE WHEN success THEN 1 ELSE 0 END) as success FROM tool_calls').get() as any
  return { total: row.total, success: row.success, failed: row.total - row.success }
}

// ==================== Settings ====================

export function getSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

export function getSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}

export function updateSettings(newSettings: Record<string, string>): Record<string, string> {
  const stmt = getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  const tx = getDb().transaction(() => {
    for (const [key, value] of Object.entries(newSettings)) {
      stmt.run(key, String(value ?? ''))
    }
  })
  tx()
  return getSettings()
}

// ==================== Stats ====================

export function getSessionMessageCount(sessionId: string): number {
  const row = getDb().prepare('SELECT COUNT(*) as c FROM messages WHERE session_id = ?').get(sessionId) as { c: number }
  return row.c
}

// ==================== Cleanup ====================

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
