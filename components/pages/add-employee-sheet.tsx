"use client"

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
import { Loader2, UserPlus } from "lucide-react"
import useClientMutation from "@/hooks/use-client-mutation"
import { toast } from "@/hooks/use-toast"
import {
  createEmployeeSchema,
  type CreateEmployeeInput,
} from "@/lib/schemas/create-employee"
import { useApp } from "@/lib/app-context"

const COMPANY_AUTH_OPTIONS = [
  { value: "cascadia", label: "Cascadia" },
  { value: "ramos", label: "Ramos" },
  { value: "both", label: "Both" },
]

const RATE_TYPE_OPTIONS = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
]

interface AddEmployeeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function AddEmployeeSheet({
  open,
  onOpenChange,
  onCreated,
}: AddEmployeeSheetProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      company_auth: "cascadia",
      is_foreman: false,
      is_driver: false,
      is_h2b: false,
      is_office: false,
      rate_type: "hourly",
      rate: null,
      daily_rate: null,
      status: "active",
    },
  })

  const mutation = useClientMutation("createEmployee", {
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Employee added",
          description: "New employee created successfully.",
        })
        reset()
        onOpenChange(false)
        onCreated?.()
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

  const onSubmit = (data: CreateEmployeeInput) => {
    mutation.mutate(data)
  }

  const rateType = watch("rate_type")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-foreground">Add Employee</SheetTitle>
          <SheetDescription>
            Create a new employee record.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="add-first_name">First Name *</Label>
              <Input
                id="add-first_name"
                className="h-12 bg-background"
                placeholder="First name"
                {...register("first_name")}
              />
              {errors.first_name && (
                <p className="text-xs text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-last_name">Last Name *</Label>
              <Input
                id="add-last_name"
                className="h-12 bg-background"
                placeholder="Last name"
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
              <Label htmlFor="add-emp-phone">Phone</Label>
              <Input
                id="add-emp-phone"
                type="tel"
                className="h-12 bg-background"
                placeholder="(555) 555-1234"
                {...register("phone")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-emp-email">Email</Label>
              <Input
                id="add-emp-email"
                type="email"
                className="h-12 bg-background"
                placeholder="email@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Company */}
          <div className="grid gap-1.5">
            <Label>Company *</Label>
            <Select
              value={watch("company_auth") ?? "cascadia"}
              onValueChange={(v) =>
                setValue("company_auth", v as CreateEmployeeInput["company_auth"])
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

          {/* Role Toggles */}
          <div>
            <Label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Roles
            </Label>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  id="add-is_foreman"
                  checked={watch("is_foreman") ?? false}
                  onCheckedChange={(checked) => setValue("is_foreman", checked)}
                />
                <Label htmlFor="add-is_foreman" className="text-sm">
                  Foreman
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="add-is_driver"
                  checked={watch("is_driver") ?? false}
                  onCheckedChange={(checked) => setValue("is_driver", checked)}
                />
                <Label htmlFor="add-is_driver" className="text-sm">
                  Driver
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="add-is_office"
                  checked={watch("is_office") ?? false}
                  onCheckedChange={(checked) => setValue("is_office", checked)}
                />
                <Label htmlFor="add-is_office" className="text-sm">
                  Office
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="add-is_h2b"
                  checked={watch("is_h2b") ?? false}
                  onCheckedChange={(checked) => setValue("is_h2b", checked)}
                />
                <Label htmlFor="add-is_h2b" className="text-sm">
                  H2B
                </Label>
              </div>
            </div>
          </div>

          {/* Pay Rate */}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Rate Type</Label>
              <Select
                value={rateType ?? "hourly"}
                onValueChange={(v) =>
                  setValue("rate_type", v as CreateEmployeeInput["rate_type"])
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
              <Label htmlFor="add-rate">Hourly Rate ($)</Label>
              <Input
                id="add-rate"
                type="number"
                step="0.01"
                className="h-12 bg-background font-mono"
                placeholder="0.00"
                {...register("rate")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-daily_rate">Daily Rate ($)</Label>
              <Input
                id="add-daily_rate"
                type="number"
                step="0.01"
                className="h-12 bg-background font-mono"
                placeholder="0.00"
                {...register("daily_rate")}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
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
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Employee
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
