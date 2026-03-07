'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, Pencil, Printer, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { useTerm } from '@/lib/term-context'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { PaymentForm } from '@/components/payments/PaymentForm'
import { ReceiptModal } from '@/components/receipts/ReceiptModal'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import type { StudentFeeSummary, Payment, Class } from '@/types'

const PAGE_SIZE = 10

const editSchema = z.object({
  full_name:        z.string().min(1),
  admission_number: z.string().optional(),
  class_id:         z.string().optional(),
  date_of_birth:    z.string().optional(),
  gender:           z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  parent_name:      z.string().optional(),
  parent_phone:     z.string().optional(),
  parent_email:     z.string().email().optional().or(z.literal('')),
  discount_amount:  z.coerce.number().min(0).default(0),
})
type EditForm = z.infer<typeof editSchema>

type StudentWithExtras = StudentFeeSummary & {
  date_of_birth?: string | null
  admitted_at?: string | null
  class_level?: number | null
  active_term_id?: string | null
  active_term_label?: string | null
}

export default function StudentDetailPage() {
  const { id }          = useParams<{ id: string }>()
  const searchParams    = useSearchParams()
  const router          = useRouter()
  const { isAdmin, schoolName, schoolLogoUrl, schoolAddress, schoolPhone, schoolEmail } = useRole()
  const { activeTerm, selectedTerm, allTerms } = useTerm()
  const [student, setStudent]           = useState<StudentWithExtras | null>(null)
  const [payments, setPayments]         = useState<Payment[]>([])
  const [classes,  setClasses]          = useState<Class[]>([])
  const [loading,  setLoading]          = useState(true)
  const [payPage,  setPayPage]          = useState(1)
  const [editModal,    setEditModal]    = useState(searchParams.get('edit') === '1')
  const [payModal,     setPayModal]     = useState(false)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)
  const [promoting,    setPromoting]    = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    let paymentsQuery = supabase.from('payments').select('*').eq('student_id', id).order('payment_date', { ascending: false })
    if (selectedTerm?.id) paymentsQuery = paymentsQuery.eq('term_id', selectedTerm.id)
    const [{ data: s }, { data: p }, { data: cls }] = await Promise.all([
      supabase.from('student_fee_summary').select('*').eq('id', id).single(),
      paymentsQuery,
      supabase.from('classes').select('*').order('level', { ascending: true, nullsFirst: false }).order('name'),
    ])
    setStudent(s as StudentWithExtras)
    setPayments(p ?? [])
    setClasses(cls ?? [])
    setLoading(false)
  }, [supabase, id, selectedTerm?.id])

  useEffect(() => { load() }, [load])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => {
    if (student) {
      reset({
        full_name:        student.full_name,
        admission_number: student.admission_number ?? '',
        class_id:         student.class_id ?? '',
        date_of_birth:    (student as StudentWithExtras).date_of_birth ?? '',
        gender:           (student.gender as 'male' | 'female' | 'other' | '') ?? '',
        parent_name:      student.parent_name ?? '',
        parent_phone:     student.parent_phone ?? '',
        discount_amount:  student.discount_amount,
      })
    }
  }, [student, reset])

  async function onEditSubmit(values: EditForm) {
    const { error } = await supabase.from('students').update({
      full_name:        values.full_name,
      admission_number: values.admission_number || null,
      class_id:         values.class_id || null,
      date_of_birth:    values.date_of_birth || null,
      gender:           values.gender || null,
      parent_name:      values.parent_name || null,
      parent_phone:     values.parent_phone || null,
      parent_email:     values.parent_email || null,
      discount_amount:  values.discount_amount,
    }).eq('id', id)

    if (error) { toast.error(error.message); return }
    toast.success('Student updated')
    setEditModal(false)
    router.replace(`/students/${id}`)
    load()
  }

  async function promote(direction: 'up' | 'down') {
    if (!student) return
    const currentLevel = (student as StudentWithExtras).class_level
    if (currentLevel == null) {
      toast.error('Current class has no level set. Set levels in the Classes page first.')
      return
    }
    const targetLevel = direction === 'up' ? currentLevel + 1 : currentLevel - 1
    const targetClass = classes.find(c => (c as Class & { level?: number }).level === targetLevel)
    if (!targetClass) {
      toast.error(direction === 'up' ? 'No higher class found. This may be the highest level.' : 'No lower class found.')
      return
    }
    if (!confirm(`${direction === 'up' ? 'Promote' : 'Demote'} ${student.full_name} to ${targetClass.name}?`)) return
    setPromoting(true)
    const res = await fetch('/api/promote-student', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ studentId: id, targetClassId: targetClass.id }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error) } else { toast.success(`Moved to ${targetClass.name}`); load() }
    setPromoting(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="line" className="w-32 h-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    )
  }

  if (!student) return <p className="text-gray-500">Student not found.</p>

  const outstanding = Math.max(0, Number(student.outstanding))
  const pagedPayments = payments.slice((payPage - 1) * PAGE_SIZE, payPage * PAGE_SIZE)
  const yearAdmitted = (student as StudentWithExtras).admitted_at
    ? new Date((student as StudentWithExtras).admitted_at!).getFullYear()
    : null

  return (
    <div className="space-y-6">
      <Link href="/students">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />}>Students</Button>
      </Link>

      {/* Top row: Photo | Student Info | Fee Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_1fr] gap-6">

        {/* Photo / Profile Card */}
        <div className="card p-5 flex flex-col items-center text-center gap-4">
          <ImageUpload
            currentUrl={student.photo_url}
            folder="SchoolOps/students"
            initials={student.full_name.charAt(0).toUpperCase()}
            size={160}
            shape="square"
            disabled={!isAdmin}
            onUpload={async (url) => {
              await supabase.from('students').update({ photo_url: url }).eq('id', id)
              setStudent(prev => prev ? { ...prev, photo_url: url } : prev)
            }}
          />
          <div className="w-full">
            <h2 className="text-lg font-bold text-fg leading-tight">{student.full_name}</h2>
            {student.class_name && (
              <p className="text-sm text-fg-muted mt-1">{student.class_name}</p>
            )}
            <div className="mt-2 flex justify-center">
              <Badge variant={student.is_active ? 'green' : 'gray'}>
                {student.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil size={14} />}
              onClick={() => setEditModal(true)}
              className="w-full justify-center"
            >
              Edit
            </Button>
          )}
        </div>

        {/* Student Information Card */}
        <div className="card p-5">
          <h3 className="font-semibold text-fg border-b border-border pb-2 mb-4">Student Information</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Class</dt>
              <dd className="font-medium">{student.class_name ?? <Badge variant="yellow">No Class</Badge>}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Admission No.</dt>
              <dd className="font-medium">{student.admission_number ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Gender</dt>
              <dd className="font-medium capitalize">{student.gender ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Date of Birth</dt>
              <dd className="font-medium">
                {(student as StudentWithExtras).date_of_birth
                  ? formatDate((student as StudentWithExtras).date_of_birth!)
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Year Admitted</dt>
              <dd className="font-medium">{yearAdmitted ?? '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Fee Summary Card */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Fee Summary</h2>
            {activeTerm && (
              <span className="text-xs bg-accent-bg text-accent px-2 py-0.5 rounded-full">{activeTerm.label}</span>
            )}
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Term Fee</span>
              <span className="font-semibold">{formatCurrency(Number(student.term_fee_amount))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Discount</span>
              <span className="font-semibold text-accent-fg">
                {Number(student.discount_amount) > 0 ? `-${formatCurrency(Number(student.discount_amount))}` : '—'}
              </span>
            </div>
            {Number(student.carried_over_balance) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Carried Forward Balance</span>
                <span className="font-semibold text-red-500">+{formatCurrency(Number(student.carried_over_balance))}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Total Owed</span>
              <span className="font-semibold">{formatCurrency(Number(student.total_owed))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Paid</span>
              <span className="font-semibold text-accent-fg">{formatCurrency(Number(student.total_paid))}</span>
            </div>
          </div>

          <div className="border-t border-border my-4" />

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Outstanding</span>
            {outstanding > 0
              ? <span className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(outstanding)}</span>
              : <Badge variant="green">Fully Paid</Badge>
            }
          </div>

          {isAdmin && (
            <div className="flex gap-3 mt-5">
              <Button onClick={() => setPayModal(true)} className="flex-1 justify-center">
                Add Payment
              </Button>
              <Link href={`/sms?tab=single&studentId=${id}`}>
                <Button variant="secondary" icon={<MessageSquare size={14} />}>
                  SMS Reminder
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Parent/Guardian + Promotion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parent / Guardian */}
        <div className="card p-5">
          <h3 className="font-semibold text-fg border-b border-border pb-2 mb-4">Parent / Guardian</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium">{student.parent_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium">{student.parent_phone ?? '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Promotion */}
        {isAdmin && student.class_id && (
          <div className="card p-5">
            <h3 className="font-semibold text-fg border-b border-border pb-2 mb-4">Promotion</h3>
            <p className="text-sm text-fg-muted mb-4">Move this student to a higher or lower class level.</p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronUp size={14} />}
                onClick={() => promote('up')}
                loading={promoting}
              >
                Promote
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronDown size={14} />}
                onClick={() => promote('down')}
                loading={promoting}
              >
                Demote
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="section-title">Payment History</h2>
          {selectedTerm && (
            <span className="text-xs bg-accent-bg text-accent px-2 py-0.5 rounded-full">{selectedTerm.label}</span>
          )}
        </div>
        <Table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Receipt No.</th>
              <th>Notes</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={6}>
                <EmptyState icon={<span>💳</span>} title="No payments recorded" description="Record the first payment using the button above" />
              </td></tr>
            ) : (
              pagedPayments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.payment_date)}</td>
                  <td className="font-medium text-accent-fg">{formatCurrency(Number(p.amount_paid))}</td>
                  <td className="capitalize text-fg-muted">{p.payment_method?.replace('_', ' ') ?? '—'}</td>
                  <td className="text-fg-muted text-xs">{p.receipt_number ?? '—'}</td>
                  <td className="text-fg-muted max-w-xs truncate" title={p.notes ?? ''}>{p.notes ?? '—'}</td>
                  <td>
                    <button
                      className="btn-ghost p-1.5 rounded"
                      title="View Receipt"
                      onClick={() => setReceiptPayment(p)}
                    >
                      <Printer size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
        {payments.length > PAGE_SIZE && (
          <Pagination page={payPage} pageSize={PAGE_SIZE} total={payments.length} onPageChange={setPayPage} />
        )}
      </div>

      {/* Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Payment">
        <PaymentForm
          studentId={id}
          outstanding={outstanding}
          onSuccess={() => { setPayModal(false); load() }}
          onCancel={() => setPayModal(false)}
        />
      </Modal>

      {/* Receipt Modal */}
      {receiptPayment && (
        <ReceiptModal
          payment={receiptPayment}
          studentName={student.full_name}
          className={student.class_name ?? undefined}
          schoolName={schoolName ?? 'School'}
          schoolLogoUrl={schoolLogoUrl ?? undefined}
          schoolAddress={schoolAddress ?? undefined}
          schoolPhone={schoolPhone ?? undefined}
          schoolEmail={schoolEmail ?? undefined}
          outstanding={outstanding}
          termLabel={allTerms.find(t => t.id === receiptPayment.term_id)?.label}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {/* Edit Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Student" className="max-w-lg">
        <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" {...register('full_name')} />
            {errors.full_name && <p className="field-error">{errors.full_name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Admission No.</label>
              <input className="input" {...register('admission_number')} />
            </div>
            <div>
              <label className="label">Class</label>
              <select className="input" {...register('class_id')}>
                <option value="">— None —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date of Birth</label>
              <input type="date" className="input" {...register('date_of_birth')} />
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="input" {...register('gender')}>
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Parent Name</label>
              <input className="input" {...register('parent_name')} />
            </div>
            <div>
              <label className="label">Parent Phone</label>
              <input className="input" {...register('parent_phone')} />
            </div>
          </div>
          <div>
            <label className="label">Discount (GHS)</label>
            <input type="number" min="0" step="0.01" className="input" {...register('discount_amount')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={isSubmitting} className="flex-1 justify-center">Save Changes</Button>
            <Button type="button" variant="ghost" onClick={() => setEditModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
