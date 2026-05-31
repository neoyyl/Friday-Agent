# Friday Agent Phase 4 实施计划：调度任务执行

**项目**: Friday Agent Platform
**版本**: v2.3.0
**日期**: 2026-05-31
**状态**: 待执行

---

## 目标

让 SchedulerService 真正执行定时任务，TriggerService 支持 cron 类型。

---

## 任务清单

### Task 1: 完善 SchedulerService action 执行

**文件**: `electron/services/SchedulerService.ts`

**目标**: `executeJob` 不再只发送事件，而是真正执行 action

**步骤**:

1. **添加 Action 类型定义**
   ```typescript
   interface JobAction {
     type: 'agent' | 'workflow' | 'skill' | 'notification'
     target_id?: string
     params?: Record<string, unknown>
   }
   
   interface SchedulerJob {
     id: string
     name: string
     cron: string
     action: JobAction | string  // 兼容旧格式
     enabled: boolean
     // ... 其他字段
   }
   ```

2. **更新 SchedulerJob 接口**
   修改第5-15行的接口定义，添加 action 的类型支持

3. **添加 action 执行方法**
   ```typescript
   private async executeJobAction(job: SchedulerJob): Promise<void> {
     const action = this.parseAction(job.action)
     if (!action) {
       console.warn(`[SchedulerService] No valid action for job: ${job.name}`)
       return
     }
   
     try {
       switch (action.type) {
         case 'agent':
           await this.executeAgentAction(action)
           break
         case 'workflow':
           await this.executeWorkflowAction(action)
           break
         case 'skill':
           await this.executeSkillAction(action)
           break
         case 'notification':
           await this.executeNotificationAction(action)
           break
         default:
           console.warn(`[SchedulerService] Unknown action type: ${action.type}`)
       }
     } catch (err) {
       console.error(`[SchedulerService] Action execution failed for job ${job.name}:`, err)
       job.last_status = 'failed'
     }
   }
   ```

4. **添加 parseAction 方法**
   ```typescript
   private parseAction(action: JobAction | string): JobAction | null {
     if (typeof action === 'string') {
       // 兼容旧的字符串格式
       if (action.startsWith('agent:')) {
         return { type: 'agent', target_id: action.substring(6) }
       }
       if (action.startsWith('workflow:')) {
         return { type: 'workflow', target_id: action.substring(9) }
       }
       if (action.startsWith('skill:')) {
         return { type: 'skill', target_id: action.substring(6) }
       }
       // 默认作为 notification
       return { type: 'notification', params: { message: action } }
     }
     return action
   }
   ```

5. **实现各个 action 执行方法**
   ```typescript
   private async executeAgentAction(action: JobAction): Promise<void> {
     const { ServiceRegistry } = await import('./ServiceRegistry')
     const registry = ServiceRegistry.getInstance()
     const agentService = registry.get('agents')
     if (agentService) {
       const task = (action.params?.task as string) || 'Scheduled task'
       const mode = (action.params?.mode as string) || 'chat'
       await (agentService as any).dispatch(task, mode)
     }
   }
   
   private async executeWorkflowAction(action: JobAction): Promise<void> {
     const { ServiceRegistry } = await import('./ServiceRegistry')
     const registry = ServiceRegistry.getInstance()
     const workflowService = registry.get('workflows')
     if (workflowService && action.target_id) {
       await (workflowService as any).run(action.target_id)
     }
   }
   
   private async executeSkillAction(action: JobAction): Promise<void> {
     const { ServiceRegistry } = await import('./ServiceRegistry')
     const registry = ServiceRegistry.getInstance()
     const skillService = registry.get('skills')
     if (skillService && action.target_id) {
       await (skillService as any).call(action.target_id, action.params)
     }
   }
   
   private async executeNotificationAction(action: JobAction): Promise<void> {
     const { ServiceRegistry } = await import('./ServiceRegistry')
     const registry = ServiceRegistry.getInstance()
     const voiceService = registry.get('voice')
     const message = (action.params?.message as string) || 'Scheduled notification'
     if (voiceService) {
       await (voiceService as any).speak(message)
     }
   }
   ```

6. **更新 executeJob 方法**
   ```typescript
   private executeJob(job: SchedulerJob): void {
     job.last_run = new Date().toISOString()
     job.run_count++
     
     this.emit('scheduler.executed', {
       id: job.id,
       name: job.name,
       action: job.action,
       timestamp: job.last_run,
     })
     
     // 异步执行 action
     this.executeJobAction(job).catch(err => {
       console.error(`[SchedulerService] executeJobAction error:`, err)
     })
   }
   ```

