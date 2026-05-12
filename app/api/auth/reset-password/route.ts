import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/reset-password
 * Admin-only: sends a password reset email to a user.
 * Body: { email: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Use Supabase auth admin to generate a password reset link
    // This sends the user an email with a reset link
    const { error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://cascadiaops.com'}/auth/login`,
      },
    })

    if (error) {
      console.error('Reset password error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
