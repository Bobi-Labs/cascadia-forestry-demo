"use client"

import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { useApp } from "@/lib/app-context"

const cumulativeData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  vanessa: Math.round(2800 * (i + 1) * (0.9 + Math.random() * 0.2)),
  kirk: Math.round(2200 * (i + 1) * (0.9 + Math.random() * 0.2)),
  expected: Math.round(2600 * (i + 1)),
}))

const dailyOutput = Array.from({ length: 14 }, (_, i) => ({
  day: `Feb ${7 + i}`,
  vanessa: Math.round(4000 + Math.random() * 3000),
  kirk: Math.round(3500 + Math.random() * 3000),
}))

const efficiencyData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  value: Math.round(420 + Math.random() * 200),
}))

const performanceData = [
  { unit: 'midge u1', contract: 'Vanessa', total: 38200, days: 8, avgDaily: 4775, terrain: 'Moderate', rating: 'A' },
  { unit: 'quaker u3', contract: 'Vanessa', total: 34100, days: 7, avgDaily: 4871, terrain: 'Hard', rating: 'A+' },
  { unit: 'silver u1', contract: 'Kirk', total: 12400, days: 3, avgDaily: 4133, terrain: 'Easy', rating: 'B' },
]

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (!active || !payload) return null
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground">{p.name}: {p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export function ProductionPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Main Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Cumulative Production — All Active Projects</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#475569' }} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} content={<CustomTooltip />} />
              <Area type="monotone" dataKey="vanessa" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Vanessa" />
              <Area type="monotone" dataKey="kirk" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Kirk" />
              <Line type="monotone" dataKey="expected" stroke="#475569" strokeDasharray="6 3" dot={false} name="Expected" />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Three Column */}
      <div className="grid grid-cols-3 gap-4">
        {/* Daily Output */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Daily Output</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyOutput}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#475569' }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: '#475569' }} />
                <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} content={<CustomTooltip />} />
                <Bar dataKey="vanessa" fill="#22c55e" radius={[2, 2, 0, 0]} name="Vanessa" />
                <Bar dataKey="kirk" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Kirk" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Crew Efficiency */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Crew Efficiency</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={efficiencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#475569' }} interval={5} />
                <YAxis tick={{ fontSize: 9, fill: '#475569' }} domain={[300, 700]} />
                <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} content={<CustomTooltip />} />
                <ReferenceLine y={500} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '500', fill: '#22c55e', fontSize: 9 }} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name="Trees/Person" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expected vs Actual */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Expected vs Actual</h3>
          <div className="flex flex-col gap-4 pt-4">
            {[
              { name: 'Vanessa', expected: 108000, actual: 97200, delta: -10, ahead: false },
              { name: 'Kirk', expected: 85000, actual: 91400, delta: 8, ahead: true },
            ].map(c => (
              <div key={c.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{c.name}</span>
                  <span className={`font-mono text-[10px] ${c.ahead ? 'text-primary' : 'text-warning'}`}>
                    {c.ahead ? `${c.delta}% ahead` : `${Math.abs(c.delta)}% behind`}
                  </span>
                </div>
                <div className="flex gap-1">
                  <div className="h-4 rounded bg-muted-foreground/20" style={{ width: `${(c.expected / 120000) * 100}%` }}>
                    <div className="flex h-full items-center pl-2 text-[9px] text-muted-foreground">{(c.expected / 1000).toFixed(0)}K exp</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <div className={`h-4 rounded ${c.ahead ? 'bg-primary/60' : 'bg-info/60'}`} style={{ width: `${(c.actual / 120000) * 100}%` }}>
                    <div className="flex h-full items-center pl-2 text-[9px] text-foreground">{(c.actual / 1000).toFixed(1)}K actual</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Table */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Performance by Unit</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Unit</th>
              <th className="px-4 py-2 text-left font-medium">Contract</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Days Worked</th>
              <th className="px-4 py-2 text-right font-medium">Avg Daily</th>
              <th className="px-4 py-2 text-center font-medium">Terrain</th>
              <th className="px-4 py-2 text-center font-medium">Rating</th>
            </tr>
          </thead>
          <tbody>
            {performanceData.map(p => (
              <tr key={p.unit} className="border-b border-border transition-colors hover:bg-elevated">
                <td className="px-4 py-3 font-mono text-xs text-foreground">{p.unit}</td>
                <td className="px-4 py-3 text-foreground">{p.contract}</td>
                <td className="px-4 py-3 text-right font-mono text-foreground">{p.total.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-foreground">{p.days}</td>
                <td className="px-4 py-3 text-right font-mono text-foreground">{p.avgDaily.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    p.terrain === 'Easy' ? 'bg-primary/20 text-primary' :
                    p.terrain === 'Moderate' ? 'bg-warning/20 text-warning' :
                    'bg-destructive/20 text-destructive'
                  }`}>{p.terrain}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    p.rating.startsWith('A') ? 'bg-primary/20 text-primary' : 'bg-warning/20 text-warning'
                  }`}>{p.rating}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
