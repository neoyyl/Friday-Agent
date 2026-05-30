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
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [asrStatus, setAsrStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pcmChunksRef = useRef<Float32Array[]>([])

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
    let cancelled = false
    const poll = async () => {
      for (const port of [5000, 5001]) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/asr/status`, { signal: AbortSignal.timeout(3000) })
          if (!res.ok) continue
          const data = await res.json()
          console.log(`[ASR] Port ${port} status:`, data)
          if (!cancelled) setAsrStatus(data?.ready ? 'ready' : 'loading')
          return
        } catch (e) {
          console.log(`[ASR] Port ${port} failed:`, e)
          continue
        }
      }
      if (!cancelled) setAsrStatus('unavailable')
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => { cancelled = true; clearInterval(id) }
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

  const float32ToInt16 = (float32: Float32Array): ArrayBuffer => {
    const int16 = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return int16.buffer
  }

  const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return btoa(binary)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })
      streamRef.current = stream
      const ctx = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      pcmChunksRef.current = []

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0)
        pcmChunksRef.current.push(new Float32Array(data))
      }

      source.connect(processor)
      processor.connect(ctx.destination)
      setIsRecording(true)
    } catch (err) {
      console.error('Microphone access denied:', err)
    }
  }

  const transcribeViaRest = async (base64: string): Promise<string> => {
    for (const port of [5000, 5001]) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/asr/transcribe`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64, lang: 'zh' }),
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) continue
        const data = await res.json()
        if (data?.text) return data.text
      } catch { continue }
    }
    return ''
  }

  const stopRecording = async () => {
    setIsRecording(false)
    audioContextRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())

    if (pcmChunksRef.current.length === 0) return
    setIsTranscribing(true)
    try {
      const totalLen = pcmChunksRef.current.reduce((s, c) => s + c.length, 0)
      const merged = new Float32Array(totalLen)
      let offset = 0
      for (const chunk of pcmChunksRef.current) {
        merged.set(chunk, offset)
        offset += chunk.length
      }
      const pcmBuf = float32ToInt16(merged)
      const base64 = arrayBufferToBase64(pcmBuf)
      const transcribe = window.electronAPI?.kernel?.voice?.transcribe
      let text: string
      if (transcribe) {
        const result = await transcribe(base64)
        text = result?.data?.text || ''
      } else {
        text = await transcribeViaRest(base64)
      }
      if (text) setInputValue(prev => prev + text)
    } catch (err) {
      console.error('ASR failed:', err)
    } finally {
      setIsTranscribing(false)
    }
  }

  const toggleRecording = () => {
    if (isRecording) stopRecording()
    else startRecording()
  }

  return (
    <div className="center-area">
      {/* 主内容区 */}
      <div className="memory-graph" id="graph">
        <MemoryGraph />
      </div>

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
          <button
            id="mic-btn"
            onClick={toggleRecording}
            disabled={isTranscribing}
            title={isRecording ? '停止录音' : '语音输入'}
            style={{
              background: isRecording ? '#ef4444' : 'transparent',
              color: isRecording ? '#fff' : '#9ca3af',
              border: 'none',
              cursor: isTranscribing ? 'wait' : 'pointer',
              fontSize: '18px',
              padding: '0 8px',
              transition: 'all 0.2s',
            }}
          >
            {isTranscribing ? '⏳' : isRecording ? '⏹' : '🎙️'}
          </button>
          <span
            style={{
              fontSize: '11px', marginLeft: '6px',
              color: asrStatus === 'ready' ? '#22c55e' : asrStatus === 'loading' ? '#eab308' : '#ef4444',
              opacity: asrStatus === 'ready' ? 0 : 1,
              transition: 'opacity 0.5s',
            }}
          >
            {asrStatus === 'loading' ? '语音加载中' : asrStatus === 'unavailable' ? '语音不可用' : '语音就绪'}
          </span>
          <span className="prompt-mark">❯</span>
          <input
            id="msg-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? '正在录音...' : isTranscribing ? '识别中...' : t('INPUT_PLACEHOLDER')}
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
