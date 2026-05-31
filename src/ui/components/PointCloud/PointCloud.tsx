import { useEffect, useRef, useCallback } from 'react'

type EmotionType = 'happy' | 'sad' | 'angry' | 'fear' | 'surprise' | 'neutral' | 'disgust' | 'anticipation'
type AgentStatus = 'idle' | 'busy' | 'error'

interface PointCloudProps {
  isListening?: boolean
  emotion?: EmotionType | null
  agentStatus?: AgentStatus
}

// 情感颜色映射
const EMOTION_COLORS: Record<EmotionType, string[]> = {
  happy: ['#fbbf24', '#f59e0b', '#fcd34d', '#fde68a'],
  sad: ['#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8'],
  angry: ['#ef4444', '#f87171', '#fca5a5', '#dc2626'],
  fear: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed'],
  surprise: ['#f97316', '#fb923c', '#fdba74', '#ea580c'],
  neutral: ['#8fb6d8', '#3b82f6', '#a855f7', '#c96b32'],
  disgust: ['#22c55e', '#4ade80', '#86efac', '#16a34a'],
  anticipation: ['#eab308', '#facc15', '#fde047', '#ca8a04'],
}

// Agent状态颜色
const AGENT_COLORS: Record<AgentStatus, string[]> = {
  idle: ['#8fb6d8', '#3b82f6', '#a855f7', '#c96b32'],
  busy: ['#22d3ee', '#14b8a6', '#06b6d4', '#0891b2'],
  error: ['#ef4444', '#f87171', '#fca5a5', '#dc2626'],
}

interface Point {
  x: number
  y: number
  z: number
  originalX: number
  originalY: number
  originalZ: number
  originalRadius: number
  size: number
  color: string
  speed: number
  phi: number
  theta: number
}

