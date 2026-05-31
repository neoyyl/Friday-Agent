import { ipcMain, BrowserWindow } from 'electron'
import { createLLMClient } from '../../src/services/llm/clients'
import { getAllProviders } from '../../src/services/llm/providers'
import { LLMClient, ToolDefinition } from '../../src/services/llm/types'
import { getSettings } from '../../src/services/database/index'
import { getEnabledTools, executeTool, Tool } from '../../src/services/tools/index'

interface ResolveClientOptions {
  model?: string
  temperature?: number
  apiKey?: string
  provider?: string
  baseUrl?: string
  maxTokens?: number
  enableTools?: boolean
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
  chatMessages: Array<{ role: string; content: string; tool_call_id?: string; name?: string }>
): Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string }> {
  return chatMessages.map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
    content: msg.content,
    tool_call_id: msg.tool_call_id,
    name: msg.name,
  }))
}

function toolsToDefinitions(tools: Tool[]): ToolDefinition[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(
          t.parameters.map((p) => [p.name, { type: p.type, description: p.description, ...(p.enum ? { enum: p.enum } : {}) }])
        ),
        required: t.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }))
}

async function executeToolCall(toolName: string, argsStr: string): Promise<string> {
  try {
    const args = JSON.parse(argsStr)
    const result = await executeTool(toolName, args)
    return result.success ? (result.output || '工具执行成功') : `错误: ${result.error}`
  } catch (e) {
    return `工具执行异常: ${e instanceof Error ? e.message : String(e)}`
  }
}

export function registerLLMHandlers(): void {
  ipcMain.handle(
    'llm:chat',
    async (
      _event,
      chatMessages: Array<{ role: string; content: string; tool_call_id?: string; name?: string }>,
      options?: ResolveClientOptions
    ) => {
      try {
        const { client, model, temperature, maxTokens } = resolveClient(options)
        const enabledTools = getEnabledTools()
        const toolDefs = (options?.enableTools !== false && enabledTools.length > 0)
          ? toolsToDefinitions(enabledTools) : undefined
        const response = await client.chat(mapMessages(chatMessages), {
          model, temperature, maxTokens, tools: toolDefs,
        })
        const msg = response.choices[0].message

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const toolResults = await Promise.all(
            msg.tool_calls.map(async (tc) => ({
              tool_call_id: tc.id,
              role: 'tool' as const,
              content: await executeToolCall(tc.function.name, tc.function.arguments),
            }))
          )
          return {
            ...msg,
            tool_results: toolResults,
          }
        }
        return msg
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
