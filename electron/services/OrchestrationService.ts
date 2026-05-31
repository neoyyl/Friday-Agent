import { ServiceBase } from './ServiceBase'
import { executeTool } from '../../src/services/tools'

export interface ExecutionStep {
  id: string
  tool: string
  params: Record<string, unknown>
  description: string
}

export interface ExecutionPlan {
  steps: ExecutionStep[]
  summary: string
}

export interface ExecutionResult {
  success: boolean
  results: Array<{ step: string; success: boolean; output?: string; error?: string }>
  summary: string
}

interface IntentToolMapping {
  keywords: string[]
  tool: string
  paramExtractor: (task: string) => Record<string, unknown>
}

export class OrchestrationService extends ServiceBase {
  private intentToolMap: IntentToolMapping[] = [
    {
      keywords: ['搜索', 'search', '查找', '查询', '搜一下'],
      tool: 'web-search',
      paramExtractor: (task) => {
        const query = task.replace(/搜索|查找|查询|搜一下|search/gi, '').trim()
        return { query }
      }
    },
    {
      keywords: ['保存', '写入', '写文件', '保存到'],
      tool: 'file-writer',
      paramExtractor: (task) => {
        const pathMatch = task.match(/([A-Za-z]:\\[^\s]+|~\/[^\s]+|\/[^\s]+)/)
        const content = task.replace(/保存|写入|写文件|保存到[^\s]+\s*/gi, '').trim()
        return {
          path: pathMatch ? pathMatch[1] : './result.txt',
          content: content || '空内容'
        }
      }
    },
    {
      keywords: ['读取', 'read', '打开文件', '查看文件'],
      tool: 'file-reader',
      paramExtractor: (task) => {
        const pathMatch = task.match(/([A-Za-z]:\\[^\s]+|~\/[^\s]+|\/[^\s]+)/)
        return { path: pathMatch ? pathMatch[1] : '' }
      }
    },
    {
      keywords: ['执行代码', '运行代码', 'run code', '执行这段代码'],
      tool: 'code-executor',
      paramExtractor: (task) => {
        const codeMatch = task.match(/```[\s\S]*?```/g)
        const code = codeMatch ? codeMatch[0].replace(/```\w*\n?/g, '') : task.replace(/执行代码|运行代码|run code|执行这段代码/gi, '').trim()
        const langMatch = task.match(/```(\w+)/)
        return {
          code,
          language: langMatch ? langMatch[1] : 'javascript'
        }
      }
    },
    {
      keywords: ['终端', 'shell', '命令行', '执行命令', '运行命令'],
      tool: 'shell-executor',
      paramExtractor: (task) => {
        const cmd = task.replace(/终端|shell|命令行|执行命令|运行命令/gi, '').trim()
        return { command: cmd }
      }
    }
  ]

  constructor() {
    super({
      name: 'orchestration',
      version: '1.0.0',
      description: 'Intelligent task orchestration engine',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.ready = false
  }

  understandIntent(task: string): ExecutionPlan {
    const steps: ExecutionStep[] = []
    const usedTools = new Set<string>()

    for (let i = 0; i < this.intentToolMap.length; i++) {
      const mapping = this.intentToolMap[i]
      for (const keyword of mapping.keywords) {
        if (task.toLowerCase().includes(keyword.toLowerCase())) {
          if (!usedTools.has(mapping.tool)) {
            steps.push({
              id: `step${steps.length + 1}`,
              tool: mapping.tool,
              params: mapping.paramExtractor(task),
              description: `执行 ${mapping.tool}`
            })
            usedTools.add(mapping.tool)
          }
          break
        }
      }
    }

    return {
      steps,
      summary: `识别到 ${steps.length} 个步骤，需要使用以下工具：${Array.from(usedTools).join(', ') || '无'}`
    }
  }

  async executePlan(plan: ExecutionPlan): Promise<ExecutionResult> {
    const results: ExecutionResult['results'] = []

    for (const step of plan.steps) {
      try {
        const result = await this.executeTool(step.tool, step.params)
        results.push({
          step: step.id,
          success: result.success,
          output: result.output,
          error: result.error
        })
      } catch (err) {
        results.push({
          step: step.id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    return {
      success: results.every(r => r.success),
      results,
      summary: `${results.filter(r => r.success).length}/${results.length} 步骤执行成功`
    }
  }

  async autoExecute(task: string): Promise<ExecutionResult> {
    const plan = this.understandIntent(task)

    if (plan.steps.length === 0) {
      return {
        success: false,
        results: [],
        summary: '无法理解任务意图，请尝试更明确的描述。例如："帮我搜索今天的天气"'
      }
    }

    return await this.executePlan(plan)
  }

  private async executeTool(toolId: string, params: Record<string, unknown>): Promise<{ success: boolean; output?: string; error?: string }> {
    const result = await executeTool(toolId, params as any)
    return result
  }
}
