import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

/**
 * POST /api/admin/set-password
 * Admin-only: manually sets a password for an employee's auth user.
 * Body: { employeeId: string, password: string }
 *
 * Uses the service role key to call auth.admin.updateUserById().
 * The employee must have a linked user_id (Supabase Auth user).
 */
export async function POST(req: NextRequest) {
  try {
    const { employeeId, password } = await req.json()

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Verify the caller is an admin by checking their session
    const userClient = await createClient()
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check caller is admin in the employees table
    const adminClient = createAdminClient()
    const { data: callerEmployee } = await adminClient
      .from('employees')
      .select('role')
      .eq('user_id', caller.id)
      .single()

    if (!callerEmployee || callerEmployee.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Look up the employee to get their auth user_id
    const { data: employee, error: empError } = await adminClient
      .from('employees')
      .select('id, first_name, last_name, user_id')
      .eq('id', employeeId)
      .single()

    if (empError || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (!employee.user_id) {
      return NextResponse.json(
        { error: `${employee.first_name} ${employee.last_name} has no linked auth account. Create their auth user first.` },
        { status: 400 },
      )
    }

    // Set the password using admin API
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      employee.user_id,
      { password },
    )

    if (updateError) {
      console.error('Admin set-password error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin set-password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
