# Friday Agent Phase 2 实施计划

**项目**: Friday Agent Platform
**版本**: v2.1.0
**日期**: 2026-05-31
**状态**: 待执行

---

## 目标
让 WorkflowService 真正执行工具/技能/Agent，集成工具到 Agent，提供预设工作流模板。

---

## 任务清单

### Task 1: 完善 WorkflowService 实现真正的动作执行

**文件**: `electron/services/WorkflowService.ts`

**目标**: `dispatchStepAction` 不再只发送事件，而是真正执行工具/技能/Agent。

**步骤**:

1. **导入依赖服务**
   - 在 WorkflowService 中导入工具执行函数 (`executeTool`)
   - 导入 SkillService 和 AgentService（通过依赖注入或动态获取）

2. **更新 WorkflowStep 类型**
   ```typescript
   interface WorkflowStep {
     name: string
     action: 'tool' | 'skill' | 'agent' | 'event'
     target_id?: string
     params?: Record<string, unknown>
   }
   ```

3. **重写 dispatchStepAction**
   ```typescript
   private async dispatchStepAction(step: WorkflowStep): Promise<void> {
     this.emit('workflow.action', {
       name: step.name,
       action: step.action,
       target_id: step.target_id,
       params: step.params,
       timestamp: new Date().toISOString(),
     })

     const params = step.params || {}

     switch (step.action) {
       case 'tool':
         await this.executeToolAction(step.target_id, params)
         break
       case 'skill':
         await this.executeSkillAction(step.target_id, params)
         break
       case 'agent':
         await this.executeAgentAction(step.target_id, params)
         break
       case 'event':
       default:
         // 向后兼容
         await this.delay(100)
         break
     }
   }
   ```

4. **实现工具执行**
   ```typescript
   private async executeToolAction(
     toolId: string | undefined,
     params: Record<string, unknown>
   ): Promise<void> {
     if (!toolId) throw new Error('tool id required for tool action')
     const { executeTool } = await import('../../src/services/tools')
     const result = await executeTool(toolId, params as any)
     if (!result.success) {
       throw new Error(result.error || 'tool execution failed')
     }
   }
   ```

5. **实现技能执行**
   ```typescript
   private async executeSkillAction(
     skillId: string | undefined,
     params: Record<string, unknown>
   ): Promise<void> {
     if (!skillId) throw new Error('skill id required for skill action')
     const { skillService } = await import('./index') // 假设主进程有实例注册表
     if (skillService) {
       await skillService.call(skillId, params)
     } else {
       throw new Error('SkillService not available')
     }
   }
   ```

6. **实现 Agent 执行**
   ```typescript
   private async executeAgentAction(
     agentId: string | undefined,
     params: Record<string, unknown>
   ): Promise<void> {
     if (!agentId) throw new Error('agent id required for agent action')
     const { agentService } = await import('./index')
     if (agentService) {
       const task = (params.task as string) || ''
       const mode = (params.mode as string) || 'chat'
       await agentService.dispatch(task, mode)
     } else {
       throw new Error('AgentService not available')
     }
   }
   ```

---

### Task 2: 实现预设工作流模板系统

**文件**: `electron/services/WorkflowService.ts` (新增) + `electron/services/WorkflowPresets.ts` (新建)

**目标**: 提供常用工作流模板。

**步骤**:

1. **创建 WorkflowPresets.ts**
   ```typescript
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
   ```

2. **在 WorkflowService 中添加预设支持**
   ```typescript
   import { workflowPresets, WorkflowPreset } from './WorkflowPresets'

   // 在 WorkflowService 类中添加
   listPresets(): { presets: WorkflowPreset[] } {
     return { presets: [...workflowPresets] }
   }

   createFromPreset(presetId: string, params?: Record<string, string>): WorkflowDef {
     const preset = workflowPresets.find(p => p.id === presetId)
     if (!preset) throw new Error(`preset not found: ${presetId}`)

     const steps = preset.steps.map(step => {
       const processedParams = this.interpolateParams(step.params, params || {})
       return { ...step, params: processedParams }
     })

     return this.create({
       name: preset.name,
       description: preset.description,
       steps
     })
   }

   private interpolateParams(
     params: Record<string, unknown> | undefined,
     replacements: Record<string, string>
   ): Record<string, unknown> | undefined {
     if (!params) return undefined
     const result: Record<string, unknown> = {}
     for (const [key, value] of Object.entries(params)) {
       if (typeof value === 'string') {
         let processed = value
         for (const [k, v] of Object.entries(replacements)) {
           processed = processed.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
         }
         result[key] = processed
       } else {
         result[key] = value
       }
     }
     return result
   }
   ```

---

### Task 3: 在 AgentService 中添加工具调用能力

**文件**: `electron/services/AgentService.ts`

**目标**: 让 Agent 可以直接调用工具完成任务。

**步骤**:

1. **添加工具调用方法**
   ```typescript
   private async executeTool(task: string, mode: string): Promise<string> {
     const { executeTool } = await import('../../src/services/tools')

     // 根据模式和任务内容智能选择工具
     let toolId = ''
     let toolParams: Record<string, any> = {}

     if (mode === 'research' && task.toLowerCase().includes('search')) {
       toolId = 'web-search'
       toolParams = { query: task }
     } else if (mode === 'code') {
       // 支持代码执行
       toolId = 'code-executor'
       // 尝试从任务中提取代码
       toolParams = { language: 'javascript', code: task }
     } else {
       // 默认直接调用 LLM
       return await this.callLLM(task, mode)
     }

     const result = await executeTool(toolId, toolParams)
     if (result.success) {
       return `工具执行结果:\n${result.output || '执行成功'}`
     } else {
       return `工具执行失败: ${result.error}`
     }
   }
   ```

