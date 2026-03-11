'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, History, CheckCircle, AlertCircle, DollarSign, TrendingUp, Printer, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { useTerm } from '@/lib/term-context'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate, today } from '@/lib/utils/date'
import { cn } from '@/lib/utils/cn'
import type { Teacher, TeacherSalaryPayment } from '@/types'

type StaffType = 'teaching' | 'non_teaching'

// ── Schema ─────────────────────────────────────────────────────────────────────
const paySchema = z.object({
  amount_paid: z.coerce.number().positive('Amount must be positive'),
  payment_date: z.string().min(1),
  period_label: z.string().min(1, 'Period is required'),
  payment_method: z.enum(['cash', 'bank_transfer', 'mobile_money', 'cheque']),
  notes: z.string().optional(),
})
type PayForm = z.infer<typeof paySchema>

// ── Types ──────────────────────────────────────────────────────────────────────
interface TeacherRow extends Teacher {
  termSalary: number        // from teacher_term_salaries for the selected term
  paidThisPeriod: number
  outstandingThisPeriod: number
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TeacherSalariesPage() {
  const { isAdmin, schoolName: ctxSchoolName, schoolLogoUrl } = useRole()
  const { allTerms } = useTerm()
  const supabase = createClient()

  const now = new Date()
  const currentYear = now.getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  // Derive year/term options from allTerms
  const termYears = Array.from(new Set(allTerms.map(t => t.year))).sort((a, b) => b - a)
  const availableYears = termYears.length > 0 ? termYears : years

  const [staffType, setStaffType] = useState<StaffType>('teaching')
  const [selYear, setSelYear] = useState(currentYear)
  const [selTermId, setSelTermId] = useState('')
  const [nameSearch, setNameSearch] = useState('')

  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [loading, setLoading] = useState(true)

  const [payModal, setPayModal] = useState<TeacherRow | null>(null)
  const [historyModal, setHistoryModal] = useState<{ teacher: TeacherRow; payments: TeacherSalaryPayment[] } | null>(null)
  const [histLoading, setHistLoading] = useState(false)

  // Keep selected term in sync with year
  const termsInYear = allTerms.filter(t => t.year === selYear)

  useEffect(() => {
    if (termsInYear.length > 0 && !termsInYear.find(t => t.id === selTermId)) {
      // Pick active term in year, else first
      const active = termsInYear.find(t => t.is_active)
      setSelTermId((active ?? termsInYear[0]).id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selYear, allTerms])

  const load = useCallback(async () => {
    if (!selTermId) return
    setLoading(true)

    const [{ data: tList }, { data: termSalaries }, { data: payments }] = await Promise.all([
      supabase.from('teachers').select('*').eq('is_active', true).eq('staff_type', staffType).order('full_name'),
      supabase.from('teacher_term_salaries').select('teacher_id, salary_amount').eq('term_id', selTermId),
      supabase.from('teacher_salary_payments').select('*').eq('term_id', selTermId),
    ])

    const salaryMap = new Map((termSalaries ?? []).map(s => [s.teacher_id, Number(s.salary_amount)]))

    const rows: TeacherRow[] = (tList ?? []).map((t) => {
      const termSalary = salaryMap.get(t.id) ?? 0
      const paid = (payments ?? [])
        .filter((p) => p.teacher_id === t.id)
        .reduce((sum, p) => sum + Number(p.amount_paid), 0)
      return {
        ...t,
        termSalary,
        paidThisPeriod: paid,
        outstandingThisPeriod: Math.max(0, termSalary - paid),
      }
    })

    setTeachers(rows)
    setLoading(false)
  }, [supabase, selTermId, staffType])

  useEffect(() => { load() }, [load])

  // ── Stats ───────────────────────────────────────────────────────────────────
  const totalBill = teachers.reduce((s, t) => s + t.termSalary, 0)
  const totalPaid = teachers.reduce((s, t) => s + t.paidThisPeriod, 0)
  const totalOutstand = teachers.reduce((s, t) => s + t.outstandingThisPeriod, 0)
  const paidCount = teachers.filter((t) => t.outstandingThisPeriod === 0 && t.termSalary > 0).length

  // ── Filtered teachers ───────────────────────────────────────────────────────
  const displayedTeachers = nameSearch
    ? teachers.filter(t => t.full_name.toLowerCase().includes(nameSearch.toLowerCase()))
    : teachers

  // ── Selected term label ─────────────────────────────────────────────────────
  const selectedTermLabel = allTerms.find(t => t.id === selTermId)?.label ?? ''

  // ── Payment form ────────────────────────────────────────────────────────────
  const payForm = useForm<PayForm>({
    resolver: zodResolver(paySchema),
    defaultValues: { payment_date: today(), payment_method: 'cash', period_label: selectedTermLabel },
  })

  useEffect(() => {
    if (payModal) {
      payForm.reset({
        amount_paid: payModal.outstandingThisPeriod > 0 ? payModal.outstandingThisPeriod : payModal.termSalary,
        payment_date: today(),
        payment_method: 'cash',
        period_label: selectedTermLabel,
        notes: '',
      })
    }
  }, [payModal, payForm, selectedTermLabel])

  async function onPaySubmit(values: PayForm) {
    if (!payModal) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()

    const { error } = await supabase.from('teacher_salary_payments').insert({
      school_id: me!.school_id,
      teacher_id: payModal.id,
      term_id: selTermId,
      amount_paid: values.amount_paid,
      payment_date: values.payment_date,
      period_label: values.period_label,
      payment_method: values.payment_method,
      notes: values.notes || null,
      paid_by: user!.id,
    })

    if (error) { toast.error(error.message); return }
    toast.success(`Salary payment recorded for ${payModal.full_name}`)
    setPayModal(null)
    load()
  }

  // ── Print salary history ─────────────────────────────────────────────────────
  function printSalaryHistory() {
    if (!historyModal) return
    const { teacher, payments } = historyModal
    const total = payments.reduce((s, p) => s + Number(p.amount_paid), 0)
    const logoHtml = schoolLogoUrl
      ? `<img src="${schoolLogoUrl}" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px;" />`
      : `<div style="width:52px;height:52px;border-radius:8px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:#374151;">${ctxSchoolName?.charAt(0) ?? 'S'}</div>`
    const rows = payments.map((p) => `
      <tr>
        <td>${formatDate(p.payment_date)}</td>
        <td>${p.period_label ?? '—'}</td>
        <td style="font-weight:600">${formatCurrency(Number(p.amount_paid))}</td>
        <td style="text-transform:capitalize">${p.payment_method.replace('_', ' ')}</td>
        <td>${p.notes ?? '—'}</td>
      </tr>`).join('')

    const printContent = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div>
          <h1 style="font-size:16px;font-weight:bold;margin:0;">${ctxSchoolName ?? 'School'}</h1>
          <h2 style="font-size:13px;font-weight:600;margin:4px 0 0;">Salary Payment History</h2>
          <p style="font-size:11px;color:#555;margin:2px 0 0;">${teacher.full_name} &nbsp;·&nbsp; Employee No: ${teacher.employee_number ?? '—'}</p>
        </div>
        <div>${logoHtml}</div>
      </div>
      <hr style="border:none;border-top:1px solid #ccc;margin-bottom:12px;" />
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr>
          <th style="border:1px solid #ddd;padding:6px 10px;background:#f3f4f6;text-align:left;">Date</th>
          <th style="border:1px solid #ddd;padding:6px 10px;background:#f3f4f6;text-align:left;">Period</th>
          <th style="border:1px solid #ddd;padding:6px 10px;background:#f3f4f6;text-align:left;">Amount</th>
          <th style="border:1px solid #ddd;padding:6px 10px;background:#f3f4f6;text-align:left;">Method</th>
          <th style="border:1px solid #ddd;padding:6px 10px;background:#f3f4f6;text-align:left;">Notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="2" style="border:1px solid #ddd;padding:6px 10px;font-weight:bold;background:#f3f4f6;text-align:right;">Total (${payments.length} payments)</td>
          <td colspan="3" style="border:1px solid #ddd;padding:6px 10px;font-weight:bold;background:#f3f4f6;">${formatCurrency(total)}</td>
        </tr></tfoot>
      </table>`

    // Clean up any leftover elements from a previous print
    document.getElementById('__print-salary__')?.remove()
    document.getElementById('__print-salary-style__')?.remove()

    const style = document.createElement('style')
    style.id = '__print-salary-style__'
    style.textContent = `@media print {
      body > *:not(#__print-salary__) { display: none !important; }
      #__print-salary__ { display: block !important; }
      @page { size: auto; margin: 12mm; }
    }`
    document.head.appendChild(style)

    const div = document.createElement('div')
    div.id = '__print-salary__'
    div.style.cssText = 'display:none;font-family:sans-serif;font-size:13px;color:#111;'
    div.innerHTML = printContent
    document.body.appendChild(div)

    window.print()

    window.addEventListener('afterprint', function cleanup() {
      document.getElementById('__print-salary__')?.remove()
      document.getElementById('__print-salary-style__')?.remove()
      window.removeEventListener('afterprint', cleanup)
    }, { once: true })
  }

  // ── History ─────────────────────────────────────────────────────────────────
  async function openHistory(teacher: TeacherRow) {
    setHistLoading(true)
    setHistoryModal({ teacher, payments: [] })
    const { data } = await supabase
      .from('teacher_salary_payments')
      .select('*')
      .eq('teacher_id', teacher.id)
      .order('payment_date', { ascending: false })
    setHistoryModal({ teacher, payments: (data ?? []) as TeacherSalaryPayment[] })
    setHistLoading(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Staff Salaries" subtitle={`Track and manage ${staffType === 'teaching' ? 'teaching' : 'non-teaching'} staff salary payments`} />

      {/* Staff type toggle */}
      <div className="flex gap-1 p-1 bg-surface-alt rounded-lg w-fit border border-border">
        <button
          className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', staffType === 'teaching' ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg')}
          onClick={() => setStaffType('teaching')}
        >
          Teaching Staff
        </button>
        <button
          className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', staffType === 'non_teaching' ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg')}
          onClick={() => setStaffType('non_teaching')}
        >
          Non-Teaching Staff
        </button>
      </div>

      {/* Period selector */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label text-xs mb-1">Year</label>
          <select
            className="input max-w-[100px]"
            value={selYear}
            onChange={(e) => setSelYear(Number(e.target.value))}
          >
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {termsInYear.length > 0 && (
          <div>
            <label className="label text-xs mb-1">Term</label>
            <select
              className="input max-w-[160px]"
              value={selTermId}
              onChange={(e) => setSelTermId(e.target.value)}
            >
              {termsInYear.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="relative flex-1 min-w-[180px]">
          <label className="label text-xs mb-1">Search by Name</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
            <input
              type="text"
              className="input pl-8"
              placeholder="Search teacher…"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
            />
          </div>
        </div>

        {!selTermId && allTerms.length > 0 && (
          <p className="text-sm text-fg-muted self-end pb-1">No terms found for {selYear}. Create terms in the Terms page.</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Term Payroll"
          value={formatCurrency(totalBill)}
          sub="Total salary bill"
          icon={<DollarSign size={20} className="text-accent" />}
        />
        <StatCard
          label="Paid"
          value={formatCurrency(totalPaid)}
          sub={`${paidCount} fully paid`}
          icon={<CheckCircle size={20} className="text-accent" />}
          highlight="green"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(totalOutstand)}
          sub={`${teachers.filter(t => t.outstandingThisPeriod > 0 && t.termSalary > 0).length} unpaid`}
          icon={<AlertCircle size={20} className="text-red-500" />}
          highlight={totalOutstand > 0 ? 'red' : undefined}
        />
        <StatCard
          label="Collection Rate"
          value={totalBill > 0 ? `${Math.round((totalPaid / totalBill) * 100)}%` : '—'}
          sub="Salary disbursed"
          icon={<TrendingUp size={20} className="text-accent" />}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table>
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Employee No.</th>
              <th>Term Salary</th>
              <th>Paid ({selectedTermLabel || 'Term'})</th>
              <th>Outstanding</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : displayedTeachers.length === 0 ? (
              <tr><td colSpan={7}>
                <EmptyState
                  title={nameSearch ? 'No teachers match your search' : 'No active teachers'}
                  description={nameSearch ? 'Try a different name' : 'Add teachers first from the Teachers page'} />
              </td></tr>
            ) : (
              displayedTeachers.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.full_name}</td>
                  <td className="text-gray-500 text-xs">{t.employee_number ?? '—'}</td>
                  <td>
                    <span className="font-medium">
                      {t.termSalary > 0
                        ? formatCurrency(t.termSalary)
                        : <span className="text-gray-400 text-xs">Not set</span>}
                    </span>
                  </td>
                  <td className="text-accent-fg font-medium">
                    {t.paidThisPeriod > 0 ? formatCurrency(t.paidThisPeriod) : <span className="text-fg-subtle">—</span>}
                  </td>
                  <td>
                    {t.outstandingThisPeriod > 0
                      ? <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(t.outstandingThisPeriod)}</span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td>
                    {t.termSalary === 0 ? (
                      <Badge variant="gray">No Salary Set</Badge>
                    ) : t.outstandingThisPeriod === 0 ? (
                      <Badge variant="green">Fully Paid</Badge>
                    ) : t.paidThisPeriod > 0 ? (
                      <Badge variant="yellow">Partially Paid</Badge>
                    ) : (
                      <Badge variant="red">Unpaid</Badge>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <button
                          className="btn-ghost p-1.5 rounded"
                          title="Record Payment"
                          onClick={() => setPayModal(t)}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <button
                        className="btn-ghost p-1.5 rounded"
                        title="Payment History"
                        onClick={() => openHistory(t)}
                      >
                        <History size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* ── Record Payment Modal ──────────────────────────────────────── */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Record Salary Payment — ${payModal?.full_name}`}>
        {payModal && (
          <form onSubmit={payForm.handleSubmit(onPaySubmit)} className="space-y-4">
            {payModal.termSalary > 0 && (
              <div className="card p-3 bg-surface-alt border border-border text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-fg-muted">Term Salary</span>
                  <span className="font-medium">{formatCurrency(payModal.termSalary)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-fg-muted">Already Paid</span>
                  <span className="text-accent-fg font-medium">{formatCurrency(payModal.paidThisPeriod)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Outstanding</span>
                  <span className={payModal.outstandingThisPeriod > 0 ? 'text-red-600' : 'text-accent-fg'}>
                    {formatCurrency(payModal.outstandingThisPeriod)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Amount (GHS) *</label>
                <input type="number" min="0.01" step="0.01" className="input" {...payForm.register('amount_paid')} />
                {payForm.formState.errors.amount_paid && (
                  <p className="field-error">{payForm.formState.errors.amount_paid.message}</p>
                )}
              </div>
              <div>
                <label className="label">Payment Date *</label>
                <input type="date" className="input" max={today()} {...payForm.register('payment_date')} />
              </div>
            </div>

            <div>
              <label className="label">Period *</label>
              <input type="text" className="input" placeholder="e.g. Term 1 2026" {...payForm.register('period_label')} />
              {payForm.formState.errors.period_label && (
                <p className="field-error">{payForm.formState.errors.period_label.message}</p>
              )}
            </div>

            <div>
              <label className="label">Payment Method *</label>
              <select className="input" {...payForm.register('payment_method')}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} placeholder="Optional notes" {...payForm.register('notes')} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={payForm.formState.isSubmitting} className="flex-1 justify-center">
                Record Payment
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPayModal(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Payment History Modal ─────────────────────────────────────── */}
      <Modal
        open={!!historyModal}
        onClose={() => setHistoryModal(null)}
        title={`Salary History — ${historyModal?.teacher.full_name}`}
        className="max-w-xl"
      >
        {histLoading ? (
          <div className="py-8 text-center text-gray-500">Loading...</div>
        ) : historyModal?.payments.length === 0 ? (
          <EmptyState icon={<span>💳</span>} title="No salary payments recorded" description="Record the first payment using the + button" />
        ) : (
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button variant="ghost" icon={<Printer size={14} />} onClick={printSalaryHistory} size="sm">Print</Button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              <Table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Period</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {historyModal?.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="text-sm">{formatDate(p.payment_date)}</td>
                      <td className="text-gray-500 text-xs">{p.period_label ?? '—'}</td>
                      <td className="font-medium text-accent-fg">{formatCurrency(Number(p.amount_paid))}</td>
                      <td className="capitalize text-fg-muted text-xs">{p.payment_method.replace('_', ' ')}</td>
                      <td className="text-fg-muted text-xs max-w-[120px] truncate">{p.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
