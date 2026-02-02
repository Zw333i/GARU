'use client'

import { useRef, useEffect } from 'react'
import * as d3 from 'd3'

interface RadarChartProps {
  data: {
    label: string
    value: number
    max: number
  }[]
  size?: number
}

export function RadarChart({ data, size = 200 }: RadarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = 40
    const width = size
    const height = size
    const radius = Math.min(width, height) / 2 - margin

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`)

    const angleSlice = (2 * Math.PI) / data.length

    // Draw concentric circles
    const levels = 5
    for (let i = 1; i <= levels; i++) {
      g.append('circle')
        .attr('r', (radius / levels) * i)
        .attr('fill', 'none')
        .attr('stroke', '#334155')
        .attr('stroke-width', 1)
        .attr('opacity', 0.5)
    }

    // Draw axis lines
    data.forEach((_, i) => {
      const angle = angleSlice * i - Math.PI / 2
      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', radius * Math.cos(angle))
        .attr('y2', radius * Math.sin(angle))
        .attr('stroke', '#334155')
        .attr('stroke-width', 1)
    })

    // Draw labels
    data.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2
      const labelRadius = radius + 20
      g.append('text')
        .attr('x', labelRadius * Math.cos(angle))
        .attr('y', labelRadius * Math.sin(angle))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#94A3B8')
        .attr('font-size', '10px')
        .text(d.label)
    })

    // Create the radar path
    const radarLine = d3.lineRadial<{ label: string; value: number; max: number }>()
      .radius(d => (d.value / d.max) * radius)
      .angle((_, i) => i * angleSlice)
      .curve(d3.curveCardinalClosed)

    // Draw the radar area
    g.append('path')
      .datum(data)
      .attr('d', radarLine as any)
      .attr('fill', '#84CC16')
      .attr('fill-opacity', 0.3)
      .attr('stroke', '#84CC16')
      .attr('stroke-width', 2)

    // Draw data points
    data.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2
      const r = (d.value / d.max) * radius
      g.append('circle')
        .attr('cx', r * Math.cos(angle))
        .attr('cy', r * Math.sin(angle))
        .attr('r', 4)
        .attr('fill', '#84CC16')
        .attr('stroke', '#0F172A')
        .attr('stroke-width', 2)
    })

  }, [data, size])

  return <svg ref={svgRef} />
}
