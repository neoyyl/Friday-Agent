# Friday Agent Phase 2 设计方案：工具执行层

**项目**: Friday Agent Platform
**版本**: v2.1.0
**日期**: 2026-05-31
**状态**: 待批准

---

## 1. 背景与目标

### 1.1 项目现状
经过 Phase 1 的完成，AgentService 已成功集成 LLM 调用，但存在以下需要完善的地方：
- WorkflowService 的 `dispatchStepAction` 只发送事件，不真正执行动作
- AgentService 尚未集成工具调用能力
- LLM handler 尚未实现 function calling
- 工具服务已完整，但需要更完善的集成

### 1.2 Phase 2 目标
1. **完善 WorkflowService** - 让工作流步骤真正执行工具/技能
2. **Agent + 工具集成** - 让 Agent 可以调用工具完成复杂任务
3. **LLM Function Calling** - 实现 LLM 的工具调用能力
4. **预设工作流** - 提供常用工作流模板

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                 │
│  (Workflows, Agent, Tools, Skills Panels)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     IPC Bridge (preload)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Agent Svc   │──►│  Workflow    │──►│  Tools Svc  │          │
│  │              │  │    Service   │  │             │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  LLM Handler │──►│  Skill Svc   │  │  Presets    │          │
│  │(function call)│  │             │  │  Workflows  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心设计

### 3.1 WorkflowStep 扩展

```typescript
interface WorkflowStep {
  name: string
  action: 'tool' | 'skill' | 'agent' | 'event'
  target_id?: string      // 工具/技能/Agent ID
  params?: Record<string, unknown>
  condition?: string      // 可选的执行条件表达式
}
```

### 3.2 动作类型

| Action | Description | 示例 |
|--------|-------------|------|
| `tool` | 执行工具 | file-reader, code-executor |
| `skill` | 执行技能 | web-search, file-ops |
| `agent` | 调用 Agent | planner, coder, researcher |
| `event` | 仅发送事件（原行为） | 向后兼容 |

### 3.3 LLM Function Calling

让 Agent 可以自动决定何时调用工具：

```typescript
interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

interface ChatResponseWithTools {
  content?: string
  tool_calls?: ToolCall[]
}
```

---

## 4. 预设工作流模板

### 4.1 模板定义

```typescript
interface WorkflowPreset {
  id: string
  name: string
  description: string
  icon: string
  category: 'daily' | 'dev' | 'research' | 'automation'
  steps: WorkflowStep[]
}
```

### 4.2 内置模板

| 模板 | 用途 | 步骤 |
|------|------|------|
| `search-analyze-save` | 搜索→分析→保存 | 1. web-search 2. text-process 3. file-writer |
| `code-review` | 代码审查 | 1. file-reader 2. agent=coder 3. file-writer |
| `daily-report` | 日报生成 | 1. shell-executor(git log) 2. agent=assistant |

---

## 5. Phase 2 实施范围

### 任务清单

| 任务 | 优先级 | 描述 |
|------|--------|------|
| 1 | P0 | 完善 WorkflowService dispatchStepAction 真正执行工具/技能/Agent |
| 2 | P0 | 在 AgentService 中集成工具调用能力 |
| 3 | P0 | 实现预设工作流模板系统 |
| 4 | P1 | 在 LLM handler 中实现 function calling（可选） |
| 5 | P1 | 添加工具/Agent 调用 IPC 暴露给前端 |

---

## 6. 验收标准

- [ ] Workflow 步骤可以真正执行工具（file-reader, code-executor 等）
- [ ] Workflow 步骤可以调用 Skill（web-search, file-ops 等）
- [ ] Workflow 步骤可以调用 Agent（planner, coder, researcher）
- [ ] 提供 3+ 个预设工作流模板
- [ ] Agent 可以使用工具完成任务
- [ ] 完整的错误处理

---

## 7. 后续 Phase 规划

| Phase | 核心交付 |
|-------|---------|
| Phase 3 | 语音识别完善 |
| Phase 4 | 调度任务执行 |
| Phase 5 | 智能工作流（LLM 驱动） |
