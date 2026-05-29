/**
 * Shell 工具实现
 * 提供安全的命令执行
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { getSandbox } from '../sandbox'
import { ToolExecutionResult } from '../index'

const execAsync = promisify(exec)

export async function executeShell(params: {
  command: string
  cwd?: string
}): Promise<ToolExecutionResult> {
  const sandbox = getSandbox()

  // 验证命令安全性
  const validation = sandbox.validateShellCommand(params.command)
  if (!validation.safe) {
    return { success: false, error: validation.error }
  }

  try {
    const { stdout, stderr } = await execAsync(params.command, {
      cwd: params.cwd || process.cwd(),
      timeout: sandbox.getConfig().maxExecutionTime,
      maxBuffer: 1024 * 1024,
      encoding: 'utf-8',
    })

    return {
      success: true,
      output: stdout,
      metadata: {
        command: params.command,
        cwd: params.cwd || process.cwd(),
        stderr: stderr || undefined,
      },
    }
  } catch (error: any) {
    if (error.killed) {
      return {
        success: false,
        error: `Command timed out after ${sandbox.getConfig().maxExecutionTime}ms`,
        metadata: { command: params.command, timeout: true },
      }
    }

    return {
      success: false,
      error: error.message || 'Shell execution failed',
      metadata: {
        command: params.command,
        stdout: error.stdout,
        stderr: error.stderr,
      },
    }
  }
}

export async function executePowerShell(params: {
  command: string
  cwd?: string
}): Promise<ToolExecutionResult> {
  const sandbox = getSandbox()

  const validation = sandbox.validateShellCommand(params.command)
  if (!validation.safe) {
    return { success: false, error: validation.error }
  }

  try {
    const { stdout, stderr } = await execAsync(
      `powershell -Command "${params.command}"`,
      {
        cwd: params.cwd || process.cwd(),
        timeout: sandbox.getConfig().maxExecutionTime,
        maxBuffer: 1024 * 1024,
        encoding: 'utf-8',
      }
    )

    return {
      success: true,
      output: stdout,
      metadata: {
        command: params.command,
        shell: 'powershell',
        cwd: params.cwd || process.cwd(),
        stderr: stderr || undefined,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'PowerShell execution failed',
      metadata: {
        command: params.command,
        shell: 'powershell',
        stdout: error.stdout,
        stderr: error.stderr,
      },
    }
  }
}

export async function getSystemInfo(): Promise<ToolExecutionResult> {
  try {
    const os = await import('os')

    const info = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`,
      freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB`,
      uptime: `${Math.round(os.uptime() / 3600)} hours`,
      userInfos: os.userInfo(),
    }

    return {
      success: true,
      output: JSON.stringify(info, null, 2),
      metadata: info,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get system info',
    }
  }
}
