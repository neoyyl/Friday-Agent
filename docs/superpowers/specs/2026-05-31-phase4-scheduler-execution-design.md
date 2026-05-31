# Friday Agent Phase 4 设计文档：调度任务执行

**项目**: Friday Agent Platform
**版本**: v2.3.0
**日期**: 2026-05-31
**状态**: 待批准

---

## 1. 背景与目标

### 1.1 项目现状

**SchedulerService**：
- ✅ 使用 node-cron 实现定时调度
- ✅ 支持创建、删除、切换定时任务
- ❌ `executeJob` 只发送事件，不真正执行 `job.action`
- ❌ job.action 没有被解析和执行

**TriggerService**：
- ✅ event 类型已完整实现
- ⚠️ cron 类型预设存在但未实现
- ✅ 事件匹配逻辑完整
- ❌ 缺少 action 执行能力

### 1.2 Phase 4 目标

1. **SchedulerService 完善** - 让定时任务真正执行 action
2. **TriggerService cron 支持** - 实现基于 cron 的触发器
3. **Action 执行引擎** - 支持多种 action 类型
4. **与现有系统集成** - Agent、Workflow、工具的调度

---

## 2. 技术方案

### 2.1 Action 类型定义

```typescript
interface SchedulerJob {
  id: string
  name: string
  cron: string
  action: JobAction
  enabled: boolean
  // ... 其他字段
}

type JobAction = {
  type: 'agent' | 'workflow' | 'skill' | 'notification'
  target_id?: string
  params?: Record<string, unknown>
}
```

### 2.2 Action 执行流程

```
Cron 触发
    ↓
executeJob(job)
    ↓
解析 job.action
    ↓
┌─────────────────────────────────────┐
│  switch (action.type)                │
│    case 'agent': executeAgent()      │
│    case 'workflow': executeWorkflow()│
│    case 'skill': executeSkill()     │
│    case 'notification': sendNotify()│
└─────────────────────────────────────┘
    ↓
更新 job.last_run, job.run_count
```

### 2.3 Trigger cron 支持

在 TriggerService 中添加：
- cron 类型触发器
- 使用 node-cron 调度
- 与 SchedulerService 类似但更轻量

---

## 3. 预设 Action 模板

| Action | 描述 | 参数 |
|--------|------|------|
| `daily_report` | 生成日报 | 无 |
| `weather_reminder` | 天气提醒 | location |
| `backup` | 备份数据 | target_path |
| `cleanup` | 清理临时文件 | pattern |
| `health_check` | 健康检查 | 无 |

---

## 4. 实施范围

| 功能 | 优先级 | 状态 |
|------|--------|------|
| SchedulerService executeJob 真正执行 | P0 | 待实现 |
| Action 类型定义 | P0 | 待实现 |
| TriggerService cron 类型 | P1 | 待实现 |
| Action 执行引擎 | P1 | 待实现 |
| 预设 Action 模板 | P2 | 待实现 |

---

## 5. 验收标准

- [ ] SchedulerService.executeJob() 真正执行 action
- [ ] 支持 agent/workflow/skill/notification 类型 action
- [ ] TriggerService 支持 cron 类型
- [ ] 与现有 AgentService、WorkflowService 集成
- [ ] 错误处理完善
- [ ] 代码编译无错误

---

## 6. 后续阶段

- **Phase 5**: 智能工作流（LLM 驱动）
