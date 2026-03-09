'use client'
import { useState, useEffect, useCallback } from 'react'
import { Printer, Plus, X, PrinterIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { useTerm } from '@/lib/term-context'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { ReceiptModal } from '@/components/receipts/ReceiptModal'
import { PaymentForm } from '@/components/payments/PaymentForm'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate, today } from '@/lib/utils/date'
import type { Payment } from '@/types'

const PAGE_SIZE = 10

interface PaymentWithStudent extends Payment {
  students?: { full_name: string; classes?: { name: string } | null } | null
}

type StudentOption = { id: string; full_name: string; class_name?: string | null }

export default function PaymentsPage() {
  const { schoolName, schoolLogoUrl, schoolAddress, schoolPhone, schoolEmail, isAdmin } = useRole()
  const { activeTerm, allTerms, selectedTerm } = useTerm()
  const [payments, setPayments] = useState<PaymentWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(today())
  const [termFilter, setTermFilter] = useState(selectedTerm?.id ?? '')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [receiptPayment, setReceiptPayment] = useState<{ payment: PaymentWithStudent; studentName: string; className?: string } | null>(null)
  const [payModal, setPayModal] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<StudentOption[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null)
  const [studentSearching, setStudentSearching] = useState(false)
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
    if (dateTo) query = query.lte('payment_date', dateTo)
    if (termFilter) query = query.eq('term_id', termFilter)

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
  }, [supabase, page, dateFrom, dateTo, search, termFilter])

  useEffect(() => { load() }, [load])

  // Sync term filter when global selected term changes
  useEffect(() => {
    setTermFilter(selectedTerm?.id ?? '')
    setPage(1)
  }, [selectedTerm?.id])

  useEffect(() => {
    if (!payModal) { setStudentSearch(''); setStudentResults([]); setSelectedStudent(null) }
  }, [payModal])

  useEffect(() => {
    if (!studentSearch.trim()) { setStudentResults([]); return }
    setStudentSearching(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('student_fee_summary')
        .select('id, full_name, class_name')
        .eq('is_active', true)
        .or(`full_name.ilike.%${studentSearch}%,admission_number.ilike.%${studentSearch}%`)
        .order('full_name')
        .limit(8)
      setStudentResults((data ?? []) as StudentOption[])
      setStudentSearching(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [studentSearch, supabase])

  async function printAll() {
    let query = supabase
      .from('payments')
      .select('*, students(full_name, classes(name))')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (dateFrom) query = query.gte('payment_date', dateFrom)
    if (dateTo) query = query.lte('payment_date', dateTo)
    if (termFilter) query = query.eq('term_id', termFilter)
    const { data } = await query
    let results = (data ?? []) as PaymentWithStudent[]
    if (search) results = results.filter(p =>
      p.students?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      (p.receipt_number ?? '').toLowerCase().includes(search.toLowerCase())
    )

    const termLabel = allTerms.find(t => t.id === termFilter)?.label ?? ''
    const fmtCur = (n: number) => `GHS ${n.toFixed(2)}`
    const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const total = results.reduce((s, p) => s + Number(p.amount_paid), 0)

    const cards = results.map(p => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cls = (p.students?.classes as any)?.name ?? ''
      return `<div class="receipt">
        <div class="receipt-header"><b>${schoolName ?? 'School'}</b><br/><span>Official Receipt</span></div>
        <dl>
          ${p.receipt_number ? `<div><dt>Receipt No.</dt><dd>${p.receipt_number}</dd></div>` : ''}
          <div><dt>Date</dt><dd>${fmtDate(p.payment_date)}</dd></div>
          <div><dt>Student</dt><dd>${p.students?.full_name ?? '—'}</dd></div>
          ${cls ? `<div><dt>Class</dt><dd>${cls}</dd></div>` : ''}
          ${termLabel ? `<div><dt>Term</dt><dd>${termLabel}</dd></div>` : ''}
          <div><dt>Method</dt><dd style="text-transform:capitalize">${(p.payment_method ?? '—').replace('_', ' ')}</dd></div>
          ${p.notes ? `<div class="notes-row"><dt>Notes</dt><dd>${p.notes}</dd></div>` : ''}
        </dl>
        <div class="amount"><span>Amount Paid</span><b>${fmtCur(Number(p.amount_paid))}</b></div>
      </div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page{size:auto;margin:8mm}
  body{font-family:sans-serif;font-size:11px;color:#111;background:#fff}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:720px;margin:0 auto}
  .receipt{border:1px solid #ccc;border-radius:6px;padding:10px;page-break-inside:avoid;break-inside:avoid}
  .receipt-header{text-align:center;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:6px}
  .receipt-header b{font-size:13px}
  .receipt-header span{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#888}
  dl div{display:flex;justify-content:space-between;margin:3px 0}
  dl dt{color:#888}
  dl dd{font-weight:500;text-align:right;max-width:55%;word-break:break-word}
  .notes-row{flex-direction:column !important}
  .notes-row dt{color:#888;margin-bottom:2px}
  .notes-row dd{text-align:left !important;max-width:100% !important;word-break:break-word}
  .amount{display:flex;justify-content:space-between;border-top:1px solid #ccc;margin-top:6px;padding-top:6px}
  .amount b{font-size:14px}
  .summary{text-align:center;font-size:11px;color:#555;margin-top:10px}
</style></head>
<body>
<div class="grid">${cards}</div>
${results.length === 0 ? '<p style="text-align:center;color:#999;padding:40px">No payments found.</p>' : ''}
<div class="summary">${results.length} receipt${results.length !== 1 ? 's' : ''} — Total: ${fmtCur(total)}</div>
</body></html>`

    const w = window.open('', '_blank', 'width=900,height=600')
    if (!w) { toast.error('Popup blocked — allow popups and try again'); return }
    w.document.write(html)
    w.document.close()
    w.onload = () => {
      w.print()
      w.onafterprint = () => w.close()
    }
  }

  function openReceipt(p: PaymentWithStudent) {
    setReceiptPayment({
      payment: p,
      studentName: p.students?.full_name ?? 'Unknown',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      className: (p.students?.classes as any)?.name ?? undefined,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="All recorded fee payments"
        action={isAdmin ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<PrinterIcon size={16} />} onClick={printAll}>Print All</Button>
            <Button icon={<Plus size={16} />} onClick={() => setPayModal(true)}>Record Payment</Button>
          </div>
        ) : undefined}
      />

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <SearchInput placeholder="Search student or receipt no." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="label text-xs">From</label>
            <input type="date" className="input max-w-[140px]" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} />
          </div>
          <div>
            <label className="label text-xs">To</label>
            <input type="date" className="input max-w-[140px]" value={dateTo} max={today()} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} />
          </div>
          {allTerms.length > 0 && (
            <div>
              <label className="label text-xs">Term</label>
              <select className="input max-w-[160px]" value={termFilter} onChange={(e) => { setTermFilter(e.target.value); setPage(1) }}>
                <option value="">All Terms</option>
                {allTerms.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          )}
          {(dateFrom || termFilter) && (
            <button onClick={() => { setDateFrom(''); setTermFilter(''); setPage(1) }} className="btn-ghost flex items-center gap-1 text-sm px-3 py-2">
              <X size={14} /> Clear
            </button>
          )}
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
                <EmptyState
                  //  icon={<span>💳</span>} 
                  title="No payments found" description="Payments appear here after recording them on student pages" />
              </td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td className="text-sm">{formatDate(p.payment_date)}</td>
                  <td className="font-medium">{p.students?.full_name ?? '—'}</td>
                  <td className="font-medium text-accent-fg">{formatCurrency(Number(p.amount_paid))}</td>
                  <td className="capitalize text-fg-muted text-sm">{p.payment_method?.replace('_', ' ') ?? '—'}</td>
                  <td className="text-fg-muted text-xs">{p.receipt_number ?? '—'}</td>
                  <td
                    className="text-fg-muted text-sm max-w-[200px] truncate"
                    title={p.notes ?? ''}
                  >
                    {p.notes ? (p.notes.length > 65 ? p.notes.slice(0, 65) + '…' : p.notes) : '—'}
                  </td>
                  <td>
                    <button
                      className="btn-ghost p-1.5 rounded"
                      title="View Receipt"
                      onClick={() => openReceipt(p)}
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
          schoolLogoUrl={schoolLogoUrl ?? undefined}
          schoolName={schoolName ?? 'School'}
          schoolAddress={schoolAddress ?? undefined}
          schoolPhone={schoolPhone ?? undefined}
          schoolEmail={schoolEmail ?? undefined}
          termLabel={allTerms.find(t => t.id === receiptPayment.payment.term_id)?.label}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {/* Record Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Payment">
        {!selectedStudent ? (
          <div className="space-y-3 min-h-96">
            <div className="relative">
              <label className="label">Search Student *</label>
              <SearchInput
                placeholder="Type name or admission number…"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                autoFocus
              />
              {(studentResults.length > 0 || studentSearching) && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                  {studentSearching && <p className="px-4 py-3 text-sm text-fg-muted">Searching…</p>}
                  {studentResults.map(s => (
                    <button
                      key={s.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-alt border-b border-border last:border-b-0"
                      onClick={() => { setSelectedStudent(s); setStudentSearch(''); setStudentResults([]) }}
                    >
                      <span className="font-medium text-sm text-fg">{s.full_name}</span>
                      {s.class_name && <span className="text-xs text-fg-muted ml-2">· {s.class_name}</span>}
                    </button>
                  ))}
                  {!studentSearching && studentSearch && studentResults.length === 0 && (
                    <p className="px-4 py-3 text-sm text-fg-muted">No students found</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-surface-alt rounded-lg border border-border">
              <div>
                <p className="font-medium text-sm text-fg">{selectedStudent.full_name}</p>
                {selectedStudent.class_name && <p className="text-xs text-fg-muted">{selectedStudent.class_name}</p>}
              </div>
              <button className="text-fg-muted hover:text-fg text-xs" onClick={() => setSelectedStudent(null)}>✕ Change</button>
            </div>
            <PaymentForm
              studentId={selectedStudent.id}
              outstanding={0}
              onSuccess={() => { setPayModal(false); setSelectedStudent(null); load() }}
              onCancel={() => { setPayModal(false); setSelectedStudent(null) }}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
