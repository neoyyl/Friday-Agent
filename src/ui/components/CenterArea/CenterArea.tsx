import { useState, useRef, useEffect } from 'react'
import { useChatStore, Message } from '../../../stores/chatStore'
import { useLanguageStore } from '../../../stores/languageStore'
import { MemoryGraph } from '../MemoryGraph/MemoryGraph'

const WELCOME_ID = 'welcome'
const WELCOME_MSG: Message = {
  id: WELCOME_ID,
  role: 'assistant',
  content: 'Hello! I\'m Friday, your AI assistant. How can I help you today?',
  created_at: new Date().toISOString(),
}

let sessionCreated = false

export function CenterArea() {
  const [inputValue, setInputValue] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const { messages, isLoading, sendMessage, setMessages } = useChatStore()
  const { t } = useLanguageStore()
  const [showGraph, setShowGraph] = useState(() => {
    return localStorage.getItem('friday-show-graph') !== 'false'
  })
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!sessionCreated) {
      sessionCreated = true
      setMessages([WELCOME_MSG])
    }
  }, [setMessages])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    const handleGraphToggle = (e: CustomEvent) => {
      setShowGraph(e.detail.show)
    }
    window.addEventListener('graph-toggle', handleGraphToggle as EventListener)
    return () => window.removeEventListener('graph-toggle', handleGraphToggle as EventListener)
  }, [])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return
    const content = inputValue
    setInputValue('')
    await sendMessage('default', content, true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="center-area">
      {showGraph && (
        <div className="memory-graph" id="graph">
          <MemoryGraph />
        </div>
      )}
      <div className={`console ${isExpanded ? 'expanded' : ''}`}>
        <div
          id="chat-messages"
          className={`chat-messages ${isExpanded ? 'expanded' : ''}`}
          ref={chatContainerRef}
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`msg ${msg.role === 'user' ? 'msg-user' : 'msg-jarvis'}`}>
              <div className="msg-label">{msg.role === 'user' ? 'YOU' : 'FRIDAY'}</div>
              <div className="msg-body">{msg.content}</div>
            </div>
          ))}
        </div>
        <button
          className="console-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? '收起聊天' : '展开聊天'}
        >
          {isExpanded ? '▼' : '▲'}
        </button>
        <div id="input-row">
          <span className="prompt-mark">❯</span>
          <input
            id="msg-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('INPUT_PLACEHOLDER')}
            disabled={isLoading}
          />
          <button id="send-btn" onClick={handleSend} disabled={isLoading}>
            {isLoading ? '...' : t('SEND')}
          </button>
        </div>
      </div>
    </div>
  )
}
