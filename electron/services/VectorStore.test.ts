import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { VectorStore } from './VectorStore'
import fs from 'fs'

const TEST_DB = 'test-vectors.db'

function makeEmbedding(dim = 4): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1)
}

describe('VectorStore', () => {
  let store: VectorStore

  beforeEach(() => {
    store = new VectorStore(TEST_DB)
  })

  afterEach(() => {
    store.close()
    try { fs.unlinkSync(TEST_DB) } catch { }
  })

  it('should insert a vector and return id', () => {
    const id = store.insert('hello world', makeEmbedding())
    expect(id).toBeGreaterThan(0)
    expect(store.count()).toBe(1)
  })

  it('should retrieve inserted vector by id', () => {
    const emb = makeEmbedding()
    const id = store.insert('test content', emb, { topic: 'test' })
    const record = store.get(id)
    expect(record).not.toBeNull()
    expect(record!.content).toBe('test content')
    expect((record!.metadata as any).topic).toBe('test')
  })

  it('should find similar vectors via cosine similarity', () => {
    const baseEmb = [1.0, 0.0, 0.0, 0.0]
    store.insert('similar doc', [0.95, 0.05, 0.0, 0.0], { type: 'doc' })
    store.insert('different doc', [0.0, 1.0, 0.0, 0.0], { type: 'doc' })
    store.insert('also different', [0.0, 0.0, 1.0, 0.0], { type: 'doc' })

    const results = store.search(baseEmb, { limit: 5, minScore: 0.0 })
    expect(results.length).toBe(3)
    expect(results[0].content).toBe('similar doc')
  })

  it('should filter by metadata type', () => {
    store.insert('type a content', makeEmbedding(), { type: 'a' })
    store.insert('type b content', makeEmbedding(), { type: 'b' })

    const results = store.search(new Array(4).fill(0), { limit: 10, minScore: 0.0, type: 'a' })
    expect(results.every((r) => (r.metadata as any).type === 'a')).toBe(true)
  })

  it('should delete a vector', () => {
    const id = store.insert('to delete', makeEmbedding())
    expect(store.count()).toBe(1)
    const deleted = store.delete(id)
    expect(deleted).toBe(true)
    expect(store.count()).toBe(0)
    expect(store.get(id)).toBeNull()
  })
})
