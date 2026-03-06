'use client'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { today } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/currency'

const schema = z.object({
  amount_paid:    z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  payment_date:   z.string().min(1, 'Date is required'),
  payment_method: z.enum(['cash', 'bank_transfer', 'momo', 'card', 'other']).optional(),
  receipt_number: z.string().optional(),
  notes:          z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface PaymentFormProps {
  studentId:   string
  outstanding: number
  termId?:     string | null
  onSuccess:   () => void
  onCancel:    () => void
}

export function PaymentForm({ studentId, outstanding, termId, onSuccess, onCancel }: PaymentFormProps) {
  const supabase = createClient()

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { payment_date: today() },
  })

  const amount = watch('amount_paid')
  const isOverpayment = Number(amount) > outstanding && outstanding > 0

  useEffect(() => {
    reset({ payment_date: today() })
  }, [reset])

  async function onSubmit(values: FormData) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()

    const receipt = values.receipt_number?.trim() || `REC-${Date.now()}`

    const { error } = await supabase.from('payments').insert({
      student_id:     studentId,
      school_id:      me!.school_id,
      amount_paid:    values.amount_paid,
      payment_date:   values.payment_date,
      payment_method: values.payment_method ?? null,
      receipt_number: receipt,
      notes:          values.notes || null,
      recorded_by:    user!.id,
      term_id:        termId ?? null,
    })

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Payment recorded successfully')
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="label">Amount (GHS) *</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          className="input"
          placeholder="0.00"
          {...register('amount_paid')}
        />
        {errors.amount_paid && <p className="field-error">{errors.amount_paid.message}</p>}
      </div>

      {isOverpayment && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <span className="text-yellow-700 dark:text-yellow-300">
            This amount exceeds the outstanding balance of {formatCurrency(outstanding)}. Continue?
          </span>
        </div>
      )}

      <div>
        <label className="label">Payment Date *</label>
        <input
          type="date"
          max={today()}
          className="input"
          {...register('payment_date')}
        />
        {errors.payment_date && <p className="field-error">{errors.payment_date.message}</p>}
      </div>

      <div>
        <label className="label">Payment Method</label>
        <select className="input" {...register('payment_method')}>
          <option value="">Select method</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="momo">MoMo</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="label">Receipt Number</label>
        <input
          className="input"
          placeholder="Auto-generated if blank"
          {...register('receipt_number')}
        />
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea rows={2} className="input resize-none" placeholder="Optional note" {...register('notes')} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1 justify-center">
          Record Payment
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
