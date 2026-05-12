"use client"

import { CloudSun, Wind, Droplets, Thermometer, Snowflake, Bell, MapPin, Hotel } from 'lucide-react'
import { useApp } from "@/lib/app-context"

const forecast = [
  { day: 'Fri', icon: 'partly-cloudy', high: 45, low: 28, precip: 10, wind: 8, frost: true },
  { day: 'Sat', icon: 'cloudy', high: 42, low: 30, precip: 40, wind: 12, frost: true },
  { day: 'Sun', icon: 'rain', high: 48, low: 35, precip: 80, wind: 15, frost: false },
  { day: 'Mon', icon: 'partly-cloudy', high: 52, low: 38, precip: 20, wind: 10, frost: false },
  { day: 'Tue', icon: 'sunny', high: 55, low: 40, precip: 5, wind: 6, frost: false },
]

function GaugeBar({ label, value, min, max, threshold, unit, danger }: { label: string; value: number; min: number; max: number; threshold: number; unit: string; danger?: boolean }) {
  const pct = ((value - min) / (max - min)) * 100
  const threshPct = ((threshold - min) / (max - min)) * 100
  const isOk = danger ? value <= threshold : value >= threshold

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono font-semibold ${isOk ? 'text-primary' : 'text-destructive'}`}>{value}{unit}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#1e2d42]">
        <div className={`h-full rounded-full ${isOk ? 'bg-primary' : 'bg-destructive'}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${threshPct}%` }} />
      </div>
      <div className="text-[9px] text-muted-foreground">
        {danger ? `Max: ${threshold}${unit}` : `Min: ${threshold}${unit}`}
      </div>
    </div>
  )
}

export function WeatherPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Two Column */}
      <div className="grid grid-cols-[1fr_1fr] gap-5">
        {/* Left: Map Placeholder */}
        <div className="flex flex-col gap-4">
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-border bg-card">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <MapPin className="h-8 w-8" />
              <span className="text-sm">Interactive Map</span>
              <div className="flex flex-col gap-1 text-[10px]">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Vanessa — Cowlitz CO — 42 F</span>
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-info" /> Kirk — Columbia CO — 44 F</span>
              </div>
            </div>
          </div>

          {/* Hotels */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Hotel className="h-4 w-4 text-muted-foreground" />
              Nearby Hotels
            </div>
            <div className="flex flex-col gap-2">
              {[
                { name: 'Best Western Kelso', dist: '23 mi', price: '$89/night' },
                { name: 'Holiday Inn Longview', dist: '18 mi', price: '$102/night' },
              ].map(h => (
                <div key={h.name} className="flex items-center justify-between rounded-md bg-elevated/50 px-3 py-2 text-xs">
                  <span className="text-foreground">{h.name}</span>
                  <span className="text-muted-foreground">{h.dist}</span>
                  <span className="font-mono text-foreground">{h.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Current + Detail */}
        <div className="flex flex-col gap-4">
          {/* Current Conditions */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-1 text-xs text-muted-foreground">Vanessa — Cowlitz CO, WA</div>
            <div className="flex items-center gap-4">
              <CloudSun className="h-12 w-12 text-info" />
              <div>
                <div className="font-mono text-4xl font-bold text-foreground">42 F</div>
                <div className="text-sm text-muted-foreground">Partly Cloudy</div>
              </div>
              <div className="ml-auto flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><Wind className="h-3 w-3" /> 8 mph NW</div>
                <div className="flex items-center gap-1.5"><Droplets className="h-3 w-3" /> 65%</div>
                <div className="flex items-center gap-1.5"><CloudSun className="h-3 w-3" /> 10% precip</div>
              </div>
            </div>
          </div>

          {/* Spray Status */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Spray Conditions</span>
              <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">SPRAY: CLEAR</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <GaugeBar label="Temperature" value={45} min={20} max={100} threshold={40} unit=" F" danger={false} />
              <GaugeBar label="Humidity" value={62} min={0} max={100} threshold={80} unit="%" danger={true} />
              <GaugeBar label="Wind" value={8} min={0} max={30} threshold={15} unit=" mph" danger={true} />
            </div>
          </div>

          {/* Fire Risk */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 text-sm font-semibold text-foreground">Fire Risk Level</div>
            <div className="flex gap-1">
              {[
                { level: 1, label: 'Low', color: 'bg-primary', active: true },
                { level: 2, label: 'Moderate', color: 'bg-warning', active: false },
                { level: 3, label: 'High', color: 'bg-[#f97316]', active: false },
                { level: 4, label: 'Extreme', color: 'bg-destructive', active: false },
              ].map(l => (
                <div key={l.level} className={`flex-1 rounded-md py-2 text-center text-[10px] font-semibold ${
                  l.active ? `${l.color} text-primary-foreground` : 'bg-elevated text-muted-foreground'
                }`}>
                  {l.label}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Level 1 — No restrictions</div>
          </div>

          {/* Ice */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-primary">No current ice warnings</div>
          </div>
        </div>
      </div>

      {/* 5-Day Forecast */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">5-Day Forecast</h3>
        </div>
        <div className="grid grid-cols-5 gap-px bg-border">
          {forecast.map(d => (
            <div key={d.day} className="relative flex flex-col items-center gap-2 bg-card p-4">
              <span className="text-xs font-semibold text-foreground">{d.day}</span>
              <CloudSun className="h-8 w-8 text-info" />
              <div className="text-center">
                <span className="font-mono text-sm font-bold text-foreground">{d.high}</span>
                <span className="font-mono text-sm text-muted-foreground">/{d.low}</span>
              </div>
              <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                <span><Droplets className="mr-1 inline h-3 w-3" />{d.precip}%</span>
                <span><Wind className="mr-1 inline h-3 w-3" />{d.wind} mph</span>
              </div>
              {d.frost && (
                <div className="absolute right-2 top-2">
                  <Snowflake className="h-4 w-4 text-info animate-pulse" />
                </div>
              )}
              <div className={`mt-1 h-0.5 w-full rounded ${d.precip > 50 ? 'bg-destructive' : d.frost ? 'bg-warning' : 'bg-primary'}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Alert Button */}
      <button className="self-start rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_0_12px_rgba(34,197,94,0.3)]">
        <Bell className="mr-2 inline h-4 w-4" /> Send Weather Alert to Foremen
      </button>
    </div>
  )
}
