# Friday Agent Phase 5 设计文档：智能工作流（LLM 驱动）

**项目**: Friday Agent Platform
**版本**: v2.4.0
**日期**: 2026-05-31
**状态**: 待批准

---

## 1. 背景与目标

### 1.1 项目现状

经过 Phase 1-4 的实现，我们已经拥有：
- ✅ Agent + LLM 集成
- ✅ 工具执行 + 工作流 + 预设
- ✅ 语音识别（模拟模式）
- ✅ 调度任务执行 + cron 触发器

### 1.2 Phase 5 目标

**核心目标**：让 LLM 理解用户意图，自动编排工具和工作流完成任务

用户可以用自然语言描述任务，系统自动：
1. 理解任务意图
2. 选择合适的工具
3. 编排执行步骤
4. 执行并返回结果

### 1.3 使用场景示例

```
用户: "帮我搜索一下今天北京的天气，然后保存到桌面"

LLM 理解：
1. 识别需要天气查询工具
2. 识别需要文件写入工具
3. 编排步骤：搜索 → 保存到桌面
4. 执行并返回结果
```

---

## 2. 技术方案

### 2.1 架构设计

```
┌──────────────────────────────────────────────────────────┐
│              Intent Understanding Layer                   │
│  用户输入 → LLM 理解意图 → 提取工具需求 → 编排步骤      │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                    Orchestration Engine                    │
│  - 解析 LLM 返回的执行计划                               │
│  - 验证工具可用性                                        │
│  - 处理步骤依赖                                          │
│  - 管理执行上下文                                        │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                      Execution Layer                       │
│  - 执行工具/技能/Agent                                    │
│  - 收集执行结果                                          │
│  - 处理错误和回退                                        │
└──────────────────────────────────────────────────────────┘
```

### 2.2 核心接口

```typescript
// LLM 返回的执行计划格式
interface ExecutionPlan {
  steps: Array<{
    id: string
    tool: string
    params: Record<string, unknown>
    depends_on?: string[]
  }>
  summary: string
}

// 智能编排服务
interface OrchestrationService {
  // 从自然语言生成执行计划
  understandIntent(task: string): Promise<ExecutionPlan>
  
  // 执行计划
  executePlan(plan: ExecutionPlan): Promise<ExecutionResult>
  
  // 一步式：理解 + 执行
  autoExecute(task: string): Promise<ExecutionResult>
}
```

### 2.3 LLM 提示词设计

```typescript
const ORCHESTRATION_PROMPT = `你是一个任务编排专家。根据用户的需求，生成执行计划。

可用工具：
- web-search: 网络搜索
- file-reader: 读取文件
- file-writer: 写入文件
- code-executor: 执行代码
- shell-executor: 执行 Shell 命令
- agent: 调用 AI Agent

技能：
- web-search: 网络搜索
- file-ops: 文件操作
- code-exec: 代码执行
- text-process: 文本处理

用户需求：{user_task}

请返回 JSON 格式的执行计划：
{
  "steps": [
    {
      "id": "step1",
      "tool": "工具名称",
      "params": { "参数": "值" },
      "description": "步骤描述"
    }
  ],
  "summary": "计划摘要"
}

只返回 JSON，不要其他内容。`
```

---

## 3. 实施范围

### 3.1 核心功能

| 功能 | 优先级 | 描述 |
|------|--------|------|
| OrchestrationService | P0 | 智能编排服务 |
| Intent Understanding | P0 | 理解用户意图 |
| Plan Execution | P0 | 执行编排计划 |
| Tool Selection | P1 | 工具选择 |
| Error Handling | P1 | 错误处理和回退 |

### 3.2 简化实现

考虑到复杂度，Phase 5 采用**简化版实现**：
- 使用正则表达式 + 关键词匹配理解意图
- 预设工具映射表
- 简单的步骤编排

后续可以升级为完整的 LLM 驱动编排。

---

## 4. 验收标准

- [ ] OrchestrationService 核心功能实现
- [ ] 意图理解（关键词 + 正则）
- [ ] 工具自动选择
- [ ] 步骤编排和执行
- [ ] 与现有 AgentService、WorkflowService 集成
- [ ] 代码编译无错误

---

## 5. 后续扩展

- 完整的 LLM 驱动编排
- 步骤条件判断
- 循环执行
- 执行可视化
