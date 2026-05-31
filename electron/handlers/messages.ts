import { ipcMain } from 'electron'
import {
  getMessages,
  createMessage as dbCreateMessage,
} from '../../src/services/database/index'

export function registerMessageHandlers(): void {
  ipcMain.handle('messages:list', (_event, sessionId: string, limit?: number, offset?: number) => {
    return getMessages(sessionId, limit, offset)
  })

  ipcMain.handle(
    'messages:create',
    (_event, sessionId: string, role: string, content: string, toolCalls?: string) => {
      const id = Date.now().toString()
      return dbCreateMessage(id, sessionId, role, content, toolCalls)
    }
  )
}
