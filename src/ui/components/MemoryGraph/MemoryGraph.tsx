import { useRef, useEffect } from 'react'
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

const sampleData: { nodes: Node[]; links: Link[] } = {
  nodes: [
    { id: 'agent-core', type: 'core', label: 'Agent Core', radius: 25 },
    { id: 'user-pref', type: 'memory', label: 'User Preference', radius: 18 },
    { id: 'task-history', type: 'memory', label: 'Task History', radius: 18 },
    { id: 'conversation', type: 'memory', label: 'Conversation', radius: 18 },
    { id: 'code-pattern', type: 'knowledge', label: 'Code Pattern', radius: 15 },
    { id: 'tool-usage', type: 'knowledge', label: 'Tool Usage', radius: 15 },
    { id: 'old-context', type: 'decay', label: 'Old Context', radius: 12 },
  ],
  links: [
    { source: 'agent-core', target: 'user-pref', strength: 0.8 },
    { source: 'agent-core', target: 'task-history', strength: 0.7 },
    { source: 'agent-core', target: 'conversation', strength: 0.6 },
    { source: 'user-pref', target: 'code-pattern', strength: 0.4 },
    { source: 'task-history', target: 'tool-usage', strength: 0.5 },
    { source: 'conversation', target: 'old-context', strength: 0.3 },
  ],
}

const nodeColors: Record<Node['type'], string> = {
  core: 'var(--warm)',
  memory: 'var(--cool)',
  knowledge: '#22c55e',
  decay: '#6b7280',
}

export function MemoryGraph() {
  const svgRef = useRef<SVGSVGElement>(null)

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

    const simulation = d3.forceSimulation<Node>(sampleData.nodes)
      .force('link', d3.forceLink<Node, Link>(sampleData.links)
        .id((d) => d.id)
        .distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<Node>().radius((d) => d.radius + 5))

    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(sampleData.links)
      .join('line')
      .attr('stroke', 'rgba(255, 255, 255, 0.2)')
      .attr('stroke-width', 1.5)

    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, Node>('g')
      .data(sampleData.nodes)
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
  }, [])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ background: 'transparent' }}
    />
  )
}