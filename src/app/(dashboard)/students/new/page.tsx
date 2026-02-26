'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'
import type { Class } from '@/types'

const schema = z.object({
  full_name:        z.string().min(1, 'Full name is required'),
  admission_number: z.string().optional(),
  class_id:         z.string().optional(),
  date_of_birth:    z.string().optional(),
  gender:           z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  parent_name:      z.string().optional(),
  parent_phone:     z.string().optional(),
  parent_email:     z.string().email('Invalid email').optional().or(z.literal('')),
  discount_amount:  z.coerce.number().min(0).default(0),
})
type FormData = z.infer<typeof schema>

export default function NewStudentPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('classes').select('*').order('name').then(({ data }) => setClasses(data ?? []))
  }, [supabase])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { discount_amount: 0 },
  })

  async function onSubmit(values: FormData) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()

    const { data, error } = await supabase.from('students').insert({
      school_id:        me!.school_id,
      full_name:        values.full_name,
      admission_number: values.admission_number || null,
      class_id:         values.class_id || null,
      date_of_birth:    values.date_of_birth || null,
      gender:           values.gender || null,
      parent_name:      values.parent_name || null,
      parent_phone:     values.parent_phone || null,
      parent_email:     values.parent_email || null,
      discount_amount:  values.discount_amount,
    }).select('id').single()

    if (error) { toast.error(error.message); return }
    toast.success('Student registered successfully')
    router.push(`/students/${data.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/students">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />}>Students</Button>
        </Link>
      </div>

      <PageHeader title="Add Student" subtitle="Register a new student" />

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="card p-5 space-y-4">
            <h3 className="section-title">Student Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Full Name *</label>
                <input className="input" placeholder="Kwame Asante" {...register('full_name')} />
                {errors.full_name && <p className="field-error">{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="label">Admission Number</label>
                <input className="input" placeholder="ADM-001" {...register('admission_number')} />
              </div>
              <div>
                <label className="label">Class</label>
                <select className="input" {...register('class_id')}>
                  <option value="">— Select class —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
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
          </div>

          {/* Parent Info */}
          <div className="card p-5 space-y-4">
            <h3 className="section-title">Parent / Guardian</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Parent Name</label>
                <input className="input" placeholder="Kofi Asante" {...register('parent_name')} />
              </div>
              <div>
                <label className="label">Parent Phone</label>
                <input className="input" placeholder="0XX XXX XXXX" {...register('parent_phone')} />
              </div>
              <div>
                <label className="label">Parent Email</label>
                <input type="email" className="input" placeholder="parent@email.com" {...register('parent_email')} />
                {errors.parent_email && <p className="field-error">{errors.parent_email.message}</p>}
              </div>
            </div>
          </div>

          {/* Fee Info */}
          <div className="card p-5 space-y-4">
            <h3 className="section-title">Fee Adjustment</h3>
            <div className="max-w-xs">
              <label className="label">Discount Amount (GHS)</label>
              <input type="number" min="0" step="0.01" className="input" placeholder="0.00" {...register('discount_amount')} />
              {errors.discount_amount && <p className="field-error">{errors.discount_amount.message}</p>}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={isSubmitting}>Register Student</Button>
            <Link href="/students">
              <Button type="button" variant="secondary">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
