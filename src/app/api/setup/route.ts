import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
  const admin = createAdminClient()

  // Guard: only allow if no schools exist
  const { count, error: countErr } = await admin.from('schools').select('id', { count: 'exact', head: true })
  if (countErr) return NextResponse.json({ error: 'DB connection failed: ' + countErr.message }, { status: 500 })
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'School already set up. Please sign in.' }, { status: 403 })
  }

  const { schoolName, adminName, email, password } = await req.json() as {
    schoolName: string; adminName: string; email: string; password: string
  }

  if (!schoolName || !adminName || !email || !password) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  // 1. Create school
  const { data: school, error: schoolErr } = await admin
    .from('schools')
    .insert({ name: schoolName })
    .select('id')
    .single()

  if (schoolErr || !school) {
    return NextResponse.json({ error: 'Failed to create school: ' + schoolErr?.message }, { status: 500 })
  }

  // 2. Create auth user
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authErr || !authUser.user) {
    // Rollback school
    await admin.from('schools').delete().eq('id', school.id)
    return NextResponse.json({ error: 'Failed to create user: ' + authErr?.message }, { status: 500 })
  }

  // 3. Create user profile
  const { error: profileErr } = await admin.from('users').insert({
    id:        authUser.user.id,
    school_id: school.id,
    full_name: adminName,
    role:      'admin',
  })

  if (profileErr) {
    // Rollback
    await admin.auth.admin.deleteUser(authUser.user.id)
    await admin.from('schools').delete().eq('id', school.id)
    return NextResponse.json({ error: 'Failed to create user profile: ' + profileErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[setup] Unhandled error:', err)
    return NextResponse.json({ error: 'Unexpected error: ' + String(err) }, { status: 500 })
  }
}
