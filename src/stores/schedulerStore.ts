import { create } from 'zustand'

export interface Job {
  id: string
  name: string
  trigger: string // 'cron' | 'interval' | 'date'
  expression?: string
  action?: string
  enabled: boolean
  next_run?: string
  last_run?: string
}

export interface Trigger {
  id: string
  name: string
  condition: string
  action: string
  enabled: boolean
  cooldown?: number
}

export interface Workflow {
  id: string
  name: string
  description?: string
  steps: any[]
  enabled?: boolean
}

export interface WorkflowInstance {
  id: string
  workflow_id: string
  status: 'running' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
}

interface SchedulerState {
  jobs: Job[]
  triggers: Trigger[]
  workflows: Workflow[]
  instances: WorkflowInstance[]
  isLoading: boolean

  loadJobs: () => Promise<void>
  createJob: (job: Partial<Job>) => Promise<boolean>
  deleteJob: (id: string) => Promise<boolean>
  toggleJob: (id: string) => Promise<boolean>
  runAction: (name: string) => Promise<boolean>

  loadTriggers: () => Promise<void>
  createTrigger: (trigger: Partial<Trigger>) => Promise<boolean>
  deleteTrigger: (id: string) => Promise<boolean>
  toggleTrigger: (id: string) => Promise<boolean>
  loadPresets: () => Promise<any[]>

  loadWorkflows: () => Promise<void>
  createWorkflow: (workflow: Partial<Workflow>) => Promise<boolean>
  runWorkflow: (id: string) => Promise<boolean>
  loadInstances: () => Promise<void>
}

export const useSchedulerStore = create<SchedulerState>((set) => ({
  jobs: [],
  triggers: [],
  workflows: [],
  instances: [],
  isLoading: false,

  loadJobs: async () => {
    try {
      const result = await (window as any).electronAPI.kernel.scheduler.jobs()
      if (result && !result.error) {
        const jobs = Array.isArray(result) ? result : (result.jobs || [])
        set({ jobs })
      }
    } catch (e) {
      console.error('Failed to load jobs:', e)
    }
  },

  createJob: async (job) => {
    try {
      const result = await (window as any).electronAPI.kernel.scheduler.create(job)
      if (result && !result.error) {
        await (useSchedulerStore.getState().loadJobs())
        return true
      }
      return false
    } catch {
      return false
    }
  },

  deleteJob: async (id) => {
    try {
      const result = await (window as any).electronAPI.kernel.scheduler.delete(id)
      if (result && !result.error) {
        set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  toggleJob: async (id) => {
    try {
      const result = await (window as any).electronAPI.kernel.scheduler.toggle(id)
      if (result && !result.error) {
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === id ? { ...j, enabled: !j.enabled } : j)),
        }))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  runAction: async (name) => {
    try {
      const result = await (window as any).electronAPI.kernel.scheduler.runAction(name)
      return result && !result.error
    } catch {
      return false
    }
  },

  loadTriggers: async () => {
    try {
      const result = await (window as any).electronAPI.kernel.triggers.list()
      if (result && !result.error) {
        const triggers = Array.isArray(result) ? result : (result.triggers || [])
        set({ triggers })
      }
    } catch (e) {
      console.error('Failed to load triggers:', e)
    }
  },

  createTrigger: async (trigger) => {
    try {
      const result = await (window as any).electronAPI.kernel.triggers.create(trigger)
      if (result && !result.error) {
        await (useSchedulerStore.getState().loadTriggers())
        return true
      }
      return false
    } catch {
      return false
    }
  },

  deleteTrigger: async (id) => {
    try {
      const result = await (window as any).electronAPI.kernel.triggers.delete(id)
      if (result && !result.error) {
        set((s) => ({ triggers: s.triggers.filter((t) => t.id !== id) }))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  toggleTrigger: async (id) => {
    try {
      const result = await (window as any).electronAPI.kernel.triggers.toggle(id)
      if (result && !result.error) {
        set((s) => ({
          triggers: s.triggers.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
        }))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  loadPresets: async () => {
    try {
      const result = await (window as any).electronAPI.kernel.triggers.presets()
      return result && !result.error ? (Array.isArray(result) ? result : result.presets || []) : []
    } catch {
      return []
    }
  },

  loadWorkflows: async () => {
    try {
      const result = await (window as any).electronAPI.kernel.workflows.list()
      if (result && !result.error) {
        const workflows = Array.isArray(result) ? result : (result.workflows || [])
        set({ workflows })
      }
    } catch (e) {
      console.error('Failed to load workflows:', e)
    }
  },

  createWorkflow: async (workflow) => {
    try {
      const result = await (window as any).electronAPI.kernel.workflows.create(workflow)
      if (result && !result.error) {
        await (useSchedulerStore.getState().loadWorkflows())
        return true
      }
      return false
    } catch {
      return false
    }
  },

  runWorkflow: async (id) => {
    try {
      const result = await (window as any).electronAPI.kernel.workflows.run(id)
      return result && !result.error
    } catch {
      return false
    }
  },

  loadInstances: async () => {
    try {
      const result = await (window as any).electronAPI.kernel.workflows.instances()
      if (result && !result.error) {
        const instances = Array.isArray(result) ? result : (result.instances || [])
        set({ instances })
      }
    } catch (e) {
      console.error('Failed to load workflow instances:', e)
    }
  },
}))
