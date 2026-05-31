# Friday Agent LLM 集成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 AgentService.dispatch() 真正调用 LLM 处理任务，替代模拟文本返回

**Architecture:** 采用 IPC 调用模式，AgentService 通过 ipcMain.invoke('llm:chat') 与 LLM Handler 通信，LLM Handler 调用已有的 LLM clients 实现

**Tech Stack:** TypeScript, Electron IPC, LLM Clients (OpenAI Compatible, Anthropic, Google, Ollama)

---

## 文件结构

```
electron/
├── services/
│   └── AgentService.ts          # 修改：添加 callLLM 方法和提示词映射
└── handlers/
    └── llm.ts                   # 已存在：已有 llm:chat 实现

src/
├── stores/
│   └── chatStore.ts             # 可能需要：添加 agent dispatch 支持
└── ui/components/
    └── CenterArea/
        └── CenterArea.tsx       # 可能需要：添加 Agent/Mode 选择器
```

---

## Task 1: 添加 Agent 系统提示词

**Files:**
- Modify: `electron/services/AgentService.ts:1-50`

- [ ] **Step 1: 添加 AGENT_PROMPTS 常量**

在 AgentService 类定义之前添加：

```typescript
const AGENT_PROMPTS: Record<string, string> = {
  chat: `你是一个友善、有用的 AI 助手 named Friday。你的目标是：
1. 理解用户的问题和需求
2. 提供准确、有帮助的回答
3. 保持对话简洁明了
4. 如果不确定，诚实告知用户`,

  code: `你是一个专业的代码助手，擅长：
1. 生成高质量代码（Python, JavaScript, TypeScript, Go 等）
2. 代码审查和优化建议
3. Bug 定位和修复方案
4. 解释代码逻辑和架构
回复格式：以代码为主，附上简要说明。`,

  research: `你是一个研究助手，擅长：
1. 信息搜索和整理
2. 摘要和要点提取
3. 对比分析和总结
4. 提供信息来源
回复格式：结构化输出，包含要点和来源。`,

  plan: `你是一个任务规划专家，擅长：
1. 理解复杂任务需求
2. 将任务分解为可执行的子任务
3. 确定任务依赖和执行顺序
4. 预估时间和资源需求
回复格式：分步骤列出，每个步骤有明确的输入输出。`
}
```

- [ ] **Step 2: 添加 getSystemPromptForMode 方法**

在 AgentService 类中添加：

```typescript
private getSystemPromptForMode(mode: string): string {
  return AGENT_PROMPTS[mode] || AGENT_PROMPTS['chat']
}
```

- [ ] **Step 3: 验证代码编译**

运行：`cd PROJECT_ROOT && npx tsc --noEmit`

预期输出：无编译错误

- [ ] **Step 4: 提交代码**

```bash
git add electron/services/AgentService.ts
git commit -m "feat(agent): add system prompts for agent modes"
```

---

## Task 2: 实现 callLLM 方法

**Files:**
- Modify: `electron/services/AgentService.ts:100-150`

- [ ] **Step 1: 添加 callLLM 私有方法**

在 AgentService 类 `executeWithAgent` 方法之前添加：

```typescript
private async callLLM(task: string, mode: string): Promise<string> {
  const systemPrompt = this.getSystemPromptForMode(mode)
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task }
  ]

  try {
    const response = await this.invokeLLM(messages)
    return response.content || 'LLM 返回为空'
  } catch (error) {
    console.error('[AgentService] LLM call failed:', error)
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return '错误：请先在设置中配置 API Key'
      }
      if (error.message.includes('timeout')) {
        return '错误：请求超时，请重试'
      }
      return `错误：${error.message}`
    }
    return '错误：LLM 调用失败，请检查网络连接'
  }
}
```

- [ ] **Step 2: 添加 invokeLLM 方法**

添加 IPC 调用方法：

```typescript
private async invokeLLM(messages: Array<{ role: string; content: string }>): Promise<{ content: string }> {
  const { ipcMain, BrowserWindow } = await import('electron')
  
  return new Promise((resolve, reject) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) {
      reject(new Error('No window available'))
      return
    }

    const timeout = setTimeout(() => {
      reject(new Error('LLM request timeout'))
    }, 60000)

    ipcMain.once('llm:response', (_event, response) => {
      clearTimeout(timeout)
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })

    win.webContents.send('llm:chat', messages)
  })
}
```

