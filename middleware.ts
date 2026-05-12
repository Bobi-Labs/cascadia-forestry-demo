import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { IS_DEMO_MODE } from '@/lib/demo-mode'

export async function middleware(request: NextRequest) {
  // Demo mode skips Supabase session validation entirely. There is no
  // auth in the demo, no login redirect, no protected routes. Every
  // request passes through as the synthetic admin user that
  // auth-context.tsx injects on the client.
  if (IS_DEMO_MODE) {
    return NextResponse.next()
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     * - public folder assets (images, svgs, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|swe-worker-.+\\.js|workbox-.+\\.js|manifest\\.webmanifest|~offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
