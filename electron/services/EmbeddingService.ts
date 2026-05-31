import { ServiceBase } from './ServiceBase'
import { ServiceRegistry } from './ServiceRegistry'
import { ConfigService } from './ConfigService'

interface EmbeddingConfig {
  provider: 'openai' | 'deepseek'
  apiKey: string
  baseUrl: string
  model: string
  dimensions: number
}

export class EmbeddingService extends ServiceBase {
  private config: EmbeddingConfig
  private cache: Map<string, { value: number[]; timestamp: number }>
  private cacheMaxSize: number

  constructor() {
    super({
      name: 'embeddings',
      version: '1.0.0',
      description: 'Text embedding generation via LLM APIs',
    })
    this.cache = new Map()
    this.cacheMaxSize = 1000
    this.config = {
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small',
      dimensions: 1536,
    }
  }

  async init(): Promise<void> {
    const cfg = ServiceRegistry.getInstance().get<ConfigService>('config')
    if (cfg) {
      const saved = cfg.getKey('embedding') as Record<string, unknown> | undefined
      if (saved) {
        if (typeof saved.provider === 'string') this.config.provider = saved.provider as EmbeddingConfig['provider']
        if (typeof saved.apiKey === 'string') this.config.apiKey = saved.apiKey
        if (typeof saved.baseUrl === 'string') this.config.baseUrl = saved.baseUrl
        if (typeof saved.model === 'string') this.config.model = saved.model
        if (typeof saved.dimensions === 'number') this.config.dimensions = saved.dimensions
      }
    }
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.cache.clear()
    this.ready = false
  }

  updateConfig(updates: Partial<EmbeddingConfig>): void {
    Object.assign(this.config, updates)
    const cfg = ServiceRegistry.getInstance().get<ConfigService>('config')
    cfg?.setKey('embedding', { ...this.config })
  }

  private getApiKey(): string {
    if (this.config.apiKey) return this.config.apiKey
    if (this.config.provider === 'openai') return process.env.OPENAI_API_KEY || ''
    if (this.config.provider === 'deepseek') return process.env.DEEPSEEK_API_KEY || ''
    return ''
  }

  async embed(text: string): Promise<number[]> {
    const cacheKey = `${this.config.provider}:${this.config.model}:${text}`
    const cached = this.cache.get(cacheKey)
    if (cached) {
      cached.timestamp = Date.now()
      return cached.value
    }

    const result = await this.callEmbeddingAPI(text)
    this.addToCache(cacheKey, result)
    return result
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = []
    const uncached: { index: number; text: string }[] = []

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = `${this.config.provider}:${this.config.model}:${texts[i]}`
      const cached = this.cache.get(cacheKey)
      if (cached) {
        cached.timestamp = Date.now()
        results[i] = cached.value
      } else {
        uncached.push({ index: i, text: texts[i] })
      }
    }

    if (uncached.length > 0) {
      const batchResults = await this.callBatchEmbeddingAPI(uncached.map((u) => u.text))
      for (let j = 0; j < uncached.length; j++) {
        const { index, text } = uncached[j]
        const emb = batchResults[j]
        results[index] = emb
        this.addToCache(`${this.config.provider}:${this.config.model}:${text}`, emb)
      }
    }

    return results
  }

  private addToCache(key: string, value: number[]): void {
    if (this.cache.size >= this.cacheMaxSize) {
      let oldestKey = ''
      let oldestTime = Infinity
      for (const [k, v] of this.cache) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp
          oldestKey = k
        }
      }
      if (oldestKey) this.cache.delete(oldestKey)
    }
    this.cache.set(key, { value, timestamp: Date.now() })
  }

  private async callEmbeddingAPI(text: string): Promise<number[]> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return this.fallbackEmbed(text)
    }

    const url = `${this.config.baseUrl}/embeddings`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: this.config.model,
      }),
    })

    if (!response.ok) {
      console.warn(`[EmbeddingService] API error ${response.status}, using fallback`)
      return this.fallbackEmbed(text)
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0].embedding
  }

  private async callBatchEmbeddingAPI(texts: string[]): Promise<number[][]> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return texts.map((t) => this.fallbackEmbed(t))
    }

    const url = `${this.config.baseUrl}/embeddings`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.config.model,
      }),
    })

    if (!response.ok) {
      console.warn(`[EmbeddingService] Batch API error ${response.status}, using fallback`)
      return texts.map((t) => this.fallbackEmbed(t))
    }

    const data = await response.json() as { data: Array<{ embedding: number[]; index: number }> }
    const sorted = data.data.sort((a, b) => a.index - b.index)
    return sorted.map((d) => d.embedding)
  }

  private fallbackEmbed(text: string): number[] {
    const dims = this.config.dimensions
    const vec = new Array(dims).fill(0)
    const chars = text.split('')
    for (let i = 0; i < chars.length; i++) {
      vec[i % dims] += chars[i].charCodeAt(0) / 255
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
    return norm > 0 ? vec.map((v) => v / norm) : vec
  }

  clearCache(): void {
    this.cache.clear()
  }

  getCacheSize(): number {
    return this.cache.size
  }

  getConfig(): EmbeddingConfig {
    return { ...this.config }
  }
}