- [ ] **Step 3: 验证代码编译**

运行：`cd PROJECT_ROOT && npx tsc --noEmit`

预期输出：无编译错误

- [ ] **Step 4: 提交代码**

```bash
git add electron/services/AgentService.ts
git commit -m "feat(agent): add callLLM method for LLM invocation"
```

---

## Task 3: 修改 executeWithAgent 集成 LLM

**Files:**
- Modify: `electron/services/AgentService.ts:107-118`

- [ ] **Step 1: 查看当前 executeWithAgent 实现**

读取 `electron/services/AgentService.ts` 第 107-118 行

预期内容：返回模拟文本的 switch 语句

- [ ] **Step 2: 替换 executeWithAgent 实现**

将原来的 switch 返回文本改为调用 callLLM：

```typescript
private async executeWithAgent(agent: AgentRecord, task: string, mode: string): Promise<string> {
  switch (agent.id) {
    case 'planner':
      return await this.callLLM(task, 'plan')
    case 'coder':
      return await this.callLLM(task, 'code')
    case 'researcher':
      return await this.callLLM(task, 'research')
    default:
      return await this.callLLM(task, 'chat')
  }
}
```

- [ ] **Step 3: 验证代码编译**

运行：`cd PROJECT_ROOT && npx tsc --noEmit`

预期输出：无编译错误

- [ ] **Step 4: 测试运行**

启动开发服务器：`npm run dev`

预期：应用正常启动，无编译错误

- [ ] **Step 5: 提交代码**

```bash
git add electron/services/AgentService.ts
git commit -m "feat(agent): integrate LLM calls in executeWithAgent"
```

---

## Task 4: 增强 LLM Handler 支持 Agent 调用

**Files:**
- Modify: `electron/handlers/llm.ts:80-120`

- [ ] **Step 1: 查看当前 LLM Handler 实现**

读取 `electron/handlers/llm.ts` 第 80-120 行

预期：`llm:chat` handler 存在并可处理 messages

- [ ] **Step 2: 添加 Agent 专用 chat 方法**

在 `registerLLMHandlers` 函数中添加新 handler：

```typescript
ipcMain.handle('llm:agentChat', async (_event, messages: Array<{ role: string; content: string }>, options?: ResolveClientOptions) => {
  try {
    const { client, model, temperature, maxTokens } = resolveClient(options)
    const response = await client.chat(
      messages.map((msg) => ({
        role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
        content: msg.content,
      })),
      { model, temperature, maxTokens }
    )
    const msg = response.choices[0]?.message
    return {
      content: msg?.content || '',
      role: 'assistant',
      error: null
    }
  } catch (error) {
    console.error('Agent LLM chat error:', error)
    return {
      content: '',
      role: 'assistant',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
```

- [ ] **Step 3: 修改 AgentService 使用新方法**

更新 `invokeLLM` 方法使用 `llm:agentChat`：

```typescript
private async invokeLLM(messages: Array<{ role: string; content: string }>): Promise<{ content: string }> {
  const { ipcMain } = await import('electron')
  
  try {
    const result = await ipcMain.handle('llm:agentChat', messages)
    if (result.error) {
      throw new Error(result.error)
    }
    return result
  } catch (error) {
    console.error('[AgentService] invokeLLM error:', error)
    throw error
  }
}
```

- [ ] **Step 4: 验证代码编译**

运行：`cd PROJECT_ROOT && npx tsc --noEmit`

预期输出：无编译错误

- [ ] **Step 5: 提交代码**

```bash
git add electron/handlers/llm.ts electron/services/AgentService.ts
git commit -m "feat(agent): add agentChat handler and update AgentService"
```

---

## Task 5: 前端集成测试

**Files:**
- Modify: `src/ui/components/CenterArea/CenterArea.tsx`（如需要）
- Modify: `src/stores/chatStore.ts`（如需要）

- [ ] **Step 1: 检查当前聊天流程**

