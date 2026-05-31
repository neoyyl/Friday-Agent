export interface WorkflowPreset {
  id: string
  name: string
  description: string
  icon: string
  category: 'daily' | 'dev' | 'research' | 'automation'
  steps: Array<{
    name: string
    action: 'tool' | 'skill' | 'agent' | 'event'
    target_id?: string
    params?: Record<string, unknown>
  }>
}

export const workflowPresets: WorkflowPreset[] = [
  {
    id: 'search-analyze-save',
    name: '搜索·分析·保存',
    description: '搜索网络信息，分析并保存结果',
    icon: '🔍',
    category: 'research',
    steps: [
      {
        name: '搜索',
        action: 'tool',
        target_id: 'web-search',
        params: { query: '{{query}}' }
      },
      {
        name: '分析',
        action: 'skill',
        target_id: 'text-process',
        params: { action: 'summarize', text: '{{prev_output}}' }
      },
      {
        name: '保存',
        action: 'tool',
        target_id: 'file-writer',
        params: { path: './result.md', content: '{{prev_output}}' }
      }
    ]
  },
  {
    id: 'code-review',
    name: '代码审查',
    description: '读取代码文件并进行审查',
    icon: '📝',
    category: 'dev',
    steps: [
      {
        name: '读取代码',
        action: 'tool',
        target_id: 'file-reader',
        params: { path: '{{file_path}}' }
      },
      {
        name: 'AI 审查',
        action: 'agent',
        target_id: 'coder',
        params: { task: '请审查以下代码，指出潜在问题和优化建议：\n{{prev_output}}', mode: 'code' }
      }
    ]
  },
  {
    id: 'daily-report',
    name: '生成日报',
    description: '从 Git 日志生成日报',
    icon: '📊',
    category: 'daily',
    steps: [
      {
        name: '获取 Git 日志',
        action: 'tool',
        target_id: 'shell-executor',
        params: { command: 'git log --since="1 day ago" --oneline' }
      },
      {
        name: 'AI 摘要',
        action: 'agent',
        target_id: 'assistant',
        params: { task: '请根据以下 Git 日志生成工作日报：\n{{prev_output}}', mode: 'chat' }
      }
    ]
  }
]
