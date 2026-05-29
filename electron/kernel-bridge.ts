/**
 * Friday Kernel Bridge
 * HTTP 代理 + WebSocket 桥接，连接 Electron 主进程与 Python Flask 后端
 */

import { EventEmitter } from 'events'
import http from 'http'
import type { BrowserWindow } from 'electron'

export interface KernelBridgeOptions {
  port: number
  host?: string
  timeout?: number
}

export class KernelBridge extends EventEmitter {
  private baseUrl: string
  private timeout: number
  private win: BrowserWindow | null = null
  private wsConnected = false
  private socketClient: any = null

  constructor(options: KernelBridgeOptions) {
    super()
    this.baseUrl = `http://127.0.0.1:${options.port}`
    this.timeout = options.timeout || 30000
  }

  setWindow(win: BrowserWindow): void {
    this.win = win
  }

  // ==================== HTTP 代理 ====================

  async get(path: string): Promise<any> {
    return this.request('GET', path)
  }

  async post(path: string, body?: any): Promise<any> {
    return this.request('POST', path, body)
  }

  async put(path: string, body?: any): Promise<any> {
    return this.request('PUT', path, body)
  }

  async delete(path: string): Promise<any> {
    return this.request('DELETE', path)
  }

  private request(method: string, path: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl)
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        timeout: this.timeout,
        headers: { 'Content-Type': 'application/json' },
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve(json)
          } catch {
            resolve(data)
          }
        })
      })

      req.on('error', (err) => {
        reject(new Error(`Kernel request failed: ${err.message}`))
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`Kernel request timeout: ${path}`))
      })

      if (body) {
        req.write(JSON.stringify(body))
      }
      req.end()
    })
  }

  // ==================== WebSocket 桥接 ====================

  async connectWebSocket(): Promise<void> {
    try {
      // Dynamic import for socket.io-client (may not be installed yet)
      const { io } = await import('socket.io-client')
      const wsUrl = `http://127.0.0.1:${new URL(this.baseUrl).port}`

      this.socketClient = io(wsUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 10,
      })

      this.socketClient.on('connect', () => {
        console.log('[KernelBridge] WebSocket connected')
        this.wsConnected = true
        this.emit('ws:connected')
      })

      this.socketClient.on('disconnect', (reason: string) => {
        console.log('[KernelBridge] WebSocket disconnected:', reason)
        this.wsConnected = false
        this.emit('ws:disconnected', reason)
      })

      this.socketClient.on('connect_error', (err: Error) => {
        console.error('[KernelBridge] WebSocket error:', err.message)
      })

      // Forward all Kernel events to renderer
      const kernelEvents = [
        'state.changed',
        'config.updated',
        'dispatch.event',
        'emotion.updated',
        'emotion.user_input',
        'scheduler.event',
        'scheduler.jobs',
        'scheduler.health',
        'trigger.event',
        'triggers.updated',
        'workflow.event',
        'workflows.updated',
        'voice.speaker_registered',
        'voice.speaker_identified',
        'tts.state',
        'log.recorded',
      ]

      for (const event of kernelEvents) {
        this.socketClient.on(event, (data: any) => {
          this.emit('kernel:event', event, data)
          if (this.win && !this.win.isDestroyed()) {
            this.win.webContents.send('kernel:event', event, data)
          }
        })
      }
    } catch (err: any) {
      console.warn('[KernelBridge] socket.io-client not available, WebSocket disabled:', err.message)
    }
  }

  disconnectWebSocket(): void {
    if (this.socketClient) {
      this.socketClient.disconnect()
      this.socketClient = null
      this.wsConnected = false
    }
  }

  isWebSocketConnected(): boolean {
    return this.wsConnected
  }

  // ==================== Typed API 方法 ====================

  // --- Health ---
  async health(): Promise<any> {
    return this.get('/api/health')
  }

  async hello(): Promise<any> {
    return this.get('/api/hello')
  }

  // --- Config ---
  async getConfig(): Promise<any> {
    return this.get('/api/config')
  }

  async updateConfig(config: Record<string, any>): Promise<any> {
    return this.post('/api/config', config)
  }

  // --- Agents ---
  async getAgents(): Promise<any> {
    return this.get('/api/agents')
  }

  async getAgentStats(): Promise<any> {
    return this.get('/api/agents/stats')
  }

  async dispatchAgent(task: string, mode: string, options?: any): Promise<any> {
    return this.post('/api/orchestrator/dispatch', { task, mode, ...options })
  }

  async getDispatchHistory(): Promise<any> {
    return this.get('/api/orchestrator/history')
  }

  // --- Skills ---
  async getSkills(): Promise<any> {
    return this.get('/api/skills')
  }

  async getSkillStats(): Promise<any> {
    return this.get('/api/skills/stats')
  }

  async callSkill(id: string, params?: any): Promise<any> {
    return this.post(`/api/skills/${id}/call`, params)
  }

  async reloadSkill(id: string): Promise<any> {
    return this.post(`/api/skills/${id}/reload`)
  }

  async findSkillsByCapability(capability: string): Promise<any> {
    return this.get(`/api/skills/find?capability=${encodeURIComponent(capability)}`)
  }

  async scanSkills(): Promise<any> {
    return this.post('/api/skills/scan')
  }

  // --- Scheduler ---
  async getSchedulerStatus(): Promise<any> {
    return this.get('/api/scheduler/status')
  }

  async getSchedulerJobs(): Promise<any> {
    return this.get('/api/scheduler/jobs')
  }

  async createSchedulerJob(job: any): Promise<any> {
    return this.post('/api/scheduler/jobs', job)
  }

  async deleteSchedulerJob(id: string): Promise<any> {
    return this.delete(`/api/scheduler/jobs/${id}`)
  }

  async toggleSchedulerJob(id: string): Promise<any> {
    return this.post(`/api/scheduler/jobs/${id}/toggle`)
  }

  async runSchedulerAction(name: string): Promise<any> {
    return this.post(`/api/scheduler/actions/${name}`)
  }

  // --- Triggers ---
  async getTriggers(): Promise<any> {
    return this.get('/api/triggers')
  }

  async createTrigger(trigger: any): Promise<any> {
    return this.post('/api/triggers', trigger)
  }

  async deleteTrigger(id: string): Promise<any> {
    return this.delete(`/api/triggers/${id}`)
  }

  async toggleTrigger(id: string): Promise<any> {
    return this.post(`/api/triggers/${id}/toggle`)
  }

  async getTriggerPresets(): Promise<any> {
    return this.get('/api/triggers/presets')
  }

  // --- Workflows ---
  async getWorkflows(): Promise<any> {
    return this.get('/api/workflows')
  }

  async createWorkflow(workflow: any): Promise<any> {
    return this.post('/api/workflows', workflow)
  }

  async getWorkflow(id: string): Promise<any> {
    return this.get(`/api/workflows/${id}`)
  }

  async deleteWorkflow(id: string): Promise<any> {
    return this.delete(`/api/workflows/${id}`)
  }

  async runWorkflow(id: string): Promise<any> {
    return this.post(`/api/workflows/${id}/run`)
  }

  async getWorkflowInstances(): Promise<any> {
    return this.get('/api/workflows/instances')
  }

  // --- Emotion ---
  async analyzeEmotion(text: string): Promise<any> {
    return this.post('/api/emotion/analyze', { text })
  }

  async getEmotionState(): Promise<any> {
    return this.get('/api/emotion/state')
  }

  async updateConversationEmotion(data: any): Promise<any> {
    return this.post('/api/emotion/update_conversation', data)
  }

  // --- Voice / TTS ---
  async speak(text: string, tone?: string): Promise<any> {
    return this.post('/api/tts/speak', { text, tone })
  }

  async stopSpeaking(): Promise<any> {
    return this.post('/api/tts/stop')
  }

  async getTTSStatus(): Promise<any> {
    return this.get('/api/tts/status')
  }

  async detectTone(text: string): Promise<any> {
    return this.post('/api/tts/detect_tone', { text })
  }

  // --- Voice Speakers ---
  async getSpeakers(): Promise<any> {
    return this.get('/api/voice/speakers')
  }

  async registerSpeaker(name: string, config?: any): Promise<any> {
    return this.post('/api/voice/speakers', { name, ...config })
  }

  async deleteSpeaker(name: string): Promise<any> {
    return this.delete(`/api/voice/speakers/${encodeURIComponent(name)}`)
  }

  async identifySpeaker(data: any): Promise<any> {
    return this.post('/api/voice/identify', data)
  }

  async getCurrentSpeaker(): Promise<any> {
    return this.get('/api/voice/current')
  }

  // --- Dispatch Log ---
  async getDispatchLogStats(): Promise<any> {
    return this.get('/api/dispatch_log/stats')
  }

  async getDispatchInsights(): Promise<any> {
    return this.get('/api/dispatch_log/insights')
  }

  // --- Execution Log ---
  async getExecutionLog(): Promise<any> {
    return this.get('/api/log')
  }

  async getExecutionReport(): Promise<any> {
    return this.get('/api/log/report')
  }

  // --- Timing ---
  async getTimingReadiness(): Promise<any> {
    return this.get('/api/timing/readiness')
  }

  async shouldNotify(data: any): Promise<any> {
    return this.post('/api/timing/should_notify', data)
  }

  destroy(): void {
    this.disconnectWebSocket()
    this.removeAllListeners()
  }
}
