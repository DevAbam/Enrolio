import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Must use admin client — there is no Auth session in a webhook call.
// All data is trusted only after HMAC-SHA512 signature verification.

export async function POST(req: NextRequest) {
  // 1. Read raw body AS TEXT first — needed for HMAC; calling .json() consumes the stream
  const rawBody   = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''

  // 2. Verify signature
  const secret   = process.env.PAYSTACK_SECRET_KEY ?? ''
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')

  if (expected !== signature) {
    console.warn('[webhook/paystack] Invalid signature — rejected')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 3. Parse event
  const event = JSON.parse(rawBody) as {
    event: string
    data: { status: string; reference: string; amount: number }
  }

  // 4. Only handle charge.success — return 200 for all other events to silence retries
  if (event.event !== 'charge.success' || event.data.status !== 'success')
    return NextResponse.json({ received: true })

  const reference = event.data.reference
  const admin     = createAdminClient()

  // 5. Look up our purchase record (source of truth for credit amount)
  const { data: purchase } = await admin
    .from('sms_credit_purchases')
    .select('id, school_id, credits_purchased, status')
    .eq('paystack_reference', reference)
    .single()

  // Unknown reference — not our transaction; acknowledge silently
  if (!purchase) {
    console.warn(`[webhook/paystack] Unknown reference: ${reference}`)
    return NextResponse.json({ received: true })
  }

  // 6. Idempotency guard: skip if already processed
  if (purchase.status === 'success') {
    console.log(`[webhook/paystack] Already processed: ${reference}`)
    return NextResponse.json({ received: true })
  }

  // 7. Optimistic lock: only one caller (webhook vs verify route) wins
  const { count } = await admin
    .from('sms_credit_purchases')
    .update({ status: 'success', verified_at: new Date().toISOString() })
    .eq('paystack_reference', reference)
    .eq('status', 'pending')       // guard — verify route may have already run
    .select('id', { count: 'exact', head: true })

  if ((count ?? 0) === 0) {
    console.log(`[webhook/paystack] Race won by verify route: ${reference}`)
    return NextResponse.json({ received: true })
  }

  // 8. Add credits (using amount from DB, not from Paystack payload)
  await admin.rpc('add_sms_credits', {
    p_school_id: purchase.school_id,
    p_amount:    purchase.credits_purchased,
  })

  await admin.from('sms_credit_transactions').insert({
    school_id:   purchase.school_id,
    amount:      purchase.credits_purchased,
    type:        'recharge',
    description: `Paystack recharge: ${purchase.credits_purchased} credits (ref: ${reference})`,
    created_by:  null,  // no user session in webhook
  })

  console.log(`[webhook/paystack] ✓ ${purchase.credits_purchased} credits added to school ${purchase.school_id}`)
  return NextResponse.json({ received: true })
}
