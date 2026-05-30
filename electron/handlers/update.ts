import { ipcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

export function registerUpdateHandlers(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus({ status: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    sendStatus({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatus({
      status: 'downloading',
      percent: progress.percent,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({ status: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    sendStatus({ status: 'error', error: err.message })
  })

  ipcMain.handle('update:check', async () => {
    try {
      autoUpdater.checkForUpdates()
      return { status: 'checking' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { status: 'error', error: msg }
    }
  })

  ipcMain.handle('update:install', async () => {
    try {
      autoUpdater.quitAndInstall()
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })
}

function sendStatus(status: { status: string; version?: string; percent?: number; error?: string }): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send('update:status', status)
  }
}
