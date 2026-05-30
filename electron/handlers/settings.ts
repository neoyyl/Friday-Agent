import { ipcMain } from 'electron'
import { getSettings, updateSettings } from '../../src/services/database/index'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', (_event, newSettings: Record<string, string>) => {
    return updateSettings(newSettings)
  })
}
