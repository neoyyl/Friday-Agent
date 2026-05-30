import { create } from 'zustand'
import { useSettingsStore } from './settingsStore'
import type { LLMMessage } from '../types/electron-api'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  created_at: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
  result?: string
}

interface ChatState {
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null

  setMessages: (messages: Message[]) => void
  addMessage: (message: Omit<Message, 'id' | 'created_at'>) => string
  updateMessage: (id: string, updates: Partial<Message>) => void
  appendToMessage: (id: string, content: string) => void
  setLoading: (loading: boolean) => void
  setStreaming: (streaming: boolean) => void
  setError: (error: string | null) => void
  clearMessages: () => void

  loadMessages: (sessionId: string) => Promise<void>
  sendMessage: (sessionId: string, content: string, useStream?: boolean) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    }
    set((state) => ({
      messages: [...state.messages, newMessage],
    }))
    return newMessage.id
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
    }))
  },

  appendToMessage: (id, content) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content: msg.content + content } : msg
      ),
    }))
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setError: (error) => set({ error }),

  clearMessages: () => set({ messages: [], error: null }),

  loadMessages: async (sessionId) => {
    const { setMessages } = get()
    try {
      const messages = await window.electronAPI!.messages.list(sessionId) as Message[]
      setMessages(messages)
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  },

  sendMessage: async (_sessionId, content, useStream = true) => {
    const { addMessage, setLoading, setStreaming, setError, appendToMessage, messages } = get()

    const st = useSettingsStore.getState().settings
    const provider = st.provider || 'openai'
    const model = st.model || 'gpt-4o'
    const temperature = parseFloat(st.temperature || '0.7')
    const maxTokens = parseInt(st.maxTokens || '4096')
    const apiKey = st.apiKey || ''
    const baseUrl = (st as any).baseUrl || undefined
    const lang = localStorage.getItem('friday-voice-lang') || 'zh-CN'

    const langPrompt = lang.startsWith('zh') ? '请始终使用中文回复。' : 'Please always respond in English.'
    const llmOptions = { model, temperature, maxTokens, apiKey, provider, baseUrl }

    addMessage({ role: 'user', content })

    try {
      await window.electronAPI!.kernel.memory.save({ role: 'user', content })
    } catch {
      // non-critical
    }

    setLoading(true)
    setStreaming(useStream)
    setError(null)

    const systemMessage = { role: 'system' as const, content: `你是 Friday，一个个人 AI 助手。${langPrompt}` }

    const personalityData = await window.electronAPI!.kernel.personality.get()
    const personality = personalityData?.data?.content || ''

    const memoryData = await window.electronAPI!.kernel.memory.context()
    const memoryContext = (memoryData?.data?.context || []) as LLMMessage[]

    const finalSystemMessage = personality
      ? { role: 'system' as const, content: `${personality}\n\n${langPrompt}` }
      : systemMessage

    const apiMessages = [finalSystemMessage, ...memoryContext, ...messages.filter((msg) => msg.content).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))]

    try {
      if (useStream) {
        const aiMessageId = addMessage({ role: 'assistant', content: '' })

        const unsubscribeChunk = window.electronAPI!.llm.onStreamChunk((chunk: string) => {
          appendToMessage(aiMessageId, chunk)
        })

        let streamDone = false
        const unsubscribeDone = window.electronAPI!.llm.onStreamDone(() => {
          streamDone = true
          unsubscribeChunk()
          unsubscribeDone()
          setLoading(false)
          setStreaming(false)
          const msgs = get().messages
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg?.role === 'assistant' && lastMsg.content) {
            window.electronAPI!.kernel.memory.save({ role: 'assistant', content: lastMsg.content }).catch(() => {})
          }
        })

        try {
          await window.electronAPI!.llm.chatStream(apiMessages, llmOptions)
        } catch (streamErr) {
          if (!streamDone) {
            unsubscribeChunk()
            unsubscribeDone()
            setStreaming(false)
            const errMsg = streamErr instanceof Error ? streamErr.message : '流式连接中断'
            setError(`${errMsg} — 点击重试`)
          }
        }
      } else {
        const response = await window.electronAPI!.llm.chat(apiMessages, llmOptions)

        addMessage({ role: 'assistant', content: response.content })
        setLoading(false)
        if (response.content) {
          window.electronAPI!.kernel.memory.save({ role: 'assistant', content: response.content }).catch(() => {})
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '发送消息失败'
      setError(msg)
      setLoading(false)
      setStreaming(false)
    }
  },
}))
