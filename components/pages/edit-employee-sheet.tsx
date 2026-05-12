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
import { toast } from "@/hooks/use-toast"
import {
  updateEmployeeSchema,
  type UpdateEmployeeInput,
} from "@/lib/schemas/update-employee"
import type { Employee } from "@/lib/database.types"
import { useApp } from "@/lib/app-context"

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "terminated", label: "Terminated" },
]

const COMPANY_AUTH_OPTIONS = [
  { value: "cascadia", label: "Cascadia" },
  { value: "ramos", label: "Ramos" },
  { value: "both", label: "Both" },
]

const RATE_TYPE_OPTIONS = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
]

interface EditEmployeeSheetProps {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export function EditEmployeeSheet({
  employee,
  open,
  onOpenChange,
  onUpdated,
}: EditEmployeeSheetProps) {
  const [showDocs, setShowDocs] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateEmployeeInput>({
    resolver: zodResolver(updateEmployeeSchema),
  })

  useEffect(() => {
    if (employee && open) {
      reset({
        id: employee.id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        phone: employee.phone,
        email: employee.email,
        address_us: employee.address_us,
        rate: employee.rate,
        daily_rate: employee.daily_rate,
        rate_type: employee.rate_type as UpdateEmployeeInput["rate_type"],
        is_h2b: employee.is_h2b,
        is_driver: employee.is_driver,
        is_foreman: employee.is_foreman,
        is_office: employee.is_office,
        company_auth: employee.company_auth as UpdateEmployeeInput["company_auth"],
        status: employee.status as UpdateEmployeeInput["status"],
        passport_exp: employee.passport_exp,
        visa_exp: employee.visa_exp,
        dl_exp: employee.dl_exp,
        drive_auth_exp: employee.drive_auth_exp,
        cpr_exp: employee.cpr_exp,
        herbicide_license_exp: employee.herbicide_license_exp,
        fingerprints_exp: employee.fingerprints_exp,
        notes: employee.notes,
      })

      // Auto-expand docs section if there are expirations
      if (employee.passport_exp || employee.visa_exp || employee.dl_exp) {
        setShowDocs(true)
      }
    }
  }, [employee, open, reset])

  const mutation = useClientMutation("updateEmployee", {
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Employee updated",
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

  const onSubmit = (data: UpdateEmployeeInput) => {
    mutation.mutate(data)
  }

  const rateType = watch("rate_type")

  if (!employee) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-foreground">Edit Employee</SheetTitle>
          <SheetDescription>
            Update {employee.first_name} {employee.last_name}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <input type="hidden" {...register("id")} />

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-first_name">First Name</Label>
              <Input
                id="edit-first_name"
                className="h-12 bg-background"
                {...register("first_name")}
              />
              {errors.first_name && (
                <p className="text-xs text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-last_name">Last Name</Label>
              <Input
                id="edit-last_name"
                className="h-12 bg-background"
                {...register("last_name")}
              />
              {errors.last_name && (
                <p className="text-xs text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-emp-phone">Phone</Label>
              <Input
                id="edit-emp-phone"
                type="tel"
                className="h-12 bg-background"
                {...register("phone")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-emp-email">Email</Label>
              <Input
                id="edit-emp-email"
                type="email"
                className="h-12 bg-background"
                {...register("email")}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="edit-address_us">US Address</Label>
            <Input
              id="edit-address_us"
              className="h-12 bg-background"
              {...register("address_us")}
            />
          </div>

          {/* Status + Company */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={watch("status") ?? "active"}
                onValueChange={(v) =>
                  setValue("status", v as UpdateEmployeeInput["status"])
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
              <Label>Company</Label>
              <Select
                value={watch("company_auth") ?? "cascadia"}
                onValueChange={(v) =>
                  setValue(
                    "company_auth",
                    v as UpdateEmployeeInput["company_auth"]
                  )
                }
              >
                <SelectTrigger className="h-12 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_AUTH_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Roles */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Switch
                id="edit-is_foreman"
                checked={watch("is_foreman") ?? false}
                onCheckedChange={(checked) => setValue("is_foreman", checked)}
              />
              <Label htmlFor="edit-is_foreman" className="text-sm">
                Foreman
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="edit-is_driver"
                checked={watch("is_driver") ?? false}
                onCheckedChange={(checked) => setValue("is_driver", checked)}
              />
              <Label htmlFor="edit-is_driver" className="text-sm">
                Driver
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="edit-is_office"
                checked={watch("is_office") ?? false}
                onCheckedChange={(checked) => setValue("is_office", checked)}
              />
              <Label htmlFor="edit-is_office" className="text-sm">
                Office
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="edit-is_h2b"
                checked={watch("is_h2b") ?? false}
                onCheckedChange={(checked) => setValue("is_h2b", checked)}
              />
              <Label htmlFor="edit-is_h2b" className="text-sm">
                H2B
              </Label>
            </div>
          </div>

          {/* Pay Rate */}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Rate Type</Label>
              <Select
                value={rateType ?? "hourly"}
                onValueChange={(v) =>
                  setValue("rate_type", v as UpdateEmployeeInput["rate_type"])
                }
              >
                <SelectTrigger className="h-12 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATE_TYPE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-rate">Hourly Rate ($)</Label>
              <Input
                id="edit-rate"
                type="number"
                step="0.01"
                className="h-12 bg-background font-mono"
                {...register("rate")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-daily_rate">Daily Rate ($)</Label>
              <Input
                id="edit-daily_rate"
                type="number"
                step="0.01"
                className="h-12 bg-background font-mono"
                {...register("daily_rate")}
              />
            </div>
          </div>

          {/* Documents & Expirations (collapsible) */}
          <button
            type="button"
            onClick={() => setShowDocs(!showDocs)}
            className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDocs ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Document Expirations
          </button>
          {showDocs && (
            <div className="grid gap-4 rounded-md border border-border bg-elevated/50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-passport_exp">Passport Exp</Label>
                  <Input
                    id="edit-passport_exp"
                    type="date"
                    className="h-12 bg-background"
                    {...register("passport_exp")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-visa_exp">Visa Exp</Label>
                  <Input
                    id="edit-visa_exp"
                    type="date"
                    className="h-12 bg-background"
                    {...register("visa_exp")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-dl_exp">DL Exp</Label>
                  <Input
                    id="edit-dl_exp"
                    type="date"
                    className="h-12 bg-background"
                    {...register("dl_exp")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-drive_auth_exp">Drive Auth Exp</Label>
                  <Input
                    id="edit-drive_auth_exp"
                    type="date"
                    className="h-12 bg-background"
                    {...register("drive_auth_exp")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-cpr_exp">CPR Cert Exp</Label>
                  <Input
                    id="edit-cpr_exp"
                    type="date"
                    className="h-12 bg-background"
                    {...register("cpr_exp")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-herbicide_license_exp">Herbicide Exp</Label>
                  <Input
                    id="edit-herbicide_license_exp"
                    type="date"
                    className="h-12 bg-background"
                    {...register("herbicide_license_exp")}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-fingerprints_exp">Fingerprints Exp</Label>
                <Input
                  id="edit-fingerprints_exp"
                  type="date"
                  className="h-12 bg-background"
                  {...register("fingerprints_exp")}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="edit-emp-notes">Notes</Label>
            <Textarea
              id="edit-emp-notes"
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
