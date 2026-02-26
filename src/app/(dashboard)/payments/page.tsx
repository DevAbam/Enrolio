'use client'
import { useState, useEffect, useCallback } from 'react'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { ReceiptModal } from '@/components/receipts/ReceiptModal'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate, today } from '@/lib/utils/date'
import type { Payment } from '@/types'

const PAGE_SIZE = 20

interface PaymentWithStudent extends Payment {
  students?: { full_name: string; classes?: { name: string } | null } | null
}

export default function PaymentsPage() {
  const { schoolName } = useRole()
  const [payments,       setPayments]       = useState<PaymentWithStudent[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState(today())
  const [page,           setPage]           = useState(1)
  const [total,          setTotal]          = useState(0)
  const [receiptPayment, setReceiptPayment] = useState<{ payment: PaymentWithStudent; studentName: string; className?: string } | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('payments')
      .select('*, students(full_name, classes(name))', { count: 'exact' })
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (dateFrom) query = query.gte('payment_date', dateFrom)
    if (dateTo)   query = query.lte('payment_date', dateTo)

    const { data, count, error } = await query
    if (error) toast.error(error.message)
    else {
      let results = (data ?? []) as PaymentWithStudent[]
      if (search) {
        results = results.filter((p) =>
          p.students?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          (p.receipt_number ?? '').toLowerCase().includes(search.toLowerCase())
        )
      }
      setPayments(results)
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [supabase, page, dateFrom, dateTo, search])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="All recorded fee payments" />

      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[180px]">
          <SearchInput placeholder="Search student or receipt no." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="flex gap-2 items-center">
          <div>
            <label className="label text-xs">From</label>
            <input type="date" className="input max-w-[140px]" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} />
          </div>
          <div>
            <label className="label text-xs">To</label>
            <input type="date" className="input max-w-[140px]" value={dateTo} max={today()} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Receipt No.</th>
              <th>Notes</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={8} cols={7} />
            ) : payments.length === 0 ? (
              <tr><td colSpan={7}>
                <EmptyState icon={<span>💳</span>} title="No payments found" description="Payments appear here after recording them on student pages" />
              </td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td className="text-sm">{formatDate(p.payment_date)}</td>
                  <td className="font-medium">{p.students?.full_name ?? '—'}</td>
                  <td className="font-medium text-green-700 dark:text-green-400">{formatCurrency(Number(p.amount_paid))}</td>
                  <td className="capitalize text-gray-500 text-sm">{p.payment_method?.replace('_', ' ') ?? '—'}</td>
                  <td className="text-gray-500 text-xs">{p.receipt_number ?? '—'}</td>
                  <td className="text-gray-500 text-sm max-w-xs truncate">{p.notes ?? '—'}</td>
                  <td>
                    <button
                      className="btn-ghost p-1.5 rounded"
                      title="View Receipt"
                      onClick={() => setReceiptPayment({
                        payment: p,
                        studentName: p.students?.full_name ?? 'Unknown',
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        className: (p.students?.classes as any)?.name ?? undefined,
                      })}
                    >
                      <Printer size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {receiptPayment && (
        <ReceiptModal
          payment={receiptPayment.payment}
          studentName={receiptPayment.studentName}
          className={receiptPayment.className}
          schoolName={schoolName ?? 'School'}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </div>
  )
}
