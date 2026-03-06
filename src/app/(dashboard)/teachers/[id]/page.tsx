'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Pencil, Lock, KeyRound, User, Phone, Mail, Hash, Calendar, GraduationCap, BadgeCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const teacherSchema = z.object({
  full_name:       z.string().min(1, 'Full name is required'),
  phone:           z.string().optional(),
  email:           z.string().email('Invalid email').optional().or(z.literal('')),
  employee_number: z.string().optional(),
  gender:          z.enum(['male', 'female', 'other', '']).optional(),
  notes:           z.string().optional(),
  class_id:        z.string().optional(),
})
type TeacherForm = z.infer<typeof teacherSchema>

const pwSchema = z.object({
  newPassword: z.string().min(6, 'Min 6 characters'),
})
type PwForm = z.infer<typeof pwSchema>

type TeacherDetail = {
  id: string; school_id: string; full_name: string; phone: string | null
  email: string | null; employee_number: string | null; gender: string | null
  is_active: boolean; user_id: string | null; class_id: string | null
  temp_password: string | null; notes: string | null; created_at: string
}

export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const supabase = createClient()
  const { isAdmin } = useRole()

  const [teacher,    setTeacher]    = useState<TeacherDetail | null>(null)
  const [className,  setClassName]  = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [editModal,  setEditModal]  = useState(false)
  const [pwModal,    setPwModal]    = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
  })
  const pwForm = useForm<PwForm>({ resolver: zodResolver(pwSchema) })

  const load = useCallback(async () => {
    setLoading(true)
    const { data: t } = await supabase.from('teachers').select('*').eq('id', id).single()
    if (!t) { setLoading(false); return }
    setTeacher(t as TeacherDetail)

    const [classRes, userRes] = await Promise.all([
      t.class_id ? supabase.from('classes').select('name').eq('id', t.class_id).single() : Promise.resolve({ data: null }),
      t.user_id  ? supabase.from('users').select('email:id').eq('id', t.user_id).single() : Promise.resolve({ data: null }),
    ])
    setClassName(classRes.data ? (classRes.data as { name: string }).name : null)

    // Fetch auth email via users table (email stored in auth.users, but we can show the teacher's email field)
    setLoginEmail(t.email)
    setLoading(false)
  }, [supabase, id])

  useEffect(() => { load() }, [load])

  function openEdit() {
    if (!teacher) return
    reset({
      full_name:       teacher.full_name,
      phone:           teacher.phone ?? '',
      email:           teacher.email ?? '',
      employee_number: teacher.employee_number ?? '',
      gender:          (teacher.gender as 'male' | 'female' | 'other' | '') ?? '',
      notes:           teacher.notes ?? '',
    })
    setEditModal(true)
  }

  async function onSave(values: TeacherForm) {
    const { error } = await supabase.from('teachers').update({
      full_name:       values.full_name,
      phone:           values.phone || null,
      email:           values.email || null,
      employee_number: values.employee_number || null,
      gender:          values.gender || null,
      notes:           values.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Teacher updated')
    setEditModal(false)
    load()
  }

  async function onChangePassword(values: PwForm) {
    if (!teacher?.user_id) return
    const res = await fetch('/api/teacher-account/change-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ teacherId: teacher.id, userId: teacher.user_id, newPassword: values.newPassword }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); return }
    toast.success('Password updated')
    setPwModal(false)
    load()
  }

  async function toggleActive() {
    if (!teacher) return
    await supabase.from('teachers').update({ is_active: !teacher.is_active }).eq('id', id)
    load()
  }

  if (loading) return <div className="card animate-pulse h-64" />

  if (!teacher) return (
    <div className="card text-center py-16">
      <p className="text-fg-muted">Teacher not found.</p>
      <button onClick={() => router.back()} className="btn-ghost mt-4 mx-auto flex items-center gap-2">
        <ArrowLeft size={16} /> Back
      </button>
    </div>
  )

  const yearEmployed = new Date(teacher.created_at).getFullYear()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost p-2 -ml-2" title="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-fg truncate">{teacher.full_name}</h2>
          <p className="text-sm text-fg-muted">Teacher Profile</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<Pencil size={14} />} onClick={openEdit}>Edit</Button>
            {teacher.user_id && (
              <Button variant="secondary" icon={<Lock size={14} />} onClick={() => { pwForm.reset(); setPwModal(true) }}>
                Change Password
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-fg border-b border-border pb-2">Personal Information</h3>

          <div className="flex items-start gap-3">
            <User size={16} className="text-fg-subtle mt-0.5" />
            <div>
              <p className="text-xs text-fg-muted">Full Name</p>
              <p className="text-fg font-medium">{teacher.full_name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <GraduationCap size={16} className="text-fg-subtle mt-0.5" />
            <div>
              <p className="text-xs text-fg-muted">Gender</p>
              <p className="text-fg capitalize">{teacher.gender ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone size={16} className="text-fg-subtle mt-0.5" />
            <div>
              <p className="text-xs text-fg-muted">Phone</p>
              <p className="text-fg">{teacher.phone ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail size={16} className="text-fg-subtle mt-0.5" />
            <div>
              <p className="text-xs text-fg-muted">Email</p>
              <p className="text-fg">{teacher.email ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Employment Info */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-fg border-b border-border pb-2">Employment Details</h3>

          <div className="flex items-start gap-3">
            <Hash size={16} className="text-fg-subtle mt-0.5" />
            <div>
              <p className="text-xs text-fg-muted">Employee Number</p>
              <p className="text-fg">{teacher.employee_number ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar size={16} className="text-fg-subtle mt-0.5" />
            <div>
              <p className="text-xs text-fg-muted">Year Employed</p>
              <p className="text-fg">{yearEmployed}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <BadgeCheck size={16} className="text-fg-subtle mt-0.5" />
            <div>
              <p className="text-xs text-fg-muted">Assigned Class</p>
              <p className="text-fg">{className ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <BadgeCheck size={16} className="text-fg-subtle mt-0.5" />
            <div>
              <p className="text-xs text-fg-muted">Status</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={teacher.is_active ? 'green' : 'gray'}>{teacher.is_active ? 'Active' : 'Inactive'}</Badge>
                {isAdmin && (
                  <button onClick={toggleActive} className="text-xs text-fg-muted underline">
                    {teacher.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Login Account */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-fg border-b border-border pb-2">Login Account</h3>
          {teacher.user_id ? (
            <>
              <div className="flex items-start gap-3">
                <KeyRound size={16} className="text-fg-subtle mt-0.5" />
                <div>
                  <p className="text-xs text-fg-muted">Login Email</p>
                  <p className="text-fg">{loginEmail ?? '—'}</p>
                </div>
              </div>
              {isAdmin && teacher.temp_password && (
                <div className="flex items-start gap-3">
                  <Lock size={16} className="text-fg-subtle mt-0.5" />
                  <div>
                    <p className="text-xs text-fg-muted">Last Assigned Password</p>
                    <p className="text-fg font-mono">{teacher.temp_password}</p>
                  </div>
                </div>
              )}
              {isAdmin && !teacher.temp_password && (
                <p className="text-sm text-fg-muted">No password on record. Use &quot;Change Password&quot; to set one.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-fg-muted">No login account yet. Go to Teachers list to create one.</p>
          )}
        </div>

        {/* Notes */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-fg border-b border-border pb-2">Notes</h3>
          {teacher.notes
            ? <p className="text-fg whitespace-pre-wrap text-sm">{teacher.notes}</p>
            : <p className="text-fg-muted text-sm">No notes.</p>
          }
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Teacher">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" {...register('full_name')} />
            {errors.full_name && <p className="field-error">{errors.full_name.message}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" {...register('phone')} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" {...register('email')} />
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Employee Number</label>
            <input className="input" {...register('employee_number')} />
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
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[80px]" {...register('notes')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={isSubmitting} className="flex-1 justify-center">Save Changes</Button>
            <Button type="button" variant="ghost" onClick={() => setEditModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal open={pwModal} onClose={() => setPwModal(false)} title="Change Teacher Password">
        <form onSubmit={pwForm.handleSubmit(onChangePassword)} className="space-y-4">
          <p className="text-sm text-fg-muted">Set a new login password for {teacher.full_name}.</p>
          <div>
            <label className="label">New Password *</label>
            <input type="text" className="input" placeholder="Min 6 characters" {...pwForm.register('newPassword')} />
            {pwForm.formState.errors.newPassword && <p className="field-error">{pwForm.formState.errors.newPassword.message}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={pwForm.formState.isSubmitting} icon={<Lock size={14} />} className="flex-1 justify-center">
              Update Password
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPwModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
