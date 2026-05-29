/**
 * 安全沙箱模块
 * 提供文件操作和命令执行的安全检查
 */

import * as path from 'path'
import * as fs from 'fs/promises'

// ==================== 类型定义 ====================

export interface SandboxConfig {
  allowedDirectories: string[]
  blockedCommands: string[]
  maxFileSize: number
  maxExecutionTime: number
}

// ==================== 全局开关 ====================

let sandboxEnabled = true

export function setSandboxEnabled(enabled: boolean): void {
  sandboxEnabled = enabled
}

export function isSandboxEnabled(): boolean {
  return sandboxEnabled
}

// ==================== 默认配置 ====================

const defaultConfig: SandboxConfig = {
  allowedDirectories: [
    process.env.USERPROFILE || process.env.HOME || '',
    'C:\\Projects',
    'F:\\Product',
    'F:\\AITest',
  ],
  blockedCommands: [
    'rm -rf',
    'format',
    'del /f',
    'del /s',
    'del /q',
    'mkfs',
    'dd if=',
    'sudo',
    'chmod 777',
    ':(){ :|:& };:',  // fork bomb
  ],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxExecutionTime: 30000, // 30秒
}

// ==================== 安全沙箱类 ====================

export class SecuritySandbox {
  private config: SandboxConfig

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * 检查路径是否安全
   */
  isPathSafe(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath)
    return this.config.allowedDirectories.some((dir) => {
      const resolvedDir = path.resolve(dir)
      return resolvedPath.startsWith(resolvedDir)
    })
  }

  /**
   * 检查命令是否安全
   */
  isCommandSafe(command: string): boolean {
    const lowerCommand = command.toLowerCase()
    return !this.config.blockedCommands.some((blocked) =>
      lowerCommand.includes(blocked.toLowerCase())
    )
  }

  /**
   * 检查文件大小是否安全
   */
  async isFileSizeSafe(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath)
      return stats.size <= this.config.maxFileSize
    } catch {
      return true // 文件不存在时允许
    }
  }

  /**
   * 验证文件操作
   */
  async validateFileOperation(
    filePath: string,
    operation: 'read' | 'write' | 'delete'
  ): Promise<{ safe: boolean; error?: string }> {
    // 如果沙箱禁用，允许所有操作
    if (!sandboxEnabled) {
      return { safe: true }
    }

    // 检查路径
    if (!this.isPathSafe(filePath)) {
      return {
        safe: false,
        error: `Access denied: path outside allowed directory (${filePath})`,
      }
    }

    // 检查文件大小（读取和写入时）
    if (operation === 'read' || operation === 'write') {
      if (!(await this.isFileSizeSafe(filePath))) {
        return {
          safe: false,
          error: `File too large: exceeds ${this.config.maxFileSize / 1024 / 1024}MB limit`,
        }
      }
    }

    return { safe: true }
  }

  /**
   * 验证 Shell 命令
   */
  validateShellCommand(command: string): { safe: boolean; error?: string } {
    // 如果沙箱禁用，允许所有命令
    if (!sandboxEnabled) {
      return { safe: true }
    }

    if (!this.isCommandSafe(command)) {
      return {
        safe: false,
        error: 'Blocked command: potential dangerous operation detected',
      }
    }
    return { safe: true }
  }

  /**
   * 安全读取文件
   */
  async safeReadFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    const validation = await this.validateFileOperation(filePath, 'read')
    if (!validation.safe) {
      return { success: false, error: validation.error }
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File read failed',
      }
    }
  }

  /**
   * 安全写入文件
   */
  async safeWriteFile(
    filePath: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> {
    const validation = await this.validateFileOperation(filePath, 'write')
    if (!validation.safe) {
      return { success: false, error: validation.error }
    }

    // 检查内容大小
    if (Buffer.byteLength(content, 'utf-8') > this.config.maxFileSize) {
      return {
        success: false,
        error: `Content too large: exceeds ${this.config.maxFileSize / 1024 / 1024}MB limit`,
      }
    }

    try {
      // 确保目录存在
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File write failed',
      }
    }
  }

  /**
   * 安全删除文件
   */
  async safeDeleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    const validation = await this.validateFileOperation(filePath, 'delete')
    if (!validation.safe) {
      return { success: false, error: validation.error }
    }

    try {
      await fs.unlink(filePath)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File delete failed',
      }
    }
  }

  /**
   * 获取安全配置
   */
  getConfig(): SandboxConfig {
    return { ...this.config }
  }

  /**
   * 更新安全配置
   */
  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// ==================== 单例实例 ====================

let sandboxInstance: SecuritySandbox | null = null

export function getSandbox(config?: Partial<SandboxConfig>): SecuritySandbox {
  if (!sandboxInstance) {
    sandboxInstance = new SecuritySandbox(config)
  }
  return sandboxInstance
}

// ==================== 事件监听 ====================

// 在浏览器环境中监听设置变化
if (typeof window !== 'undefined') {
  // 从 localStorage 读取初始状态
  const savedEnabled = localStorage.getItem('friday-sandbox-enabled')
  if (savedEnabled !== null) {
    sandboxEnabled = savedEnabled !== 'false'
  }

  // 监听设置变化事件
  window.addEventListener('sandbox-toggle', ((e: CustomEvent) => {
    setSandboxEnabled(e.detail.enabled)
  }) as EventListener)
}
