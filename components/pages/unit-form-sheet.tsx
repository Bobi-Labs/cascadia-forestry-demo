"use client"

import { useEffect, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Save, Trash2, Plus, X, ChevronDown, ChevronUp, MapPin, Upload, FileText, Download } from "lucide-react"
import useClientMutation from "@/hooks/use-client-mutation"
import { useWorkTypes } from "@/hooks/use-supabase"
import { toast } from "@/hooks/use-toast"
import { useApp } from "@/lib/app-context"
import { createClient } from "@/lib/supabase/client"
import {
  createUnitSchema,
  updateUnitSchema,
  type CreateUnitInput,
  type UpdateUnitInput,
  type SpeciesEntry,
  encodeSpeciesEntry,
  decodeSpeciesEntry,
} from "@/lib/schemas/unit"
import type { Unit } from "@/lib/database.types"

// State name map for select
const US_STATES = [
  { value: "WA", label: "Washington" },
  { value: "OR", label: "Oregon" },
  { value: "ID", label: "Idaho" },
  { value: "CA", label: "California" },
  { value: "MT", label: "Montana" },
]

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
]

const TERRAIN_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "moderate", label: "Moderate" },
  { value: "hard", label: "Hard" },
]

const AMOUNT_TYPE_OPTIONS = [
  { value: "tree", label: "Trees" },
  { value: "acre", label: "Acres" },
  { value: "hour", label: "Hours" },
]

// Seedling stock-type codes Jaime + crews use in the field. The "X+Y"
// format is years-in-seedbed + years-in-transplant-bed. Plug variants
// are container-grown. P+0 added 2026-05-13 per the May 8 demo call —
// missing option came up while reviewing Manulife specs.
const STOCK_TYPE_OPTIONS = [
  { value: "1+1", label: "1+1" },
  { value: "1+0", label: "1+0" },
  { value: "2+0", label: "2+0" },
  { value: "P+0", label: "P+0" },
  { value: "P+1", label: "P+1" },
  { value: "Plug", label: "Plug" },
  { value: "Plug+1", label: "Plug+1" },
  { value: "Bareroot", label: "Bareroot" },
  { value: "Container", label: "Container" },
  { value: "Other", label: "Other" },
]

type LocationMode = "gps" | "township"

