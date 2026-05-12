"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TreePine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useTrackerAuth } from "@/components/tracker/tracker-auth-provider";

export default function TrackerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { user, isLoading: authLoading } = useTrackerAuth();

  // If already logged in, redirect to tracker
  if (!authLoading && user) {
    router.replace("/tracker");
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // The TrackerAuthProvider's onAuthStateChange will pick up the SIGNED_IN event
      // and handle the redirect + profile fetch. We just need to wait a moment.
      // If it doesn't redirect within 2s, force it.
      setTimeout(() => {
        router.replace("/tracker");
      }, 2000);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20">
            <TreePine className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Work Tracker</h1>
            <p className="text-sm text-muted-foreground">
              Cascadia &amp; Ramos Forestry
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="h-11"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="h-11"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="h-11 w-full">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
