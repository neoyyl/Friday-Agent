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
  hasMore: boolean
  isLoadingMore: boolean

  setMessages: (messages: Message[]) => void
  deleteMessage: (id: string) => void
  addMessage: (message: Omit<Message, 'id' | 'created_at'>) => string
  prependMessages: (messages: Message[]) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  appendToMessage: (id: string, content: string) => void
  setLoading: (loading: boolean) => void
  setStreaming: (streaming: boolean) => void
  setError: (error: string | null) => void
  clearMessages: () => void

  loadMessages: (sessionId: string) => Promise<void>
  loadMoreMessages: (sessionId: string) => Promise<void>
  sendMessage: (sessionId: string, content: string, useStream?: boolean) => Promise<void>
  retryLastMessage: () => Promise<void>
  editAndResend: (messageId: string, newContent: string) => Promise<void>
}

const PAGE_SIZE = 40

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  hasMore: false,
  isLoadingMore: false,

  setMessages: (messages) => set({ messages }),

  deleteMessage: (id: string) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    }))
  },

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

  prependMessages: (olderMessages) => {
    set((state) => ({
      messages: [...olderMessages, ...state.messages],
    }))
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
      set({ hasMore: messages.length >= PAGE_SIZE })
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  },

  loadMoreMessages: async (sessionId) => {
    const { messages, isLoadingMore, prependMessages } = get()
    if (isLoadingMore) return
    set({ isLoadingMore: true })
    try {
      const offset = messages.length
      const olderMessages = await window.electronAPI!.messages.list(sessionId, PAGE_SIZE, offset) as Message[]
      if (olderMessages.length > 0) {
        prependMessages(olderMessages)
      }
      set({ hasMore: olderMessages.length >= PAGE_SIZE })
    } catch (error) {
      console.error('Failed to load more messages:', error)
    } finally {
      set({ isLoadingMore: false })
    }
  },

  sendMessage: async (sessionId, content, useStream = true) => {
    const { addMessage, setLoading, setStreaming, setError, appendToMessage, messages } = get()
    const st = useSettingsStore.getState().settings
    const provider = st.provider || 'openai'
    const model = st.model || 'gpt-4o'
    const temperature = parseFloat(st.temperature || '0.7')
    const maxTokens = parseInt(st.maxTokens || '4096')
    const apiKey = st.apiKey || ''
    const baseUrl = (st as any).baseUrl || undefined
    const lang = st.voiceLang || 'zh-CN'

    const langPrompt = lang.startsWith('zh') ? '请始终使用中文回复。' : 'Please always respond in English.'
    const llmOptions = { model, temperature, maxTokens, apiKey, provider, baseUrl }

    addMessage({ role: 'user', content })

    const userMsgCount = messages.filter(m => m.role === 'user').length
    if (userMsgCount === 0 && sessionId !== 'default') {
      try {
        const title = content.slice(0, 40) + (content.length > 40 ? '...' : '')
        const sessions = await window.electronAPI!.sessions.list() as Array<{ id: string; title: string }>
        const session = sessions.find((s: { id: string }) => s.id === sessionId)
        if (session && session.title.startsWith('新对话')) {
          await window.electronAPI!.sessions.update(sessionId, title)
        }
      } catch {
        // non-critical
      }
    }

    try {
      if (sessionId !== 'default') {
        try {
          await window.electronAPI!.messages.create(sessionId, 'user', content)
        } catch {
          // ignore message save failure
        }
      }
      await window.electronAPI!.backend.memory.save({ role: 'user', content })
    } catch {
      // non-critical
    }

    setLoading(true)
    setStreaming(useStream)
    setError(null)

    const systemMessage = { role: 'system' as const, content: `你是 Friday，一个个人 AI 助手。${langPrompt}` }

    const personalityData = await window.electronAPI!.backend.personality.get()
    const personality = personalityData?.data?.content || ''

    const memoryData = await window.electronAPI!.backend.memory.context()
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
            window.electronAPI!.backend.memory.save({ role: 'assistant', content: lastMsg.content }).catch(() => {})
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
          window.electronAPI!.backend.memory.save({ role: 'assistant', content: response.content }).catch(() => {})
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '发送消息失败'
      setError(msg)
      setLoading(false)
      setStreaming(false)
    }
  },

  retryLastMessage: async () => {
    const { messages, sendMessage } = get()
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return
    set({ error: null })
    await sendMessage('default', lastUserMsg.content, true)
  },

  editAndResend: async (messageId, newContent) => {
    const { messages, updateMessage } = get()
    const msgIndex = messages.findIndex(m => m.id === messageId)
    if (msgIndex === -1) return
    updateMessage(messageId, { content: newContent })
    const truncatedMessages = messages.slice(0, msgIndex + 1).map(m =>
      m.id === messageId ? { ...m, content: newContent } : m
    )
    set({ messages: truncatedMessages, error: null })
    const msg = get()
    const last = msg.messages[msg.messages.length - 1]
    if (last && last.role === 'user') {
      const st = useSettingsStore.getState().settings
      const provider = st.provider || 'openai'
      const model = st.model || 'gpt-4o'
      const lang = st.voiceLang || 'zh-CN'
      const llmOptions = {
        model,
        temperature: parseFloat(st.temperature || '0.7'),
        maxTokens: parseInt(st.maxTokens || '4096'),
        apiKey: st.apiKey || '',
        provider,
        baseUrl: (st as any).baseUrl || undefined,
      }
      msg.setLoading(true)
      msg.setStreaming(true)
      const systemMsg = lang.startsWith('zh')
        ? { role: 'system' as const, content: '你是 Friday，一个个人 AI 助手。请始终使用中文回复。' }
        : { role: 'system' as const, content: 'You are Friday, an AI assistant. Always respond in English.' }
      const apiMessages = [systemMsg, ...msg.messages.filter(m => m.content).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))]
      try {
        const aiMsgId = msg.addMessage({ role: 'assistant', content: '' })
        const unsubChunk = window.electronAPI!.llm.onStreamChunk((chunk: string) => {
          msg.appendToMessage(aiMsgId, chunk)
        })
        const unsubDone = window.electronAPI!.llm.onStreamDone(() => {
          unsubChunk()
          unsubDone()
          msg.setLoading(false)
          msg.setStreaming(false)
        })
        await window.electronAPI!.llm.chatStream(apiMessages, llmOptions)
      } catch (err) {
        msg.setLoading(false)
        msg.setStreaming(false)
        msg.setError(err instanceof Error ? err.message : '发送失败')
      }
    }
  },
}))