读取 `src/stores/chatStore.ts` 了解消息发送流程

- [ ] **Step 2: 确认 Agent dispatch 路径**

检查 `CenterArea.tsx` 中如何触发消息发送

- [ ] **Step 3: 如需要，添加 Agent 选择器 UI**

如果前端需要选择 Agent/Mode，参考设计文档添加 UI 组件

- [ ] **Step 4: 端到端测试**

1. 启动应用：`npm run dev`
2. 在设置中配置 API Key
3. 发送一条消息
4. 验证 Agent 返回真实 LLM 响应

预期：Agent 返回的不是模拟文本，而是真实的 LLM 回答

- [ ] **Step 5: 提交代码**

```bash
git add src/
git commit -m "test(agent): end-to-end test for LLM integration"
```

---

## Task 6: 错误处理完善

**Files:**
- Modify: `electron/services/AgentService.ts`

- [ ] **Step 1: 添加错误类型枚举**

```typescript
enum AgentErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',
  TIMEOUT = 'TIMEOUT',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN'
}
```

- [ ] **Step 2: 完善 callLLM 错误处理**

更新 `callLLM` 方法的错误处理逻辑：

```typescript
private classifyError(error: Error): AgentErrorType {
  const message = error.message.toLowerCase()
  if (message.includes('api key') || message.includes('auth')) {
    return AgentErrorType.API_KEY_MISSING
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return AgentErrorType.TIMEOUT
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return AgentErrorType.NETWORK
  }
  return AgentErrorType.UNKNOWN
}
```

- [ ] **Step 3: 验证代码编译**

运行：`cd PROJECT_ROOT && npx tsc --noEmit`

预期输出：无编译错误

- [ ] **Step 4: 提交代码**

```bash
git add electron/services/AgentService.ts
git commit -m "feat(agent): add comprehensive error handling"
```

---

## Task 7: 单元测试

**Files:**
- Create: `electron/services/AgentService.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AgentService } from './AgentService'

describe('AgentService', () => {
  let service: AgentService

  beforeEach(() => {
    service = new AgentService()
  })

  describe('getSystemPromptForMode', () => {
    it('should return chat prompt for chat mode', () => {
      const prompt = (service as any).getSystemPromptForMode('chat')
      expect(prompt).toContain('Friday')
    })

    it('should return code prompt for code mode', () => {
      const prompt = (service as any).getSystemPromptForMode('code')
      expect(prompt).toContain('代码助手')
    })

    it('should fallback to chat for unknown mode', () => {
      const prompt = (service as any).getSystemPromptForMode('unknown')
      expect(prompt).toContain('Friday')
    })
  })

  describe('dispatch', () => {
    it('should return error when no agents available', async () => {
      const service2 = new AgentService()
      await service2.init()
      
      // Disable all agents
      const agents = service2.list().agents
      for (const agent of agents) {
        agent.enabled = false
      }

      await expect(
        service2.dispatch('test task', 'chat')
      ).rejects.toThrow('No available agents')
    })
  })
})
```

- [ ] **Step 2: 运行测试**

运行：`npm test -- AgentService.test.ts`

预期：测试通过

- [ ] **Step 3: 提交代码**

```bash
git add electron/services/AgentService.test.ts
git commit -m "test(agent): add unit tests for AgentService"
```

---

## 验收检查清单

- [ ] AGENT_PROMPTS 常量已添加
- [ ] getSystemPromptForMode 方法已实现
- [ ] callLLM 方法已实现
- [ ] invokeLLM IPC 调用已实现
- [ ] executeWithAgent 已集成 LLM 调用
- [ ] llm:agentChat handler 已添加
- [ ] 错误处理完善
- [ ] 单元测试通过
- [ ] 端到端测试通过

---

## 依赖关系

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7
  ↑                                        │
  └────────────────────────────────────────┘
         (验证后继续)
```

---

## 预期交付时间

- Task 1-2: 15 分钟
- Task 3-4: 20 分钟
- Task 5: 15 分钟
- Task 6-7: 15 分钟
- **总计: 约 65 分钟**

---

**Plan saved to:** `docs/superpowers/plans/2026-05-30-friday-agent-llm-integration-plan.md`
