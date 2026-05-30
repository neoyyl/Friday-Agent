import { ipcMain } from 'electron'
import { getAllTools, toggleTool, executeTool } from '../../src/services/tools/index'

export function registerToolHandlers(): void {
  ipcMain.handle('tools:list', () => {
    return getAllTools()
  })

  ipcMain.handle('tools:toggle', (_event, toolId: string, enabled: boolean) => {
    toggleTool(toolId, enabled)
    return { success: true }
  })

  ipcMain.handle('tools:execute', async (_event, toolId: string, params: Record<string, any>) => {
    return executeTool(toolId, params)
  })
}
