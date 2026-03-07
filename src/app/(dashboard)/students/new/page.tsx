'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { PageHeader } from '@/components/layout/PageHeader'
import type { Class } from '@/types'

const studentSchema = z.object({
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

const schema = z.object({ students: z.array(studentSchema).min(1) })
type FormData = z.infer<typeof schema>

export default function NewStudentPage() {
  const [classes,      setClasses]      = useState<Class[]>([])
  const [studentPhotos, setStudentPhotos] = useState<Record<string, string>>({}) // fieldId → url
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('classes').select('*').order('name').then(({ data }) => setClasses(data ?? []))
  }, [supabase])

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { students: [{ discount_amount: 0 }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'students' })

  async function onSubmit(values: FormData) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()

    const rows = values.students.map((s, i) => ({
      school_id:        me!.school_id,
      full_name:        s.full_name,
      admission_number: s.admission_number || null,
      class_id:         s.class_id || null,
      date_of_birth:    s.date_of_birth || null,
      gender:           s.gender || null,
      parent_name:      s.parent_name || null,
      parent_phone:     s.parent_phone || null,
      parent_email:     s.parent_email || null,
      discount_amount:  s.discount_amount,
      photo_url:        studentPhotos[fields[i].id] || null,
    }))

    const { error } = await supabase.from('students').insert(rows)
    if (error) { toast.error(error.message); return }
    toast.success(`${rows.length} student${rows.length > 1 ? 's' : ''} registered successfully`)
    router.push('/students')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/students">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />}>Students</Button>
        </Link>
      </div>

      <PageHeader title="Add Students" subtitle="Register one or more students at once" />

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {fields.map((field, index) => (
            <div key={field.id} className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ImageUpload
                    currentUrl={studentPhotos[field.id] ?? null}
                    folder="SchoolOps/students"
                    initials={(index + 1).toString()}
                    size={48}
                    onUpload={(url) => setStudentPhotos(prev => ({ ...prev, [field.id]: url }))}
                  />
                  <h3 className="section-title">
                    {fields.length > 1 ? `Student ${index + 1}` : 'Student Information'}
                  </h3>
                </div>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { remove(index); setStudentPhotos(prev => { const n = { ...prev }; delete n[field.id]; return n }) }}
                    className="text-fg-muted hover:text-red-500 transition-colors"
                    aria-label="Remove student"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Full Name *</label>
                  <input className="input" placeholder="Kwame Asante" {...register(`students.${index}.full_name`)} />
                  {errors.students?.[index]?.full_name && (
                    <p className="field-error">{errors.students[index]!.full_name!.message}</p>
                  )}
                </div>
                <div>
                  <label className="label">Admission Number</label>
                  <input className="input" placeholder="ADM-001" {...register(`students.${index}.admission_number`)} />
                </div>
                <div>
                  <label className="label">Class</label>
                  <select className="input" {...register(`students.${index}.class_id`)}>
                    <option value="">— Select class —</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input type="date" className="input" {...register(`students.${index}.date_of_birth`)} />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select className="input" {...register(`students.${index}.gender`)}>
                    <option value="">— Select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Parent Info */}
              <div>
                <h4 className="label font-semibold mb-3">Parent / Guardian</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Parent Name</label>
                    <input className="input" placeholder="Kofi Asante" {...register(`students.${index}.parent_name`)} />
                  </div>
                  <div>
                    <label className="label">Parent Phone</label>
                    <input className="input" placeholder="0XX XXX XXXX" {...register(`students.${index}.parent_phone`)} />
                  </div>
                  <div>
                    <label className="label">Parent Email</label>
                    <input type="email" className="input" placeholder="parent@email.com" {...register(`students.${index}.parent_email`)} />
                    {errors.students?.[index]?.parent_email && (
                      <p className="field-error">{errors.students[index]!.parent_email!.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Fee Info */}
              <div>
                <h4 className="label font-semibold mb-3">Fee Adjustment</h4>
                <div className="max-w-xs">
                  <label className="label">Discount Amount (GHS)</label>
                  <input type="number" min="0" step="0.01" className="input" placeholder="0.00" {...register(`students.${index}.discount_amount`)} />
                  {errors.students?.[index]?.discount_amount && (
                    <p className="field-error">{errors.students[index]!.discount_amount!.message}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => append({ discount_amount: 0 })}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-lg text-sm text-fg-muted hover:border-accent hover:text-accent transition-colors"
          >
            <Plus size={16} />
            Add Another Student
          </button>

          <div className="flex gap-3">
            <Button type="submit" loading={isSubmitting}>
              {fields.length > 1 ? `Register ${fields.length} Students` : 'Register Student'}
            </Button>
            <Link href="/students">
              <Button type="button" variant="secondary">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
