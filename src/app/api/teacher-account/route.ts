import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // Auth check — must be admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role, school_id').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { teacherId, email, password, fullName, classId } = await req.json() as {
    teacherId: string; email: string; password: string; fullName: string; classId?: string
  }
  if (!teacherId || !email || !password || !fullName) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check teacher doesn't already have a login
  const { data: teacher } = await admin.from('teachers').select('user_id').eq('id', teacherId).single()
  if (teacher?.user_id) {
    return NextResponse.json({ error: 'This teacher already has a login account.' }, { status: 409 })
  }

  // 1. Create auth user
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authErr || !authUser.user) {
    return NextResponse.json({ error: 'Failed to create account: ' + authErr?.message }, { status: 500 })
  }

  // 2. Create users profile row
  const { error: profileErr } = await admin.from('users').insert({
    id:        authUser.user.id,
    school_id: me!.school_id,
    full_name: fullName,
    role:      'teacher',
  })
  if (profileErr) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: 'Failed to create profile: ' + profileErr.message }, { status: 500 })
  }

  // 3. Link teacher row → user + assign class
  const update: Record<string, string> = { user_id: authUser.user.id }
  if (classId) update.class_id = classId

  const { error: linkErr } = await admin.from('teachers').update(update).eq('id', teacherId)
  if (linkErr) {
    return NextResponse.json({ error: 'Account created but failed to link: ' + linkErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
