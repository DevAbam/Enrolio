import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSmsBatch }      from '@/lib/sms/provider'

/** Normalize Ghana phone numbers to international format (233XXXXXXXXX) */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')          // strip non-digits
  if (digits.startsWith('233')) return digits       // already international
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1)
  return digits                                     // unknown format — pass through
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('school_id, role').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    recipients: Array<{ student_id?: string; phone: string; message: string }>
    sms_type?: string
  }
  const { recipients, sms_type } = body
  if (!recipients?.length) return NextResponse.json({ error: 'No recipients' }, { status: 400 })

  const admin = createAdminClient()

  // Check SMS credit balance
  const { data: school } = await admin
    .from('schools')
    .select('sms_credits')
    .eq('id', me.school_id)
    .single()

  const currentCredits = school?.sms_credits ?? 0
  if (currentCredits < recipients.length) {
    return NextResponse.json(
      { error: 'Insufficient SMS credits', credits: currentCredits, required: recipients.length },
      { status: 402 }
    )
  }

  // Send via Arkesel
  const results = await sendSmsBatch(recipients.map((r) => ({ phone: normalizePhone(r.phone), message: r.message })))
  const successCount = results.filter((r) => r.success).length
  const failCount    = results.filter((r) => !r.success).length

  const isSingle  = recipients.length === 1
  const allFailed = successCount === 0
  // Use constraint-safe statuses until migration 35 is applied.
  // After migration 35: 'partial' and 'sent'/'delivered' become available.
  // 'success' is kept in migration 35's new constraint for backward compat.
  const status    = allFailed ? 'failed' : 'success'

  // Collect Arkesel message IDs for delivery status polling (comma-separated)
  const msgIds = results.flatMap(r => r.messageId ? [r.messageId] : [])
  const arkeselMsgIds = msgIds.length > 0 ? msgIds.join(',') : null

  // Deduct credits equal to the number actually dispatched
  if (successCount > 0) {
    await admin.rpc('deduct_sms_credits', {
      p_school_id: me.school_id,
      p_amount:    successCount,
    })
    await admin.from('sms_credit_transactions').insert({
      school_id:   me.school_id,
      amount:      -successCount,
      type:        'deduction',
      description: `${successCount} SMS sent (${sms_type ?? 'general'})`,
      created_by:  user.id,
    })
  }

  // Determine the log sms_type (guard against invalid values)
  const validTypes = ['fee_reminder', 'general', 'bulk', 'broadcast']
  const logType = validTypes.includes(sms_type ?? '') ? sms_type! : (isSingle ? 'general' : 'bulk')

  await admin.from('sms_logs').insert({
    school_id:        me.school_id,
    student_id:       isSingle ? (recipients[0].student_id ?? null) : null,
    sent_by:          user.id,
    parent_phone:     isSingle ? recipients[0].phone : `${recipients.length} recipients`,
    message:          recipients[0].message,
    sms_type:         logType,
    status,
    recipient_count:  recipients.length,
    arkesel_msg_ids:  arkeselMsgIds,
  })

  return NextResponse.json({ results, successCount, failCount })
}
