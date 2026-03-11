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

type StudentOption = { id: string; full_name: string; class_name?: string | null; outstanding?: number }

export default function PaymentsPage() {
  const { schoolName, schoolLogoUrl, schoolAddress, schoolPhone, schoolEmail, isAdmin } = useRole()
  const { activeTerm, allTerms, selectedTerm } = useTerm()
  const [payments, setPayments] = useState<PaymentWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(today())
  const [dateExact, setDateExact] = useState('')
  const [termFilter, setTermFilter] = useState(selectedTerm?.id ?? '')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [receiptPayment, setReceiptPayment] = useState<{ payment: PaymentWithStudent; studentName: string; className?: string } | null>(null)
  const [payModal, setPayModal] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<StudentOption[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null)
  const [studentSearching, setStudentSearching] = useState(false)
  const [recordedCount, setRecordedCount] = useState(0)
  const [lastRecorded, setLastRecorded] = useState<string | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('payments')
      .select('*, students(full_name, classes(name))', { count: 'exact' })
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (dateExact) {
      query = query.eq('payment_date', dateExact)
    } else {
      if (dateFrom) query = query.gte('payment_date', dateFrom)
      if (dateTo) query = query.lte('payment_date', dateTo)
    }
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
  }, [supabase, page, dateFrom, dateTo, dateExact, search, termFilter])

  useEffect(() => { load() }, [load])

  // Sync term filter when global selected term changes
  useEffect(() => {
    setTermFilter(selectedTerm?.id ?? '')
    setPage(1)
  }, [selectedTerm?.id])

  useEffect(() => {
    if (!payModal) {
      setStudentSearch(''); setStudentResults([]); setSelectedStudent(null)
      setRecordedCount(0); setLastRecorded(null)
    }
  }, [payModal])

  useEffect(() => {
    if (!studentSearch.trim()) { setStudentResults([]); return }
    setStudentSearching(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('student_fee_summary')
        .select('id, full_name, class_name, outstanding')
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

    const fmtCur = (n: number) => `GHS ${n.toFixed(2)}`
    const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const grandTotal = results.reduce((s, p) => s + Number(p.amount_paid), 0)

    const logoHtml = schoolLogoUrl
      ? `<img src="${schoolLogoUrl}" alt="${schoolName ?? ''}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:1px solid #e2e8f0;" />`
      : `<div style="width:48px;height:48px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;margin:0 auto;">${(schoolName ?? 'S').charAt(0).toUpperCase()}</div>`

    const schoolMeta = [schoolAddress, [schoolPhone, schoolEmail].filter(Boolean).join(' · ')].filter(Boolean)
      .map(line => `<p style="margin:0;line-height:1.4;">${line}</p>`).join('')

    const cards = results.map(p => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cls = (p.students?.classes as any)?.name ?? ''
      const pTermLabel = allTerms.find(t => t.id === p.term_id)?.label ?? ''
      const balAfter = p.balance_after != null ? Number(p.balance_after) : null
      const balHtml = balAfter != null
        ? `<div class="row"><span class="lbl">Balance Remaining</span><span style="font-weight:700;color:${balAfter > 0 ? '#dc2626' : '#16a34a'}">${balAfter > 0 ? fmtCur(balAfter) : 'Fully Paid'}</span></div>`
        : ''
      return `<div class="receipt">
        <div class="r-header">
          <div style="text-align:center;margin-bottom:8px;">${logoHtml}</div>
          <p style="margin:2px 0;font-size:13px;font-weight:700;">${schoolName ?? 'School'}</p>
          ${schoolMeta ? `<div style="font-size:9px;color:#64748b;margin-top:2px;line-height:1.4;">${schoolMeta}</div>` : ''}
          <p style="margin:4px 0 0;font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;">Official Receipt</p>
        </div>
        <div class="sep-dashed"></div>
        <div class="row"><span class="lbl">Receipt No.</span><span class="val">${p.receipt_number ?? '—'}</span></div>
        <div class="row"><span class="lbl">Date</span><span class="val">${fmtDate(p.payment_date)}</span></div>
        <div class="sep-solid"></div>
        <div class="row"><span class="lbl">Student</span><span class="val">${p.students?.full_name ?? '—'}</span></div>
        ${cls ? `<div class="row"><span class="lbl">Class</span><span class="val">${cls}</span></div>` : ''}
        ${pTermLabel ? `<div class="row"><span class="lbl">Term</span><span class="val">${pTermLabel}</span></div>` : ''}
        <div class="sep-solid"></div>
        <div class="row amount-row"><span style="font-size:12px;color:#64748b;">Amount Paid</span><span style="font-size:18px;font-weight:700;color:#2563eb;">${fmtCur(Number(p.amount_paid))}</span></div>
        ${balHtml}
        ${p.payment_method ? `<div class="row"><span class="lbl">Method</span><span class="val" style="text-transform:capitalize;">${p.payment_method.replace('_', ' ')}</span></div>` : ''}
        ${p.notes ? `<div style="margin-top:4px;"><p class="lbl" style="margin-bottom:2px;">Notes</p><p style="margin:0;color:#0f172a;word-break:break-word;">${p.notes}</p></div>` : ''}
        <div class="sep-dashed"></div>
        <p style="text-align:center;font-size:9px;color:#94a3b8;margin:0;">Thank you for your payment</p>
      </div>`
    }).join('')

    const printContent = `<div style="font-family:sans-serif;font-size:11px;color:#0f172a;">
<div style="display:flex;flex-direction:column;align-items:center;gap:12px;max-width:320px;margin:0 auto;">${cards}</div>
${results.length === 0 ? '<p style="text-align:center;color:#999;padding:40px">No payments found.</p>' : ''}
<div style="text-align:center;font-size:11px;color:#555;margin-top:12px;">${results.length} receipt${results.length !== 1 ? 's' : ''} — Total: ${fmtCur(grandTotal)}</div>
</div>`

    const style = document.createElement('style')
    style.id = '__print-all-style__'
    style.textContent = `
      @media print {
        body > *:not(#__print-all-receipts__) { display: none !important; }
        #__print-all-receipts__ { display: block !important; }
        @page { size: 80mm auto; margin: 6mm; }
      }
      #__print-all-receipts__ .receipt { border:1px solid #e2e8f0;border-radius:8px;padding:16px;page-break-inside:avoid;break-inside:avoid;width:100%;box-sizing:border-box; }
      #__print-all-receipts__ .r-header { text-align:center;margin-bottom:0; }
      #__print-all-receipts__ .sep-dashed { border-top:2px dashed #e2e8f0;margin:12px 0; }
      #__print-all-receipts__ .sep-solid { border-top:1px solid #e2e8f0;margin:8px 0; }
      #__print-all-receipts__ .row { display:flex;justify-content:space-between;align-items:center;margin:4px 0;font-size:11px; }
      #__print-all-receipts__ .lbl { color:#64748b; }
      #__print-all-receipts__ .val { font-weight:600;text-align:right;max-width:55%;word-break:break-word; }
      #__print-all-receipts__ .amount-row { margin-bottom:4px; }
    `
    document.head.appendChild(style)

    const div = document.createElement('div')
    div.id = '__print-all-receipts__'
    div.style.display = 'none'
    div.innerHTML = printContent
    document.body.appendChild(div)

    window.print()

    window.addEventListener('afterprint', function cleanup() {
      document.getElementById('__print-all-receipts__')?.remove()
      document.getElementById('__print-all-style__')?.remove()
      window.removeEventListener('afterprint', cleanup)
    }, { once: true })
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
            <input type="date" className="input max-w-[140px]" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDateExact(''); setPage(1) }} />
          </div>
          <div>
            <label className="label text-xs">To</label>
            <input type="date" className="input max-w-[140px]" value={dateTo} max={today()} onChange={(e) => { setDateTo(e.target.value); setDateExact(''); setPage(1) }} />
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
          {(dateFrom || termFilter || dateExact || dateTo !== today()) && (
            <button onClick={() => { setDateFrom(''); setDateTo(today()); setTermFilter(''); setDateExact(''); setPage(1) }} className="btn-ghost flex items-center gap-1 text-sm px-3 py-2">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm text-fg">Payment History</h3>
          <input
            type="date"
            className="input text-sm max-w-[160px] py-1"
            value={dateExact}
            max={today()}
            title="Filter by specific date"
            onChange={(e) => { setDateExact(e.target.value); if (e.target.value) { setDateFrom(''); setDateTo('') } else { setDateTo(today()) } setPage(1) }}
          />
        </div>
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
        <div className="space-y-4">
          {/* Success banner after each payment */}
          {lastRecorded && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-sm text-green-800 dark:text-green-300 flex items-center gap-2">
              <span className="text-base">✓</span>
              <span>Payment recorded for <strong>{lastRecorded}</strong>. Add another or close when done.</span>
            </div>
          )}
          {recordedCount > 0 && (
            <p className="text-xs text-fg-muted">{recordedCount} payment{recordedCount !== 1 ? 's' : ''} recorded this session</p>
          )}
          {!selectedStudent ? (
            <div className="space-y-3 min-h-72">
              <div className="relative">
                <label className="label">Search Student *</label>
                <SearchInput
                  placeholder="Type name or admission number…"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  autoFocus={!lastRecorded}
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
              <div className="flex justify-end pt-2">
                <button className="btn-ghost text-sm" onClick={() => setPayModal(false)}>Close</button>
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
                outstanding={selectedStudent.outstanding ?? 0}
                onSuccess={() => {
                  setLastRecorded(selectedStudent.full_name)
                  setRecordedCount(c => c + 1)
                  setSelectedStudent(null)
                  load()
                }}
                onCancel={() => { setPayModal(false); setSelectedStudent(null) }}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