2. **在 dispatch 中添加 enableTools 选项**
   ```typescript
   async dispatch(
     task: string,
     mode: string,
     options?: {
       model?: string
       temperature?: number
       enableTools?: boolean
     }
   ): Promise<{ agent_id: string; result: string }> {
     // ... 现有代码 ...

     if (options?.enableTools) {
       // 尝试先调用工具
       try {
         const toolResult = await this.executeTool(task, mode)
         if (!toolResult.includes('工具执行失败')) {
           return { agent_id: agent.id, result: toolResult }
         }
       } catch (e) {
         // 工具失败，回退到 LLM
       }
     }

     const result = await this.executeWithAgent(agent, task, mode)
     return { agent_id: agent.id, result }
   }
   ```

---

### Task 4: 暴露工具/Agent 调用到 IPC

**文件**: `electron/handlers/backend.ts`

**目标**: 让前端可以调用工具和 Agent。

**步骤**:

1. **在后端 handler 中添加工具 IPC**
   ```typescript
   // tools
   ipcMain.handle('tools.execute', async (_event, toolId: string, params: any) => {
     const { executeTool } = await import('../../src/services/tools')
     return executeTool(toolId, params)
   })

   ipcMain.handle('tools.list', async () => {
     const { getAllTools, getEnabledTools } = await import('../../src/services/tools')
     return { all: getAllTools(), enabled: getEnabledTools() }
   })

   // workflows presets
   ipcMain.handle('workflows.presets', async () => {
     return workflowService.listPresets()
   })

   ipcMain.handle('workflows.createFromPreset', async (
     _event, presetId: string, params?: Record<string, string>
   ) => {
     return workflowService.createFromPreset(presetId, params)
   })
   ```

2. **在 preload 中暴露**
   ```typescript
   // preload.ts (查看是否需要添加)
   // 假设已有的 window.electronAPI.backend 结构
   // 添加 tools 相关方法
   ```

---

### Task 5: 注册预设工具

**文件**: `src/services/tools/index.ts`

**目标**: 确保工具已正确注册。

**步骤**:

1. **添加工具注册初始化** (如果缺失)
   ```typescript
   // 初始化工具注册表
   const initTools = () => {
     const tools: Array<{
       id: string
       name: string
       description: string
       category: 'code' | 'file' | 'web' | 'system'
       parameters: any[]
       enabled: boolean
     }> = [
       {
         id: 'code-executor',
         name: '代码执行器',
         description: '执行 JavaScript/Python 代码',
         category: 'code',
         parameters: [
           { name: 'language', type: 'string', description: '编程语言', required: true },
           { name: 'code', type: 'string', description: '代码内容', required: true }
         ],
         enabled: true
       },
       {
         id: 'file-reader',
         name: '文件读取器',
         description: '读取文本文件',
         category: 'file',
         parameters: [{ name: 'path', type: 'string', description: '文件路径', required: true }],
         enabled: true
       },
       {
         id: 'file-writer',
         name: '文件写入器',
         description: '写入文本文件',
         category: 'file',
         parameters: [
           { name: 'path', type: 'string', description: '文件路径', required: true },
           { name: 'content', type: 'string', description: '文件内容', required: true }
         ],
         enabled: true
       },
       {
         id: 'web-search',
         name: '网络搜索',
         description: '搜索网络信息',
         category: 'web',
         parameters: [{ name: 'query', type: 'string', description: '搜索关键词', required: true }],
         enabled: true
       },
       {
         id: 'http-request',
         name: 'HTTP 请求',
         description: '发送 HTTP 请求',
         category: 'web',
         parameters: [
           { name: 'method', type: 'string', description: 'HTTP 方法', required: true },
           { name: 'url', type: 'string', description: '请求 URL', required: true },
           { name: 'body', type: 'string', description: '请求体', required: false },
           { name: 'headers', type: 'object', description: '请求头', required: false }
         ],
         enabled: true
       },
       {
         id: 'shell-executor',
         name: 'Shell 执行器',
         description: '执行 Shell 命令',
         category: 'system',
         parameters: [{ name: 'command', type: 'string', description: 'Shell 命令', required: true }],
         enabled: true
       }
     ]

     for (const tool of tools) {
       registerTool(tool)
     }
   }

   // 调用初始化
   initTools()
   ```

---

## 验收检查清单

- [ ] Workflow dispatchStepAction 可执行工具
- [ ] Workflow dispatchStepAction 可执行技能
- [ ] Workflow dispatchStepAction 可执行 Agent
- [ ] Workflow 预设模板存在且可创建
- [ ] 3+ 个预设工作流模板可用
- [ ] AgentService 有工具调用能力
- [ ] 工具执行 IPC 已暴露
- [ ] 完整错误处理

---

## 预期交付时间
- Task 1-2: 40 分钟
- Task 3-5: 30 分钟
- 总计: ~70 分钟
