'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, KeyRound, X, Lock, Power } from 'lucide-react'
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
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'
import { cn } from '@/lib/utils/cn'
import type { Teacher, Class } from '@/types'

const PAGE_SIZE = 10

type StaffType = 'teaching' | 'non_teaching'

const teacherSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  employee_number: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  date_of_birth: z.string().optional(),
  class_id: z.string().optional(),
  staff_type: z.enum(['teaching', 'non_teaching']),
  staff_role: z.string().optional(),
})
type TeacherForm = z.infer<typeof teacherSchema>

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Min 8 characters'),
  classId: z.string().optional(),
})
type LoginForm = z.infer<typeof loginSchema>

const pwSchema = z.object({
  newPassword: z.string().min(6, 'Min 6 characters'),
})
type PwForm = z.infer<typeof pwSchema>

interface TeacherWithUser extends Teacher {
  user_id: string | null
  class_id: string | null
}

export default function TeachersPage() {
  const { isAdmin } = useRole()
  const router = useRouter()
  const [staffType, setStaffType] = useState<StaffType>('teaching')
  const [teachers, setTeachers] = useState<TeacherWithUser[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [loginModal, setLoginModal] = useState<TeacherWithUser | null>(null)
  const [loginSaving, setLoginSaving] = useState(false)
  const [pwModal, setPwModal] = useState<TeacherWithUser | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('teachers')
      .select('*', { count: 'exact' })
      .eq('staff_type', staffType)
      .order('full_name')
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (search) query = query.ilike('full_name', `%${search}%`)
    if (genderFilter) query = query.eq('gender', genderFilter)
    if (statusFilter === 'active') query = query.eq('is_active', true)
    if (statusFilter === 'inactive') query = query.eq('is_active', false)

    const [{ data: tData, count }, { data: cData }] = await Promise.all([
      query,
      supabase.from('classes').select('*').order('name'),
    ])
    setTeachers((tData ?? []) as TeacherWithUser[])
    setTotal(count ?? 0)
    setClasses(cData ?? [])
    setLoading(false)
  }, [supabase, search, genderFilter, statusFilter, page, staffType])

  function clearFilters() {
    setSearch(''); setGenderFilter(''); setStatusFilter(''); setPage(1)
  }
  const hasFilters = search || genderFilter || statusFilter

  useEffect(() => { load() }, [load])

  // Reset page when staffType changes
  useEffect(() => { setPage(1) }, [staffType])

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { staff_type: 'teaching' },
  })
  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const pwForm = useForm<PwForm>({ resolver: zodResolver(pwSchema) })

  const watchedStaffType = watch('staff_type')
  const isTeachingForm = watchedStaffType === 'teaching'

  function openAdd() {
    setEditing(null)
    reset({ full_name: '', phone: '', email: '', employee_number: '', gender: '', date_of_birth: '', class_id: '', staff_type: staffType, staff_role: '' })
    setModal(true)
  }

  function openEdit(t: TeacherWithUser) {
    setEditing(t)
    reset({
      full_name: t.full_name, phone: t.phone ?? '', email: t.email ?? '',
      employee_number: t.employee_number ?? '', gender: (t.gender as 'male' | 'female' | 'other' | '') ?? '',
      date_of_birth: (t as Teacher & { date_of_birth?: string }).date_of_birth ?? '',
      class_id: t.class_id ?? '', staff_type: (t.staff_type as StaffType) ?? 'teaching',
      staff_role: (t as Teacher & { staff_role?: string }).staff_role ?? '',
    })
    setModal(true)
  }

  function openLogin(t: TeacherWithUser) {
    loginForm.reset({ email: t.email ?? '', password: '', classId: t.class_id ?? '' })
    setLoginModal(t)
  }

  function openPw(t: TeacherWithUser) {
    pwForm.reset({ newPassword: '' })
    setPwModal(t)
  }

  async function onSubmit(values: TeacherForm) {
    const isTeaching = values.staff_type === 'teaching'
    const payload = {
      full_name: values.full_name,
      phone: values.phone || null,
      email: values.email || null,
      employee_number: values.employee_number || null,
      gender: values.gender || null,
      date_of_birth: values.date_of_birth || null,
      class_id: isTeaching ? (values.class_id || null) : null,
      staff_type: values.staff_type,
      staff_role: !isTeaching ? (values.staff_role || null) : null,
    }
    if (editing) {
      const { error } = await supabase.from('teachers').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
      // Sync auth email if changed and teacher has a login
      const editingUser = editing as TeacherWithUser
      if (editingUser.user_id && values.email && values.email !== editing.email) {
        const res = await fetch('/api/teacher-account/update-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: editingUser.user_id, email: values.email }),
        })
        if (!res.ok) toast.warning('Profile saved but login email could not be updated in auth')
      }
      toast.success(`${isTeaching ? 'Teaching' : 'Non-teaching'} staff updated`)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()
      const { error } = await supabase.from('teachers').insert({ ...payload, school_id: me!.school_id })
      if (error) { toast.error(error.message); return }
      toast.success(`${isTeaching ? 'Teaching' : 'Non-teaching'} staff added`)
    }
    setModal(false)
    load()
  }

  async function onCreateLogin(values: LoginForm) {
    if (!loginModal) return
    setLoginSaving(true)
    const res = await fetch('/api/teacher-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: loginModal.id,
        email: values.email,
        password: values.password,
        fullName: loginModal.full_name,
        classId: values.classId || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); setLoginSaving(false); return }
    await supabase.from('teachers').update({ temp_password: values.password }).eq('id', loginModal.id)
    toast.success(`Login created for ${loginModal.full_name}`)
    setLoginModal(null)
    setLoginSaving(false)
    load()
  }

  async function onChangePassword(values: PwForm) {
    if (!pwModal) return
    const res = await fetch('/api/teacher-account/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: pwModal.id, userId: pwModal.user_id, newPassword: values.newPassword }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); return }
    toast.success('Password updated')
    setPwModal(null)
    load()
  }

  async function toggleActive(t: Teacher) {
    await supabase.from('teachers').update({ is_active: !t.is_active }).eq('id', t.id)
    load()
  }

  const isTeaching = staffType === 'teaching'
  const pageTitle = isTeaching ? 'Teaching Staff' : 'Non-Teaching Staff'
  const addLabel = isTeaching ? 'Add Teaching Staff' : 'Add Non-Teaching Staff'
  const colCount = isAdmin ? (isTeaching ? 9 : 7) : (isTeaching ? 7 : 5)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        subtitle={`Managing ${pageTitle.toLowerCase()}`}
        action={isAdmin ? <Button icon={<Plus size={16} />} onClick={openAdd}>{addLabel}</Button> : undefined}
      />

      {/* Staff type toggle */}
      <div className="flex gap-1 p-1 bg-surface-alt rounded-lg w-fit border border-border">
        <button
          className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', isTeaching ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg')}
          onClick={() => setStaffType('teaching')}
        >
          Teaching Staff
        </button>
        <button
          className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', !isTeaching ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg')}
          onClick={() => setStaffType('non_teaching')}
        >
          Non-Teaching Staff
        </button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <SearchInput
            placeholder={`Search by name…`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select className="input max-w-[150px]" value={genderFilter} onChange={(e) => { setGenderFilter(e.target.value); setPage(1) }}>
          <option value="">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <select className="input max-w-[150px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="btn-ghost flex items-center gap-1 text-sm px-3 py-2">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Gender</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Employee No.</th>
              {isTeaching && <th>Class</th>}
              <th>Status</th>
              {isAdmin && isTeaching && <th>Login</th>}
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={colCount} />
            ) : teachers.length === 0 ? (
              <tr><td colSpan={colCount}>
                <EmptyState
                  title={`No ${pageTitle.toLowerCase()} found`}
                  action={isAdmin ? <Button variant="secondary" size="sm" onClick={openAdd}>{addLabel}</Button> : undefined}
                />
              </td></tr>
            ) : (
              teachers.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-surface-alt transition-colors"
                  onClick={() => router.push(`/teachers/${t.id}`)}
                >
                  <td className="font-medium">{t.full_name}</td>
                  <td className="text-gray-500 dark:text-gray-400 capitalize">{t.gender ?? '—'}</td>
                  <td className="text-gray-500 dark:text-gray-400">{t.phone ?? '—'}</td>
                  <td className="text-gray-500 dark:text-gray-400">{t.email ?? '—'}</td>
                  <td className="text-gray-500 dark:text-gray-400">{t.employee_number ?? '—'}</td>
                  {isTeaching && (
                    <td className="text-gray-500 dark:text-gray-400">
                      {classes.find((c) => c.id === t.class_id)?.name ?? '—'}
                    </td>
                  )}
                  <td>
                    <Badge variant={t.is_active ? 'green' : 'gray'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  {isAdmin && isTeaching && (
                    <td onClick={e => e.stopPropagation()}>
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
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(t)} className="btn-ghost p-2 rounded-lg" title="Edit">
                          <Pencil size={15} />
                        </button>
                        {isTeaching && t.user_id && (
                          <button onClick={() => openPw(t)} className="btn-ghost p-2 rounded-lg" title="Change password">
                            <Lock size={15} />
                          </button>
                        )}
                        <button
                          className="btn-ghost p-2 rounded-lg"
                          title={t.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => toggleActive(t)}
                        >
                          <Power size={15} className={!t.is_active ? 'text-accent' : ''} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {/* Add/Edit Staff Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Staff' : 'Add Staff'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Staff type selector */}
          <div>
            <label className="label">Staff Type *</label>
            <div className="flex gap-1 p-1 bg-surface-alt rounded-lg border border-border w-fit mt-1">
              <label className={cn('px-3 py-1 rounded-md text-sm font-medium cursor-pointer transition-colors', watchedStaffType === 'teaching' ? 'bg-accent text-white' : 'text-fg-muted')}>
                <input type="radio" value="teaching" {...register('staff_type')} className="sr-only" />
                Teaching
              </label>
              <label className={cn('px-3 py-1 rounded-md text-sm font-medium cursor-pointer transition-colors', watchedStaffType === 'non_teaching' ? 'bg-accent text-white' : 'text-fg-muted')}>
                <input type="radio" value="non_teaching" {...register('staff_type')} className="sr-only" />
                Non-Teaching
              </label>
            </div>
          </div>

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
            <input type="email" className="input" placeholder="staff@school.com" {...register('email')} />
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Employee Number</label>
            <input className="input" placeholder="EMP-001" {...register('employee_number')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <label className="label">Date of Birth</label>
              <input type="date" className="input" {...register('date_of_birth')} />
            </div>
          </div>
          {editing && isTeachingForm && (
            <div>
              <label className="label">Assigned Class</label>
              <select className="input" {...register('class_id')}>
                <option value="">— No class —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {!isTeachingForm && (
            <div>
              <label className="label">Role / Position</label>
              <input className="input" placeholder="e.g. Driver, Cook, Cleaner, Security" {...register('staff_role')} />
              <p className="text-xs text-fg-muted mt-1">The specific role this staff member performs</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={isSubmitting} className="flex-1 justify-center">
              {editing ? 'Save Changes' : 'Add Staff'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Create Login Modal (teaching staff only) */}
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

      {/* Change Password Modal */}
      <Modal open={!!pwModal} onClose={() => setPwModal(null)} title={`Change Password — ${pwModal?.full_name}`}>
        <form onSubmit={pwForm.handleSubmit(onChangePassword)} className="space-y-4">
          <p className="text-sm text-fg-muted">Set a new login password for this staff member.</p>
          <div>
            <label className="label">New Password *</label>
            <input type="text" className="input" placeholder="Min 6 characters" {...pwForm.register('newPassword')} />
            {pwForm.formState.errors.newPassword && <p className="field-error">{pwForm.formState.errors.newPassword.message}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={pwForm.formState.isSubmitting} icon={<Lock size={14} />} className="flex-1 justify-center">
              Update Password
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPwModal(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
