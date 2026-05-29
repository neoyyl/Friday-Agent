/**
 * 文件工具实现
 * 提供安全的文件操作
 */

import { getSandbox } from '../sandbox'
import { ToolExecutionResult } from '../index'

export async function readFile(params: { path: string }): Promise<ToolExecutionResult> {
  const sandbox = getSandbox()
  const result = await sandbox.safeReadFile(params.path)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return {
    success: true,
    output: result.content,
    metadata: {
      path: params.path,
      size: result.content?.length || 0,
    },
  }
}

export async function writeFile(params: {
  path: string
  content: string
}): Promise<ToolExecutionResult> {
  const sandbox = getSandbox()
  const result = await sandbox.safeWriteFile(params.path, params.content)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return {
    success: true,
    output: `File written successfully: ${params.path}`,
    metadata: {
      path: params.path,
      size: Buffer.byteLength(params.content, 'utf-8'),
    },
  }
}

export async function listDirectory(params: { path: string }): Promise<ToolExecutionResult> {
  const sandbox = getSandbox()

  if (!sandbox.isPathSafe(params.path)) {
    return {
      success: false,
      error: `Access denied: path outside allowed directory (${params.path})`,
    }
  }

  try {
    const fs = await import('fs/promises')
    const entries = await fs.readdir(params.path, { withFileTypes: true })

    const items = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      path: `${params.path}/${entry.name}`,
    }))

    return {
      success: true,
      output: JSON.stringify(items, null, 2),
      metadata: {
        path: params.path,
        count: items.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Directory listing failed',
    }
  }
}

export async function deleteFile(params: { path: string }): Promise<ToolExecutionResult> {
  const sandbox = getSandbox()
  const result = await sandbox.safeDeleteFile(params.path)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return {
    success: true,
    output: `File deleted successfully: ${params.path}`,
  }
}
