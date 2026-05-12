"use client"

import { useState, useEffect } from "react"
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
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Save, ChevronDown, ChevronUp } from "lucide-react"
import useClientMutation from "@/hooks/use-client-mutation"
import { useCompanies, useEmployees } from "@/hooks/use-supabase"
import { LandownerSelect } from "@/components/landowner-select"
import { toast } from "@/hooks/use-toast"
import {
  updateContractSchema,
  type UpdateContractInput,
} from "@/lib/schemas/update-contract"
import type { Contract } from "@/lib/database.types"
import { useApp } from "@/lib/app-context"

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "open", label: "Open (Bidding)" },
  { value: "seasonal", label: "Seasonal" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
]

const CONTRACT_TYPE_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "dnr_gna", label: "DNR / GNA" },
  { value: "federal", label: "Federal" },
  { value: "weyerhaeuser", label: "Weyerhaeuser" },
  { value: "state", label: "State" },
  { value: "county", label: "County" },
  { value: "other", label: "Other" },
]

const UNIT_TYPE_OPTIONS = [
  { value: "tree", label: "Trees" },
  { value: "acre", label: "Acres" },
  { value: "hour", label: "Hours" },
]

interface EditContractSheetProps {
  contract: Contract | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export function EditContractSheet({
  contract,
  open,
  onOpenChange,
  onUpdated,
}: EditContractSheetProps) {
  const { data: companies } = useCompanies()
  const { data: employees } = useEmployees()
  const foremen = (employees || []).filter((e) => e.is_foreman && e.status === "active")
  const [showFinancial, setShowFinancial] = useState(false)
  const [showContact, setShowContact] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateContractInput>({
    resolver: zodResolver(updateContractSchema),
  })

  // Pre-populate form when contract changes
  useEffect(() => {
    if (contract && open) {
      reset({
        id: contract.id,
        name: contract.name,
        company_id: contract.company_id,
        status: contract.status as UpdateContractInput["status"],
        start_date: contract.start_date ?? undefined,
        end_date: contract.end_date,
        contract_number: contract.contract_number,
        contract_type: contract.contract_type as UpdateContractInput["contract_type"],
        location: contract.location,
        landowner: contract.landowner,
        landowner_address: contract.landowner_address,
        contract_price: contract.contract_price,
        bond_amount: contract.bond_amount,
        has_prevailing_wage: contract.has_prevailing_wage ?? false,
        has_fringe: contract.has_fringe ?? false,
        fringe_rate: contract.fringe_rate,
        unit_type: contract.unit_type as UpdateContractInput["unit_type"],
        total_seedlings: contract.total_seedlings,
        total_acres: contract.total_acres,
        contact_name: contract.contact_name,
        contact_phone: contract.contact_phone,
        contact_email: contract.contact_email,
        foreman_id: contract.foreman_id,
        prime_contractor: contract.prime_contractor,
        notes: contract.notes,
      })

      // Auto-expand sections that have data
      if (contract.contract_price || contract.bond_amount || contract.has_fringe || contract.has_prevailing_wage) {
        setShowFinancial(true)
      }
      if (contract.contact_name || contract.contact_phone || contract.contact_email) {
        setShowContact(true)
      }
    }
  }, [contract, open, reset])

  const mutation = useClientMutation("updateContract", {
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Project updated",
          description: "Changes saved successfully.",
        })
        onOpenChange(false)
        onUpdated?.()
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      })
    },
  })

  const onSubmit = (data: UpdateContractInput) => {
    mutation.mutate(data)
  }

  const hasFringe = watch("has_fringe")

  if (!contract) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-foreground">Edit Project</SheetTitle>
          <SheetDescription>
            Update {contract.name}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <input type="hidden" {...register("id")} />

          {/* === CORE FIELDS === */}
          <div className="grid gap-4">
            {/* Contract Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="edit-name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                className="h-12 bg-background"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Company — required unless Private project type */}
            <div className="grid gap-1.5">
              <Label>
                Company {watch("contract_type") !== "private" && <span className="text-destructive">*</span>}
                {watch("contract_type") === "private" && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    (optional — private projects can be either)
                  </span>
                )}
              </Label>
              <Select
                value={watch("company_id") ?? ""}
                onValueChange={(v) => setValue("company_id", v)}
              >
                <SelectTrigger className="h-12 bg-background">
                  <SelectValue
                    placeholder={
                      watch("contract_type") === "private" ? "Any (both)" : "Select company"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.company_id && (
                <p className="text-xs text-destructive">{errors.company_id.message}</p>
              )}
            </div>

            {/* Status + Type row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={watch("status") ?? "upcoming"}
                  onValueChange={(v) =>
                    setValue("status", v as UpdateContractInput["status"])
                  }
                >
                  <SelectTrigger className="h-12 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Project Type</Label>
                <Select
                  value={watch("contract_type") ?? ""}
                  onValueChange={(v) =>
                    setValue(
                      "contract_type",
                      v as UpdateContractInput["contract_type"]
                    )
                  }
                >
                  <SelectTrigger className="h-12 bg-background">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contract Number */}
            <div className="grid gap-1.5">
              <Label htmlFor="edit-contract_number">Project Number</Label>
              <Input
                id="edit-contract_number"
                className="h-12 bg-background"
                {...register("contract_number")}
              />
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-start_date">Start Date</Label>
                <Input
                  id="edit-start_date"
                  type="date"
                  className="h-12 bg-background"
                  {...register("start_date")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-end_date">End Date</Label>
                <Input
                  id="edit-end_date"
                  type="date"
                  className="h-12 bg-background"
                  {...register("end_date")}
                />
              </div>
            </div>

            {/* Location + Landowner + Address */}
            <div className="grid gap-1.5">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                className="h-12 bg-background"
                {...register("location")}
              />
            </div>
            <LandownerSelect
              value={watch("landowner") ?? ""}
              onChange={val => setValue("landowner", val, { shouldValidate: true })}
              error={errors.landowner?.message}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="edit-landowner_address">Address</Label>
              <Input
                id="edit-landowner_address"
                placeholder="Street address"
                className="h-12 bg-background"
                {...register("landowner_address")}
              />
            </div>

            {/* Scope: Unit Type + Counts */}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Unit Type</Label>
                <Select
                  value={watch("unit_type") ?? ""}
                  onValueChange={(v) =>
                    setValue("unit_type", v as UpdateContractInput["unit_type"])
                  }
                >
                  <SelectTrigger className="h-12 bg-background">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPE_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-total_seedlings">Seedlings</Label>
                <Input
                  id="edit-total_seedlings"
                  type="number"
                  className="h-12 bg-background font-mono"
                  {...register("total_seedlings")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-total_acres">Acres</Label>
                <Input
                  id="edit-total_acres"
                  type="number"
                  step="0.1"
                  className="h-12 bg-background font-mono"
                  {...register("total_acres")}
                />
              </div>
            </div>

            {/* Prime Contractor */}
            <div className="grid gap-1.5">
              <Label htmlFor="edit-prime_contractor">Prime Contractor</Label>
              <Input
                id="edit-prime_contractor"
                className="h-12 bg-background"
                {...register("prime_contractor")}
              />
            </div>

            {/* Assigned Foreman */}
            <div className="grid gap-1.5">
              <Label>Assigned Foreman</Label>
              <Select
                value={watch("foreman_id") ?? "__none__"}
                onValueChange={(v) =>
                  setValue("foreman_id", v === "__none__" ? null : v)
                }
              >
                <SelectTrigger className="h-12 bg-background">
                  <SelectValue placeholder="Select foreman (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {foremen.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.first_name} {f.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* === FINANCIAL (collapsible) === */}
          <button
            type="button"
            onClick={() => setShowFinancial(!showFinancial)}
            className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showFinancial ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Financial Details
          </button>
          {showFinancial && (
            <div className="grid gap-4 rounded-md border border-border bg-elevated/50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-contract_price">Project Price ($)</Label>
                  <Input
                    id="edit-contract_price"
                    type="number"
                    step="0.01"
                    className="h-12 bg-background font-mono"
                    {...register("contract_price")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-bond_amount">Bond Amount ($)</Label>
                  <Input
                    id="edit-bond_amount"
                    type="number"
                    step="0.01"
                    className="h-12 bg-background font-mono"
                    {...register("bond_amount")}
                  />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Switch
                    id="edit-has_prevailing_wage"
                    checked={watch("has_prevailing_wage") ?? false}
                    onCheckedChange={(checked) =>
                      setValue("has_prevailing_wage", checked)
                    }
                  />
                  <Label htmlFor="edit-has_prevailing_wage" className="text-sm">
                    Prevailing Wage
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="edit-has_fringe"
                    checked={watch("has_fringe") ?? false}
                    onCheckedChange={(checked) =>
                      setValue("has_fringe", checked)
                    }
                  />
                  <Label htmlFor="edit-has_fringe" className="text-sm">
                    Fringe
                  </Label>
                </div>
              </div>
              {hasFringe && (
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-fringe_rate">Fringe Rate ($/hr)</Label>
                  <Input
                    id="edit-fringe_rate"
                    type="number"
                    step="0.01"
                    className="h-12 bg-background font-mono"
                    {...register("fringe_rate")}
                  />
                </div>
              )}
            </div>
          )}

          {/* === CONTACT (collapsible) === */}
          <button
            type="button"
            onClick={() => setShowContact(!showContact)}
            className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showContact ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Contact Info
          </button>
          {showContact && (
            <div className="grid gap-4 rounded-md border border-border bg-elevated/50 p-4">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-contact_name">Contact Name</Label>
                <Input
                  id="edit-contact_name"
                  className="h-12 bg-background"
                  {...register("contact_name")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-contact_phone">Phone</Label>
                  <Input
                    id="edit-contact_phone"
                    type="tel"
                    className="h-12 bg-background"
                    {...register("contact_phone")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-contact_email">Email</Label>
                  <Input
                    id="edit-contact_email"
                    type="email"
                    className="h-12 bg-background"
                    {...register("contact_email")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              className="min-h-[80px] bg-background"
              {...register("notes")}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
