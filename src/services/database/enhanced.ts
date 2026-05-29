/**
 * 数据库增强模块
 * 提供额外的数据持久化功能，同时保持与原有 API 的兼容性
 */

import fs from 'fs'
import path from 'path'
import { app } from 'electron'

// ==================== 类型定义 ====================

export interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  tool_calls?: string
  created_at: string
}

export interface ToolCallRecord {
  id: string
  message_id: string
  tool_id: string
  parameters?: string
  result?: string
  success: boolean
  duration_ms?: number
  created_at: string
}

// ==================== 增强的数据库类 ====================

export class EnhancedDatabase {
  private dataFilePath: string
  private sessions: Session[] = []
  private messages: Record<string, Message[]> = {}
  private settings: Record<string, string> = {}
  private toolCalls: ToolCallRecord[] = []

  constructor() {
    const userDataPath = app.getPath('userData')
    this.dataFilePath = path.join(userDataPath, 'friday-enhanced.json')
    this.loadData()
  }

  // ==================== 数据加载/保存 ====================

  private loadData(): void {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.dataFilePath, 'utf-8'))
        this.sessions = data.sessions || []
        this.messages = data.messages || {}
        this.settings = data.settings || {}
        this.toolCalls = data.toolCalls || []
      }
    } catch (error) {
      console.error('Failed to load enhanced database:', error)
    }
  }

  private saveData(): void {
    try {
      const dir = path.dirname(this.dataFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.dataFilePath, JSON.stringify({
        sessions: this.sessions,
        messages: this.messages,
        settings: this.settings,
        toolCalls: this.toolCalls,
      }, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save enhanced database:', error)
    }
  }

  // ==================== Session 操作 ====================

  getAllSessions(): Session[] {
    return [...this.sessions].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }

  getSession(id: string): Session | undefined {
    return this.sessions.find(s => s.id === id)
  }

  createSession(session: { id: string; title: string }): Session {
    const newSession: Session = {
      id: session.id,
      title: session.title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    this.sessions.unshift(newSession)
    this.saveData()
    return newSession
  }

  updateSession(id: string, updates: Partial<Pick<Session, 'title'>>): Session | null {
    const session = this.getSession(id)
    if (!session) return null

    if (updates.title !== undefined) {
      session.title = updates.title
    }
    session.updated_at = new Date().toISOString()
    this.saveData()
    return session
  }

  deleteSession(id: string): boolean {
    const index = this.sessions.findIndex(s => s.id === id)
    if (index === -1) return false

    this.sessions.splice(index, 1)
    delete this.messages[id]
    this.saveData()
    return true
  }

  // ==================== Message 操作 ====================

  getMessages(sessionId: string): Message[] {
    return [...(this.messages[sessionId] || [])].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }

  getMessage(id: string): Message | undefined {
    for (const sessionMessages of Object.values(this.messages)) {
      const msg = sessionMessages.find(m => m.id === id)
      if (msg) return msg
    }
    return undefined
  }

  createMessage(message: {
    id: string
    session_id: string
    role: string
    content: string
    tool_calls?: string
  }): Message {
    if (!this.messages[message.session_id]) {
      this.messages[message.session_id] = []
    }

    const newMessage: Message = {
      id: message.id,
      session_id: message.session_id,
      role: message.role as Message['role'],
      content: message.content,
      tool_calls: message.tool_calls,
      created_at: new Date().toISOString(),
    }

    this.messages[message.session_id].push(newMessage)

    // 更新 session 的 updated_at
    const session = this.getSession(message.session_id)
    if (session) {
      session.updated_at = new Date().toISOString()
    }

    this.saveData()
    return newMessage
  }

  updateMessage(id: string, updates: Partial<Pick<Message, 'content' | 'tool_calls'>>): Message | null {
    const message = this.getMessage(id)
    if (!message) return null

    if (updates.content !== undefined) {
      message.content = updates.content
    }
    if (updates.tool_calls !== undefined) {
      message.tool_calls = updates.tool_calls
    }

    this.saveData()
    return message
  }

  deleteMessages(sessionId: string): boolean {
    if (!this.messages[sessionId]) return false
    delete this.messages[sessionId]
    this.saveData()
    return true
  }

  // ==================== ToolCall 操作 ====================

  getToolCalls(messageId: string): ToolCallRecord[] {
    return this.toolCalls.filter(tc => tc.message_id === messageId)
  }

  logToolCall(call: {
    id: string
    message_id: string
    tool_id: string
    parameters?: string
    result?: string
    success: boolean
    duration_ms?: number
  }): ToolCallRecord {
    const record: ToolCallRecord = {
      id: call.id,
      message_id: call.message_id,
      tool_id: call.tool_id,
      parameters: call.parameters,
      result: call.result,
      success: call.success,
      duration_ms: call.duration_ms,
      created_at: new Date().toISOString(),
    }
    this.toolCalls.push(record)
    this.saveData()
    return record
  }

  // ==================== Settings 操作 ====================

  getSettings(): Record<string, string> {
    return { ...this.settings }
  }

  getSetting(key: string): string | undefined {
    return this.settings[key]
  }

  setSetting(key: string, value: string): void {
    this.settings[key] = value
    this.saveData()
  }

  updateSettings(newSettings: Record<string, string>): Record<string, string> {
    this.settings = { ...this.settings, ...newSettings }
    this.saveData()
    return this.getSettings()
  }

  // ==================== 统计操作 ====================

  getSessionMessageCount(sessionId: string): number {
    return (this.messages[sessionId] || []).length
  }

  getToolCallStats(): { total: number; success: number; failed: number } {
    const total = this.toolCalls.length
    const success = this.toolCalls.filter(tc => tc.success).length
    return { total, success, failed: total - success }
  }

  // ==================== 数据迁移 ====================

  migrateFromJSON(jsonData: {
    sessions?: any[]
    messages?: Record<string, any[]>
    settings?: Record<string, string>
  }): void {
    // 迁移 sessions
    if (jsonData.sessions && Array.isArray(jsonData.sessions)) {
      for (const session of jsonData.sessions) {
        if (!this.getSession(session.id)) {
          this.sessions.push({
            id: session.id,
            title: session.title,
            created_at: session.created_at || new Date().toISOString(),
            updated_at: session.updated_at || new Date().toISOString(),
          })
        }
      }
    }

    // 迁移 messages
    if (jsonData.messages && typeof jsonData.messages === 'object') {
      for (const [sessionId, messages] of Object.entries(jsonData.messages)) {
        if (Array.isArray(messages)) {
          if (!this.messages[sessionId]) {
            this.messages[sessionId] = []
          }
          for (const msg of messages) {
            if (!this.messages[sessionId].find(m => m.id === msg.id)) {
              this.messages[sessionId].push({
                id: msg.id,
                session_id: sessionId,
                role: msg.role,
                content: msg.content,
                tool_calls: msg.tool_calls,
                created_at: msg.created_at || new Date().toISOString(),
              })
            }
          }
        }
      }
    }

    // 迁移 settings
    if (jsonData.settings && typeof jsonData.settings === 'object') {
      this.settings = { ...this.settings, ...jsonData.settings }
    }

    this.saveData()
  }

  // ==================== 工具方法 ====================

  getDataFilePath(): string {
    return this.dataFilePath
  }

  clearAll(): void {
    this.sessions = []
    this.messages = {}
    this.settings = {}
    this.toolCalls = []
    this.saveData()
  }

  exportData(): string {
    return JSON.stringify({
      sessions: this.sessions,
      messages: this.messages,
      settings: this.settings,
      toolCalls: this.toolCalls,
    }, null, 2)
  }
}

// ==================== 单例实例 ====================

let enhancedDbInstance: EnhancedDatabase | null = null

export function getEnhancedDatabase(): EnhancedDatabase {
  if (!enhancedDbInstance) {
    enhancedDbInstance = new EnhancedDatabase()
  }
  return enhancedDbInstance
}

// ==================== 兼容性函数 ====================

/**
 * 从原始数据文件迁移到增强数据库
 */
export function migrateFromOriginal(originalDataPath: string): boolean {
  try {
    if (!fs.existsSync(originalDataPath)) {
      return false
    }

    const originalData = JSON.parse(fs.readFileSync(originalDataPath, 'utf-8'))
    const db = getEnhancedDatabase()
    db.migrateFromJSON(originalData)
    return true
  } catch (error) {
    console.error('Migration failed:', error)
    return false
  }
}
