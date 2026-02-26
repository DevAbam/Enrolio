import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms }           from '@/lib/sms/provider'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('school_id').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { recipients } = await req.json() as {
    recipients: Array<{ student_id?: string; phone: string; message: string }>
  }
  if (!recipients?.length) return NextResponse.json({ error: 'No recipients' }, { status: 400 })

  const admin = createAdminClient()
  const results: Array<{ phone: string; success: boolean }> = []

  for (const r of recipients) {
    const result = await sendSms(r.phone, r.message)
    await admin.from('sms_logs').insert({
      school_id:         me.school_id,
      student_id:        r.student_id ?? null,
      sent_by:           user.id,
      parent_phone:      r.phone,
      message:           r.message,
      sms_type:          recipients.length === 1 ? 'fee_reminder' : 'bulk',
      status:            result.success ? 'success' : 'failed',
      provider_response: result.providerResponse,
    })
    results.push({ phone: r.phone, success: result.success })
  }

  return NextResponse.json({
    results,
    successCount: results.filter((r) => r.success).length,
    failCount:    results.filter((r) => !r.success).length,
  })
}
