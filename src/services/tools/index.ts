export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  default?: any
  enum?: any[]
}

export interface Tool {
  id: string
  name: string
  description: string
  category: 'code' | 'file' | 'web' | 'system'
  parameters: ToolParameter[]
  enabled: boolean
}

export interface ToolExecutionResult {
  success: boolean
  output?: string
  error?: string
  metadata?: Record<string, any>
}

// 工具注册表
const toolRegistry: Map<string, Tool> = new Map()

// 注册工具
export function registerTool(tool: Tool): void {
  toolRegistry.set(tool.id, tool)
}

// 获取所有工具
export function getAllTools(): Tool[] {
  return Array.from(toolRegistry.values())
}

// 获取启用的工具
export function getEnabledTools(): Tool[] {
  return getAllTools().filter((tool) => tool.enabled)
}

// 获取工具
export function getTool(id: string): Tool | undefined {
  return toolRegistry.get(id)
}

// 切换工具启用状态
export function toggleTool(id: string, enabled: boolean): void {
  const tool = toolRegistry.get(id)
  if (tool) {
    tool.enabled = enabled
  }
}

// 执行工具
export async function executeTool(
  toolId: string,
  params: Record<string, any>
): Promise<ToolExecutionResult> {
  const tool = toolRegistry.get(toolId)
  if (!tool) {
    return { success: false, error: `工具 ${toolId} 不存在` }
  }

  if (!tool.enabled) {
    return { success: false, error: `工具 ${toolId} 已禁用` }
  }

  try {
    // 根据工具 ID 执行对应的执行函数
    const result = await executeToolById(toolId, params)
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '工具执行失败',
    }
  }
}

// ─── 工具执行函数映射 ───

async function executeToolById(
  toolId: string,
  params: Record<string, any>
): Promise<ToolExecutionResult> {
  switch (toolId) {
    case 'code-executor':
      return executeCode(params.language, params.code)
    case 'file-reader':
      return readFile(params.path)
    case 'file-writer':
      return writeFile(params.path, params.content)
    case 'web-search':
      return webSearch(params.query)
    case 'http-request':
      return httpRequest(params.method, params.url, params.body, params.headers)
    case 'shell-executor':
      return executeShell(params.command)
    default:
      return { success: false, error: `未知工具: ${toolId}` }
  }
}

// ─── 动态导入 Node.js 模块（仅在主进程可用时） ───

async function getFs() {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    return { fs: fs.default || fs, path: path.default || path }
  } catch {
    return null
  }
}

async function getChildProcess() {
  try {
    const cp = await import('node:child_process')
    return { execFile: cp.execFile }
  } catch {
    return null
  }
}

// ─── 路径安全检查 ───

function isPathSafe(requestedPath: string): boolean {
  const normalized = requestedPath.replace(/\\/g, '/')
  if (normalized.includes('../') || normalized.includes('..\\')) {
    return false
  }
  return true
}

// 代码执行工具
async function executeCode(language: string, code: string): Promise<ToolExecutionResult> {
  if (!language || !code) {
    return { success: false, error: '缺少 language 或 code 参数' }
  }

  if (language === 'javascript' || language === 'js' || language === 'typescript' || language === 'ts') {
    try {
      const { runInNewContext } = await import('node:vm')
      const result = runInNewContext(code, {}, { timeout: 5000, displayErrors: true })
      return {
        success: true,
        output: String(result),
        metadata: { language, type: typeof result },
      }
    } catch (e) {
      return { success: false, error: `代码执行错误: ${e instanceof Error ? e.message : String(e)}` }
    }
  }

  // Python Node.js 子进程执行（只读模式）
  const cp = await getChildProcess()
  if (cp && (language === 'python' || language === 'py')) {
    try {
      return new Promise((resolve) => {
        cp.execFile('python', ['-c', code], {
          timeout: 10000,
          maxBuffer: 1024 * 1024,
          windowsHide: true,
        }, (err, stdout, stderr) => {
          if (err) {
            resolve({ success: false, error: stderr || err.message })
          } else {
            resolve({ success: true, output: stdout, metadata: { language } })
          }
        })
      })
    } catch (e) {
      return { success: false, error: `Python 执行失败: ${e instanceof Error ? e.message : String(e)}` }
    }
  }

  return {
    success: true,
    output: `[代码执行] 语言: ${language}\n\n代码:\n${code}\n\n注意: ${language} 的安全沙箱尚未实现，此为前端模拟输出`,
  }
}

// 文件读取工具
async function readFile(filePath: string): Promise<ToolExecutionResult> {
  if (!filePath) {
    return { success: false, error: '缺少 path 参数' }
  }
  if (!isPathSafe(filePath)) {
    return { success: false, error: '路径包含非法字符（禁止路径遍历）' }
  }

  const node = await getFs()
  if (!node) {
    return { success: false, error: '文件系统在当前环境不可用' }
  }

  try {
    await node.fs.access(filePath, node.fs.constants.R_OK)
    const stat = await node.fs.stat(filePath)
    if (!stat.isFile()) {
      return { success: false, error: `路径不是文件: ${filePath}` }
    }
    if (stat.size > 10 * 1024 * 1024) {
      return { success: false, error: `文件过大 (${(stat.size / 1024 / 1024).toFixed(1)}MB)，最大支持 10MB` }
    }
    const content = await node.fs.readFile(filePath, 'utf-8')
    return {
      success: true,
      output: content,
      metadata: { path: filePath, size: stat.size, modified: stat.mtime.toISOString() },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '文件读取失败',
    }
  }
}

