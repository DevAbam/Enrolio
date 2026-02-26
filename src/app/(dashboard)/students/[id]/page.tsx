'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, Pencil, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { PaymentForm } from '@/components/payments/PaymentForm'
import { ReceiptModal } from '@/components/receipts/ReceiptModal'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import type { StudentFeeSummary, Payment, Class } from '@/types'

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

export default function StudentDetailPage() {
  const { id }          = useParams<{ id: string }>()
  const searchParams    = useSearchParams()
  const router          = useRouter()
  const { isAdmin, schoolName } = useRole()
  const [student, setStudent] = useState<StudentFeeSummary | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [classes,  setClasses]  = useState<Class[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editModal,    setEditModal]    = useState(searchParams.get('edit') === '1')
  const [payModal,     setPayModal]     = useState(false)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: p }, { data: cls }] = await Promise.all([
      supabase.from('student_fee_summary').select('*').eq('id', id).single(),
      supabase.from('payments').select('*').eq('student_id', id).order('payment_date', { ascending: false }),
      supabase.from('classes').select('*').order('name'),
    ])
    setStudent(s)
    setPayments(p ?? [])
    setClasses(cls ?? [])
    setLoading(false)
  }, [supabase, id])

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

  return (
    <div className="space-y-6">
      <Link href="/students">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />}>Students</Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Student Info */}
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-bold text-green-900 dark:text-green-50">{student.full_name}</h2>
            {isAdmin && (
              <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setEditModal(true)}>
                Edit
              </Button>
            )}
          </div>
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
              <dt className="text-gray-500">Status</dt>
              <dd><Badge variant={student.is_active ? 'green' : 'gray'}>{student.is_active ? 'Active' : 'Inactive'}</Badge></dd>
            </div>
          </dl>

          <div className="border-t border-green-100 dark:border-green-800 my-4" />

          <h3 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-3">Parent / Guardian</h3>
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

        {/* Right — Fee Summary */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Fee Summary</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Term Fee</span>
              <span className="font-semibold">{formatCurrency(Number(student.term_fee_amount))}</span>
            </div>
            {Number(student.discount_amount) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Discount</span>
                <span className="font-semibold text-green-600">-{formatCurrency(Number(student.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Total Owed</span>
              <span className="font-semibold">{formatCurrency(Number(student.total_owed))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Paid</span>
              <span className="font-semibold text-green-600">{formatCurrency(Number(student.total_paid))}</span>
            </div>
          </div>

          <div className="border-t border-green-100 dark:border-green-800 my-4" />

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

      {/* Payment History */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-green-100 dark:border-green-800">
          <h2 className="section-title">Payment History</h2>
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
              payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.payment_date)}</td>
                  <td className="font-medium text-green-700 dark:text-green-400">{formatCurrency(Number(p.amount_paid))}</td>
                  <td className="capitalize text-gray-500">{p.payment_method?.replace('_', ' ') ?? '—'}</td>
                  <td className="text-gray-500 text-xs">{p.receipt_number ?? '—'}</td>
                  <td className="text-gray-500 max-w-xs truncate">{p.notes ?? '—'}</td>
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