---

### Task 2: 实现 TriggerService cron 类型

**文件**: `electron/services/TriggerService.ts`

**目标**: 支持 cron 类型的触发器

**步骤**:

1. **添加 node-cron 导入**
   ```typescript
   import * as nodeCron from 'node-cron'
   import type { ScheduledTask } from 'node-cron'
   ```

2. **添加 cron 任务管理**
   ```typescript
   private cronTasks = new Map<string, ScheduledTask>()
   ```

3. **更新 create 方法支持 cron**
   ```typescript
   create(trigger: Partial<Trigger>): Trigger {
     // ... 现有代码 ...
     
     if (newTrigger.enabled && newTrigger.type === 'cron') {
       this.scheduleCronTrigger(newTrigger)
     }
     
     return newTrigger
   }
   ```

4. **添加 scheduleCronTrigger 方法**
   ```typescript
   private scheduleCronTrigger(trigger: Trigger): void {
     this.unscheduleCronTrigger(trigger.id)
     
     const config = trigger.config as Record<string, unknown>
     const schedule = config.schedule as string
     
     if (!nodeCron.validate(schedule)) {
       console.warn(`[TriggerService] Invalid cron schedule for trigger "${trigger.name}": ${schedule}`)
       return
     }
     
     try {
       const task = nodeCron.schedule(schedule, () => {
         this.fireTrigger(trigger, 'cron', { schedule })
       }, {
         timezone: process.env.TZ || 'Asia/Hong_Kong',
       })
       this.cronTasks.set(trigger.id, task)
     } catch (err) {
       console.error(`[TriggerService] Failed to schedule cron trigger "${trigger.name}":`, err)
     }
   }
   ```

5. **添加 unscheduleCronTrigger 方法**
   ```typescript
   private unscheduleCronTrigger(triggerId: string): void {
     const task = this.cronTasks.get(triggerId)
     if (task) {
       task.stop()
       this.cronTasks.delete(triggerId)
     }
   }
   ```

6. **更新 matchTrigger 支持 cron**
   ```typescript
   private matchTrigger(trigger: Trigger, event: string, data: unknown): boolean {
     const cfg = trigger.config as Record<string, unknown>
     const triggerType = trigger.type
   
     if (triggerType === 'event') {
       // 现有逻辑...
     }
   
     if (triggerType === 'cron') {
       // cron 类型由 node-cron 直接触发，不需要匹配
       return true
     }
   
     console.warn(`[TriggerService] Unknown trigger type: ${triggerType}`)
     return false
   }
   ```

7. **更新 toggle 方法**
   ```typescript
   toggle(id: string): Trigger | null {
     const trigger = this.triggers.find((t) => t.id === id)
     if (!trigger) return null
     trigger.enabled = !trigger.enabled
   
     if (trigger.type === 'cron') {
       if (trigger.enabled) {
         this.scheduleCronTrigger(trigger)
       } else {
         this.unscheduleCronTrigger(trigger.id)
       }
     }
   
     this.emit('triggers.updated', { triggers: this.triggers })
     return { ...trigger }
   }
   ```

8. **更新 shutdown 清理**
   ```typescript
   async shutdown(): Promise<void> {
     // 清理 cron 任务
     for (const task of this.cronTasks.values()) {
       task.stop()
     }
     this.cronTasks.clear()
     
     // ... 其他清理代码
   }
   ```

---

### Task 3: 更新 IPC handlers（如需要）

**文件**: `electron/handlers/backend.ts`

**检查**: 查看是否需要添加新的 IPC handlers

**预期**: 当前 IPC 已足够，无需修改

---

## 验收检查清单

- [ ] SchedulerJob 支持 JobAction 类型
- [ ] executeJob 真正执行 action
- [ ] 支持 agent/workflow/skill/notification action
- [ ] parseAction 兼容旧字符串格式
- [ ] TriggerService 支持 cron 类型
- [ ] cron 触发器可启用/禁用
- [ ] 与 AgentService、WorkflowService 集成
- [ ] 代码编译无错误

---

## 预期交付时间

- Task 1: 40 分钟
- Task 2: 30 分钟
- Task 3: 10 分钟
- **总计**: ~80 分钟
