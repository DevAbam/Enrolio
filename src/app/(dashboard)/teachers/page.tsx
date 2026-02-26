'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import type { Teacher, Class } from '@/types'

const teacherSchema = z.object({
  full_name:       z.string().min(1, 'Full name is required'),
  phone:           z.string().optional(),
  email:           z.string().email('Invalid email').optional().or(z.literal('')),
  employee_number: z.string().optional(),
})
type TeacherForm = z.infer<typeof teacherSchema>

const loginSchema = z.object({
  email:    z.string().email('Valid email required'),
  password: z.string().min(8, 'Min 8 characters'),
  classId:  z.string().optional(),
})
type LoginForm = z.infer<typeof loginSchema>

interface TeacherWithUser extends Teacher {
  user_id:  string | null
  class_id: string | null
}

export default function TeachersPage() {
  const { isAdmin } = useRole()
  const [teachers,    setTeachers]    = useState<TeacherWithUser[]>([])
  const [classes,     setClasses]     = useState<Class[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState(false)
  const [editing,     setEditing]     = useState<Teacher | null>(null)
  const [loginModal,  setLoginModal]  = useState<TeacherWithUser | null>(null)
  const [loginSaving, setLoginSaving] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: tData }, { data: cData }] = await Promise.all([
      supabase.from('teachers').select('*').order('full_name'),
      supabase.from('classes').select('*').order('name'),
    ])
    setTeachers((tData ?? []) as TeacherWithUser[])
    setClasses(cData ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
  })
  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  function openAdd() {
    setEditing(null)
    reset({ full_name: '', phone: '', email: '', employee_number: '' })
    setModal(true)
  }

  function openEdit(t: Teacher) {
    setEditing(t)
    reset({ full_name: t.full_name, phone: t.phone ?? '', email: t.email ?? '', employee_number: t.employee_number ?? '' })
    setModal(true)
  }

  function openLogin(t: TeacherWithUser) {
    loginForm.reset({ email: t.email ?? '', password: '', classId: t.class_id ?? '' })
    setLoginModal(t)
  }

  async function onSubmit(values: TeacherForm) {
    const payload = {
      full_name:       values.full_name,
      phone:           values.phone || null,
      email:           values.email || null,
      employee_number: values.employee_number || null,
    }
    if (editing) {
      const { error } = await supabase.from('teachers').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
      toast.success('Teacher updated')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()
      const { error } = await supabase.from('teachers').insert({ ...payload, school_id: me!.school_id })
      if (error) { toast.error(error.message); return }
      toast.success('Teacher added')
    }
    setModal(false)
    load()
  }

  async function onCreateLogin(values: LoginForm) {
    if (!loginModal) return
    setLoginSaving(true)
    const res = await fetch('/api/teacher-account', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        teacherId: loginModal.id,
        email:     values.email,
        password:  values.password,
        fullName:  loginModal.full_name,
        classId:   values.classId || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); setLoginSaving(false); return }
    toast.success(`Login created for ${loginModal.full_name}`)
    setLoginModal(null)
    setLoginSaving(false)
    load()
  }

  async function toggleActive(t: Teacher) {
    await supabase.from('teachers').update({ is_active: !t.is_active }).eq('id', t.id)
    load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers"
        subtitle="Manage teaching staff"
        action={isAdmin ? <Button icon={<Plus size={16} />} onClick={openAdd}>Add Teacher</Button> : undefined}
      />

      <div className="card overflow-hidden">
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Employee No.</th>
              <th>Class</th>
              <th>Status</th>
              {isAdmin && <th>Login</th>}
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={isAdmin ? 8 : 6} />
            ) : teachers.length === 0 ? (
              <tr><td colSpan={isAdmin ? 8 : 6}>
                <EmptyState icon={<span>👨‍🏫</span>} title="No teachers yet" action={isAdmin ? <Button variant="secondary" size="sm" onClick={openAdd}>Add Teacher</Button> : undefined} />
              </td></tr>
            ) : (
              teachers.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.full_name}</td>
                  <td className="text-gray-500 dark:text-gray-400">{t.phone ?? '—'}</td>
                  <td className="text-gray-500 dark:text-gray-400">{t.email ?? '—'}</td>
                  <td className="text-gray-500 dark:text-gray-400">{t.employee_number ?? '—'}</td>
                  <td className="text-gray-500 dark:text-gray-400">
                    {classes.find((c) => c.id === t.class_id)?.name ?? '—'}
                  </td>
                  <td>
                    <button onClick={() => isAdmin && toggleActive(t)}>
                      <Badge variant={t.is_active ? 'green' : 'gray'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                    </button>
                  </td>
                  {isAdmin && (
                    <td>
                      {t.user_id
                        ? <Badge variant="green">Has Login</Badge>
                        : (
                          <button onClick={() => openLogin(t)} className="btn-ghost p-1.5 rounded text-xs flex items-center gap-1" title="Create login">
                            <KeyRound size={14} /> Create
                          </button>
                        )
                      }
                    </td>
                  )}
                  {isAdmin && (
                    <td>
                      <button onClick={() => openEdit(t)} className="btn-ghost p-2 rounded-lg">
                        <Pencil size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* Add/Edit Teacher Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Teacher' : 'Add Teacher'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" placeholder="John Mensah" {...register('full_name')} />
            {errors.full_name && <p className="field-error">{errors.full_name.message}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" placeholder="0XX XXX XXXX" {...register('phone')} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" placeholder="teacher@school.com" {...register('email')} />
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Employee Number</label>
            <input className="input" placeholder="EMP-001" {...register('employee_number')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={isSubmitting} className="flex-1 justify-center">
              {editing ? 'Save Changes' : 'Add Teacher'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Create Login Modal */}
      <Modal open={!!loginModal} onClose={() => setLoginModal(null)} title={`Create Login — ${loginModal?.full_name}`}>
        <form onSubmit={loginForm.handleSubmit(onCreateLogin)} className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This creates a login account. Share the email and temporary password with the teacher directly.
          </p>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" placeholder="teacher@school.com" {...loginForm.register('email')} />
            {loginForm.formState.errors.email && <p className="field-error">{loginForm.formState.errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Temporary Password *</label>
            <input type="text" className="input" placeholder="Min 8 characters" {...loginForm.register('password')} />
            {loginForm.formState.errors.password && <p className="field-error">{loginForm.formState.errors.password.message}</p>}
          </div>
          <div>
            <label className="label">Assign to Class</label>
            <select className="input" {...loginForm.register('classId')}>
              <option value="">— Select class —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loginSaving} icon={<KeyRound size={14} />} className="flex-1 justify-center">
              Create Login
            </Button>
            <Button type="button" variant="ghost" onClick={() => setLoginModal(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
