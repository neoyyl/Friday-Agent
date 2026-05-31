import { useState, useRef, useEffect, useCallback } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { useChatStore, Message } from '../../../stores/chatStore'
import { useLanguageStore } from '../../../stores/languageStore'
import { useSessionStore } from '../../../stores/sessionStore'
import { MemoryGraph } from '../MemoryGraph/MemoryGraph'
import { MessageContent } from './MessageContent'

const WELCOME_ID = 'welcome'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain', 'text/markdown', 'application/json', 'text/csv']

interface AttachedFile {
  id: string
  name: string
  type: string
  size: number
  dataUrl: string
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file)
    } else {
      reader.readAsText(file)
    }
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getWelcomeMessage(lang: 'zh' | 'en'): Message {
  const content = lang === 'zh'
    ? '你好！我是 Friday，你的个人 AI 助手。今天我能帮你做什么？'
    : "Hello! I'm Friday, your AI assistant. How can I help you today?"
  return {
    id: WELCOME_ID,
    role: 'assistant',
    content,
    created_at: new Date().toISOString(),
  }
}

let sessionCreated = false

export function CenterArea() {
  const [inputValue, setInputValue] = useState('')
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const { messages, isLoading, sendMessage, setMessages, error, retryLastMessage, loadMessages, isStreaming, hasMore, isLoadingMore, loadMoreMessages, editAndResend } = useChatStore()
  const { t, language } = useLanguageStore()
  const { activeSessionId } = useSessionStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [asrStatus, setAsrStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pcmChunksRef = useRef<Float32Array[]>([])

  useEffect(() => {
    if (!sessionCreated) {
      sessionCreated = true
      setMessages([getWelcomeMessage(language)])
    }
  }, [setMessages, language])

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId)
    }
  }, [activeSessionId, loadMessages])

  const handleAtBottomStateChange = useCallback((bottom: boolean) => {
    setAtBottom(bottom)
  }, [])

  const handleStartReached = useCallback(() => {
    if (hasMore && !isLoadingMore && activeSessionId) {
      loadMoreMessages(activeSessionId)
    }
  }, [hasMore, isLoadingMore, activeSessionId, loadMoreMessages])

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' })
  }, [messages.length])

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
    if ((!inputValue.trim() && attachedFiles.length === 0) || isLoading) return
    let content = inputValue.trim()
    if (attachedFiles.length > 0) {
      const fileParts = attachedFiles.map(f => {
        if (f.type.startsWith('image/')) {
          return `![${f.name}](${f.dataUrl})`
        }
        return `[文件: ${f.name}]\n\`\`\`\n${f.dataUrl.slice(0, 2000)}${f.dataUrl.length > 2000 ? '\n...(已截断)' : ''}\n\`\`\``
      })
      content = content ? `${content}\n\n${fileParts.join('\n\n')}` : fileParts.join('\n\n')
    }
    setInputValue('')
    setAttachedFiles([])
    await sendMessage(activeSessionId || 'default', content, true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    const valid = files.filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) return false
      if (f.size > MAX_FILE_SIZE) return false
      return true
    })
    if (valid.length === 0) return
    const attached: AttachedFile[] = await Promise.all(
      valid.map(async (f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        type: f.type,
        size: f.size,
        dataUrl: await fileToDataUrl(f),
      }))
    )
    setAttachedFiles(prev => [...prev, ...attached])
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }, [processFiles])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      processFiles(files)
    }
  }, [processFiles])

  const removeFile = useCallback((id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const startEditMessage = useCallback((msg: Message) => {
    setEditingMessageId(msg.id)
    setEditContent(msg.content)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null)
    setEditContent('')
  }, [])

  const handleEditSubmit = useCallback(async () => {
    if (!editingMessageId || !editContent.trim()) return
    await editAndResend(editingMessageId, editContent.trim())
    setEditingMessageId(null)
    setEditContent('')
  }, [editingMessageId, editContent, editAndResend])

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit()
    }
    if (e.key === 'Escape') {
      cancelEdit()
    }
  }, [handleEditSubmit, cancelEdit])

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
      const transcribe = window.electronAPI?.backend?.voice?.transcribe
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
    <div className="center-area"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 主内容区 */}
      <div className="memory-graph" id="graph">
        <MemoryGraph />
      </div>

      <div className={`console ${isExpanded ? 'expanded' : ''}`}>
        <div
          className={`chat-messages ${isExpanded ? 'expanded' : ''}`}
        >
          {isExpanded && (
            <Virtuoso
              ref={virtuosoRef}
              data={messages}
              followOutput={isStreaming ? 'smooth' : 'auto'}
              atBottomStateChange={handleAtBottomStateChange}
              startReached={handleStartReached}
              firstItemIndex={10000}
              itemContent={(_index, msg) => (
                <div className={`msg ${msg.role === 'user' ? 'msg-user' : 'msg-jarvis'}`}>
                  <div className="msg-label">
                    {msg.role === 'user' ? 'YOU' : 'FRIDAY'}
                    {msg.role === 'user' && !isLoading && (
                      <button
                        className="msg-edit-btn"
                        onClick={() => startEditMessage(msg)}
                        title="编辑消息"
                      >
                        ✎
                      </button>
                    )}
                  </div>
                  {editingMessageId === msg.id ? (
                    <div className="msg-edit-area">
                      <textarea
                        className="msg-edit-input"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        rows={3}
                        autoFocus
                      />
                      <div className="msg-edit-buttons">
                        <button className="msg-edit-submit" onClick={handleEditSubmit}>保存并重发</button>
                        <button className="msg-edit-cancel" onClick={cancelEdit}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <div className="msg-body">
                      <MessageContent content={msg.content} />
                    </div>
                  )}
                </div>
              )}
              components={{
                Header: () => isLoadingMore ? (
                  <div style={{ textAlign: 'center', padding: '8px', color: 'var(--dim)', fontSize: '11px' }}>
                    加载更多消息...
                  </div>
                ) : null,
                Footer: () => (
                  <>
                    {isLoading && (
                      <div className="msg msg-jarvis">
                        <div className="msg-label">FRIDAY</div>
                        <div className="msg-body">
                          <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
                        </div>
                      </div>
                    )}
                    {error && (
                      <div className="msg msg-error">
                        <div className="msg-label">ERROR</div>
                        <div className="msg-body">
                          <p className="error-text">{error}</p>
                          <button className="retry-btn" onClick={retryLastMessage}>
                            {t('RETRY')}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ),
              }}
            />
          )}
          {!isExpanded && (
            <div className="msg msg-jarvis">
              <div className="msg-label">FRIDAY</div>
              <div className="msg-body">
                <MessageContent content={messages[messages.length - 1]?.content || ''} />
              </div>
            </div>
          )}
        </div>
        {atBottom === false && isExpanded && (
          <button
            className="scroll-to-bottom-btn"
            onClick={scrollToBottom}
            title="滚动到底部"
          >
            ↓
          </button>
        )}
        <button
          className="console-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? '收起聊天' : '展开聊天'}
        >
          {isExpanded ? '▼' : '▲'}
        </button>
        {attachedFiles.length > 0 && (
          <div className="file-preview-bar">
            {attachedFiles.map((file) => (
              <div key={file.id} className="file-preview-item">
                {file.type.startsWith('image/') ? (
                  <img src={file.dataUrl} alt={file.name} className="file-preview-img" />
                ) : (
                  <span className="file-preview-icon">📄</span>
                )}
                <span className="file-preview-name" title={file.name}>{file.name}</span>
                <span className="file-preview-size">{formatFileSize(file.size)}</span>
                <button
                  className="file-preview-remove"
                  onClick={() => removeFile(file.id)}
                  title="移除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
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
            onPaste={handlePaste}
            placeholder={isRecording ? '正在录音...' : isTranscribing ? '识别中...' : t('INPUT_PLACEHOLDER')}
            disabled={isLoading}
          />
          <button id="send-btn" onClick={handleSend} disabled={isLoading}>
            {isLoading ? '...' : t('SEND')}
          </button>
        </div>
      </div>
      {isDragOver && (
        <div
          className="drag-overlay"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="drag-overlay-content">
            <span className="drag-overlay-icon">📁</span>
            <span>拖放文件到此处上传</span>
          </div>
        </div>
      )}
    </div>
  )
}
