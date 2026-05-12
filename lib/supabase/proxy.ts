import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Tracker routes handle their own auth via TrackerAuthProvider — skip middleware auth.
  // Also skip API tracker routes (webhook, chat, etc.) which handle auth internally.
  // Ops bot routes are called by Telegram webhooks — no user session.
  // Cron + ingest routes use Bearer-token auth (CRON_SECRET) inside the
  // route handler — middleware's redirect-to-login flow would short-
  // circuit Vercel Cron requests with a 307 before the route's own
  // auth check ever runs. /api/ingest was missing from this list and
  // surfaced as the daily 4am unit-ingest cron silently failing — added
  // 2026-05-13 after the role-gating test caught it.
  if (
    pathname.startsWith('/tracker') ||
    pathname.startsWith('/api/tracker') ||
    pathname.startsWith('/api/ops-bot') ||
    pathname.startsWith('/api/drive') ||
    pathname.startsWith('/api/expenses') ||
    pathname.startsWith('/api/tests') ||
    pathname.startsWith('/api/ingest') ||
    pathname.startsWith('/api/units')
  ) {
    return supabaseResponse
  }

  // Offline fallback page — no auth required (must be accessible when offline)
  if (pathname.startsWith('/~offline')) {
    return supabaseResponse
  }

  // Public routes — no auth required
  const isPublicRoute = pathname.startsWith('/auth/')

  // Authenticated user hitting login page → redirect to dashboard
  if (isPublicRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    const redirectResponse = NextResponse.redirect(url)
    // Carry over any refreshed session cookies from supabaseResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // Unauthenticated user hitting protected route → redirect to login
  if (!isPublicRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    const redirectResponse = NextResponse.redirect(url)
    // Carry over any cookie changes (e.g., cleared expired tokens)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  return supabaseResponse
}
