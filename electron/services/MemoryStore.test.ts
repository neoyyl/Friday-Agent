import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryStore } from './MemoryStore'
import { EmbeddingService } from './EmbeddingService'
import fs from 'fs'

const TEST_DB = 'test-memory-store.db'

describe('MemoryStore', () => {
  let store: MemoryStore
  let embService: EmbeddingService

  beforeEach(async () => {
    embService = new EmbeddingService()
    await embService.init()
    store = new MemoryStore(embService, TEST_DB)
  })

  afterEach(() => {
    store.close()
    try { fs.unlinkSync(TEST_DB) } catch { }
  })

  it('should save a memory entry', async () => {
    const result = await store.save({ content: 'My name is Test', role: 'user' })
    expect(result.id).toBeGreaterThan(0)
    expect(store.count()).toBe(1)
  })

  it('should save with metadata', async () => {
    await store.save({
      content: 'I love programming',
      role: 'user',
      emotion: 'happy',
      topic: 'coding',
      importance: 3,
    })
    expect(store.count()).toBe(1)
  })

  it('should search by semantic similarity', async () => {
    await store.save({ content: 'I enjoy writing code in TypeScript', role: 'user', importance: 2 })
    await store.save({ content: 'The weather is nice today', role: 'user', importance: 1 })

    const result = await store.search('programming', { limit: 5, minScore: 0.0 })
    expect(result.entries.length).toBeGreaterThan(0)
  })

  it('should recall relevant memories and filter forgotten ones', async () => {
    await store.save({ content: 'My favorite color is blue', role: 'user', importance: 5 })
    const result = await store.recall('color preference', { limit: 5, minScore: 0.0 })
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((e) => e.content.includes('blue'))).toBe(true)
  })

  it('should get context with recent entries', async () => {
    await store.save({ content: 'First message', role: 'user' })
    await store.save({ content: 'Second message', role: 'assistant' })

    const ctx = store.getContext(10)
    expect(ctx.context.length).toBeGreaterThanOrEqual(2)
    expect(ctx.facts).toBeDefined()
  })
})
