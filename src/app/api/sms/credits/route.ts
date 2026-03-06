import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/sms/credits — returns { credits: number } */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('school_id').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: school } = await admin
    .from('schools')
    .select('sms_credits')
    .eq('id', me.school_id)
    .single()

  return NextResponse.json({ credits: school?.sms_credits ?? 0 })
}

/** POST /api/sms/credits — body: { amount: number, description?: string }
 *  Admin-only: recharge the school's SMS credit balance */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users')
    .select('school_id, role')
    .eq('id', user.id)
    .single()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (me.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { amount, description } = await req.json() as { amount: number; description?: string }
  if (!amount || amount <= 0 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'Amount must be a positive integer' }, { status: 400 })
  }

  const admin = createAdminClient()

  await admin.rpc('add_sms_credits', { p_school_id: me.school_id, p_amount: amount })
  await admin.from('sms_credit_transactions').insert({
    school_id:   me.school_id,
    amount,
    type:        'recharge',
    description: description ?? `Manual recharge of ${amount} credits`,
    created_by:  user.id,
  })

  const { data: school } = await admin
    .from('schools')
    .select('sms_credits')
    .eq('id', me.school_id)
    .single()

  return NextResponse.json({ credits: school?.sms_credits ?? 0 })
}
