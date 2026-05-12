"use client"

import { AreaChart, Area, ResponsiveContainer, BarChart, Bar } from 'recharts'

export function MiniAreaSparkline({ data, color = '#22c55e' }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ v, i }))
  return (
    <div className="h-8 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${color.replace('#', '')})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MiniBarSparkline({ data, color = '#22c55e' }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ v, i }))
  return (
    <div className="h-8 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Bar dataKey="v" fill={color} radius={[1, 1, 0, 0]} opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
