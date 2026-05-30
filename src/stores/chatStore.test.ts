import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from './chatStore'

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
    })
  })

  it('starts with empty state', () => {
    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.isStreaming).toBe(false)
    expect(state.error).toBeNull()
  })

  it('addMessage creates a message with id and timestamp', () => {
    const { addMessage } = useChatStore.getState()
    const id = addMessage({ role: 'user', content: 'hello' })
    expect(id).toBeTruthy()
    const msg = useChatStore.getState().messages[0]
    expect(msg.role).toBe('user')
    expect(msg.content).toBe('hello')
    expect(msg.id).toBe(id)
    expect(msg.created_at).toBeTruthy()
  })

  it('addMessage creates assistant messages', () => {
    const { addMessage } = useChatStore.getState()
    addMessage({ role: 'assistant', content: 'hi there' })
    const msg = useChatStore.getState().messages[0]
    expect(msg.role).toBe('assistant')
    expect(msg.content).toBe('hi there')
  })

  it('updateMessage patches existing message', () => {
    const { addMessage, updateMessage } = useChatStore.getState()
    const id = addMessage({ role: 'user', content: 'hello' })
    updateMessage(id, { content: 'updated' })
    expect(useChatStore.getState().messages[0].content).toBe('updated')
  })

  it('appendToMessage appends content', () => {
    const { addMessage, appendToMessage } = useChatStore.getState()
    const id = addMessage({ role: 'assistant', content: 'thinking...' })
    appendToMessage(id, ' done')
    expect(useChatStore.getState().messages[0].content).toBe('thinking... done')
  })

  it('clearMessages resets messages and error', () => {
    const { addMessage, clearMessages } = useChatStore.getState()
    addMessage({ role: 'user', content: 'test' })
    useChatStore.setState({ error: 'something went wrong' })
    clearMessages()
    expect(useChatStore.getState().messages).toEqual([])
    expect(useChatStore.getState().error).toBeNull()
  })

  it('setLoading and setStreaming toggle flags', () => {
    useChatStore.getState().setLoading(true)
    expect(useChatStore.getState().isLoading).toBe(true)
    useChatStore.getState().setStreaming(true)
    expect(useChatStore.getState().isStreaming).toBe(true)
    useChatStore.getState().setLoading(false)
    expect(useChatStore.getState().isLoading).toBe(false)
  })

  it('setError stores error message', () => {
    useChatStore.getState().setError('API error')
    expect(useChatStore.getState().error).toBe('API error')
    useChatStore.getState().setError(null)
    expect(useChatStore.getState().error).toBeNull()
  })

  it('setMessages replaces entire message list', () => {
    const { addMessage, setMessages } = useChatStore.getState()
    addMessage({ role: 'user', content: 'old' })
    setMessages([{
      id: '1', role: 'assistant', content: 'new',
      created_at: new Date().toISOString(),
    }])
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().messages[0].content).toBe('new')
  })

  it('handles multiple messages in order', () => {
    const { addMessage } = useChatStore.getState()
    addMessage({ role: 'user', content: 'first' })
    addMessage({ role: 'assistant', content: 'second' })
    addMessage({ role: 'user', content: 'third' })
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(3)
    expect(msgs[0].content).toBe('first')
    expect(msgs[1].content).toBe('second')
    expect(msgs[2].content).toBe('third')
  })
})
