# Friday Agent Phase 5 实施计划：智能工作流（LLM 驱动）

**项目**: Friday Agent Platform
**版本**: v2.4.0
**日期**: 2026-05-31
**状态**: 待执行

---

## 目标

实现智能工作流编排引擎，让系统能理解用户意图并自动编排工具完成任务。

---

## 任务清单

### Task 1: 创建 OrchestrationService

**文件**: `electron/services/OrchestrationService.ts`（新建）

**目标**: 创建智能编排服务核心

**步骤**:

1. **创建服务文件**
   ```typescript
   import { ServiceBase } from './ServiceBase'
   import { ServiceRegistry } from './ServiceRegistry'
   
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
   
   export class OrchestrationService extends ServiceBase {
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
   }
   ```

2. **添加意图理解方法**
   ```typescript
   // 意图到工具的映射
   private intentToolMap: Array<{
     keywords: string[]
     tool: string
     paramExtractor: (task: string) => Record<string, unknown>
   }> = [
     {
       keywords: ['搜索', 'search', '查找', '查询'],
       tool: 'web-search',
       paramExtractor: (task) => {
         const query = task.replace(/搜索|查找|查询/g, '').trim()
         return { query }
       }
     },
     {
       keywords: ['保存', '写入', '写文件', '保存到'],
       tool: 'file-writer',
       paramExtractor: (task) => {
         const pathMatch = task.match(/([A-Za-z]:\\[^\s]+|~\/[^\s]+|\/[^\s]+)/)
         const content = task.replace(/保存|写入|写文件|保存到[^\s]+\s*/g, '').trim()
         return {
           path: pathMatch ? pathMatch[1] : './result.txt',
           content
         }
       }
     },
     {
       keywords: ['读取', 'read', '打开文件'],
       tool: 'file-reader',
       paramExtractor: (task) => {
         const pathMatch = task.match(/([A-Za-z]:\\[^\s]+|~\/[^\s]+|\/[^\s]+)/)
         return { path: pathMatch ? pathMatch[1] : '' }
       }
     },
     {
       keywords: ['执行代码', '运行代码', 'run code'],
       tool: 'code-executor',
       paramExtractor: (task) => {
         const codeMatch = task.match(/```[\s\S]*?```/g)
         const code = codeMatch ? codeMatch[0].replace(/```\w*\n?/g, '') : task
         return { code, language: 'javascript' }
       }
     },
     {
       keywords: ['终端', 'shell', '命令行', '执行命令'],
       tool: 'shell-executor',
       paramExtractor: (task) => {
         const cmd = task.replace(/终端|shell|命令行|执行命令/g, '').trim()
         return { command: cmd }
       }
     }
   ]
   
   understandIntent(task: string): ExecutionPlan {
     const steps: ExecutionStep[] = []
     const usedTools = new Set<string>()
     
     // 匹配关键词生成步骤
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
       summary: `识别到 ${steps.length} 个步骤`
     }
   }
   ```

3. **添加执行方法**
   ```typescript
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
   
   private async executeTool(toolId: string, params: Record<string, unknown>): Promise<{ success: boolean; output?: string; error?: string }> {
     const { executeTool } = await import('../../src/services/tools')
     const result = await executeTool(toolId, params as any)
     return result
   }
   ```

4. **添加一步式执行**
   ```typescript
   async autoExecute(task: string): Promise<ExecutionResult> {
     const plan = this.understandIntent(task)
     
     if (plan.steps.length === 0) {
       return {
         success: false,
         results: [],
         summary: '无法理解任务意图，请尝试更明确的描述'
       }
     }
     
     return await this.executePlan(plan)
   }
   ```

---

### Task 2: 注册 OrchestrationService

**文件**: `electron/services/ServiceRegistry.ts`

**步骤**:

1. **添加导入**
   ```typescript
   import { OrchestrationService } from './OrchestrationService'
   ```

2. **添加到服务列表**
   ```typescript
   const allServices: ServiceBase[] = [
     // ... 现有服务 ...
     new OrchestrationService(),
   ]
   ```

---

### Task 3: 暴露 IPC handlers

**文件**: `electron/handlers/backend.ts`

**步骤**:

1. **添加 IPC handler**
   ```typescript
   ipcMain.handle('backend:orchestration:autoExecute', async (_event, task: string) => {
     try {
       const registry = ServiceRegistry.getInstance()
       const orchService = registry.get('orchestration')
       if (orchService) {
         return success(await (orchService as any).autoExecute(task))
       }
       return wrapError(new Error('OrchestrationService not available'))
     } catch (e) {
       return wrapError(e)
     }
   })
   
   ipcMain.handle('backend:orchestration:understand', async (_event, task: string) => {
     try {
       const registry = ServiceRegistry.getInstance()
       const orchService = registry.get('orchestration')
       if (orchService) {
         return success((orchService as any).understandIntent(task))
       }
       return wrapError(new Error('OrchestrationService not available'))
     } catch (e) {
       return wrapError(e)
     }
   })
   ```

---

### Task 4: 扩展意图映射（可选）

**文件**: `electron/services/OrchestrationService.ts`

**添加更多工具映射**：
- 技能调用（skill）
- Agent 调用
- 通知发送

---

## 验收检查清单

- [ ] OrchestrationService 创建成功
- [ ] understandIntent 能理解基本意图
- [ ] executePlan 能执行计划
- [ ] autoExecute 一步式执行可用
- [ ] ServiceRegistry 注册成功
- [ ] IPC handlers 暴露成功
- [ ] 代码编译无错误

---

## 预期交付时间

- Task 1: 40 分钟
- Task 2: 10 分钟
- Task 3: 15 分钟
- Task 4: 20 分钟（可选）
- **总计**: ~65-85 分钟
