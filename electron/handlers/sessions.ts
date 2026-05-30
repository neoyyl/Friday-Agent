import { ipcMain } from 'electron'
import {
  getAllSessions,
  createSession as dbCreateSession,
  deleteSession as dbDeleteSession,
  updateSession as dbUpdateSession,
} from '../../src/services/database/index'

export function registerSessionHandlers(): void {
  ipcMain.handle('sessions:list', () => {
    return getAllSessions()
  })

  ipcMain.handle('sessions:create', (_event, title: string) => {
    const id = Date.now().toString()
    return dbCreateSession(id, title)
  })

  ipcMain.handle('sessions:delete', (_event, id: string) => {
    return dbDeleteSession(id)
  })

  ipcMain.handle('sessions:update', (_event, id: string, title: string) => {
    return dbUpdateSession(id, title)
  })
}
