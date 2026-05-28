import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../../../stores/chatStore'
import { useLanguageStore } from '../../../stores/languageStore'
import { MemoryGraph } from '../MemoryGraph/MemoryGraph'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  label: string
}

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: 'assistant',
    content: 'Hello! I\'m Friday, your AI assistant. How can I help you today?',
    label: 'Friday',
  },
  {
    id: 2,
    role: 'user',
    content: '你好',
    label: 'You',
  },
  {
    id: 3,
    role: 'assistant',
    content: '你好！有什么我可以帮你的吗？',
    label: 'Friday',
  },
]

export function CenterArea() {
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showGraph, setShowGraph] = useState(() => {
    return localStorage.getItem('friday-show-graph') !== 'false'
  })
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const { addMessage } = useChatStore()
  const { t } = useLanguageStore()
  
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
  
  const handleSend = () => {
    if (!inputValue.trim()) return
    
    const newUserMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      label: 'You',
    }
    
    setMessages((prev) => [...prev, newUserMessage])
    
    addMessage({
      content: inputValue,
      role: 'user'
    })
    
    setInputValue('')
    
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `I received your message: "${inputValue}"`,
        label: 'Friday',
      }
      setMessages((prev) => [...prev, aiResponse])
    }, 500)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
  
  const toggleConsole = () => {
    setIsExpanded(!isExpanded)
  }
  
  return (
    <div className="center-area">
      {/* 记忆图谱 - 根据设置显示/隐藏 */}
      {showGraph && (
        <div className="memory-graph" id="graph">
          <MemoryGraph />
        </div>
      )}
      
      {/* 底部聊天控制台 */}
      <div className={`console ${isExpanded ? 'expanded' : ''}`}>
        {/* 聊天历史区域 */}
        <div 
          id="chat-messages" 
          className={`chat-messages ${isExpanded ? 'expanded' : ''}`}
          ref={chatContainerRef}
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`msg ${msg.role === 'user' ? 'msg-user' : 'msg-jarvis'}`}>
              <div className="msg-label">{msg.label}</div>
              <div className="msg-body">{msg.content}</div>
            </div>
          ))}
        </div>
        
        {/* 展开/收起按钮 */}
        <button 
          className="console-toggle"
          onClick={toggleConsole}
          title={isExpanded ? '收起聊天' : '展开聊天'}
        >
          {isExpanded ? '▼' : '▲'}
        </button>
        
        {/* 输入区域 */}
        <div id="input-row">
          <span className="prompt-mark">❯</span>
          <input
            id="msg-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('INPUT_PLACEHOLDER')}
          />
          <button id="send-btn" onClick={handleSend}>
            {t('SEND')}
          </button>
        </div>
      </div>
    </div>
  )
}
