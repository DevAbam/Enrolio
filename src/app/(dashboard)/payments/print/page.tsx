'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

type PaymentWithStudent = {
  id: string
  payment_date: string
  amount_paid: number
  payment_method: string | null
  receipt_number: string | null
  notes: string | null
  students?: { full_name: string; classes?: { name: string } | null } | null
}

function PrintContent() {
  const searchParams = useSearchParams()
  const [payments,   setPayments]   = useState<PaymentWithStudent[]>([])
  const [schoolName, setSchoolName] = useState('')
  const [termLabel,  setTermLabel]  = useState('')
  const [loading,    setLoading]    = useState(true)
  const supabase = createClient()

  const from   = searchParams.get('from') ?? ''
  const to     = searchParams.get('to') ?? ''
  const termId = searchParams.get('term') ?? ''
  const q      = searchParams.get('q') ?? ''

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: me } = await supabase.from('users').select('school_id').eq('id', user.id).single()
    const { data: school } = await supabase.from('schools').select('name').eq('id', me!.school_id).single()
    setSchoolName((school as { name: string })?.name ?? '')

    if (termId) {
      const { data: term } = await supabase.from('academic_terms').select('label').eq('id', termId).single()
      setTermLabel((term as { label: string })?.label ?? '')
    }

    let query = supabase
      .from('payments')
      .select('*, students(full_name, classes(name))')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (from)   query = query.gte('payment_date', from)
    if (to)     query = query.lte('payment_date', to)
    if (termId) query = query.eq('term_id', termId)

    const { data } = await query
    let results = (data ?? []) as PaymentWithStudent[]
    if (q) {
      results = results.filter(p =>
        p.students?.full_name?.toLowerCase().includes(q.toLowerCase()) ||
        (p.receipt_number ?? '').toLowerCase().includes(q.toLowerCase())
      )
    }
    setPayments(results)
    setLoading(false)
  }, [supabase, from, to, termId, q])

  useEffect(() => {
    load().then(() => {
      setTimeout(() => {
        window.print()
        window.onafterprint = () => window.close()
      }, 500)
    })
  }, [load])

  if (loading) return <div className="p-8 text-center text-gray-500">Loading receipts…</div>

  return (
    <div className="p-4 font-sans text-sm text-gray-900">
      <style>{`
        @page { size: 80mm auto; margin: 6mm; }
        @media print {
          .no-print { display: none !important; }
          .receipt { page-break-inside: avoid; break-inside: avoid; }
        }
        body { background: white; }
      `}</style>

      <div className="no-print mb-4 text-center">
        <p className="text-gray-500 text-xs">Print dialog will open automatically. This window will close after printing.</p>
        <button
          className="mt-2 px-4 py-2 bg-gray-800 text-white rounded text-sm"
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-[720px] mx-auto print:grid-cols-2">
        {payments.map((p) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const className = (p.students?.classes as any)?.name as string | undefined
          return (
            <div
              key={p.id}
              className="receipt border border-gray-300 rounded p-3 text-xs"
            >
              <div className="text-center border-b border-gray-200 pb-2 mb-2">
                <p className="font-bold text-sm">{schoolName}</p>
                <p className="text-gray-500 uppercase tracking-wide text-[10px]">Official Receipt</p>
              </div>
              <dl className="space-y-1">
                {p.receipt_number && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Receipt No.</dt>
                    <dd className="font-mono font-medium">{p.receipt_number}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Date</dt>
                  <dd>{formatDate(p.payment_date)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Student</dt>
                  <dd className="font-medium text-right max-w-[55%] truncate">{p.students?.full_name ?? '—'}</dd>
                </div>
                {className && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Class</dt>
                    <dd>{className}</dd>
                  </div>
                )}
                {termLabel && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Term</dt>
                    <dd>{termLabel}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Method</dt>
                  <dd className="capitalize">{p.payment_method?.replace('_', ' ') ?? '—'}</dd>
                </div>
                {p.notes && (
                  <div>
                    <dt className="text-gray-500">Notes</dt>
                    <dd className="break-words whitespace-pre-wrap mt-0.5">{p.notes}</dd>
                  </div>
                )}
              </dl>
              <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between items-center">
                <span className="text-gray-500 font-medium">Amount Paid</span>
                <span className="text-base font-bold">{formatCurrency(Number(p.amount_paid))}</span>
              </div>
            </div>
          )
        })}
      </div>

      {payments.length === 0 && (
        <p className="text-center text-gray-500 py-12">No payments found for the selected filters.</p>
      )}

      <div className="no-print mt-4 text-center text-xs text-gray-400">
        {payments.length} receipt{payments.length !== 1 ? 's' : ''} — Total: {formatCurrency(payments.reduce((s, p) => s + Number(p.amount_paid), 0))}
      </div>
    </div>
  )
}

export default function PaymentsPrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <PrintContent />
    </Suspense>
  )
}
