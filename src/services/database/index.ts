import fs from 'fs'
import path from 'path'
import { app } from 'electron'

interface DataStore {
  sessions: any[]
  messages: Record<string, any[]>
  settings: Record<string, string>
}

let dataStore: DataStore = {
  sessions: [],
  messages: {},
  settings: {
    apiKey: '',
    model: 'openai/gpt-4',
    theme: 'dark',
    temperature: '0.7',
    maxTokens: '4096',
  },
}

let dataFilePath: string | null = null

function getDataFilePath(): string {
  if (!dataFilePath) {
    const userDataPath = app.getPath('userData')
    dataFilePath = path.join(userDataPath, 'agent-platform-data.json')
  }
  return dataFilePath
}

export function loadData(): void {
  try {
    const filePath = getDataFilePath()
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8')
      dataStore = JSON.parse(data)
    }
  } catch (error) {
    console.error('Failed to load data:', error)
  }
}

export function saveData(): void {
  try {
    const filePath = getDataFilePath()
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(dataStore, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to save data:', error)
  }
}

// 会话操作
export function getAllSessions() {
  return dataStore.sessions
}

export function createSession(id: string, title: string) {
  const session = {
    id,
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  dataStore.sessions.unshift(session)
  saveData()
  return session
}

export function updateSession(id: string, title: string) {
  const session = dataStore.sessions.find((s) => s.id === id)
  if (session) {
    session.title = title
    session.updated_at = new Date().toISOString()
    saveData()
    return session
  }
  return null
}

export function deleteSession(id: string) {
  dataStore.sessions = dataStore.sessions.filter((s) => s.id !== id)
  delete dataStore.messages[id]
  saveData()
  return true
}

// 消息操作
export function getMessages(sessionId: string) {
  return dataStore.messages[sessionId] || []
}

export function createMessage(
  id: string,
  sessionId: string,
  role: string,
  content: string,
  toolCalls?: string
) {
  if (!dataStore.messages[sessionId]) {
    dataStore.messages[sessionId] = []
  }

  const message = {
    id,
    session_id: sessionId,
    role,
    content,
    tool_calls: toolCalls || null,
    created_at: new Date().toISOString(),
  }

  dataStore.messages[sessionId].push(message)
  saveData()
  return message
}

// 设置操作
export function getSettings() {
  return dataStore.settings
}

export function updateSettings(newSettings: Record<string, string>) {
  dataStore.settings = { ...dataStore.settings, ...newSettings }
  saveData()
  return dataStore.settings
}

// 初始化
export function initializeDatabase() {
  loadData()
}
