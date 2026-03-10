import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role, school_id').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { studentId, targetClassId, direction } = await req.json() as {
    studentId: string; targetClassId: string; direction?: 'up' | 'down'
  }
  if (!studentId || !targetClassId) {
    return NextResponse.json({ error: 'studentId and targetClassId are required.' }, { status: 400 })
  }

  // Fetch student's current class + school_id + active term for history log
  const [{ data: student }, { data: targetClass }, { data: activeTerm }] = await Promise.all([
    supabase.from('students').select('class_id, school_id, classes(name)').eq('id', studentId).single(),
    supabase.from('classes').select('name').eq('id', targetClassId).single(),
    supabase.from('academic_terms').select('id, label').eq('school_id', me.school_id!).eq('is_active', true).maybeSingle(),
  ])

  const { error } = await supabase.rpc('promote_students', {
    p_student_ids:     [studentId],
    p_target_class_id: targetClassId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log the class movement
  if (student && me.school_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromClassName = (student.classes as any)?.name ?? null
    await supabase.from('student_class_history').insert({
      school_id:       me.school_id,
      student_id:      studentId,
      from_class_id:   student.class_id ?? null,
      from_class_name: fromClassName,
      to_class_id:     targetClassId,
      to_class_name:   targetClass?.name ?? null,
      action:          direction === 'down' ? 'demoted' : 'promoted',
      term_id:         activeTerm?.id ?? null,
      term_label:      activeTerm?.label ?? null,
      changed_by:      user.id,
    })
  }

  return NextResponse.json({ success: true })
}
