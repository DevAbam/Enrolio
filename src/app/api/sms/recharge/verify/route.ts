import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users').select('school_id, role').eq('id', user.id).single()
  if (!me || me.role !== 'admin')
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const reference = req.nextUrl.searchParams.get('reference')
  if (!reference) return NextResponse.json({ error: 'reference is required' }, { status: 400 })

  const admin = createAdminClient()

  // Look up purchase — must belong to this school
  const { data: purchase } = await admin
    .from('sms_credit_purchases')
    .select('status, school_id, credits_purchased')
    .eq('paystack_reference', reference)
    .single()

  if (!purchase || purchase.school_id !== me.school_id)
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })

  const getCredits = async () => {
    const { data: s } = await admin.from('schools').select('sms_credits').eq('id', me.school_id).single()
    return s?.sms_credits ?? 0
  }

  // Already processed by webhook — just return current balance
  if (purchase.status === 'success')
    return NextResponse.json({ status: 'success', credits: await getCredits() })

  // Verify with Paystack
  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
  )

  if (!verifyRes.ok)
    return NextResponse.json({ status: purchase.status, credits: await getCredits() })

  const verifyData  = await verifyRes.json()
  const pstkStatus  = verifyData?.data?.status as string | undefined

  if (pstkStatus === 'success' && purchase.status === 'pending') {
    // Optimistic lock: only credit if we win the race vs. webhook
    const { count } = await admin
      .from('sms_credit_purchases')
      .update({ status: 'success', verified_at: new Date().toISOString() })
      .eq('paystack_reference', reference)
      .eq('status', 'pending')          // guard: skip if webhook already ran
      .select('id', { count: 'exact', head: true })

    if ((count ?? 0) > 0) {
      // We won the race — add credits
      await admin.rpc('add_sms_credits', {
        p_school_id: me.school_id,
        p_amount:    purchase.credits_purchased,
      })
      await admin.from('sms_credit_transactions').insert({
        school_id:   me.school_id,
        amount:      purchase.credits_purchased,
        type:        'recharge',
        description: `Paystack recharge: ${purchase.credits_purchased} credits (ref: ${reference})`,
        created_by:  user.id,
      })
    }
    // If count === 0, webhook already added credits — just return balance
    return NextResponse.json({ status: 'success', credits: await getCredits() })
  }

  if (pstkStatus === 'failed' || pstkStatus === 'abandoned') {
    await admin
      .from('sms_credit_purchases')
      .update({ status: 'failed' })
      .eq('paystack_reference', reference)
      .eq('status', 'pending')
    return NextResponse.json({ status: 'failed', credits: await getCredits() })
  }

  return NextResponse.json({ status: 'pending', credits: await getCredits() })
}
