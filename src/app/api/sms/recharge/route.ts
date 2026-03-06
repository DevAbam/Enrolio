import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Arkesel tiers (credits) → SchoolOps charge (pesewas = GHS × 100)
// Markup increases by GHS 5 each tier to earn a margin
const PACKAGES: Record<number, number> = {
  645:    2500,    // Arkesel GHS 20  → charge GHS 25
  1667:   6000,    // Arkesel GHS 50  → charge GHS 60
  3448:   11500,   // Arkesel GHS 100 → charge GHS 115
  7143:   22000,   // Arkesel GHS 200 → charge GHS 220
  18519:  52500,   // Arkesel GHS 500 → charge GHS 525
  38462:  103000,  // Arkesel GHS 1,000 → charge GHS 1,030
  80000:  203500,  // Arkesel GHS 2,000 → charge GHS 2,035
  208333: 504000,  // Arkesel GHS 5,000 → charge GHS 5,040
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users').select('school_id, role').eq('id', user.id).single()
  if (!me)             return NextResponse.json({ error: 'Forbidden' },   { status: 403 })
  if (me.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { credits } = await req.json() as { credits: number }
  const amountPesewas = PACKAGES[credits]
  if (!amountPesewas)
    return NextResponse.json({ error: 'Invalid credit package' }, { status: 400 })

  const admin = createAdminClient()

  // Get school email for Paystack
  const { data: school } = await admin
    .from('schools').select('email, name').eq('id', me.school_id).single()
  const email = school?.email ?? user.email ?? 'noreply@schoolops.app'

  // Unique reference — includes school prefix for easier auditing
  const reference = `SMS-${me.school_id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  // Create pending row BEFORE calling Paystack (prevents ghost transactions)
  const { error: insertErr } = await admin.from('sms_credit_purchases').insert({
    school_id:          me.school_id,
    paystack_reference: reference,
    credits_purchased:  credits,
    amount_pesewas:     amountPesewas,
    status:             'pending',
    initiated_by:       user.id,
  })
  if (insertErr)
    return NextResponse.json({ error: 'Could not create purchase record' }, { status: 500 })

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const callbackUrl = `${appUrl}/sms?paystack_ref=${encodeURIComponent(reference)}&status=success`

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount:       amountPesewas,
      reference,
      callback_url: callbackUrl,
      metadata: {
        school_id:   me.school_id,
        school_name: school?.name ?? '',
        credits,
        user_id:     user.id,
      },
    }),
  })

  if (!paystackRes.ok) {
    // Mark as failed so it doesn't linger as pending
    await admin
      .from('sms_credit_purchases')
      .update({ status: 'failed' })
      .eq('paystack_reference', reference)
    return NextResponse.json({ error: 'Payment gateway error. Please try again.' }, { status: 502 })
  }

  const paystackData = await paystackRes.json()
  return NextResponse.json({
    authorization_url: paystackData.data.authorization_url,
    reference,
  })
}
