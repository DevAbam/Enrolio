'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, History, CheckCircle, AlertCircle, DollarSign, TrendingUp, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
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
import type { Teacher, TeacherSalaryPayment, SalaryPaymentMethod } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────
function currentMonthLabel() {
  return new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
}
function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  return { from, to }
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const paySchema = z.object({
  amount_paid:    z.coerce.number().positive('Amount must be positive'),
  payment_date:   z.string().min(1),
  period_label:   z.string().min(1, 'Period is required'),
  payment_method: z.enum(['cash', 'bank_transfer', 'mobile_money', 'cheque']),
  notes:          z.string().optional(),
})
type PayForm = z.infer<typeof paySchema>

const salarySchema = z.object({
  salary_amount: z.coerce.number().min(0, 'Must be 0 or more'),
})
type SalaryForm = z.infer<typeof salarySchema>

// ── Types ─────────────────────────────────────────────────────────────────────
interface TeacherRow extends Teacher {
  paidThisPeriod:      number
  outstandingThisPeriod: number
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherSalariesPage() {
  const { isAdmin, schoolName: ctxSchoolName, schoolLogoUrl } = useRole()
  const supabase    = createClient()

  const now   = new Date()
  const [selYear,  setSelYear]  = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)

  const [teachers,  setTeachers]  = useState<TeacherRow[]>([])
  const [loading,   setLoading]   = useState(true)

  const [payModal,       setPayModal]       = useState<TeacherRow | null>(null)
  const [setSalaryModal, setSetSalaryModal] = useState<TeacherRow | null>(null)
  const [historyModal,   setHistoryModal]   = useState<{ teacher: TeacherRow; payments: TeacherSalaryPayment[] } | null>(null)
  const [histLoading,    setHistLoading]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = monthRange(selYear, selMonth)

    const [{ data: tList }, { data: payments }] = await Promise.all([
      supabase.from('teachers').select('*').eq('is_active', true).order('full_name'),
      supabase.from('teacher_salary_payments').select('*').gte('payment_date', from).lte('payment_date', to),
    ])

    const rows: TeacherRow[] = (tList ?? []).map((t) => {
      const salaryAmount = Number(t.salary_amount ?? 0)
      const paid = (payments ?? [])
        .filter((p) => p.teacher_id === t.id)
        .reduce((sum, p) => sum + Number(p.amount_paid), 0)
      return {
        ...t,
        salary_amount:          salaryAmount,
        paidThisPeriod:         paid,
        outstandingThisPeriod:  Math.max(0, salaryAmount - paid),
      }
    })

