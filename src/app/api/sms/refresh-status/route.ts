import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkSmsDeliveryStatus } from '@/lib/sms/provider'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { logId } = await req.json() as { logId: string }
  if (!logId) return NextResponse.json({ error: 'logId required' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch the log entry — verify it belongs to the caller's school
  const { data: me } = await supabase.from('users').select('school_id').eq('id', user.id).single()
  const { data: log } = await admin
    .from('sms_logs')
    .select('id, arkesel_msg_ids, status, school_id')
    .eq('id', logId)
    .single()

  if (!log || log.school_id !== me?.school_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // If no message IDs (stub mode or old log), return current status unchanged
  if (!log.arkesel_msg_ids) {
    return NextResponse.json({ status: log.status, refreshed: false })
  }

  const msgIds = log.arkesel_msg_ids.split(',').map((s: string) => s.trim()).filter(Boolean)
  const statusMap = await checkSmsDeliveryStatus(msgIds)

  const statuses = Array.from(statusMap.values())
  let newStatus: string

  if (statuses.length === 0) {
    newStatus = log.status // no data, keep current
  } else if (statuses.every(s => s === 'delivered')) {
    newStatus = 'delivered'
  } else if (statuses.every(s => s === 'failed' || s === 'expired' || s === 'rejected')) {
    newStatus = 'failed'
  } else if (statuses.some(s => s === 'delivered') && statuses.some(s => s === 'failed' || s === 'expired')) {
    newStatus = 'partial'
  } else if (statuses.every(s => s === 'sent' || s === 'pending')) {
    newStatus = 'sent'   // still in transit
  } else {
    // Mixed (some delivered, some still in transit)
    newStatus = statuses.some(s => s === 'delivered') ? 'partial' : 'sent'
  }

  // Persist the updated status
  await admin.from('sms_logs').update({ status: newStatus }).eq('id', logId)

  return NextResponse.json({ status: newStatus, refreshed: true, detail: Object.fromEntries(statusMap) })
}
