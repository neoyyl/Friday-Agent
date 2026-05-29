/**
 * Friday Kernel 进程管理器
 * 管理 Python 后端 (Nuwa OS) 的生命周期
 */

import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'
import http from 'http'

export type KernelStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface KernelInfo {
  status: KernelStatus
  port: number
  pid: number | null
  uptime: number
  lastHealth: string | null
  error: string | null
  restartCount: number
}

export class KernelManager extends EventEmitter {
  private process: ChildProcess | null = null
  private status: KernelStatus = 'stopped'
  private port: number
  private healthTimer: NodeJS.Timeout | null = null
  private restartCount = 0
  private maxRestarts = 3
  private startTime = 0
  private lastHealth: string | null = null
  private lastError: string | null = null
  private kernelRoot: string

  constructor(kernelRoot: string, port = 5001) {
    super()
    this.kernelRoot = kernelRoot
    this.port = port
  }

  getStatus(): KernelInfo {
    return {
      status: this.status,
      port: this.port,
      pid: this.process?.pid ?? null,
      uptime: this.status === 'running' ? Date.now() - this.startTime : 0,
      lastHealth: this.lastHealth,
      error: this.lastError,
      restartCount: this.restartCount,
    }
  }

  async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      console.log('[KernelManager] Already running or starting')
      return
    }

    this.status = 'starting'
    this.lastError = null
    this.emit('status', this.status)

    const pythonScript = path.join(this.kernelRoot, 'scripts', 'load_kernel.py')
    const pythonExe = this.findPython()

    console.log(`[KernelManager] Starting: ${pythonExe} ${pythonScript} --web --web-port ${this.port}`)
    console.log(`[KernelManager] CWD: ${this.kernelRoot}`)

    try {
      const modulesDir = path.join(this.kernelRoot, 'modules')
      const existingPath = process.env.PYTHONPATH || ''
      const pythonPath = [
        this.kernelRoot,
        modulesDir,
        path.join(modulesDir, 'services'),
        path.join(modulesDir, 'legacy'),
        existingPath,
      ].filter(Boolean).join(path.delimiter)

      this.process = spawn(pythonExe, [pythonScript, '--web', '--web-port', String(this.port)], {
        cwd: this.kernelRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONPATH: pythonPath,
          PYTHONUNBUFFERED: '1',
          ELECTRON_PROD: '1',
        },
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) console.log(`[Kernel] ${msg}`)
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) console.error(`[Kernel:err] ${msg}`)
      })

      this.process.on('error', (err) => {
        console.error('[KernelManager] Process error:', err.message)
        this.handleError(err.message)
      })

      this.process.on('exit', (code, signal) => {
        console.log(`[KernelManager] Process exited: code=${code} signal=${signal}`)
        if (this.status !== 'stopped') {
          this.tryRestart()
        }
      })

      // Wait for the HTTP server to become available
      await this.waitForHealth(30000)
      this.startTime = Date.now()
      this.restartCount = 0
      this.status = 'running'
      this.emit('status', this.status)
      this.startHealthPolling()
      console.log('[KernelManager] Kernel is READY')
    } catch (err: any) {
      this.handleError(err.message)
      throw err
    }
  }

  async stop(): Promise<void> {
    if (!this.process) {
      this.status = 'stopped'
      this.emit('status', this.status)
      return
    }

    this.status = 'stopped'
    this.stopHealthPolling()

    return new Promise((resolve) => {
      const proc = this.process!
      const timer = setTimeout(() => {
        console.log('[KernelManager] Force killing process')
        proc.kill('SIGKILL')
        resolve()
      }, 5000)

      proc.on('exit', () => {
        clearTimeout(timer)
        this.process = null
        this.emit('status', this.status)
        resolve()
      })

      proc.kill('SIGTERM')
    })
  }

  async restart(): Promise<void> {
    await this.stop()
    this.restartCount = 0
    await this.start()
  }

  private findPython(): string {
    // Try common Python locations on Windows
    const candidates = ['python', 'python3', 'py']
    return candidates[0] // Let PATH resolve it
  }

  private async waitForHealth(timeoutMs: number): Promise<void> {
    const startTime = Date.now()
    const interval = 1000

    while (Date.now() - startTime < timeoutMs) {
      try {
        const ok = await this.checkHealthOnce()
        if (ok) return
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, interval))
    }

    throw new Error(`Kernel health check timeout after ${timeoutMs}ms`)
  }

  private async checkHealthOnce(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/api/health`, { timeout: 3000 }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            this.lastHealth = new Date().toISOString()
            resolve(json.status === 'ok')
          } catch {
            resolve(false)
          }
        })
      })

      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  private startHealthPolling(): void {
    this.stopHealthPolling()
    this.healthTimer = setInterval(async () => {
      if (this.status !== 'running') return
      const ok = await this.checkHealthOnce()
      if (!ok && this.status === 'running') {
        console.warn('[KernelManager] Health check failed')
      }
    }, 10000)
  }

  private stopHealthPolling(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }

  private tryRestart(): void {
    if (this.restartCount >= this.maxRestarts) {
      console.error(`[KernelManager] Max restarts (${this.maxRestarts}) reached`)
      this.status = 'error'
      this.lastError = 'Max restarts reached'
      this.emit('status', this.status)
      return
    }

    this.restartCount++
    const delay = this.restartCount * 3000
    console.log(`[KernelManager] Restarting in ${delay}ms (attempt ${this.restartCount}/${this.maxRestarts})`)

    setTimeout(() => {
      if (this.status !== 'stopped') {
        this.start().catch((err) => {
          console.error('[KernelManager] Restart failed:', err.message)
        })
      }
    }, delay)
  }

  private handleError(message: string): void {
    this.lastError = message
    this.status = 'error'
    this.emit('status', this.status)
    this.emit('error', message)
  }
}
