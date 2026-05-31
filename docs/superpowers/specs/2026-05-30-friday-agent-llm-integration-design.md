# Friday Agent 功能实现设计方案

**项目**: Friday Agent Platform
**版本**: v2.0.0
**日期**: 2026-05-30
**状态**: 已批准

---

## 1. 背景与目标

### 1.1 项目定位
Friday Agent 是一个综合型 AI 助手平台，核心特点：
- 多模态交互（文字、语音）
- 混合 Agent 架构（简单任务直接处理，复杂任务多 Agent 协作）
- 分阶段实现工作流自动化

### 1.2 当前问题
经过代码审查，发现以下核心功能只有框架没有实现：
- Agent 执行返回模拟文本，未调用 LLM
- 工作流动作只发事件不执行
- 语音识别返回空结果
- 调度任务不执行 action

### 1.3 本文范围
本文档聚焦 **Phase 1: Agent + LLM 调用** 的设计与实现。

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                 │
│  (CenterArea, SidePanel, ThemeSwitcher, SettingsPanel...)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     IPC Bridge (preload)                         │
│            window.electronAPI.backend.*                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ LLM Handler  │  │ Agent Service│  │  Tool Exec   │          │
│  │  (llm.ts)    │  │(AgentService)│  │(tools/index) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │Voice Service │  │Scheduler Svc  │  │ Workflow Svc  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                           │
│        LLM APIs (OpenAI/Anthropic/Local...)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1 详细设计：Agent + LLM 调用

### 3.1 目标
让 Agent 真正调用 LLM 处理任务，替代当前的模拟文本返回。

### 3.2 核心改动文件
- `electron/services/AgentService.ts` - Agent 服务核心逻辑
- `electron/handlers/llm.ts` - LLM IPC 处理器

### 3.3 Agent 定义

| Agent ID | 名称 | 描述 | 核心能力 |
|----------|------|------|---------|
| assistant | General Assistant | 通用 AI 助手 | chat, reasoning |
| coder | Coder Agent | 代码生成与分析 | code, debug |
| researcher | Research Agent | 网络搜索与信息分析 | search, summarize |
| planner | Planner Agent | 任务规划与分解 | plan, coordinate |

### 3.4 Agent Mode 定义

```typescript
type AgentMode = 'chat' | 'code' | 'research' | 'plan'
```

### 3.5 系统提示词映射

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

### 3.6 核心流程

```
User Input
    │
    ▼
CenterArea (UI)
    │
    ▼
chatStore.addMessage()
    │
    ▼
AgentService.dispatch(task, mode)
    │
    ├──► validate agent & mode
    │
    ├──► callLLM(task, mode)
    │       │
    │       ├──► getSystemPrompt(mode)
    │       │
    │       ├──► ipcRenderer.invoke('llm:chat', messages)
    │       │       │
    │       │       └──► LLM Handler
    │       │               │
    │       │               └──► call createLLMClient()
    │       │                       │
    │       │                       └──► External LLM API
    │       │
    │       └──► return response.content
    │
    └──► return { agent_id, result }
            │
            ▼
chatStore.addMessage() -> display result
```

### 3.7 API 设计

#### 3.7.1 dispatch 方法签名
```typescript
async dispatch(
  task: string,
  mode: string,
  options?: {
    model?: string
    temperature?: number
    enableTools?: boolean
  }
): Promise<{ agent_id: string; result: string }>
```

#### 3.7.2 返回值
```typescript
{
  agent_id: string   // 执行任务的 Agent ID
  result: string     // LLM 返回的结果内容
}
```

---

## 4. 实现步骤

### Step 1: 添加系统提示词映射
在 `AgentService.ts` 中添加：
- `AGENT_PROMPTS` 常量
- `getSystemPromptForMode(mode)` 方法

### Step 2: 实现 callLLM 方法
新增私有方法：
- 构建 messages 数组（system + user）
- 通过 IPC 调用 llm:chat
- 处理错误和超时

### Step 3: 修改 executeWithAgent
替换模拟返回为真正的 LLM 调用

### Step 4: 添加错误处理
- LLM API 错误
- 网络超时
- Agent 不可用

### Step 5: 集成到前端
确保 CenterArea 可以选择 Agent 和 Mode

---

## 5. 错误处理策略

| 错误类型 | 处理方式 |
|---------|---------|
| LLM API 超时 | 返回 "请求超时，请重试" |
| API Key 未配置 | 返回 "请先在设置中配置 API Key" |
| Agent 不可用 | 返回 "当前 Agent 不可用" |
| 网络错误 | 返回 "网络连接失败" |

---

## 6. 后续 Phase 规划

| Phase | 核心交付 | 涉及模块 |
|-------|---------|---------|
| Phase 2 | 工具执行层 | Tools, Workflow dispatch |
| Phase 3 | 语音识别完善 | VoiceService ASR |
| Phase 4 | 调度任务执行 | Scheduler, Trigger |
| Phase 5 | 智能工作流 | Workflow LLM-driven |

---

## 7. 验收标准

- [ ] AgentService.dispatch() 调用 LLM 并返回真实结果
- [ ] 四种 Mode (chat/code/research/plan) 都能正常工作
- [ ] 错误处理完善，用户体验良好
- [ ] 前端可以选择不同 Agent 和 Mode
- [ ] 单元测试覆盖核心逻辑

---

## 8. 技术约束

- 保持与现有 LLM Handler 的兼容性
- 不破坏现有的聊天功能
- 支持流式输出（可选，后续 Phase）
