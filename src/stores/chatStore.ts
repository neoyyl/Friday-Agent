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

    // 添加用户消息到 UI
    addMessage({ role: 'user', content })

    // 设置加载状态
    setLoading(true)
    setStreaming(useStream)
    setError(null)

    try {
      if (useStream) {
        // 流式响应
        const aiMessageId = addMessage({ role: 'assistant', content: '' })

        // 设置流式响应监听
        const unsubscribeChunk = (window as any).electronAPI.llm.onStreamChunk((chunk: string) => {
          appendToMessage(aiMessageId, chunk)
        })

        const unsubscribeDone = (window as any).electronAPI.llm.onStreamDone(() => {
          unsubscribeChunk()
          unsubscribeDone()
          setLoading(false)
          setStreaming(false)
        })

        // 发送消息
        await (window as any).electronAPI.llm.chatStream(
          messages
            .filter((msg) => msg.content)
            .map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          {}
        )
      } else {
        // 非流式响应
        const response = await (window as any).electronAPI.llm.chat(
          messages
            .filter((msg) => msg.content)
            .map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          {}
        )

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
