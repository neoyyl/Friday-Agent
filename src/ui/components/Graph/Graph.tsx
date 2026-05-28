import { useEffect, useRef, useState, useCallback } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Search } from 'lucide-react'

interface Node {
  id: string
  label: string
  type: 'topic' | 'concept' | 'tool' | 'memory'
  x: number
  y: number
  size: number
  connections: string[]
}

interface GraphProps {
  onNodeClick?: (node: Node) => void
  selectedNodeId?: string | null
}

const nodeColors: Record<Node['type'], string> = {
  topic: '#c96b3c',
  concept: '#3b82f6',
  tool: '#22c55e',
  memory: '#a855f7',
}

const nodeLabels: Record<Node['type'], string> = {
  topic: '主题',
  concept: '概念',
  tool: '工具',
  memory: '记忆',
}

function Graph({ onNodeClick, selectedNodeId }: GraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // 生成示例节点数据
  useEffect(() => {
    const sampleNodes: Node[] = [
      { id: '1', label: 'AI 助手', type: 'topic', x: 400, y: 300, size: 40, connections: ['2', '3', '4'] },
      { id: '2', label: '自然语言处理', type: 'concept', x: 250, y: 200, size: 30, connections: ['1', '5'] },
      { id: '3', label: '代码生成', type: 'concept', x: 550, y: 200, size: 30, connections: ['1', '6'] },
      { id: '4', label: '知识图谱', type: 'concept', x: 400, y: 450, size: 30, connections: ['1', '7'] },
      { id: '5', label: '文本分析', type: 'tool', x: 150, y: 300, size: 25, connections: ['2'] },
      { id: '6', label: 'Python', type: 'tool', x: 650, y: 300, size: 25, connections: ['3'] },
      { id: '7', label: '对话历史', type: 'memory', x: 300, y: 500, size: 25, connections: ['4'] },
      { id: '8', label: '用户偏好', type: 'memory', x: 500, y: 500, size: 25, connections: ['4'] },
      { id: '9', label: '机器学习', type: 'concept', x: 150, y: 150, size: 25, connections: ['2'] },
      { id: '10', label: '深度学习', type: 'concept', x: 650, y: 150, size: 25, connections: ['3'] },
    ]
    setNodes(sampleNodes)
  }, [])

  // 绘制图表
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    ctx.save()
    ctx.translate(offset.x, offset.y)
    ctx.scale(zoom, zoom)

    // 绘制连接线
    nodes.forEach((node) => {
      node.connections.forEach((targetId) => {
        const target = nodes.find((n) => n.id === targetId)
        if (target) {
          ctx.beginPath()
          ctx.moveTo(node.x, node.y)
          ctx.lineTo(target.x, target.y)
          ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      })
    })

    // 绘制节点
    nodes.forEach((node) => {
      const isHovered = hoveredNode?.id === node.id
      const isSelected = selectedNodeId === node.id
      const isSearchMatch = searchQuery && node.label.toLowerCase().includes(searchQuery.toLowerCase())

      // 节点光晕
      if (isHovered || isSelected || isSearchMatch) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.size + 10, 0, Math.PI * 2)
        ctx.fillStyle = `${nodeColors[node.type]}20`
        ctx.fill()
      }

      // 节点圆形
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2)
      
      const gradient = ctx.createRadialGradient(
        node.x - node.size / 3,
        node.y - node.size / 3,
        0,
        node.x,
        node.y,
        node.size
      )
      gradient.addColorStop(0, nodeColors[node.type])
      gradient.addColorStop(1, adjustColor(nodeColors[node.type], -30))
      
      ctx.fillStyle = gradient
      ctx.fill()

      // 节点边框
      if (isSelected) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 3
        ctx.stroke()
      }

      // 节点标签
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.max(10, node.size / 3)}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // 简化标签显示
      const displayLabel = node.label.length > 6 ? node.label.slice(0, 6) + '...' : node.label
      ctx.fillText(displayLabel, node.x, node.y)
    })

    ctx.restore()
  }, [nodes, zoom, offset, hoveredNode, selectedNodeId, searchQuery])

  useEffect(() => {
    draw()
  }, [draw])

  // 处理鼠标事件
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }

    // 检测悬停节点
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - offset.x) / zoom
    const y = (e.clientY - rect.top - offset.y) / zoom

    const hovered = nodes.find((node) => {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2)
      return dist <= node.size
    })

    setHoveredNode(hovered || null)
    canvas.style.cursor = hovered ? 'pointer' : isDragging ? 'grabbing' : 'grab'
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleClick = () => {
    if (hoveredNode && onNodeClick) {
      onNodeClick(hoveredNode)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((prev) => Math.min(Math.max(prev * delta, 0.3), 3))
  }

  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev * 0.8, 0.3))
  const handleReset = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  // 调整颜色亮度
  function adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '')
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount))
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount))
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount))
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[var(--bg-primary)] rounded-xl overflow-hidden">
      {/* 搜索框 */}
      {showSearch && (
        <div className="absolute top-4 left-4 z-10 animate-fadeIn">
          <div className="flex items-center gap-2 bg-[var(--bg-secondary)] rounded-xl px-3 py-2 shadow-[var(--shadow-md)] border border-[var(--border-color)]">
            <Search className="w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索节点..."
              className="bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none w-40"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg shadow-[var(--shadow-sm)] border border-[var(--border-color)] transition-colors"
          title="搜索"
        >
          <Search className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg shadow-[var(--shadow-sm)] border border-[var(--border-color)] transition-colors"
          title="放大"
        >
          <ZoomIn className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg shadow-[var(--shadow-sm)] border border-[var(--border-color)] transition-colors"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg shadow-[var(--shadow-sm)] border border-[var(--border-color)] transition-colors"
          title="重置视图"
        >
          <Maximize2 className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 z-10 bg-[var(--bg-secondary)]/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-[var(--shadow-sm)] border border-[var(--border-color)]">
        <div className="text-xs font-medium text-[var(--text-muted)] mb-2">图例</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-[var(--text-secondary)]">{nodeLabels[type as Node['type']]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 节点信息 */}
      {hoveredNode && (
        <div className="absolute bottom-4 right-4 z-10 bg-[var(--bg-secondary)] rounded-xl px-4 py-3 shadow-[var(--shadow-md)] border border-[var(--border-color)] animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeColors[hoveredNode.type] }} />
            <span className="text-sm font-medium text-[var(--text-primary)]">{hoveredNode.label}</span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            类型: {nodeLabels[hoveredNode.type]} | 连接: {hoveredNode.connections.length}
          </div>
        </div>
      )}

      {/* 画布 */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
    </div>
  )
}

export default Graph
export type { Node }
