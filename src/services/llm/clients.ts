import { LLMClient, ChatMessage, ChatOptions, ChatResponse, StreamChunk } from './types'

// OpenAI 兼容的客户端（适用于大多数提供商）
export class OpenAICompatibleClient implements LLMClient {
  protected apiKey: string
  protected baseUrl: string
  protected headers: Record<string, string>

  constructor(apiKey: string, baseUrl: string, extraHeaders: Record<string, string> = {}) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders,
    }
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: options.model || 'gpt-4',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 4096,
      stream: false,
    }
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools
    }
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`API error: ${response.status} - ${JSON.stringify(error)}`)
    }

    return response.json()
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: options.model || 'gpt-4',
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 4096,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`API error: ${response.status} - ${JSON.stringify(error)}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6)
          if (data === '[DONE]') return
          try {
            yield JSON.parse(data) as StreamChunk
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

// Anthropic 客户端
export class AnthropicClient implements LLMClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = 'https://api.anthropic.com') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const systemMessage = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        system: systemMessage?.content,
        messages: chatMessages,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(error)}`)
    }

    const data = await response.json()
    return {
      id: data.id,
      choices: [{
        message: {
          role: 'assistant',
          content: data.content[0]?.text || '',
        },
        finish_reason: data.stop_reason || 'stop',
      }],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    }
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncGenerator<StreamChunk, void, unknown> {
    const systemMessage = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        system: systemMessage?.content,
        messages: chatMessages,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(error)}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6)
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content_block_delta') {
              yield {
                id: '',
                choices: [{
                  delta: { content: parsed.delta?.text },
                  finish_reason: null,
                }],
              }
            } else if (parsed.type === 'message_stop') {
              return
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

// Google Gemini 客户端
export class GoogleClient implements LLMClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = 'https://generativelanguage.googleapis.com') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const model = options.model || 'gemini-1.5-pro'
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await fetch(
      `${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens || 4096,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Google API error: ${response.status} - ${JSON.stringify(error)}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return {
      id: `gemini-${Date.now()}`,
      choices: [{
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0,
      },
    }
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncGenerator<StreamChunk, void, unknown> {
    const model = options.model || 'gemini-1.5-pro'
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await fetch(
      `${this.baseUrl}/v1beta/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens || 4096,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Google API error: ${response.status} - ${JSON.stringify(error)}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6)
          try {
            const parsed = JSON.parse(data)
            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text
            if (content) {
              yield {
                id: `gemini-${Date.now()}`,
                choices: [{
                  delta: { content },
                  finish_reason: null,
                }],
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

// Ollama 客户端（本地模型）
export class OllamaClient implements LLMClient {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || 'llama3',
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens || 4096,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return {
      id: `ollama-${Date.now()}`,
      choices: [{
        message: { role: 'assistant', content: data.message?.content || '' },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    }
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || 'llama3',
        messages,
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens || 4096,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama API error: ${response.status} - ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.message?.content) {
              yield {
                id: `ollama-${Date.now()}`,
                choices: [{
                  delta: { content: parsed.message.content },
                  finish_reason: parsed.done ? 'stop' : null,
                }],
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

// 创建客户端工厂
export function createLLMClient(providerId: string, apiKey: string, baseUrl?: string): LLMClient {
  switch (providerId) {
    case 'openai':
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://api.openai.com/v1')
    case 'anthropic':
      return new AnthropicClient(apiKey, baseUrl)
    case 'google':
      return new GoogleClient(apiKey, baseUrl)
    case 'ollama':
      return new OllamaClient(baseUrl || 'http://localhost:11434')
    case 'deepseek':
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://api.deepseek.com/v1')
    case 'siliconflow':
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://api.siliconflow.cn/v1')
    case 'zhipu':
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://open.bigmodel.cn/api/paas/v4')
    case 'moonshot':
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://api.moonshot.cn/v1')
    case 'xiaomi':
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://api.xiaomi.com/v1')
    case 'doubao':
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://ark.cn-beijing.volces.com/api/v3')
    case 'minimax':
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://api.minimax.chat/v1')
    case 'qwen':
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    case 'hunyuan':
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://hunyuan.tencentcloudapi.com/v1')
    default:
      return new OpenAICompatibleClient(apiKey, baseUrl || 'https://api.openai.com/v1')
  }
}
