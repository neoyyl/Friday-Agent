import Database from 'better-sqlite3'
import type { VectorRecord, VectorSearchOptions } from './types'

export class VectorStore {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_vectors_created ON vectors(created_at);
    `)

    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vectors_fts USING fts5(
          content,
          content=vectors,
          content_rowid=id
        );
      `)
    } catch {
      console.warn('[VectorStore] FTS5 not available, full-text search disabled')
    }
  }

  private serializeEmbedding(vec: number[]): Buffer {
    return Buffer.from(new Float64Array(vec).buffer)
  }

  private deserializeEmbedding(buffer: Buffer): number[] {
    return Array.from(new Float64Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 8))
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
  }

  insert(content: string, embedding: number[], metadata?: Record<string, unknown>): number {
    const metaStr = JSON.stringify(metadata || {})
    const blob = this.serializeEmbedding(embedding)
    const result = this.db.prepare(
      'INSERT INTO vectors (content, embedding, metadata) VALUES (?, ?, ?)'
    ).run(content, blob, metaStr)

    try {
      this.db.prepare(
        'INSERT INTO vectors_fts (rowid, content) VALUES (?, ?)'
      ).run(result.lastInsertRowid, content)
    } catch { }

    return Number(result.lastInsertRowid)
  }

  insertBatch(items: Array<{ content: string; embedding: number[]; metadata?: Record<string, unknown> }>): number[] {
    const ids: number[] = []
    const insert = this.db.transaction(() => {
      for (const item of items) {
        ids.push(this.insert(item.content, item.embedding, item.metadata))
      }
    })
    insert()
    return ids
  }

  search(queryEmbedding: number[], options?: VectorSearchOptions): VectorRecord[] {
    const { limit = 10, minScore = 0.0, timeRange, type, importance } = options || {}

    let sql = 'SELECT id, content, embedding, metadata, created_at FROM vectors WHERE 1=1'
    const params: unknown[] = []

    if (timeRange?.start) {
      sql += ' AND created_at >= ?'
      params.push(timeRange.start)
    }
    if (timeRange?.end) {
      sql += ' AND created_at <= ?'
      params.push(timeRange.end)
    }

    sql += ' ORDER BY id DESC'

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: number; content: string; embedding: Buffer; metadata: string; created_at: string
    }>

    const results: VectorRecord[] = []
    for (const row of rows) {
      const meta = JSON.parse(row.metadata)
      if (type && meta.type !== type) continue
      if (importance !== undefined && (meta.importance || 0) < importance) continue

      const vec = this.deserializeEmbedding(row.embedding)
      const score = this.cosineSimilarity(queryEmbedding, vec)
      if (score < minScore) continue

      results.push({
        id: row.id,
        embedding: vec,
        content: row.content,
        metadata: meta,
        created_at: row.created_at,
      })

      if (results.length >= limit) break
    }

    return results.sort((a, b) => {
      const sa = this.cosineSimilarity(queryEmbedding, a.embedding as number[])
      const sb = this.cosineSimilarity(queryEmbedding, b.embedding as number[])
      return sb - sa
    })
  }

  searchByText(query: string, limit = 10): VectorRecord[] {
    try {
      const rows = this.db.prepare(
        `SELECT v.id, v.content, v.embedding, v.metadata, v.created_at
         FROM vectors_fts f JOIN vectors v ON f.rowid = v.id
         WHERE vectors_fts MATCH ?
         ORDER BY rank LIMIT ?`
      ).all(query, limit) as Array<{
        id: number; content: string; embedding: Buffer; metadata: string; created_at: string
      }>

      return rows.map((r) => ({
        id: r.id,
        embedding: this.deserializeEmbedding(r.embedding),
        content: r.content,
        metadata: JSON.parse(r.metadata),
        created_at: r.created_at,
      }))
    } catch {
      return []
    }
  }

  get(id: number): VectorRecord | null {
    const row = this.db.prepare(
      'SELECT id, content, embedding, metadata, created_at FROM vectors WHERE id = ?'
    ).get(id) as { id: number; content: string; embedding: Buffer; metadata: string; created_at: string } | undefined

    if (!row) return null
    return {
      id: row.id,
      embedding: this.deserializeEmbedding(row.embedding),
      content: row.content,
      metadata: JSON.parse(row.metadata),
      created_at: row.created_at,
    }
  }

  delete(id: number): boolean {
    const result = this.db.prepare('DELETE FROM vectors WHERE id = ?').run(id)
    try {
      this.db.prepare('DELETE FROM vectors_fts WHERE rowid = ?').run(id)
    } catch { }
    return result.changes > 0
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM vectors').get() as { count: number }
    return row.count
  }

  close(): void {
    this.db.close()
  }
}
