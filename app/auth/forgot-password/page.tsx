"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { TreePine, Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/login`,
      })
      if (error) throw error
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reset email")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          {/* Logo / Brand */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-500/10">
              <TreePine className="h-8 w-8 text-green-500" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Cascadia Ops</h1>
            <p className="text-sm text-muted-foreground">Forestry Operations Platform</p>
          </div>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg text-card-foreground">
                {sent ? "Check your email" : "Reset password"}
              </CardTitle>
              <CardDescription>
                {sent
                  ? "We sent a password reset link to your email address."
                  : "Enter your email and we'll send you a reset link."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sent ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    If an account exists for <span className="font-medium text-foreground">{email}</span>,
                    you will receive a password reset email shortly.
                  </p>
                  <Link
                    href="/auth/login"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to sign in
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleReset}>
                  <div className="flex flex-col gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email" className="text-card-foreground">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@cascadiaforestry.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="border-input bg-background h-11"
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full h-11 bg-green-600 hover:bg-green-700 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Send reset link
                        </>
                      )}
                    </Button>
                    <Link
                      href="/auth/login"
                      className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to sign in
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