interface UnitFormSheetProps {
  contractId: string
  unit?: Unit | null // null = create mode, Unit = edit mode
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function UnitFormSheet({
  contractId,
  unit,
  open,
  onOpenChange,
  onSaved,
}: UnitFormSheetProps) {
  const isEdit = !!unit
  const { role } = useApp()
  const { data: workTypes } = useWorkTypes()
  // Office submissions need approval; admin and foreman go straight through
  const unitNeedsApproval = role !== 'admin' && role !== 'foreman'
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Document upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [existingDocs, setExistingDocs] = useState<{ name: string; path: string }[]>([])
  const [docsLoading, setDocsLoading] = useState(false)


  // Species entry state
  const [speciesName, setSpeciesName] = useState("")
  const [speciesStockType, setSpeciesStockType] = useState("")
  const [speciesCount, setSpeciesCount] = useState("")
  const [speciesEntries, setSpeciesEntries] = useState<SpeciesEntry[]>([])

  // Location mode state
  const [locationMode, setLocationMode] = useState<LocationMode>("gps")

  const schema = isEdit ? updateUnitSchema : createUnitSchema

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateUnitInput | UpdateUnitInput>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          id: unit.id,
          contract_id: contractId,
          name: unit.name,
          work_type: unit.work_type ?? undefined,
          county: unit.county ?? undefined,
          state: unit.state ?? undefined,
          amount: unit.amount ?? undefined,
          amount_type: unit.amount_type ?? undefined,
          price_per_unit: unit.price_per_unit ?? undefined,
          price_per_tree: unit.price_per_tree ?? undefined,
          price_per_acre: unit.price_per_acre ?? undefined,
          price_per_hour: unit.price_per_hour ?? undefined,
          status: unit.status,
          completion_pct: unit.completion_pct,
          species: unit.species ?? [],
          target_spacing: unit.target_spacing ?? undefined,
          seedlings_per_acre: unit.seedlings_per_acre ?? undefined,
          total_seedlings: unit.total_seedlings ?? undefined,
          stock_type: unit.stock_type ?? undefined,
          tpa_target: unit.tpa_target ?? undefined,
          prescription: unit.prescription ?? undefined,
          avg_slope_pct: unit.avg_slope_pct ?? undefined,
          terrain_difficulty: unit.terrain_difficulty ?? undefined,
          elevation_min: unit.elevation_min ?? undefined,
          elevation_max: unit.elevation_max ?? undefined,
          township_range: unit.township_range ?? undefined,
          latitude: unit.latitude ?? undefined,
          longitude: unit.longitude ?? undefined,
          notes: unit.notes ?? undefined,
        }
      : {
          contract_id: contractId,
          status: "not_started",
          completion_pct: 0,
          species: [],
        },
  })

  // Initialize species entries from unit data
  function initSpeciesEntries(speciesArr: string[] | null | undefined) {
    if (speciesArr && speciesArr.length > 0) {
      setSpeciesEntries(speciesArr.map(decodeSpeciesEntry))
    } else {
      setSpeciesEntries([])
    }
  }

  // Determine initial location mode from unit data
  function initLocationMode(u: Unit | null | undefined) {
    if (u?.latitude || u?.longitude) {
      setLocationMode("gps")
    } else if (u?.township_range) {
      setLocationMode("township")
    } else {
      setLocationMode("gps")
    }
  }

  // Reset when sheet opens/unit changes
  useEffect(() => {
    if (open) {
      if (isEdit && unit) {
        reset({
          id: unit.id,
          contract_id: contractId,
          name: unit.name,
          work_type: unit.work_type ?? undefined,
          county: unit.county ?? undefined,
          state: unit.state ?? undefined,
          amount: unit.amount ?? undefined,
          amount_type: unit.amount_type ?? undefined,
          price_per_unit: unit.price_per_unit ?? undefined,
          price_per_tree: unit.price_per_tree ?? undefined,
          price_per_acre: unit.price_per_acre ?? undefined,
          price_per_hour: unit.price_per_hour ?? undefined,
          status: unit.status,
          completion_pct: unit.completion_pct,
          species: unit.species ?? [],
          target_spacing: unit.target_spacing ?? undefined,
          seedlings_per_acre: unit.seedlings_per_acre ?? undefined,
          total_seedlings: unit.total_seedlings ?? undefined,
          stock_type: unit.stock_type ?? undefined,
          tpa_target: unit.tpa_target ?? undefined,
          prescription: unit.prescription ?? undefined,
          avg_slope_pct: unit.avg_slope_pct ?? undefined,
          terrain_difficulty: unit.terrain_difficulty ?? undefined,
          elevation_min: unit.elevation_min ?? undefined,
          elevation_max: unit.elevation_max ?? undefined,
          township_range: unit.township_range ?? undefined,
          latitude: unit.latitude ?? undefined,
          longitude: unit.longitude ?? undefined,
          notes: unit.notes ?? undefined,
        })
        initSpeciesEntries(unit.species)
        initLocationMode(unit)
      } else {
        reset({
          contract_id: contractId,
          status: "not_started",
          completion_pct: 0,
          species: [],
        })
        setSpeciesEntries([])
        setLocationMode("gps")
      }
      setShowAdvanced(false)
      setSpeciesName("")
      setSpeciesStockType("")
      setSpeciesCount("")
    }
  }, [open, unit, contractId, isEdit, reset])

  // Sync species entries to form value whenever they change
  useEffect(() => {
    const encoded = speciesEntries.map(encodeSpeciesEntry)
    setValue("species", encoded)
  }, [speciesEntries, setValue])

  // Load existing documents from Supabase Storage when editing
  useEffect(() => {
    if (!open || !isEdit || !unit) {
      setExistingDocs([])
      setSelectedFile(null)
      return
    }
    async function loadDocs() {
      setDocsLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase.storage
          .from("unit-documents")
          .list(unit!.id, { limit: 50 })
        if (!error && data) {
          setExistingDocs(
            data
              .filter((f) => f.name !== ".emptyFolderPlaceholder")
              .map((f) => ({ name: f.name, path: `${unit!.id}/${f.name}` }))
          )
        } else {
          // Bucket may not exist yet — that's fine
          setExistingDocs([])
        }
      } catch {
        setExistingDocs([])
      }
      setDocsLoading(false)
    }
    loadDocs()
  }, [open, isEdit, unit])

  async function uploadDocument() {
    if (!selectedFile || !unit) return
    setUploading(true)
    try {
      const supabase = createClient()
      const filePath = `${unit.id}/${selectedFile.name}`
      const { error } = await supabase.storage
        .from("unit-documents")
        .upload(filePath, selectedFile, { upsert: true })
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" })
      } else {
        toast({ title: "Document uploaded", description: selectedFile.name })
        setExistingDocs((prev) => [...prev, { name: selectedFile.name, path: filePath }])
        setSelectedFile(null)
        // Reset file input
        const fileInput = document.getElementById("unit-doc-input") as HTMLInputElement
        if (fileInput) fileInput.value = ""
      }
    } catch (err) {
      toast({ title: "Upload failed", description: "An unexpected error occurred.", variant: "destructive" })
    }
    setUploading(false)
  }

  async function downloadDocument(doc: { name: string; path: string }) {
    // Bucket is private — must use a short-lived signed URL instead of
    // a permanent public URL. 1-hour expiry covers the read; a fresh
    // URL is generated each time the user clicks Download. Public-URL
    // approach was the previous behavior when the bucket was flagged
    // public; locked down per the May 13 security pass.
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from("unit-documents")
      .createSignedUrl(doc.path, 60 * 60)
    if (error || !data?.signedUrl) {
      toast({
        title: "Download failed",
        description: error?.message ?? "Could not generate a signed URL.",
        variant: "destructive",
      })
      return
    }
    window.open(data.signedUrl, "_blank")
  }

  async function removeDocument(doc: { name: string; path: string }) {
    const supabase = createClient()
    const { error } = await supabase.storage.from("unit-documents").remove([doc.path])
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" })
    } else {
      setExistingDocs((prev) => prev.filter((d) => d.path !== doc.path))
      toast({ title: "Document removed", description: doc.name })
    }
  }

  const createMutation = useClientMutation("createUnit")
  const updateMutation = useClientMutation("updateUnit")
  const deleteMutation = useClientMutation("deleteUnit")

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  function addSpecies() {
    const trimmedName = speciesName.trim()
    if (!trimmedName) return

    const newEntry: SpeciesEntry = {
      name: trimmedName,
      stockType: speciesStockType || "",
      count: speciesCount ? parseInt(speciesCount, 10) : null,
    }
    setSpeciesEntries((prev) => [...prev, newEntry])
    setSpeciesName("")
    setSpeciesStockType("")
    setSpeciesCount("")
  }

  function removeSpecies(index: number) {
    setSpeciesEntries((prev) => prev.filter((_, i) => i !== index))
  }

  async function onSubmit(data: CreateUnitInput | UpdateUnitInput) {
    // Clear location fields not relevant to the current mode
    if (locationMode === "gps") {
      data.township_range = null
    } else {
      data.latitude = null
      data.longitude = null
    }

    // Non-admin/non-foreman new units need approval
    if (!isEdit && unitNeedsApproval) {
      data.status = "pending"
    }

    if (isEdit) {
      const result = await updateMutation.mutateAsync(data as UpdateUnitInput)
      if (result.success) {
        toast({ title: "Unit updated", description: `${data.name || "Unit"} saved.` })
        onOpenChange(false)
        onSaved?.()
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    } else {
      const result = await createMutation.mutateAsync(data as CreateUnitInput)
      if (result.success) {
        toast({
          title: unitNeedsApproval ? "Unit submitted for approval" : "Unit created",
          description: unitNeedsApproval
            ? `${data.name} is pending admin approval.`
            : `${data.name} added to contract.`,
        })
        onOpenChange(false)
        onSaved?.()
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    }
  }

  async function onDelete() {
    if (!unit) return
    if (!confirm(`Delete unit "${unit.name}"? This cannot be undone.`)) return

    const result = await deleteMutation.mutateAsync({ id: unit.id })
    if (result.success) {
      toast({ title: "Unit deleted", description: `${unit.name} removed.` })
      onOpenChange(false)
      onSaved?.()
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Unit" : "Add Unit"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update unit details." : "Add a new unit to this contract."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4">
          {/* Hidden contract_id */}
          <input type="hidden" {...register("contract_id")} />
          {isEdit && <input type="hidden" {...register("id" as never)} />}

          {/* Name */}
          <div>
            <Label htmlFor="unit-name">Unit Name *</Label>
            <Input id="unit-name" {...register("name")} placeholder="e.g. Clark Creek Unit A" />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Work Type + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Work Type</Label>
              <Select
                value={watch("work_type") ?? ""}
                onValueChange={(v) => setValue("work_type", v || null)}
              >
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {workTypes?.map((wt) => (
                    <SelectItem key={wt.id} value={wt.name}>{wt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={watch("status") ?? "not_started"}
                onValueChange={(v) => setValue("status", v as "not_started" | "in_progress" | "completed")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location: County + State */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>County</Label>
              <Input {...register("county")} placeholder="e.g. Cowlitz" />
            </div>
            <div>
              <Label>State</Label>
              <Select
                value={watch("state") ?? ""}
                onValueChange={(v) => setValue("state", v || null)}
              >
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount + Type + Primary Price */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="any" {...register("amount")} placeholder="0" />
            </div>
            <div>
              <Label>Unit Type</Label>
              <Select
                value={watch("amount_type") ?? ""}
                onValueChange={(v) => setValue("amount_type", v as "tree" | "acre" | "hour" || null)}
              >
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {AMOUNT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price/Unit (primary)</Label>
              <Input type="number" step="0.01" {...register("price_per_unit")} placeholder="$0.00" />
            </div>
          </div>

          {/* Multi-price — fill any combo. PCT might use per-acre + per-hour;
              planting uses per-tree only; foreman support uses per-hour only.
              Office picks which rate to apply at invoice time. */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                $/Tree
              </Label>
              <Input type="number" step="0.0001" {...register("price_per_tree")} placeholder="$0.00" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                $/Acre
              </Label>
              <Input type="number" step="0.01" {...register("price_per_acre")} placeholder="$0.00" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                $/Hour
              </Label>
              <Input type="number" step="0.01" {...register("price_per_hour")} placeholder="$0.00" />
            </div>
          </div>

          {/* Completion */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Completion %</Label>
              <Input type="number" min={0} max={100} {...register("completion_pct")} />
            </div>
            <div>
              <Label>Terrain</Label>
              <Select
                value={watch("terrain_difficulty") ?? ""}
                onValueChange={(v) => setValue("terrain_difficulty", v as "easy" | "moderate" | "hard" || null)}
              >
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {TERRAIN_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Species (structured entries: name + stock type + count) */}
          <div>
            <Label>Species</Label>
            <div className="flex flex-col gap-2">
              {/* Input row for adding new species */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                <div>
                  <span className="text-xs text-muted-foreground">Name</span>
                  <Input
                    value={speciesName}
                    onChange={(e) => setSpeciesName(e.target.value)}
                    placeholder="e.g. Douglas Fir"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addSpecies()
                      }
                    }}
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Stock Type</span>
                  <Select
                    value={speciesStockType}
                    onValueChange={setSpeciesStockType}
                  >
                    <SelectTrigger className="w-[100px]"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      {STOCK_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Count</span>
                  <Input
                    type="number"
                    className="w-[80px]"
                    value={speciesCount}
                    onChange={(e) => setSpeciesCount(e.target.value)}
                    placeholder="0"
                    min={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addSpecies()
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={addSpecies} className="h-9 w-9">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* List of added species entries */}
              {speciesEntries.length > 0 && (
                <div className="mt-1 flex flex-col gap-1.5">
                  {speciesEntries.map((entry, idx) => (
                    <div
                      key={`${entry.name}-${idx}`}
                      className="flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium text-primary">{entry.name}</span>
                      {entry.stockType && (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary">
                          {entry.stockType}
                        </span>
                      )}
                      {entry.count != null && entry.count > 0 && (
                        <span className="text-muted-foreground font-mono">
                          {entry.count.toLocaleString()} seedlings
                        </span>
                      )}
                      <button type="button" onClick={() => removeSpecies(idx)} className="ml-auto">
                        <X className="h-3 w-3 text-primary/60 hover:text-primary" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Location Section */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Label className="mb-0">Location</Label>
              <div className="ml-auto flex rounded-md border border-border overflow-hidden text-xs">
                <button
                  type="button"
                  className={`px-3 py-1.5 transition-colors ${
                    locationMode === "gps"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setLocationMode("gps")}
                >
                  GPS
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 transition-colors ${
                    locationMode === "township"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setLocationMode("township")}
                >
                  Township/Range
                </button>
              </div>
            </div>

            {locationMode === "gps" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="unit-lat" className="text-xs">Latitude</Label>
                  <Input
                    id="unit-lat"
                    type="number"
                    step="any"
                    {...register("latitude")}
                    placeholder="e.g. 46.8523"
                  />
                  {errors.latitude && (
                    <p className="mt-1 text-xs text-destructive">{errors.latitude.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="unit-lng" className="text-xs">Longitude</Label>
                  <Input
                    id="unit-lng"
                    type="number"
                    step="any"
                    {...register("longitude")}
                    placeholder="e.g. -122.7583"
                  />
                  {errors.longitude && (
                    <p className="mt-1 text-xs text-destructive">{errors.longitude.message}</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="unit-trs" className="text-xs">Township / Range / Section</Label>
                <Input
                  id="unit-trs"
                  {...register("township_range")}
                  placeholder="e.g. T10N R5E S16"
                />
              </div>
            )}
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAdvanced ? "Hide" : "Show"} advanced fields
          </button>

          {showAdvanced && (
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-elevated/30 p-3">
              {/* Planting fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Target Spacing</Label>
                  <Input {...register("target_spacing")} placeholder="e.g. 10x10" />
                </div>
                <div>
                  <Label>Stock Type (legacy)</Label>
                  <Input {...register("stock_type")} placeholder="e.g. 1+1 bareroot" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Seedlings/Acre</Label>
                  <Input type="number" {...register("seedlings_per_acre")} />
                </div>
                <div>
                  <Label>Total Seedlings</Label>
                  <Input type="number" {...register("total_seedlings")} />
                </div>
              </div>

              {/* Thinning fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>TPA Target</Label>
                  <Input type="number" {...register("tpa_target")} placeholder="Trees per acre" />
                </div>
                <div>
                  <Label>Prescription</Label>
                  <Input {...register("prescription")} placeholder="e.g. PCT to 180 TPA" />
                </div>
              </div>

              {/* Elevation & slope */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Elev Min (ft)</Label>
                  <Input type="number" {...register("elevation_min")} />
                </div>
                <div>
                  <Label>Elev Max (ft)</Label>
                  <Input type="number" {...register("elevation_max")} />
                </div>
                <div>
                  <Label>Avg Slope %</Label>
                  <Input type="number" {...register("avg_slope_pct")} />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea {...register("notes")} placeholder="Optional notes..." rows={2} />
          </div>

          {/* Documents */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Label className="mb-0">Documents</Label>
              <span className="text-xs text-muted-foreground">(spec sheets, maps, PDFs)</span>
            </div>

            {/* Existing documents list */}
            {docsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading documents...
              </div>
            ) : existingDocs.length > 0 ? (
              <div className="flex flex-col gap-1.5 mb-3">
                {existingDocs.map((doc) => (
                  <div
                    key={doc.path}
                    className="flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-2 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate font-medium text-primary">{doc.name}</span>
                    <div className="ml-auto flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => downloadDocument(doc)}
                        className="p-1 hover:bg-primary/20 rounded"
                        title="Download"
                      >
                        <Download className="h-3 w-3 text-primary/60 hover:text-primary" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDocument(doc)}
                        className="p-1 hover:bg-destructive/20 rounded"
                        title="Remove"
                      >
                        <X className="h-3 w-3 text-primary/60 hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : isEdit ? (
              <p className="text-xs text-muted-foreground mb-3">No documents uploaded yet.</p>
            ) : null}

            {/* File input + upload button (only in edit mode — need unit ID for storage path) */}
            {isEdit ? (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="unit-doc-input"
                  className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors flex-1 min-h-[48px]"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {selectedFile ? selectedFile.name : "Choose PDF or image..."}
                  </span>
                </label>
                <input
                  id="unit-doc-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                {selectedFile && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={uploadDocument}
                    disabled={uploading}
                    className="min-h-[48px]"
                  >
                    {uploading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Upload
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Save the unit first, then you can upload documents.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-border pt-4">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              {isEdit ? "Save Changes" : "Add Unit"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
