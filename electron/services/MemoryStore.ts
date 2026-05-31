import path from 'path'
import { app } from 'electron'
import { VectorStore } from './VectorStore'
import { EmbeddingService } from './EmbeddingService'
import { computeRetention, computeInitialStrength, shouldForget } from './ForgettingCurve'
import type { MemoryEntry, MemorySearchResult, VectorSearchOptions } from './types'

export class MemoryStore {
  private vectorStore: VectorStore
  private embeddingService: EmbeddingService
  private retentionThreshold: number

  constructor(embeddingService: EmbeddingService, dbPath?: string) {
    const resolvedPath = dbPath || path.join(app.getPath('userData'), 'friday-vectors.db')
    this.vectorStore = new VectorStore(resolvedPath)
    this.embeddingService = embeddingService
    this.retentionThreshold = 0.15
  }

  async save(data: {
    content: string
    role: string
    emotion?: string
    topic?: string
    importance?: number
    type?: string
  }): Promise<{ id: number }> {
    const text = `[${data.role}] ${data.content}`
    const embedding = await this.embeddingService.embed(text)
    const importance = data.importance ?? 1

    const id = this.vectorStore.insert(text, embedding, {
      role: data.role,
      emotion: data.emotion || '',
      topic: data.topic || '',
      importance,
      type: data.type || 'conversation',
    })

    return { id }
  }

  async search(query: string, options?: {
    limit?: number
    minScore?: number
    topic?: string
    type?: string
  }): Promise<MemorySearchResult> {
    const queryEmbedding = await this.embeddingService.embed(query)

    const searchOptions: VectorSearchOptions = {
      limit: options?.limit || 10,
      minScore: options?.minScore || 0.3,
      type: options?.type,
    }

    const results = this.vectorStore.search(queryEmbedding, searchOptions)

    const filtered = options?.topic
      ? results.filter((r) => (r.metadata as Record<string, unknown>).topic === options.topic)
      : results

    const entries: MemoryEntry[] = filtered.map((r) => ({
      id: r.id,
      content: r.content,
      role: (r.metadata as Record<string, unknown>).role as string || 'user',
      embedding: r.embedding as number[],
      metadata: r.metadata as MemoryEntry['metadata'],
      retention: 1.0,
      created_at: r.created_at,
    }))

    return { entries, query, total: entries.length }
  }

  async recall(query: string, options?: {
    limit?: number
    minScore?: number
    topic?: string
  }): Promise<MemoryEntry[]> {
    const result = await this.search(query, { ...options, limit: options?.limit || 5 })
    return result.entries.filter((e) => {
      const hoursSinceCreation = (Date.now() - new Date(e.created_at).getTime()) / (1000 * 3600)
      const strength = computeInitialStrength(e.metadata.importance || 1)
      const retention = computeRetention(hoursSinceCreation, strength)
      return !shouldForget(retention, this.retentionThreshold)
    })
  }

  getContext(limit = 20): { context: Array<{ role: string; content: string }>; facts: string[] } {
    const queryEmbedding = new Array(1536).fill(0)
    const recent = this.vectorStore.search(queryEmbedding, { limit })

    const context = recent.map((r) => ({
      role: (r.metadata as Record<string, unknown>).role as string || 'user',
      content: r.content.replace(/^\[(user|assistant|system)\]\s*/, ''),
    }))

    const facts = recent
      .filter((r) => (r.metadata as Record<string, unknown>).topic)
      .map((r) => {
        const meta = r.metadata as Record<string, unknown>
        return `[${meta.topic}] ${r.content}`
      })

    return { context, facts }
  }

  searchByText(query: string, limit = 10) {
    return this.vectorStore.searchByText(query, limit)
  }

  delete(id: number): boolean {
    return this.vectorStore.delete(id)
  }

  count(): number {
    return this.vectorStore.count()
  }

  close(): void {
    this.vectorStore.close()
  }
}