    setTeachers(rows)
    setLoading(false)
  }, [supabase, selYear, selMonth])

  useEffect(() => { load() }, [load])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalBill      = teachers.reduce((s, t) => s + t.salary_amount, 0)
  const totalPaid      = teachers.reduce((s, t) => s + t.paidThisPeriod, 0)
  const totalOutstand  = teachers.reduce((s, t) => s + t.outstandingThisPeriod, 0)
  const paidCount      = teachers.filter((t) => t.outstandingThisPeriod === 0 && t.salary_amount > 0).length

  // ── Payment form ───────────────────────────────────────────────────────────
  const payForm = useForm<PayForm>({
    resolver: zodResolver(paySchema),
    defaultValues: { payment_date: today(), payment_method: 'cash', period_label: currentMonthLabel() },
  })

  useEffect(() => {
    if (payModal) {
      payForm.reset({
        amount_paid:    payModal.outstandingThisPeriod > 0 ? payModal.outstandingThisPeriod : payModal.salary_amount,
        payment_date:   today(),
        payment_method: 'cash',
        period_label:   currentMonthLabel(),
        notes:          '',
      })
    }
  }, [payModal, payForm])

  async function onPaySubmit(values: PayForm) {
    if (!payModal) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()

    const { error } = await supabase.from('teacher_salary_payments').insert({
      school_id:      me!.school_id,
      teacher_id:     payModal.id,
      amount_paid:    values.amount_paid,
      payment_date:   values.payment_date,
      period_label:   values.period_label,
      payment_method: values.payment_method,
      notes:          values.notes || null,
      paid_by:        user!.id,
    })

    if (error) { toast.error(error.message); return }
    toast.success(`Salary payment recorded for ${payModal.full_name}`)
    setPayModal(null)
    load()
  }

  // ── Set salary form ────────────────────────────────────────────────────────
  const salaryForm = useForm<SalaryForm>({ resolver: zodResolver(salarySchema) })

  useEffect(() => {
    if (setSalaryModal) salaryForm.reset({ salary_amount: setSalaryModal.salary_amount })
  }, [setSalaryModal, salaryForm])

  async function onSalarySubmit(values: SalaryForm) {
    if (!setSalaryModal) return
    const { error } = await supabase.rpc('set_teacher_salary', {
      p_teacher_id:    setSalaryModal.id,
      p_salary_amount: values.salary_amount,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Salary updated')
    setSetSalaryModal(null)
    load()
  }

  // ── Print salary history ───────────────────────────────────────────────────
  function printSalaryHistory() {
    if (!historyModal) return
    const { teacher, payments } = historyModal
    const total = payments.reduce((s, p) => s + Number(p.amount_paid), 0)
    const rows = payments.map((p) => `
      <tr>
        <td>${formatDate(p.payment_date)}</td>
        <td>${p.period_label ?? '—'}</td>
        <td style="font-weight:600">${formatCurrency(Number(p.amount_paid))}</td>
        <td style="text-transform:capitalize">${p.payment_method.replace('_', ' ')}</td>
        <td>${p.notes ?? '—'}</td>
      </tr>`).join('')
    const logoHtml = schoolLogoUrl
      ? `<img src="${schoolLogoUrl}" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px;" />`
      : `<div style="width:52px;height:52px;border-radius:8px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:#374151;">${ctxSchoolName?.charAt(0) ?? 'S'}</div>`
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Salary History — ${teacher.full_name}</title>
      <style>
        @page { size: auto; margin: 12mm; }
        body { font-family: sans-serif; font-size: 13px; color: #111; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .header-left h1 { font-size: 16px; font-weight: bold; margin: 0; }
        .header-left h2 { font-size: 13px; font-weight: 600; margin: 4px 0 0; }
        .header-left p { font-size: 11px; color: #555; margin: 2px 0 0; }
        hr { border: none; border-top: 1px solid #ccc; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        tr:nth-child(even) { background: #f9fafb; }
        tfoot td { font-weight: bold; background: #f3f4f6; }
      </style></head><body>
      <div class="header">
        <div class="header-left">
          <h1>${ctxSchoolName ?? 'School'}</h1>
          <h2>Salary Payment History</h2>
          <p>${teacher.full_name} &nbsp;·&nbsp; Employee No: ${teacher.employee_number ?? '—'}</p>
        </div>
        <div>${logoHtml}</div>
      </div>
      <hr />
      <table>
        <thead><tr><th>Date</th><th>Period</th><th>Amount</th><th>Method</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2" style="text-align:right">Total (${payments.length} payments)</td><td colspan="3">${formatCurrency(total)}</td></tr></tfoot>
      </table>
      <script>window.print()</script>
    </body></html>`
    const w = window.open('', '_blank')
    w?.document.write(html)
    w?.document.close()
  }

  // ── History ────────────────────────────────────────────────────────────────
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

  // ── Month options ──────────────────────────────────────────────────────────
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="space-y-6">
      <PageHeader title="Teacher Salaries" subtitle="Track and manage teacher salary payments" />

      {/* Period selector */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div>
          <label className="label text-xs mb-1">Month</label>
          <select className="input max-w-[160px]" value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}>
            {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs mb-1">Year</label>
          <select className="input max-w-[100px]" value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Monthly Payroll"
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
          sub={`${teachers.filter(t => t.outstandingThisPeriod > 0 && t.salary_amount > 0).length} unpaid`}
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
              <th>Monthly Salary</th>
              <th>Paid ({months[selMonth - 1]})</th>
              <th>Outstanding</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : teachers.length === 0 ? (
              <tr><td colSpan={7}>
                <EmptyState icon={<span>👨‍🏫</span>} title="No active teachers" description="Add teachers first from the Teachers page" />
              </td></tr>
            ) : (
              teachers.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.full_name}</td>
                  <td className="text-gray-500 text-xs">{t.employee_number ?? '—'}</td>
                  <td>
                    <span className="font-medium">{t.salary_amount > 0 ? formatCurrency(t.salary_amount) : <span className="text-gray-400 text-xs">Not set</span>}</span>
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
                    {t.salary_amount === 0 ? (
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
                        <>
                          <button
                            className="btn-ghost p-1.5 rounded"
                            title="Set Salary"
                            onClick={() => setSetSalaryModal(t)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn-ghost p-1.5 rounded"
                            title="Record Payment"
                            onClick={() => setPayModal(t)}
                          >
                            <Plus size={14} />
                          </button>
                        </>
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

      {/* ── Set Salary Modal ──────────────────────────────────────────── */}
      <Modal open={!!setSalaryModal} onClose={() => setSetSalaryModal(null)} title={`Set Salary — ${setSalaryModal?.full_name}`}>
        <form onSubmit={salaryForm.handleSubmit(onSalarySubmit)} className="space-y-4">
          <div>
            <label className="label">Monthly Salary (GHS)</label>
            <input type="number" min="0" step="0.01" className="input" {...salaryForm.register('salary_amount')} />
            {salaryForm.formState.errors.salary_amount && (
              <p className="field-error">{salaryForm.formState.errors.salary_amount.message}</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={salaryForm.formState.isSubmitting} className="flex-1 justify-center">
              Save Salary
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSetSalaryModal(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* ── Record Payment Modal ──────────────────────────────────────── */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Record Salary Payment — ${payModal?.full_name}`}>
        {payModal && (
          <form onSubmit={payForm.handleSubmit(onPaySubmit)} className="space-y-4">
            {payModal.salary_amount > 0 && (
              <div className="card p-3 bg-surface-alt border border-border text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-fg-muted">Monthly Salary</span>
                  <span className="font-medium">{formatCurrency(payModal.salary_amount)}</span>
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
              <input type="text" className="input" placeholder="e.g. January 2026, Term 1 2026" {...payForm.register('period_label')} />
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
