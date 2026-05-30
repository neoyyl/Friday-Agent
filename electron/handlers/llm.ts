import { ipcMain, BrowserWindow } from 'electron'
import { createLLMClient } from '../../src/services/llm/clients'
import { getAllProviders } from '../../src/services/llm/providers'
import { LLMClient } from '../../src/services/llm/types'
import { getSettings } from '../../src/services/database/index'

interface ResolveClientOptions {
  model?: string
  temperature?: number
  apiKey?: string
  provider?: string
  baseUrl?: string
  maxTokens?: number
}

interface ResolvedClient {
  client: LLMClient
  model: string
  temperature: number
  maxTokens: number
}

function resolveClient(options?: ResolveClientOptions): ResolvedClient {
  const settings = getSettings()
  const provider = options?.provider || 'openai'
  const apiKey = options?.apiKey || settings.apiKey
  const baseUrl = options?.baseUrl
  let model = options?.model || settings.model || 'gpt-4o'
  const temperature = options?.temperature ?? (parseFloat(settings.temperature) || 0.7)
  const maxTokens = options?.maxTokens ?? (parseInt(settings.maxTokens) || 4096)

  if (provider !== 'openrouter' && model.includes('/')) {
    model = model.split('/').pop() || model
  }

  const client = createLLMClient(provider, apiKey, baseUrl)
  return { client, model, temperature, maxTokens }
}

function mapMessages(
  chatMessages: Array<{ role: string; content: string }>
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  return chatMessages.map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content,
  }))
}

export function registerLLMHandlers(): void {
  ipcMain.handle(
    'llm:chat',
    async (
      _event,
      chatMessages: Array<{ role: string; content: string }>,
      options?: ResolveClientOptions
    ) => {
      try {
        const { client, model, temperature, maxTokens } = resolveClient(options)
        const response = await client.chat(mapMessages(chatMessages), {
          model,
          temperature,
          maxTokens,
        })
        return response.choices[0].message
      } catch (error) {
        console.error('LLM chat error:', error)
        return {
          role: 'assistant',
          content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
        }
      }
    }
  )

  ipcMain.handle(
    'llm:chatStream',
    async (
      _event,
      chatMessages: Array<{ role: string; content: string }>,
      options?: ResolveClientOptions
    ) => {
      try {
        const { client, model, temperature, maxTokens } = resolveClient(options)
        let fullContent = ''

        for await (const chunk of client.chatStream(mapMessages(chatMessages), {
          model,
          temperature,
          maxTokens,
        })) {
          if (chunk.choices[0]?.delta?.content) {
            fullContent += chunk.choices[0].delta.content
            const win = BrowserWindow.getAllWindows()[0]
            if (win && !win.isDestroyed()) {
              win.webContents.send('llm:streamChunk', chunk.choices[0].delta.content)
            }
          }
        }

        const win = BrowserWindow.getAllWindows()[0]
        if (win && !win.isDestroyed()) {
          win.webContents.send('llm:streamDone')
        }

        return { role: 'assistant', content: fullContent }
      } catch (error) {
        console.error('LLM stream error:', error)
        return {
          role: 'assistant',
          content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
        }
      }
    }
  )

  ipcMain.handle('llm:getModels', () => {
    return getAllProviders().flatMap((p) =>
      p.defaultModels.map((m) => ({ id: m.id, name: m.name, provider: p.name }))
    )
  })
}
