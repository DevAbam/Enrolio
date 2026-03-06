import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { teacherId, userId, newPassword } = await req.json() as {
    teacherId: string; userId: string; newPassword: string
  }
  if (!teacherId || !userId || !newPassword) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) {
    return NextResponse.json({ error: 'Failed to update password: ' + error.message }, { status: 500 })
  }

  // Store temp password for reference on teacher detail page
  await admin.from('teachers').update({ temp_password: newPassword }).eq('id', teacherId)

  return NextResponse.json({ success: true })
}
