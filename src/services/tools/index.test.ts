import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerTool,
  getAllTools,
  getEnabledTools,
  getTool,
  toggleTool,
  executeTool,
  type Tool,
} from './index'

const mockTool: Tool = {
  id: 'test-tool',
  name: 'Test Tool',
  description: 'A test tool',
  category: 'code',
  parameters: [
    {
      name: 'input',
      type: 'string',
      description: 'Test input',
      required: true,
    },
  ],
  enabled: true,
}

const disabledTool: Tool = {
  id: 'disabled-tool',
  name: 'Disabled Tool',
  description: 'A disabled tool',
  category: 'file',
  parameters: [],
  enabled: false,
}

describe('Tool Registry', () => {
  beforeEach(() => {
    // Clear registry by registering and toggling
    // Since there's no clear function, we test with fresh registrations
  })

  it('registerTool adds a tool to registry', () => {
    registerTool(mockTool)
    const tool = getTool('test-tool')
    expect(tool).toBeDefined()
    expect(tool?.name).toBe('Test Tool')
  })

  it('getAllTools returns all registered tools', () => {
    registerTool(mockTool)
    registerTool(disabledTool)
    const tools = getAllTools()
    expect(tools.length).toBeGreaterThanOrEqual(2)
    expect(tools.map(t => t.id)).toContain('test-tool')
    expect(tools.map(t => t.id)).toContain('disabled-tool')
  })

  it('getEnabledTools returns only enabled tools', () => {
    registerTool(mockTool)
    registerTool(disabledTool)
    const enabled = getEnabledTools()
    expect(enabled.every(t => t.enabled)).toBe(true)
    expect(enabled.map(t => t.id)).toContain('test-tool')
    expect(enabled.map(t => t.id)).not.toContain('disabled-tool')
  })

  it('getTool returns undefined for unknown tool', () => {
    const tool = getTool('nonexistent')
    expect(tool).toBeUndefined()
  })

  it('toggleTool changes tool enabled state', () => {
    registerTool(mockTool)
    toggleTool('test-tool', false)
    const tool = getTool('test-tool')
    expect(tool?.enabled).toBe(false)

    toggleTool('test-tool', true)
    const tool2 = getTool('test-tool')
    expect(tool2?.enabled).toBe(true)
  })

  it('executeTool returns error for unknown tool', async () => {
    const result = await executeTool('nonexistent', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('不存在')
  })

  it('executeTool returns error for disabled tool', async () => {
    registerTool(disabledTool)
    const result = await executeTool('disabled-tool', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('禁用')
  })

  it('executeTool executes enabled tool', async () => {
    const codeExecutorTool: Tool = {
      id: 'code-executor',
      name: 'Code Executor',
      description: 'Execute code',
      category: 'code',
      parameters: [],
      enabled: true,
    }
    registerTool(codeExecutorTool)
    const result = await executeTool('code-executor', { language: 'javascript', code: '1 + 1' })
    expect(result.success).toBe(true)
    expect(result.output).toBeDefined()
  })

  it('readFile returns error without path', async () => {
    const fileTool: Tool = {
      id: 'file-reader',
      name: 'File Reader',
      description: 'Read a file',
      category: 'file',
      parameters: [],
      enabled: true,
    }
    registerTool(fileTool)
    const result = await executeTool('file-reader', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('path')
  })

  it('file-writer returns error without path', async () => {
    const fileTool: Tool = {
      id: 'file-writer',
      name: 'File Writer',
      description: 'Write a file',
      category: 'file',
      parameters: [],
      enabled: true,
    }
    registerTool(fileTool)
    const result = await executeTool('file-writer', { content: 'test' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('path')
  })

  it('shell-executor returns error without command', async () => {
    const shellTool: Tool = {
      id: 'shell-executor',
      name: 'Shell Executor',
      description: 'Run shell commands',
      category: 'system',
      parameters: [],
      enabled: true,
    }
    registerTool(shellTool)
    const result = await executeTool('shell-executor', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('command')
  })
})
