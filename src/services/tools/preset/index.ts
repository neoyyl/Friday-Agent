import { registerTool, Tool } from '../index'

// 代码执行工具
export const codeExecutorTool: Tool = {
  id: 'code-executor',
  name: '代码执行',
  description: '执行指定语言的代码片段',
  category: 'code',
  parameters: [
    {
      name: 'language',
      type: 'string',
      description: '编程语言（如 javascript、python、typescript）',
      required: true,
      enum: ['javascript', 'python', 'typescript', 'bash'],
    },
    {
      name: 'code',
      type: 'string',
      description: '要执行的代码',
      required: true,
    },
  ],
  enabled: true,
}

// 文件读取工具
export const fileReaderTool: Tool = {
  id: 'file-reader',
  name: '文件读取',
  description: '读取指定路径的文件内容',
  category: 'file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '文件路径',
      required: true,
    },
  ],
  enabled: true,
}

// 文件写入工具
export const fileWriterTool: Tool = {
  id: 'file-writer',
  name: '文件写入',
  description: '将内容写入指定路径的文件',
  category: 'file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '文件路径',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      description: '要写入的内容',
      required: true,
    },
  ],
  enabled: true,
}

// 网络搜索工具
export const webSearchTool: Tool = {
  id: 'web-search',
  name: '网络搜索',
  description: '在网络搜索指定内容',
  category: 'web',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '搜索关键词',
      required: true,
    },
  ],
  enabled: true,
}

// HTTP 请求工具
export const httpRequestTool: Tool = {
  id: 'http-request',
  name: 'HTTP 请求',
  description: '发送 HTTP 请求到指定 URL',
  category: 'web',
  parameters: [
    {
      name: 'method',
      type: 'string',
      description: 'HTTP 方法（GET、POST、PUT、DELETE）',
      required: true,
      enum: ['GET', 'POST', 'PUT', 'DELETE'],
    },
    {
      name: 'url',
      type: 'string',
      description: '请求 URL',
      required: true,
    },
    {
      name: 'body',
      type: 'string',
      description: '请求体（JSON 格式）',
      required: false,
    },
    {
      name: 'headers',
      type: 'object',
      description: '请求头',
      required: false,
    },
  ],
  enabled: true,
}

// Shell 执行工具
export const shellExecutorTool: Tool = {
  id: 'shell-executor',
  name: 'Shell 执行',
  description: '执行 Shell 命令',
  category: 'system',
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: '要执行的 Shell 命令',
      required: true,
    },
  ],
  enabled: true,
}

// 注册所有预设工具
export function registerPresetTools(): void {
  registerTool(codeExecutorTool)
  registerTool(fileReaderTool)
  registerTool(fileWriterTool)
  registerTool(webSearchTool)
  registerTool(httpRequestTool)
  registerTool(shellExecutorTool)
}

// 获取预设工具列表
export function getPresetTools(): Tool[] {
  return [
    codeExecutorTool,
    fileReaderTool,
    fileWriterTool,
    webSearchTool,
    httpRequestTool,
    shellExecutorTool,
  ]
}
