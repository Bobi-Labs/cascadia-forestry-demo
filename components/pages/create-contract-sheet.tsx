"use client"

import { useState } from "react"
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
import { useApp } from "@/lib/app-context"
import {
  createContractSchema,
  type CreateContractInput,
} from "@/lib/schemas/create-contract"

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

interface CreateContractSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: string) => void
}

export function CreateContractSheet({
  open,
  onOpenChange,
  onCreated,
}: CreateContractSheetProps) {
  const { role } = useApp()
  const { data: companies } = useCompanies()
  const { data: employees } = useEmployees()
  const needsApproval = role !== 'admin'
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
  } = useForm<CreateContractInput>({
    resolver: zodResolver(createContractSchema),
    defaultValues: {
      status: "upcoming",
      has_prevailing_wage: false,
      has_fringe: false,
    },
  })

  // Private/landowner contracts: company is optional (Jaime, April 2026).
  // Ramos and Cascadia can both work the same private contract in a year,
  // so don't lock it to one company at create time.
  const contractType = watch("contract_type")
  const companyRequired = contractType !== "private"

  const mutation = useClientMutation("createContract", {
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: needsApproval ? "Project submitted for approval" : "Project created",
          description: needsApproval
            ? "An admin will review and approve this project."
            : "Successfully created project.",
        })
        reset()
        onOpenChange(false)
        onCreated?.(result.data.id)
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

  const onSubmit = (data: CreateContractInput) => {
    // Non-admin submissions require approval
    if (needsApproval) {
      data.status = "pending_approval"
    }
    mutation.mutate(data)
  }

  const hasFringe = watch("has_fringe")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-foreground">New Project</SheetTitle>
          <SheetDescription>
            Create a new project. You can add units after creation.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {/* === CORE FIELDS === */}
          <div className="grid gap-4">
            {/* Contract Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Chilton Trail 2026"
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
                Company {companyRequired && <span className="text-destructive">*</span>}
                {!companyRequired && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    (optional — private projects can be either)
                  </span>
                )}
              </Label>
              <Select
                value={watch("company_id") || ""}
                onValueChange={(v) => setValue("company_id", v)}
              >
                <SelectTrigger className="h-12 bg-background">
                  <SelectValue placeholder={companyRequired ? "Select company" : "Any (both)"} />
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
                <Label>
                  Status <span className="text-destructive">*</span>
                </Label>
                <Select
                  defaultValue="upcoming"
                  onValueChange={(v) =>
                    setValue("status", v as CreateContractInput["status"])
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
                  onValueChange={(v) =>
                    setValue(
                      "contract_type",
                      v as CreateContractInput["contract_type"]
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
              <Label htmlFor="contract_number">Project Number</Label>
              <Input
                id="contract_number"
                placeholder="e.g. DNR-7044"
                className="h-12 bg-background"
                {...register("contract_number")}
              />
            </div>

            {/* Dates row — both optional (private contracts often have no fixed schedule) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  className="h-12 bg-background"
                  {...register("start_date")}
                />
                {errors.start_date && (
                  <p className="text-xs text-destructive">
                    {errors.start_date.message}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  className="h-12 bg-background"
                  {...register("end_date")}
                />
              </div>
            </div>

            {/* Location + Landowner + Address */}
            <div className="grid gap-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Lewis County, WA"
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
              <Label htmlFor="landowner_address">Address</Label>
              <Input
                id="landowner_address"
                placeholder="Street address — e.g. 123 Timber Rd, Chehalis, WA 98532"
                className="h-12 bg-background"
                {...register("landowner_address")}
              />
            </div>

            {/* Scope: Unit Type + Counts */}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Unit Type</Label>
                <Select
                  onValueChange={(v) =>
                    setValue("unit_type", v as CreateContractInput["unit_type"])
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
                <Label htmlFor="total_seedlings">Seedlings</Label>
                <Input
                  id="total_seedlings"
                  type="number"
                  placeholder="0"
                  className="h-12 bg-background font-mono"
                  {...register("total_seedlings")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="total_acres">Acres</Label>
                <Input
                  id="total_acres"
                  type="number"
                  step="0.1"
                  placeholder="0"
                  className="h-12 bg-background font-mono"
                  {...register("total_acres")}
                />
              </div>
            </div>

            {/* Prime Contractor */}
            <div className="grid gap-1.5">
              <Label htmlFor="prime_contractor">Prime Contractor</Label>
              <Input
                id="prime_contractor"
                placeholder="e.g. Cascadia Forestry Inc"
                className="h-12 bg-background"
                {...register("prime_contractor")}
              />
            </div>

            {/* Assigned Foreman */}
            <div className="grid gap-1.5">
              <Label>Assigned Foreman</Label>
              <Select
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
                  <Label htmlFor="contract_price">Project Price ($)</Label>
                  <Input
                    id="contract_price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="h-12 bg-background font-mono"
                    {...register("contract_price")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bond_amount">Bond Amount ($)</Label>
                  <Input
                    id="bond_amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="h-12 bg-background font-mono"
                    {...register("bond_amount")}
                  />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Switch
                    id="has_prevailing_wage"
                    onCheckedChange={(checked) =>
                      setValue("has_prevailing_wage", checked)
                    }
                  />
                  <Label htmlFor="has_prevailing_wage" className="text-sm">
                    Prevailing Wage
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="has_fringe"
                    onCheckedChange={(checked) =>
                      setValue("has_fringe", checked)
                    }
                  />
                  <Label htmlFor="has_fringe" className="text-sm">
                    Fringe
                  </Label>
                </div>
              </div>
              {hasFringe && (
                <div className="grid gap-1.5">
                  <Label htmlFor="fringe_rate">Fringe Rate ($/hr)</Label>
                  <Input
                    id="fringe_rate"
                    type="number"
                    step="0.01"
                    placeholder="4.98"
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
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  placeholder="e.g. John Smith"
                  className="h-12 bg-background"
                  {...register("contact_name")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="contact_phone">Phone</Label>
                  <Input
                    id="contact_phone"
                    type="tel"
                    placeholder="(360) 555-0100"
                    className="h-12 bg-background"
                    {...register("contact_phone")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    placeholder="contact@example.com"
                    className="h-12 bg-background"
                    {...register("contact_email")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this project..."
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
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
