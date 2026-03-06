import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { studentId, targetClassId } = await req.json() as {
    studentId: string; targetClassId: string
  }
  if (!studentId || !targetClassId) {
    return NextResponse.json({ error: 'studentId and targetClassId are required.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('students')
    .update({ class_id: targetClassId })
    .eq('id', studentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
