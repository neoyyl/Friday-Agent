import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'

interface Node extends d3.SimulationNodeDatum {
  id: string
  type: 'core' | 'memory' | 'knowledge' | 'decay'
  label: string
  radius: number
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string
  target: string
  strength: number
}

const DEFAULT_NODES: Node[] = [
  { id: 'agent-core', type: 'core', label: 'Agent Core', radius: 25 },
]

const DEFAULT_LINKS: Link[] = []

const nodeColors: Record<Node['type'], string> = {
  core: 'var(--warm)',
  memory: 'var(--cool)',
  knowledge: '#22c55e',
  decay: '#6b7280',
}

function buildGraphFromMemories(memories: Array<{ content: string; role: string; topic?: string }>): { nodes: Node[]; links: Link[] } {
  if (!memories || memories.length === 0) {
    return { nodes: DEFAULT_NODES, links: DEFAULT_LINKS }
  }

  const nodes: Node[] = [{ id: 'agent-core', type: 'core', label: 'Agent Core', radius: 25 }]
  const links: Link[] = []

  const topicMap = new Map<string, number>()

  memories.forEach((mem, i) => {
    const topic = mem.topic || 'general'
    const count = topicMap.get(topic) || 0
    topicMap.set(topic, count + 1)

    const nodeId = `mem-${i}`
    const label = mem.content.length > 25 ? mem.content.slice(0, 25) + '...' : mem.content
    const isUser = mem.role === 'user'

    nodes.push({
      id: nodeId,
      type: isUser ? 'memory' : 'knowledge',
      label,
      radius: 10 + Math.min(count, 10),
    })

    links.push({
      source: 'agent-core',
      target: nodeId,
      strength: 0.3 + count * 0.1,
    })
  })

  return { nodes, links }
}

export function MemoryGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: DEFAULT_NODES,
    links: DEFAULT_LINKS,
  })

  useEffect(() => {
    let cancelled = false
    const fetchMemory = async () => {
      try {
        if (window.electronAPI?.backend?.memory?.list) {
          const result = await window.electronAPI.backend.memory.list()
          const ctx = (result as any)?.data?.context || []
          const facts = (result as any)?.data?.facts || []
          const memories = ctx.map((m: any) => ({
            content: typeof m === 'string' ? m : m.content || '',
            role: m.role || 'assistant',
            topic: m.topic || 'general',
          }))
          const factMemories = facts.map((f: string) => ({
            content: f,
            role: 'assistant',
            topic: 'fact',
          }))
          if (!cancelled) {
            setGraphData(buildGraphFromMemories([...memories, ...factMemories]))
          }
        }
      } catch {
        if (!cancelled) {
          setGraphData({ nodes: DEFAULT_NODES, links: DEFAULT_LINKS })
        }
      }
    }
    fetchMemory()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth || 800
    const height = svgRef.current.clientHeight || 600

    svg.selectAll('*').remove()

    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    svg.append('defs').html(`
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `)

    const simulation = d3.forceSimulation<Node>(graphData.nodes)
      .force('link', d3.forceLink<Node, Link>(graphData.links)
        .id((d) => d.id)
        .distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<Node>().radius((d) => d.radius + 5))

    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', 'rgba(255, 255, 255, 0.2)')
      .attr('stroke-width', 1.5)

    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, Node>('g')
      .data(graphData.nodes)
      .join('g')
      .attr('filter', 'url(#glow)')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }))

    node.append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => nodeColors[d.type])
      .attr('stroke', 'rgba(255, 255, 255, 0.3)')
      .attr('stroke-width', 1.5)

    node.append('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 14)
      .attr('fill', 'rgba(255, 255, 255, 0.8)')
      .attr('font-size', '11px')

    const tooltip = d3.select('body').append('div')
      .attr('class', 'graph-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '6px 10px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)

    node.on('mouseover', (event, d) => {
      tooltip
        .style('opacity', 1)
        .html(`<strong>${d.label}</strong><br/>类型: ${d.type}`)
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 28}px`)
    })
    .on('mousemove', (event) => {
      tooltip
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 28}px`)
    })
    .on('mouseout', () => {
      tooltip.style('opacity', 0)
    })

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as unknown as Node).x!)
        .attr('y1', (d) => (d.source as unknown as Node).y!)
        .attr('x2', (d) => (d.target as unknown as Node).x!)
        .attr('y2', (d) => (d.target as unknown as Node).y!)

      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => {
      simulation.stop()
      tooltip.remove()
    }
  }, [graphData])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ background: 'transparent' }}
    />
  )
}