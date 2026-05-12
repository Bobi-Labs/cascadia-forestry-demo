import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/update-password
 * Authenticated user changes their own password.
 * Body: { newPassword: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { newPassword } = await req.json()
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error('Update password error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
