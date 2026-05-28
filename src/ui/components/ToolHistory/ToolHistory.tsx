import { useState } from 'react'
import { 
  Clock, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight,
  Code, FileText, Globe, Database, Terminal, Settings, Copy, Trash2
} from 'lucide-react'

export interface ToolCall {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  input?: Record<string, unknown>
  output?: string
  error?: string
  startTime: Date
  endTime?: Date
  duration?: number
}

interface ToolHistoryProps {
  toolCalls: ToolCall[]
  onClear?: () => void
  onCopy?: (toolCall: ToolCall) => void
  maxItems?: number
}

const toolIcons: Record<string, React.ReactNode> = {
  code: <Code className="w-4 h-4" />,
  file: <FileText className="w-4 h-4" />,
  web: <Globe className="w-4 h-4" />,
  database: <Database className="w-4 h-4" />,
  terminal: <Terminal className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
}

const statusConfig = {
  pending: {
    icon: <Clock className="w-4 h-4" />,
    color: 'text-gray-500',
    bg: 'bg-gray-500/10',
    label: '等待中',
  },
  running: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    label: '运行中',
  },
  success: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    label: '成功',
  },
  error: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    label: '失败',
  },
}

function ToolHistory({ toolCalls, onClear, onCopy, maxItems = 50 }: ToolHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const displayTools = showAll ? toolCalls : toolCalls.slice(0, maxItems)

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`
    }
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getToolIcon = (toolName: string) => {
    const lowerName = toolName.toLowerCase()
    if (lowerName.includes('code') || lowerName.includes('script')) {
      return toolIcons.code
    }
    if (lowerName.includes('file') || lowerName.includes('read') || lowerName.includes('write')) {
      return toolIcons.file
    }
    if (lowerName.includes('web') || lowerName.includes('search') || lowerName.includes('fetch')) {
      return toolIcons.web
    }
    if (lowerName.includes('db') || lowerName.includes('query') || lowerName.includes('sql')) {
      return toolIcons.database
    }
    if (lowerName.includes('exec') || lowerName.includes('run') || lowerName.includes('shell')) {
      return toolIcons.terminal
    }
    return toolIcons.settings
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const successCount = toolCalls.filter(t => t.status === 'success').length
  const errorCount = toolCalls.filter(t => t.status === 'error').length
  const runningCount = toolCalls.filter(t => t.status === 'running').length

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-[var(--text-primary)]">工具调用历史</h3>
          {toolCalls.length > 0 && (
            <button
              onClick={onClear}
              className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              title="清空历史"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[var(--text-muted)]">成功: {successCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[var(--text-muted)]">失败: {errorCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[var(--text-muted)]">运行中: {runningCount}</span>
          </div>
          <div className="ml-auto text-[var(--text-muted)]">
            总计: {toolCalls.length}
          </div>
        </div>
      </div>

      {/* 工具列表 */}
      <div className="flex-1 overflow-y-auto">
        {toolCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
            <Terminal className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">暂无工具调用</p>
            <p className="text-sm mt-1">工具调用记录将显示在这里</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {displayTools.map((tool) => {
              const config = statusConfig[tool.status]
              const isExpanded = expandedId === tool.id
              
              return (
                <div
                  key={tool.id}
                  className={`rounded-xl border transition-all ${
                    isExpanded 
                      ? 'border-[var(--accent-color)]/30 bg-[var(--bg-tertiary)]' 
                      : 'border-transparent hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  {/* 工具头部 */}
                  <button
                    onClick={() => toggleExpand(tool.id)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <div className={`p-2 rounded-lg ${config.bg}`}>
                      <span className={config.color}>
                        {getToolIcon(tool.name)}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)] truncate">
                          {tool.name}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {formatTime(tool.startTime)}
                        {tool.duration && ` · ${formatDuration(tool.duration)}`}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {tool.status === 'success' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onCopy?.(tool)
                          }}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                          title="复制结果"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </div>
                  </button>
                  
                  {/* 展开内容 */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 animate-fadeIn">
                      {/* 输入参数 */}
                      {tool.input && Object.keys(tool.input).length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-[var(--text-muted)] mb-1">输入参数</div>
                          <pre className="p-3 bg-[var(--bg-primary)] rounded-lg text-xs text-[var(--text-primary)] overflow-x-auto">
                            {JSON.stringify(tool.input, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {/* 输出结果 */}
                      {tool.output && (
                        <div>
                          <div className="text-xs font-medium text-[var(--text-muted)] mb-1">输出结果</div>
                          <pre className="p-3 bg-[var(--bg-primary)] rounded-lg text-xs text-[var(--text-primary)] overflow-x-auto max-h-40">
                            {tool.output}
                          </pre>
                        </div>
                      )}
                      
                      {/* 错误信息 */}
                      {tool.error && (
                        <div>
                          <div className="text-xs font-medium text-red-500 mb-1">错误信息</div>
                          <pre className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-500 overflow-x-auto">
                            {tool.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            {/* 显示更多按钮 */}
            {toolCalls.length > maxItems && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-2 text-sm text-[var(--accent-color)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              >
                显示更多 ({toolCalls.length - maxItems} 项)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ToolHistory
