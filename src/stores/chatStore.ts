import { create } from 'zustand'

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

  // Actions
  setMessages: (messages: Message[]) => void
  addMessage: (message: Omit<Message, 'id' | 'created_at'>) => string
  updateMessage: (id: string, updates: Partial<Message>) => void
  appendToMessage: (id: string, content: string) => void
  setLoading: (loading: boolean) => void
  setStreaming: (streaming: boolean) => void
  setError: (error: string | null) => void
  clearMessages: () => void

  // Async actions
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
      id: Date.now().toString(),
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
      const messages = await (window as any).electronAPI.messages.list(sessionId)
      setMessages(messages)
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  },

  sendMessage: async (_sessionId, content, useStream = true) => {
    const { addMessage, setLoading, setStreaming, setError, appendToMessage, messages } = get()

    const provider = localStorage.getItem('friday-provider') || 'openai'
    const model = localStorage.getItem('friday-model') || 'gpt-4o'
    const temperature = parseFloat(localStorage.getItem('friday-temperature') || '0.7')
    const maxTokens = parseInt(localStorage.getItem('friday-max-tokens') || '4096')
    const apiKey = localStorage.getItem('friday-api-key') || ''
    const baseUrl = localStorage.getItem('friday-base-url') || undefined
    const lang = localStorage.getItem('friday-voice-lang') || 'zh-CN'
    const langPrompt = lang.startsWith('zh') ? '请始终使用中文回复。' : 'Please always respond in English.'
    const llmOptions = { model, temperature, maxTokens, apiKey, provider, baseUrl }

    addMessage({ role: 'user', content })

    setLoading(true)
    setStreaming(useStream)
    setError(null)

    const systemMessage = { role: 'system' as const, content: `你是 Friday，一个个人 AI 助手。${langPrompt}` }
    const apiMessages = [systemMessage, ...messages.filter((msg) => msg.content).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))]

    try {
      if (useStream) {
        const aiMessageId = addMessage({ role: 'assistant', content: '' })

        const unsubscribeChunk = (window as any).electronAPI.llm.onStreamChunk((chunk: string) => {
          appendToMessage(aiMessageId, chunk)
        })

        const unsubscribeDone = (window as any).electronAPI.llm.onStreamDone(() => {
          unsubscribeChunk()
          unsubscribeDone()
          setLoading(false)
          setStreaming(false)
        })

        await (window as any).electronAPI.llm.chatStream(apiMessages, llmOptions)
      } else {
        const response = await (window as any).electronAPI.llm.chat(apiMessages, llmOptions)

        addMessage({ role: 'assistant', content: response.content })
        setLoading(false)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '发送消息失败')
      setLoading(false)
      setStreaming(false)
    }
  },
}))
