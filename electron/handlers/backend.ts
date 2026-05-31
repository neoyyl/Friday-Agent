import { ipcMain } from 'electron'
import { ServiceRegistry } from '../services/ServiceRegistry'
import { HealthService } from '../services/HealthService'
import { ConfigService } from '../services/ConfigService'
import { PerceptionService } from '../services/PerceptionService'
import { GPUService } from '../services/GPUService'
import { ObsidianService } from '../services/ObsidianService'
import { MemoryService } from '../services/MemoryService'
import { ExecutionLogService } from '../services/ExecutionLogService'
import { DispatchLogService } from '../services/DispatchLogService'
import { TimingService } from '../services/TimingService'
import { SelfHealService } from '../services/SelfHealService'
import { PersonalityService } from '../services/PersonalityService'
import { AgentService } from '../services/AgentService'
import { SkillService } from '../services/SkillService'
import { SchedulerService } from '../services/SchedulerService'
import { TriggerService } from '../services/TriggerService'
import { WorkflowService } from '../services/WorkflowService'
import { EmotionService } from '../services/EmotionService'
import { VoiceService } from '../services/VoiceService'
import { OrchestrationService } from '../services/OrchestrationService'

function wrapError(e: unknown): { error: string } {
  return { error: e instanceof Error ? e.message : String(e) }
}

function success<T>(data: T): { success: true; data: T } {
  return { success: true, data }
}

