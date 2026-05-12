"use client"

import { useState, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useContracts } from "@/hooks/use-supabase"

const NEW_KEY = "__new__"

interface LandownerSelectProps {
  value: string | undefined
  onChange: (val: string) => void
  error?: string
}

export function LandownerSelect({ value, onChange, error }: LandownerSelectProps) {
  const { data: contracts } = useContracts()

  // Distinct, sorted landowners from existing contracts (excluding blank)
  const existing = useMemo(() => {
    const set = new Set<string>()
    contracts?.forEach(c => { if (c.landowner?.trim()) set.add(c.landowner.trim()) })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [contracts])

  // Decide initial mode: if value exists and isn't in the existing list → custom
  const [mode, setMode] = useState<"select" | "custom">(() =>
    value && !existing.includes(value) ? "custom" : "select"
  )

  const selectValue = mode === "custom" ? NEW_KEY : (value ?? "")

  function handleSelect(val: string) {
    if (val === NEW_KEY) {
      setMode("custom")
      onChange("")
    } else {
      setMode("select")
      onChange(val)
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label>Landowner</Label>

      {mode === "select" ? (
        <Select value={selectValue} onValueChange={handleSelect}>
          <SelectTrigger className="h-12 bg-background">
            <SelectValue placeholder="Select landowner…" />
          </SelectTrigger>
          <SelectContent>
            {existing.map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
            <SelectItem value={NEW_KEY} className="text-primary font-medium border-t border-border mt-1 pt-1">
              + New landowner…
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="e.g. Weyerhaeuser"
            className="h-12 bg-background flex-1"
            value={value ?? ""}
            onChange={e => onChange(e.target.value)}
          />
          {existing.length > 0 && (
            <button
              type="button"
              onClick={() => { setMode("select"); onChange("") }}
              className="h-12 rounded-md border border-border px-3 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors whitespace-nowrap"
            >
              ← Pick existing
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
