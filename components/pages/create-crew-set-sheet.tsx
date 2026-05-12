"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Save, Check } from "lucide-react"
import useClientMutation from "@/hooks/use-client-mutation"
import { useEmployees } from "@/hooks/use-supabase"
import { toast } from "@/hooks/use-toast"
import {
  createCrewSetSchema,
  type CreateCrewSetInput,
} from "@/lib/schemas/create-crew-set"
import type { Employee } from "@/lib/database.types"
import { useApp } from "@/lib/app-context"

interface CreateCrewSetSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function CreateCrewSetSheet({ open, onOpenChange, onCreated }: CreateCrewSetSheetProps) {
  const { data: employees } = useEmployees()
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())

  const foremen = useMemo(
    () => (employees ?? []).filter(e => e.is_foreman && e.status === "active"),
    [employees],
  )

  const availableEmployees = useMemo(() => {
    const active = (employees ?? []).filter(e => e.status === "active")
    // Group: foremen, drivers, crew
    const groups: { label: string; items: Employee[] }[] = [
      { label: "Foremen", items: active.filter(e => e.is_foreman) },
      { label: "Drivers", items: active.filter(e => e.is_driver && !e.is_foreman) },
      { label: "Crew", items: active.filter(e => !e.is_foreman && !e.is_driver) },
    ]
    return groups.filter(g => g.items.length > 0)
  }, [employees])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateCrewSetInput>({
    resolver: zodResolver(createCrewSetSchema),
    defaultValues: {
      name: "",
      is_default: false,
      member_ids: [],
    },
  })

  const mutation = useClientMutation("createCrewSet", {
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: "Crew set created", description: "New crew set added successfully." })
        onOpenChange(false)
        reset()
        setSelectedMembers(new Set())
        onCreated?.()
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  function toggleMember(id: string) {
    setSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      // Sync with form
      setValue("member_ids", [...next], { shouldValidate: true })
      return next
    })
  }

  function selectAll() {
    const allIds = (employees ?? []).filter(e => e.status === "active").map(e => e.id)
    setSelectedMembers(new Set(allIds))
    setValue("member_ids", allIds, { shouldValidate: true })
  }

  function selectNone() {
    setSelectedMembers(new Set())
    setValue("member_ids", [], { shouldValidate: true })
  }

  const onSubmit = (data: CreateCrewSetInput) => {
    mutation.mutate(data)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-foreground">New Crew Set</SheetTitle>
          <SheetDescription>Create a pre-built crew group for timesheet entry.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {/* Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="cs-name">Name</Label>
            <Input id="cs-name" className="h-12 bg-background" placeholder="e.g. Agustin - Main Crew" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Foreman + Default */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Foreman</Label>
              <Select
                value={watch("foreman_id") ?? ""}
                onValueChange={(v) => setValue("foreman_id", v, { shouldValidate: true })}
              >
                <SelectTrigger className="h-12 bg-background">
                  <SelectValue placeholder="Select foreman..." />
                </SelectTrigger>
                <SelectContent>
                  {foremen.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.first_name} {f.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.foreman_id && <p className="text-xs text-destructive">{errors.foreman_id.message}</p>}
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-3">
                <Switch
                  id="cs-default"
                  checked={watch("is_default") ?? false}
                  onCheckedChange={(checked) => setValue("is_default", checked)}
                />
                <Label htmlFor="cs-default" className="text-sm">Default Set</Label>
              </div>
            </div>
          </div>

          {/* Member Picker */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Crew Members ({selectedMembers.size})</Label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-[10px] text-primary hover:underline">Select All</button>
                <button type="button" onClick={selectNone} className="text-[10px] text-muted-foreground hover:underline">Clear</button>
              </div>
            </div>
            {errors.member_ids && <p className="text-xs text-destructive">{errors.member_ids.message}</p>}

            <div className="max-h-[300px] overflow-y-auto rounded-md border border-border bg-background p-2 space-y-3">
              {availableEmployees.map(group => (
                <div key={group.label}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 px-1">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map(emp => {
                      const selected = selectedMembers.has(emp.id)
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => toggleMember(emp.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                            selected ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
                          }`}
                        >
                          <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            selected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          }`}>
                            {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <span>{emp.first_name} {emp.last_name}</span>
                          {emp.is_h2b && <span className="ml-auto text-[10px] text-purple">H2B</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Create Crew Set</>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