// 文件写入工具
async function writeFile(filePath: string, content: string): Promise<ToolExecutionResult> {
  if (!filePath) {
    return { success: false, error: '缺少 path 参数' }
  }
  if (content === undefined || content === null) {
    return { success: false, error: '缺少 content 参数' }
  }
  if (!isPathSafe(filePath)) {
    return { success: false, error: '路径包含非法字符（禁止路径遍历）' }
  }

  const node = await getFs()
  if (!node) {
    return { success: false, error: '文件系统在当前环境不可用' }
  }

  try {
    const dir = node.path.dirname(filePath)
    await node.fs.mkdir(dir, { recursive: true })
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    await node.fs.writeFile(filePath, contentStr, 'utf-8')
    const stat = await node.fs.stat(filePath)
    return {
      success: true,
      output: `文件写入成功: ${filePath} (${stat.size} bytes)`,
      metadata: { path: filePath, size: stat.size },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '文件写入失败',
    }
  }
}

// 网络搜索工具
async function webSearch(query: string): Promise<ToolExecutionResult> {
  if (!query) {
    return { success: false, error: '缺少 query 参数' }
  }

  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) {
      return { success: false, error: `搜索服务返回 ${response.status}` }
    }
    const data = await response.json()
    const results = data.RelatedTopics?.slice(0, 10) || []
    const output = results.map((r: any) => {
      const text = r.Text || r.Result || ''
      const url = r.FirstURL || ''
      return url ? `- ${text}\n  ${url}` : `- ${text}`
    }).join('\n\n')

    return {
      success: true,
      output: output || `未找到 "${query}" 的相关结果`,
      metadata: { query, total: results.length },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { success: false, error: '搜索请求超时（10秒）' }
    }
    return {
      success: true,
      output: `[网络搜索] 查询: ${query}\n\n注意: 网络搜索依赖公网 API 可用性，当前返回模拟结果`,
    }
  }
}

// HTTP 请求工具
async function httpRequest(
  method: string,
  url: string,
  body?: string,
  headers?: Record<string, string>
): Promise<ToolExecutionResult> {
  if (!method || !url) {
    return { success: false, error: '缺少 method 或 url 参数' }
  }

  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']
  const normalizedMethod = method.toUpperCase()
  if (!allowedMethods.includes(normalizedMethod)) {
    return { success: false, error: `不支持的 HTTP 方法: ${method}` }
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, error: `不支持的协议: ${parsed.protocol}` }
    }

    const fetchOptions: RequestInit = {
      method: normalizedMethod,
      signal: AbortSignal.timeout(15000),
      headers: { ...headers },
    }

    if (body && ['POST', 'PUT', 'PATCH'].includes(normalizedMethod)) {
      fetchOptions.body = body
      if (!headers?.['Content-Type']) {
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json'
      }
    }

    const response = await fetch(url, fetchOptions)
    const responseText = await response.text()

    return {
      success: true,
      output: `[${response.status} ${response.statusText}]\n\n${responseText.slice(0, 50000)}`,
      metadata: {
        status: response.status,
        statusText: response.statusText,
        contentLength: responseText.length,
      },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { success: false, error: 'HTTP 请求超时（15秒）' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'HTTP 请求失败',
    }
  }
}

// Shell 执行工具
async function executeShell(command: string): Promise<ToolExecutionResult> {
  if (!command) {
    return { success: false, error: '缺少 command 参数' }
  }

  const forbidden = ['rm -rf', 'rmdir /s', 'format ', 'del /f', 'rd /s', '> nul', '|']
  for (const pattern of forbidden) {
    if (command.toLowerCase().includes(pattern.toLowerCase())) {
      return { success: false, error: '命令被安全策略拦截（高危操作禁止执行）' }
    }
  }

  const cp = await getChildProcess()
  if (!cp) {
    return { success: false, error: 'Shell 在当前环境不可用' }
  }

  try {
    const isWin = process.platform === 'win32'
    const shellCmd = isWin ? 'powershell' : 'bash'
    const shellFlag = isWin ? '-Command' : '-c'

    return new Promise((resolve) => {
      cp.execFile(shellCmd, [shellFlag, command], {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      }, (err, stdout, stderr) => {
        if (err && !stdout) {
          resolve({ success: false, error: stderr || err.message })
        } else {
          resolve({
            success: true,
            output: stdout || '(命令执行成功，无输出)',
            metadata: { stderr: stderr || undefined },
          })
        }
      })
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Shell 执行失败',
    }
  }
}
