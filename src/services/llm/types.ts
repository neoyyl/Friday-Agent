// 统一 LLM 接口定义
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatResponse {
  id: string
  choices: Array<{
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface StreamChunk {
  id: string
  choices: Array<{
    delta: {
      role?: string
      content?: string
    }
    finish_reason: string | null
  }>
}

// 提供商配置接口
export interface ProviderConfig {
  id: string
  name: string
  icon: string
  description: string
  apiKeyRequired: boolean
  baseUrl?: string
  defaultModels: ModelInfo[]
  settings: ProviderSettings[]
}

export interface ModelInfo {
  id: string
  name: string
  maxTokens: number
  description?: string
}

export interface ProviderSettings {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'select' | 'url'
  placeholder?: string
  defaultValue?: string
  options?: Array<{ label: string; value: string }>
  required?: boolean
}

// 统一 LLM 客户端接口
export interface LLMClient {
  chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse>
  chatStream(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<StreamChunk, void, unknown>
}

// 提供商注册表
export interface ProviderRegistry {
  [key: string]: ProviderConfig
}
