import { LLMClient, ChatMessage, ChatOptions, ChatResponse, StreamChunk, ProviderConfig } from './types'
import { createLLMClient } from './clients'
import { getProvider, PROVIDERS } from './providers'

// 提供商配置存储
export interface ProviderSettings {
  apiKey?: string
  baseUrl?: string
  modelId?: string
  enabled: boolean
}

export interface LLMConfig {
  activeProvider: string
  providers: Record<string, ProviderSettings>
}

// LLM 管理器
export class LLMManager {
  private clients: Map<string, LLMClient> = new Map()
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  // 更新配置
  updateConfig(config: Partial<LLMConfig>) {
    this.config = { ...this.config, ...config }
    // 清除缓存的客户端
    this.clients.clear()
  }

  // 获取当前配置
  getConfig(): LLMConfig {
    return this.config
  }

  // 获取活跃提供商
  getActiveProvider(): ProviderConfig | undefined {
    return getProvider(this.config.activeProvider)
  }

  // 设置活跃提供商
  setActiveProvider(providerId: string) {
    this.config.activeProvider = providerId
    this.clients.clear()
  }

  // 获取提供商设置
  getProviderSettings(providerId: string): ProviderSettings | undefined {
    return this.config.providers[providerId]
  }

  // 更新提供商设置
  updateProviderSettings(providerId: string, settings: Partial<ProviderSettings>) {
    this.config.providers[providerId] = {
      ...this.config.providers[providerId],
      ...settings,
    }
    this.clients.delete(providerId)
  }

  // 获取客户端
  private getClient(providerId?: string): LLMClient {
    const id = providerId || this.config.activeProvider
    const settings = this.config.providers[id]
    
    if (!settings?.enabled) {
      throw new Error(`提供商 ${id} 未启用`)
    }

    if (!this.clients.has(id)) {
      const provider = getProvider(id)
      if (!provider) {
        throw new Error(`未知的提供商: ${id}`)
      }

      const client = createLLMClient(
        id,
        settings.apiKey || '',
        settings.baseUrl || provider.defaultModels[0] ? undefined : undefined
      )
      this.clients.set(id, client)
    }

    return this.clients.get(id)!
  }

  // 获取当前模型
  getCurrentModel(): string {
    const provider = this.getActiveProvider()
    const settings = this.config.providers[this.config.activeProvider]
    
    if (settings?.modelId) {
      return settings.modelId
    }
    
    return provider?.defaultModels[0]?.id || 'gpt-4'
  }

  // 聊天
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const client = this.getClient()
    return client.chat(messages, {
      ...options,
      model: options.model || this.getCurrentModel(),
    })
  }

  // 流式聊天
  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncGenerator<StreamChunk, void, unknown> {
    const client = this.getClient()
    yield* client.chatStream(messages, {
      ...options,
      model: options.model || this.getCurrentModel(),
    })
  }

  // 检查提供商是否可用
  isProviderAvailable(providerId: string): boolean {
    const provider = getProvider(providerId)
    const settings = this.config.providers[providerId]
    
    if (!provider) return false
    if (!settings?.enabled) return false
    if (provider.apiKeyRequired && !settings.apiKey) return false
    
    return true
  }

  // 获取可用提供商列表
  getAvailableProviders(): ProviderConfig[] {
    return PROVIDERS.filter(p => this.isProviderAvailable(p.id))
  }

  // 导出配置
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2)
  }

  // 导入配置
  importConfig(json: string) {
    try {
      const config = JSON.parse(json) as LLMConfig
      this.updateConfig(config)
    } catch (e) {
      throw new Error('无效的配置格式')
    }
  }
}

// 默认配置
export const defaultLLMConfig: LLMConfig = {
  activeProvider: 'openai',
  providers: {
    openai: { enabled: true },
    anthropic: { enabled: false },
    google: { enabled: false },
    ollama: { enabled: false },
    deepseek: { enabled: false },
    siliconflow: { enabled: false },
    zhipu: { enabled: false },
    moonshot: { enabled: false },
    xiaomi: { enabled: false },
    doubao: { enabled: false },
    minimax: { enabled: false },
    qwen: { enabled: false },
    hunyuan: { enabled: false },
  },
}

// 单例管理器
let managerInstance: LLMManager | null = null

export function getLLMManager(config?: LLMConfig): LLMManager {
  if (!managerInstance) {
    managerInstance = new LLMManager(config || defaultLLMConfig)
  } else if (config) {
    managerInstance.updateConfig(config)
  }
  return managerInstance
}