export function registerBackendHandlers(registry: ServiceRegistry): void {
  const svc = {
    health: () => registry.get<HealthService>('health'),
    config: () => registry.get<ConfigService>('config'),
    perception: () => registry.get<PerceptionService>('perception'),
    gpu: () => registry.get<GPUService>('gpu'),
    obsidian: () => registry.get<ObsidianService>('obsidian'),
    memory: () => registry.get<MemoryService>('memory'),
    log: () => registry.get<ExecutionLogService>('execution_log'),
    dispatch: () => registry.get<DispatchLogService>('dispatch_log'),
    timing: () => registry.get<TimingService>('timing'),
    heal: () => registry.get<SelfHealService>('self_heal'),
    personality: () => registry.get<PersonalityService>('personality'),
    agents: () => registry.get<AgentService>('agents'),
    skills: () => registry.get<SkillService>('skills'),
    scheduler: () => registry.get<SchedulerService>('scheduler'),
    triggers: () => registry.get<TriggerService>('triggers'),
    workflows: () => registry.get<WorkflowService>('workflows'),
    emotion: () => registry.get<EmotionService>('emotion'),
    voice: () => registry.get<VoiceService>('voice'),
    orchestration: () => registry.get<OrchestrationService>('orchestration'),
  }

  ipcMain.handle('backend:start', async () => {
    const reg = registry
    return {
      success: true,
      data: {
        status: 'running',
        process: 'running',
        pid: process.pid,
        wsConnected: true,
        services: reg.getAll().map((s: { name: string }) => s.name),
      },
    }
  })

  ipcMain.handle('backend:stop', async () => {
    return { success: true }
  })

  ipcMain.handle('backend:status', () => {
    return {
      status: 'running',
      process: 'running',
      pid: process.pid,
      wsConnected: true,
      services: registry.getAll().map((s: { name: string }) => s.name),
    }
  })

  ipcMain.handle('backend:getStderrLog', () => {
    return { log: [] }
  })

  ipcMain.handle('backend:proxy', async (_event, method: string, apiPath: string, body?: any) => {
    try {
      const path = apiPath.replace(/^\/api\//, '')
      if (method === 'GET') {
        if (path === 'health') return success(svc.health()?.check())
        if (path === 'hello') return success(svc.health()?.hello())
        if (path === 'config') return success(svc.config()?.get())
        if (path === 'perception/context') return success(svc.perception()?.getFullContext())
        if (path === 'perception/window') return success(svc.perception()?.getWindowContext())
        if (path === 'perception/git') return success(svc.perception()?.getGitContext())
        if (path === 'perception/project') return success(svc.perception()?.getProjectContext())
        if (path === 'gpu/status') {
          const gpu = svc.gpu()
          return success(gpu ? await gpu.queryStatus() : { available: false, error: 'GPUService not available' })
        }
        if (path === 'obsidian/config') return success(svc.obsidian()?.getConfig())
        if (path === 'personality') return success(svc.personality()?.get())
        if (path.startsWith('obsidian/notes')) return success(svc.obsidian()?.listNotes((body as any)?.folder || ''))
        if (path.startsWith('memory/context')) return success(svc.memory()?.getContext())
        if (path === 'memory') return success(svc.memory()?.list())
        if (path === 'log') return success(svc.log()?.list())
        if (path === 'log/report') return success(svc.log()?.getReport())
        if (path === 'dispatch_log/stats') return success(svc.dispatch()?.getStats())
        if (path === 'dispatch_log/insights') return success(svc.dispatch()?.getInsights())
        if (path === 'scheduler/status') return success(svc.scheduler()?.queryStatus())
        if (path === 'scheduler/jobs') return success(svc.scheduler()?.getJobs())
        if (path === 'triggers') return success(svc.triggers()?.list())
        if (path === 'triggers/presets') return success(svc.triggers()?.presets())
        if (path === 'workflows') return success(svc.workflows()?.list())
        if (path === 'workflows/instances') return success(svc.workflows()?.getInstances())
        if (path === 'agents') return success(svc.agents()?.list())
        if (path === 'agents/stats') return success(svc.agents()?.getStats())
        if (path === 'orchestrator/history') return success(svc.agents()?.getHistory())
        if (path === 'skills') return success(svc.skills()?.list())
        if (path === 'skills/stats') return success(svc.skills()?.getStats())
        if (path.startsWith('skills/find')) {
          const url = new URL(apiPath, 'http://localhost')
          return success(svc.skills()?.find(url.searchParams.get('capability') || ''))
        }
        if (path === 'emotion/state') return success(svc.emotion()?.getState())
        if (path === 'tts/status') return success(svc.voice()?.queryStatus())
        if (path === 'voice/speakers') return success(svc.voice()?.getSpeakers())
        if (path === 'voice/current') return success(svc.voice()?.getCurrentSpeaker())
        if (path === 'timing/readiness') return success(svc.timing()?.getReadiness())
        if (path === 'self_heal/check') return success(svc.heal()?.check())
        if (path === 'asr/status') return success({ available: false })
      } else if (method === 'POST') {
        if (path === 'config') return success(svc.config()?.update(body || {}))
        if (path.startsWith('memory')) return success(svc.memory()?.save(body || {}))
        if (path.startsWith('obsidian/write')) return success(svc.obsidian()?.writeNote(body || { title: 'untitled', content: '' }))
        if (path.startsWith('orchestrator/dispatch')) return success(await svc.agents()?.dispatch(body?.task || '', body?.mode || 'auto', body))
        if (path.startsWith('skills/scan')) return success(svc.skills()?.rescan())
        if (path.startsWith('tts/speak')) return success(svc.voice()?.speak(body?.text || '', body?.tone))
        if (path.startsWith('tts/stop')) return success(svc.voice()?.stop())
        if (path.startsWith('emotion/analyze')) return success(svc.emotion()?.analyze(body?.text || ''))
        if (path.startsWith('voice/speakers') && !path.includes('/')) return success(svc.voice()?.register(body?.name || 'unknown', body))
        if (path === 'timing/should_notify') return success(svc.timing()?.shouldNotify(body || {}))
        if (path === 'self_heal/fix') return success(svc.heal()?.fix())
        if (path.startsWith('scheduler/jobs') && path.endsWith('/toggle')) {
          const jobId = path.split('/')[2]
          return success(svc.scheduler()?.toggle(jobId))
        }
        if (path.startsWith('scheduler/jobs')) {
          const parts = path.split('/')
          if (parts.length === 2) return success(svc.scheduler()?.create(body || {}))
          if (parts.length === 3 && parts[2]) return success(svc.scheduler()?.delete(parts[2]))
        }
        if (path.startsWith('scheduler/actions')) {
          const actionName = path.split('/')[2]
          return success(svc.scheduler()?.runAction(actionName))
        }
        if (path === 'triggers') return success(svc.triggers()?.create(body || {}))
        if (path.startsWith('workflows') && path.endsWith('/run')) {
          const wfId = path.split('/')[1]
          return success(svc.workflows()?.run(wfId))
        }
        if (path === 'workflows') return success(svc.workflows()?.create(body || {}))
      } else if (method === 'DELETE') {
        if (path.startsWith('scheduler/jobs/')) {
          const jobId = path.split('/')[2]
          return success(svc.scheduler()?.delete(jobId))
        }
        if (path.startsWith('triggers/')) {
          const trigId = path.split('/')[1]
          return success(svc.triggers()?.delete(trigId))
        }
        if (path.startsWith('voice/speakers/')) {
          const name = decodeURIComponent(path.split('/')[2])
          return success(svc.voice()?.deleteSpeaker(name))
        }
      }
      return success({ method, apiPath, body, message: 'No native handler for this path' })
    } catch (e) {
      return wrapError(e)
    }
  })

  ipcMain.handle('backend:agents:list', async () => {
    try { return success(svc.agents()?.list()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:agents:stats', async () => {
    try { return success(svc.agents()?.getStats()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:agents:dispatch', async (_event, task: string, mode: string, options?: any) => {
    try { return success(await svc.agents()?.dispatch(task, mode, options)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:agents:history', async () => {
    try { return success(svc.agents()?.getHistory()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:skills:list', async () => {
    try { return success(svc.skills()?.list()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:skills:stats', async () => {
    try { return success(svc.skills()?.getStats()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:skills:call', async (_event, id: string, params?: any) => {
    try { return success(await svc.skills()?.call(id, params)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:skills:reload', async (_event, id: string) => {
    try { return success(svc.skills()?.reload(id)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:skills:find', async (_event, capability: string) => {
    try { return success(svc.skills()?.find(capability)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:skills:scan', async () => {
    try { return success(svc.skills()?.rescan()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:scheduler:status', async () => {
    try { return success(svc.scheduler()?.queryStatus()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:scheduler:jobs', async () => {
    try { return success(svc.scheduler()?.getJobs()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:scheduler:create', async (_event, job: any) => {
    try { return success(svc.scheduler()?.create(job)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:scheduler:delete', async (_event, id: string) => {
    try { return success(svc.scheduler()?.delete(id)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:scheduler:toggle', async (_event, id: string) => {
    try { return success(svc.scheduler()?.toggle(id)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:scheduler:action', async (_event, name: string) => {
    try { return success(svc.scheduler()?.runAction(name)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:triggers:list', async () => {
    try { return success(svc.triggers()?.list()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:triggers:create', async (_event, trigger: any) => {
    try { return success(svc.triggers()?.create(trigger)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:triggers:delete', async (_event, id: string) => {
    try { return success(svc.triggers()?.delete(id)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:triggers:toggle', async (_event, id: string) => {
    try { return success(svc.triggers()?.toggle(id)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:triggers:presets', async () => {
    try { return success(svc.triggers()?.presets()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:workflows:list', async () => {
    try { return success(svc.workflows()?.list()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:workflows:create', async (_event, workflow: any) => {
    try { return success(svc.workflows()?.create(workflow)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:workflows:run', async (_event, id: string) => {
    try { return success(svc.workflows()?.run(id)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:workflows:instances', async () => {
    try { return success(svc.workflows()?.getInstances()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:workflows:presets', async () => {
    try { return success(svc.workflows()?.listPresets()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:workflows:createFromPreset', async (_event, presetId: string, params?: any) => {
    try { return success(svc.workflows()?.createFromPreset(presetId, params)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:emotion:analyze', async (_event, text: string) => {
    try { return success(svc.emotion()?.analyze(text)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:emotion:state', async () => {
    try { return success(svc.emotion()?.getState()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:voice:speak', async (_event, text: string, tone?: string) => {
    try { return success(svc.voice()?.speak(text, tone)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:voice:stop', async () => {
    try { return success(svc.voice()?.stop()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:voice:status', async () => {
    try { return success(svc.voice()?.queryStatus()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:voice:speakers', async () => {
    try { return success(svc.voice()?.getSpeakers()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:voice:register', async (_event, name: string, config?: any) => {
    try { return success(svc.voice()?.register(name, config)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:voice:deleteSpeaker', async (_event, name: string) => {
    try { return success(svc.voice()?.deleteSpeaker(name)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:voice:currentSpeaker', async () => {
    try { return success(svc.voice()?.getCurrentSpeaker()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:voice:identify', async (_event, data: any) => {
    try { return success(svc.voice()?.identify(data)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:asr:status', async () => {
    try { return success(svc.voice()?.getASRStatus()) } catch (e) { return wrapError(e) }
  })
  
  ipcMain.handle('backend:asr:start', async (_event, lang?: string) => {
    try { return success(await svc.voice()?.startListening(lang)) } catch (e) { return wrapError(e) }
  })
  
  ipcMain.handle('backend:asr:stop', async () => {
    try { return success(svc.voice()?.stopListening()) } catch (e) { return wrapError(e) }
  })
  
  ipcMain.handle('backend:asr:transcribe', async (_event, audioBase64: string, lang?: string) => {
    try { return success(await svc.voice()?.transcribe(audioBase64, lang)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:dispatch:stats', async () => {
    try { return success(svc.dispatch()?.getStats()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:dispatch:insights', async () => {
    try { return success(svc.dispatch()?.getInsights()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:log:list', async () => {
    try { return success(svc.log()?.list()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:log:report', async () => {
    try { return success(svc.log()?.getReport()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:timing:readiness', async () => {
    try { return success(svc.timing()?.getReadiness()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:timing:shouldNotify', async (_event, data: any) => {
    try { return success(svc.timing()?.shouldNotify(data)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:self_heal:check', async () => {
    try { return success(svc.heal()?.check()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:self_heal:fix', async () => {
    try { return success(svc.heal()?.fix()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:memory:context', async () => {
    try { return success(svc.memory()?.getContext()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:memory:list', async () => {
    try { return success(svc.memory()?.list()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:memory:save', async (_event, data: any) => {
    try { return success(svc.memory()?.save(data)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:personality:get', async () => {
    try { return success(svc.personality()?.get()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:gpu:status', async () => {
    try {
      const gpu = svc.gpu()
      if (!gpu) return wrapError(new Error('GPUService not available'))
      return success(await gpu.queryStatus())
    } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:obsidian:config', async () => {
    try { return success(svc.obsidian()?.getConfig()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:obsidian:notes', async (_event, folder?: string) => {
    try { return success(svc.obsidian()?.listNotes(folder)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:obsidian:write', async (_event, data: any) => {
    try { return success(svc.obsidian()?.writeNote(data)) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:perception:context', async () => {
    try { return success(svc.perception()?.getFullContext()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:health', async () => {
    try { return success(svc.health()?.check()) } catch (e) { return wrapError(e) }
  })

  ipcMain.handle('backend:orchestration:autoExecute', async (_event, task: string) => {
    try {
      const orchService = svc.orchestration()
      if (orchService) {
        return success(await (orchService as OrchestrationService).autoExecute(task))
      }
      return wrapError(new Error('OrchestrationService not available'))
    } catch (e) {
      return wrapError(e)
    }
  })

  ipcMain.handle('backend:orchestration:understand', async (_event, task: string) => {
    try {
      const orchService = svc.orchestration()
      if (orchService) {
        return success((orchService as OrchestrationService).understandIntent(task))
      }
      return wrapError(new Error('OrchestrationService not available'))
    } catch (e) {
      return wrapError(e)
    }
  })
}