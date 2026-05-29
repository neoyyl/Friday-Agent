/**
 * 代码执行工具实现
 * 提供多语言代码执行能力
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { getSandbox } from '../sandbox'
import { ToolExecutionResult } from '../index'

const execAsync = promisify(exec)

export async function executeCode(params: {
  language: string
  code: string
}): Promise<ToolExecutionResult> {
  const sandbox = getSandbox()

  switch (params.language.toLowerCase()) {
    case 'javascript':
    case 'js':
      return executeJavaScript(params.code, sandbox)
    case 'typescript':
    case 'ts':
      return executeTypeScript(params.code, sandbox)
    case 'python':
    case 'py':
      return executePython(params.code, sandbox)
    case 'shell':
    case 'bash':
      return executeShellCode(params.code, sandbox)
    default:
      return {
        success: false,
        error: `Unsupported language: ${params.language}. Supported: javascript, typescript, python, shell`,
      }
  }
}

async function executeJavaScript(
  code: string,
  sandbox: ReturnType<typeof getSandbox>
): Promise<ToolExecutionResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'friday-code-'))
  const tempFile = path.join(tempDir, 'exec.js')

  try {
    const wrappedCode = `
      (async () => {
        const __output = [];
        const __originalLog = console.log;
        const __originalError = console.error;
        const __originalWarn = console.warn;

        console.log = (...args) => __output.push({ type: 'log', content: args.join(' ') });
        console.error = (...args) => __output.push({ type: 'error', content: args.join(' ') });
        console.warn = (...args) => __output.push({ type: 'warn', content: args.join(' ') });

        try {
          const __result = await (async () => { ${code} })();
          if (__result !== undefined) {
            __output.push({ type: 'result', content: String(__result) });
          }
        } catch (e) {
          __output.push({ type: 'error', content: e.message });
        }

        console.log = __originalLog;
        console.error = __originalError;
        console.warn = __originalWarn;

        return JSON.stringify(__output);
      })()
    `

    await fs.writeFile(tempFile, wrappedCode, 'utf-8')

    const { stdout } = await execAsync(`node "${tempFile}"`, {
      timeout: sandbox.getConfig().maxExecutionTime,
      encoding: 'utf-8',
    })

    const output = JSON.parse(stdout.trim())
    const formattedOutput = output
      .map((item: any) => `[${item.type}] ${item.content}`)
      .join('\n')

    return {
      success: true,
      output: formattedOutput,
      metadata: { language: 'javascript', rawOutput: output },
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'JavaScript execution failed',
      metadata: { language: 'javascript' },
    }
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {}
  }
}

async function executeTypeScript(
  code: string,
  sandbox: ReturnType<typeof getSandbox>
): Promise<ToolExecutionResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'friday-code-'))
  const tempFile = path.join(tempDir, 'exec.ts')

  try {
    await fs.writeFile(tempFile, code, 'utf-8')

    const { stdout, stderr } = await execAsync(`npx ts-node "${tempFile}"`, {
      timeout: sandbox.getConfig().maxExecutionTime,
      encoding: 'utf-8',
      cwd: process.cwd(),
    })

    return {
      success: true,
      output: stdout || stderr,
      metadata: { language: 'typescript' },
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'TypeScript execution failed',
      metadata: { language: 'typescript' },
    }
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {}
  }
}

async function executePython(
  code: string,
  sandbox: ReturnType<typeof getSandbox>
): Promise<ToolExecutionResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'friday-code-'))
  const tempFile = path.join(tempDir, 'exec.py')

  try {
    await fs.writeFile(tempFile, code, 'utf-8')

    const { stdout, stderr } = await execAsync(`python "${tempFile}"`, {
      timeout: sandbox.getConfig().maxExecutionTime,
      encoding: 'utf-8',
    })

    return {
      success: true,
      output: stdout || stderr,
      metadata: { language: 'python' },
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Python execution failed',
      metadata: { language: 'python' },
    }
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {}
  }
}

async function executeShellCode(
  code: string,
  sandbox: ReturnType<typeof getSandbox>
): Promise<ToolExecutionResult> {
  const validation = sandbox.validateShellCommand(code)
  if (!validation.safe) {
    return { success: false, error: validation.error }
  }

  try {
    const { stdout, stderr } = await execAsync(code, {
      timeout: sandbox.getConfig().maxExecutionTime,
      encoding: 'utf-8',
    })

    return {
      success: true,
      output: stdout || stderr,
      metadata: { language: 'shell' },
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Shell execution failed',
      metadata: { language: 'shell' },
    }
  }
}
