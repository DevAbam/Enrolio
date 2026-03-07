'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, ChevronsUp } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import type { Class } from '@/types'

type PromoteStudent = { id: string; full_name: string; admission_number: string | null }

type ClassWithLevel = Class & { level?: number | null }

const classSchema = z.object({
  name:            z.string().min(1, 'Class name is required'),
  term_fee_amount: z.coerce.number().min(0, 'Fee must be 0 or more'),
  academic_year:   z.string().optional(),
  level:           z.coerce.number().int().optional().nullable(),
})
type ClassForm = z.infer<typeof classSchema>

export default function ClassesPage() {
  const [classes,  setClasses]  = useState<ClassWithLevel[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modalOpen, setModal]   = useState(false)
  const [editing,  setEditing]  = useState<ClassWithLevel | null>(null)
  const [promoting, setPromoting] = useState<string | null>(null)
  // promote modal state
  const [promoteModal, setPromoteModal] = useState<{ cls: ClassWithLevel; nextCls: ClassWithLevel } | null>(null)
  const [promoteStudents, setPromoteStudents] = useState<PromoteStudent[]>([])
  const [promoteSelected, setPromoteSelected] = useState<Set<string>>(new Set())
  const [promoteLoading, setPromoteLoading] = useState(false)
  const [promoteSaving,  setPromoteSaving]  = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('level', { ascending: true, nullsFirst: false })
      .order('name')
    if (error) toast.error(error.message)
    else setClasses((data ?? []) as ClassWithLevel[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
  })

  function openAdd() {
    setEditing(null)
    reset({ name: '', term_fee_amount: 0, academic_year: '', level: null })
    setModal(true)
  }

  function openEdit(cls: ClassWithLevel) {
    setEditing(cls)
    reset({ name: cls.name, term_fee_amount: cls.term_fee_amount, academic_year: cls.academic_year ?? '', level: cls.level ?? null })
    setModal(true)
  }

  async function onSubmit(values: ClassForm) {
    const payload = {
      name:            values.name,
      term_fee_amount: values.term_fee_amount,
      academic_year:   values.academic_year || null,
      level:           values.level ?? null,
    }
    if (editing) {
      const { error } = await supabase.from('classes').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
      toast.success('Class updated')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()
      const { error } = await supabase.from('classes').insert({ ...payload, school_id: me!.school_id })
      if (error) { toast.error(error.message); return }
      toast.success('Class added')
    }
    setModal(false)
    load()
  }

  async function openPromoteModal(cls: ClassWithLevel) {
    if (cls.level == null) {
      toast.error('Set a level on this class first so we know which class comes next.')
      return
    }
    const nextCls = classes.find(c => c.level === (cls.level! + 1))
    if (!nextCls) {
      toast.error('No class found with the next level. This may be the highest level.')
      return
    }
    setPromoteLoading(true)
    setPromoteModal({ cls, nextCls })
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, admission_number')
      .eq('class_id', cls.id)
      .eq('is_active', true)
      .order('full_name')
    if (error) { toast.error(error.message); setPromoteModal(null); setPromoteLoading(false); return }
    const list = (data ?? []) as PromoteStudent[]
    setPromoteStudents(list)
    setPromoteSelected(new Set(list.map(s => s.id)))
    setPromoteLoading(false)
  }

  async function executePromotion() {
    if (!promoteModal) return
    const ids = Array.from(promoteSelected)
    if (ids.length === 0) { toast.error('No students selected.'); return }
    setPromoteSaving(true)
    const { error } = await supabase.rpc('promote_students', {
      p_student_ids:     ids,
      p_target_class_id: promoteModal.nextCls.id,
    })
    if (error) { toast.error(error.message) }
    else { toast.success(`${ids.length} student${ids.length !== 1 ? 's' : ''} promoted to ${promoteModal.nextCls.name}`) }
    setPromoteSaving(false)
    setPromoteModal(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        subtitle="Manage class groups and term fees"
        action={<Button icon={<Plus size={16} />} onClick={openAdd}>Add Class</Button>}
      />

      <div className="card overflow-hidden">
        <Table>
          <thead>
            <tr>
              <th>Level</th>
              <th>Class Name</th>
              <th>Term Fee</th>
              <th>Academic Year</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : classes.length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState
                  icon={<span>📚</span>}
                  title="No classes yet"
                  description="Add your first class to get started"
                  action={<Button variant="secondary" icon={<Plus size={14} />} onClick={openAdd} size="sm">Add Class</Button>}
                />
              </td></tr>
            ) : (
              classes.map((cls) => (
                <tr key={cls.id}>
                  <td className="text-fg-muted text-sm">{cls.level ?? <span className="text-fg-subtle">—</span>}</td>
                  <td className="font-medium">{cls.name}</td>
                  <td>{formatCurrency(Number(cls.term_fee_amount))}</td>
                  <td className="text-gray-500 dark:text-gray-400">{cls.academic_year ?? '—'}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(cls)}
                        className="btn-ghost p-2 rounded-lg"
                        aria-label="Edit class"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => openPromoteModal(cls)}
                        disabled={promoting === cls.id}
                        className="btn-ghost p-2 rounded-lg"
                        title="Promote students in this class to the next level"
                      >
                        <ChevronsUp size={15} className="text-accent" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* Promote with exclusions modal */}
      <Modal
        open={!!promoteModal}
        onClose={() => setPromoteModal(null)}
        title={promoteModal ? `Promote from ${promoteModal.cls.name} → ${promoteModal.nextCls.name}` : ''}
      >
        {promoteLoading ? (
          <div className="py-8 text-center text-fg-muted text-sm">Loading students…</div>
        ) : promoteStudents.length === 0 ? (
          <div className="py-8 text-center text-fg-muted text-sm">No active students in this class.</div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-fg-muted">
              Uncheck any students you want to exclude from this promotion. All others will be moved to{' '}
              <span className="font-medium text-fg">{promoteModal?.nextCls.name}</span>.
            </p>
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <input
                type="checkbox"
                id="select-all-promote"
                className="rounded border-border"
                checked={promoteSelected.size === promoteStudents.length}
                onChange={(e) => {
                  if (e.target.checked) setPromoteSelected(new Set(promoteStudents.map(s => s.id)))
                  else setPromoteSelected(new Set())
                }}
              />
              <label htmlFor="select-all-promote" className="text-sm font-medium text-fg cursor-pointer">
                Select all ({promoteStudents.length})
              </label>
              <span className="ml-auto text-xs text-fg-muted">{promoteSelected.size} selected</span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {promoteStudents.map(s => (
                <label key={s.id} className="flex items-center gap-3 px-1 py-1.5 rounded hover:bg-surface-alt cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={promoteSelected.has(s.id)}
                    onChange={() => {
                      setPromoteSelected(prev => {
                        const next = new Set(prev)
                        next.has(s.id) ? next.delete(s.id) : next.add(s.id)
                        return next
                      })
                    }}
                  />
                  <span className="text-sm text-fg flex-1">{s.full_name}</span>
                  {s.admission_number && <span className="text-xs text-fg-muted">{s.admission_number}</span>}
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 justify-center"
                onClick={executePromotion}
                loading={promoteSaving}
                disabled={promoteSelected.size === 0}
              >
                Promote {promoteSelected.size} Student{promoteSelected.size !== 1 ? 's' : ''}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPromoteModal(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Class' : 'Add Class'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Class Name *</label>
            <input className="input" placeholder="e.g. Grade 6A" {...register('name')} />
            {errors.name && <p className="field-error">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Level (for ordering &amp; promotion)</label>
            <input type="number" className="input" placeholder="e.g. 1 = Creche, 2 = Nursery 1…" {...register('level')} />
            <p className="text-xs text-fg-muted mt-1">Higher number = higher class. Used to determine promotion order.</p>
          </div>
          <div>
            <label className="label">Default Term Fee (GHS) *</label>
            <input type="number" min="0" step="0.01" className="input" placeholder="0.00" {...register('term_fee_amount')} />
            {errors.term_fee_amount && <p className="field-error">{errors.term_fee_amount.message}</p>}
          </div>
          <div>
            <label className="label">Academic Year</label>
            <input className="input" placeholder="e.g. 2024/2025" {...register('academic_year')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={isSubmitting} className="flex-1 justify-center">
              {editing ? 'Save Changes' : 'Add Class'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