export function PointCloud({ isListening = false, emotion = null, agentStatus = 'idle' }: PointCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<Point[]>([])
  const animationIdRef = useRef<number | null>(null)
  const rotationRef = useRef({ x: 0, y: 0 })
  const noiseTimeRef = useRef(0)
  const emotionRef = useRef<EmotionType | null>(emotion)
  const agentStatusRef = useRef<AgentStatus>(agentStatus)

  // 更新状态引用
  useEffect(() => {
    emotionRef.current = emotion
  }, [emotion])

  useEffect(() => {
    agentStatusRef.current = agentStatus
  }, [agentStatus])

  // 获取当前状态对应的颜色
  const getCurrentColors = useCallback(() => {
    if (emotionRef.current && emotionRef.current !== 'neutral') {
      return EMOTION_COLORS[emotionRef.current]
    }
    return AGENT_COLORS[agentStatusRef.current] || AGENT_COLORS.idle
  }, [])

  // 生成球状点云 - 戴森云风格，严格的球形分布
  const generatePoints = useCallback(() => {
    const points: Point[] = []
    const count = 400
    const colors = getCurrentColors()
    const baseRadius = 140

    // 使用斐波那契球面分布算法，确保点云均匀分布在严格的球面上
    const goldenRatio = (1 + Math.sqrt(5)) / 2
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / count)
      const theta = 2 * Math.PI * i / goldenRatio
      const radius = baseRadius + (Math.random() - 0.5) * 20 // 略微的半径变化

      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = radius * Math.sin(phi) * Math.sin(theta)
      const z = radius * Math.cos(phi)

      points.push({
        x, y, z,
        originalX: x,
        originalY: y,
        originalZ: z,
        originalRadius: radius,
        size: 1 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: 0.3 + Math.random() * 1.2,
        phi,
        theta
      })
    }
    pointsRef.current = points
  }, [])

  // 噪声函数
  const noise = useCallback((x: number, y: number, z: number) => {
    const a = Math.sin(x * 0.1) * Math.cos(y * 0.1)
    const b = Math.sin(y * 0.05 + z * 0.1)
    return (a + b) * 0.5
  }, [])

  // 渲染函数
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 使用画布实际尺寸计算中心点，确保在窗口大小变化时保持居中
    const width = canvas.width
    const height = canvas.height
    const centerX = width / 2
    const centerY = height / 2

    // 清空画布 - 使用透明背景，让父容器的主题背景色显示出来
    ctx.clearRect(0, 0, width, height)

    // 根据状态调整动画速度
    const currentEmotion = emotionRef.current
    const currentAgentStatus = agentStatusRef.current
    
    // 基础速度
    let noiseSpeed = 0.015
    let rotationSpeedY = 0.0025
    let rotationSpeedX = 0.001
    let waveIntensity = 0
    let pulseIntensity = 0

    // 根据情感状态调整
    if (currentEmotion && currentEmotion !== 'neutral') {
      switch (currentEmotion) {
        case 'happy':
          noiseSpeed = 0.025
          rotationSpeedY = 0.004
          waveIntensity = 8
          pulseIntensity = 0.15
          break
        case 'sad':
          noiseSpeed = 0.008
          rotationSpeedY = 0.0015
          waveIntensity = 3
          pulseIntensity = -0.1
          break
        case 'angry':
          noiseSpeed = 0.04
          rotationSpeedY = 0.006
          waveIntensity = 18
          pulseIntensity = 0.25
          break
        case 'fear':
          noiseSpeed = 0.035
          rotationSpeedY = 0.005
          waveIntensity = 15
          pulseIntensity = 0.2
          break
        case 'surprise':
          noiseSpeed = 0.03
          rotationSpeedY = 0.005
          waveIntensity = 20
          pulseIntensity = 0.3
          break
        case 'disgust':
          noiseSpeed = 0.012
          rotationSpeedY = 0.002
          waveIntensity = 5
          pulseIntensity = -0.05
          break
        case 'anticipation':
          noiseSpeed = 0.028
          rotationSpeedY = 0.0045
          waveIntensity = 12
          pulseIntensity = 0.18
          break
      }
    }

    // 根据Agent状态调整（情感优先）
    if (!currentEmotion || currentEmotion === 'neutral') {
      switch (currentAgentStatus) {
        case 'busy':
          noiseSpeed = 0.03
          rotationSpeedY = 0.005
          waveIntensity = 12
          pulseIntensity = 0.2
          break
        case 'error':
          noiseSpeed = 0.045
          rotationSpeedY = 0.007
          waveIntensity = 22
          pulseIntensity = 0.35
          break
        default: // idle
          noiseSpeed = 0.015
          rotationSpeedY = 0.0025
          waveIntensity = 0
          pulseIntensity = 0
      }
    }

    // 语音输入时增强效果
    if (isListening) {
      noiseSpeed *= 1.8
      rotationSpeedY *= 1.5
      waveIntensity = Math.max(waveIntensity, 15)
      pulseIntensity = Math.max(pulseIntensity, 0.2)
    }

    noiseTimeRef.current += noiseSpeed
    rotationRef.current.y += rotationSpeedY
    rotationRef.current.x += rotationSpeedX

    const points = pointsRef.current.map((point, index) => {
      const time = noiseTimeRef.current + index * 0.012

      let currentRadius = point.originalRadius
      
      // 应用波动效果
      if (waveIntensity > 0 || isListening) {
        const effectiveWave = Math.max(waveIntensity, isListening ? 15 : 0)
        const wave1 = Math.sin(time * point.speed * 2.5) * effectiveWave
        const wave2 = noise(point.originalX, point.originalY, time * 1.5) * effectiveWave * 0.8
        currentRadius = point.originalRadius + wave1 + wave2
      }

      // 应用脉冲效果（整体缩放）
      const pulse = 1 + Math.sin(time * 0.5) * pulseIntensity
      currentRadius *= pulse

      // 基于球面坐标计算当前点
      const newX = currentRadius * Math.sin(point.phi) * Math.cos(point.theta)
      const newY = currentRadius * Math.sin(point.phi) * Math.sin(point.theta)
      const newZ = currentRadius * Math.cos(point.phi)

      const cosX = Math.cos(rotationRef.current.x)
      const sinX = Math.sin(rotationRef.current.x)
      const cosY = Math.cos(rotationRef.current.y)
      const sinY = Math.sin(rotationRef.current.y)

      const rx = newX * cosY - newZ * sinY
      let ry = newY
      let rz = newX * sinY + newZ * cosY

      ry = ry * cosX - rz * sinX
      rz = ry * sinX + rz * cosX

      const scale = 400 / (400 + rz)
      const sx = centerX + rx * scale
      const sy = centerY + ry * scale

      return {
        ...point,
        x: sx,
        y: sy,
        z: rz,
        size: point.size * scale * (isListening ? 1.1 : 1)
      }
    })

    points.sort((a, b) => a.z - b.z)

    points.forEach((point, i) => {
      const alpha = Math.max(0.2, Math.min(1, (400 + point.z) / 600))
      
      ctx.beginPath()
      ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2)
      ctx.fillStyle = point.color + Math.floor(alpha * 255).toString(16).padStart(2, '0')
      ctx.fill()

      if (i < points.length - 1 && point.z > -100) {
        const next = points[i + 1]
        const dist = Math.hypot(next.x - point.x, next.y - point.y)
        if (dist < 50) {
          ctx.beginPath()
          ctx.moveTo(point.x, point.y)
          ctx.lineTo(next.x, next.y)
          ctx.strokeStyle = point.color + Math.floor(alpha * 30).toString(16).padStart(2, '0')
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    })

    animationIdRef.current = requestAnimationFrame(render)
  }, [isListening, noise])

  useEffect(() => {
    generatePoints()
    render()

    const updateCanvasSize = () => {
      if (containerRef.current && canvasRef.current) {
        const container = containerRef.current
        const canvas = canvasRef.current
        // 使用容器的 offsetWidth 和 offsetHeight 确保准确尺寸
        canvas.width = container.offsetWidth
        canvas.height = container.offsetHeight
      }
    }

    let resizeObserver: ResizeObserver | null = null
    
    if (containerRef.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        updateCanvasSize()
      })
      resizeObserver.observe(containerRef.current)
    }

    // 作为备用，监听 window resize
    let resizeTimeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(updateCanvasSize, 100)
    }

    window.addEventListener('resize', handleResize)
    updateCanvasSize()

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      clearTimeout(resizeTimeout)
      window.removeEventListener('resize', handleResize)
    }
  }, [generatePoints, render])

  return (
    <div 
      ref={containerRef}
      className="point-cloud-container" 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
    </div>
  )
}
