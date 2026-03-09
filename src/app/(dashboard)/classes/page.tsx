'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, ChevronsUp, GraduationCap } from 'lucide-react'
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
import type { Class } from '@/types'

type ActionStudent = { id: string; full_name: string; admission_number: string | null }

const classSchema = z.object({
  name:  z.string().min(1, 'Class name is required'),
  level: z.coerce.number().int().optional().nullable(),
})
type ClassForm = z.infer<typeof classSchema>

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModal] = useState(false)
  const [editing, setEditing] = useState<Class | null>(null)

  // Promote modal
  const [promoteModal, setPromoteModal] = useState<{ cls: Class; nextCls: Class } | null>(null)
  const [promoteStudents, setPromoteStudents] = useState<ActionStudent[]>([])
  const [promoteSelected, setPromoteSelected] = useState<Set<string>>(new Set())
  const [promoteLoading, setPromoteLoading] = useState(false)
  const [promoteSaving, setPromoteSaving] = useState(false)

  // Graduate modal (for the highest-level class)
  const [graduateModal, setGraduateModal] = useState<{ cls: Class } | null>(null)
  const [graduateStudents, setGraduateStudents] = useState<ActionStudent[]>([])
  const [graduateSelected, setGraduateSelected] = useState<Set<string>>(new Set())
  const [graduateLoading, setGraduateLoading] = useState(false)
  const [graduateSaving, setGraduateSaving] = useState(false)

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('level', { ascending: true, nullsFirst: false })
      .order('name')
    if (error) toast.error(error.message)
    else setClasses((data ?? []) as Class[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
  })

  function openAdd() {
    setEditing(null)
    reset({ name: '', level: null })
    setModal(true)
  }

  function openEdit(cls: Class) {
    setEditing(cls)
    reset({ name: cls.name, level: cls.level ?? null })
    setModal(true)
  }

  async function onSubmit(values: ClassForm) {
    const payload = { name: values.name, level: values.level ?? null }
    if (editing) {
      const { error } = await supabase.from('classes').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
      toast.success('Class updated')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()
      const { error } = await supabase.from('classes').insert({ ...payload, school_id: me!.school_id })
      if (error) { toast.error(error.message); return }
      toast.success('Class added — set fees for this class in Terms → expand term → Class Fees')
    }
    setModal(false)
    load()
  }

  /** True when no class has a higher level than cls */
  function isHighestLevel(cls: Class): boolean {
    if (cls.level == null) return false
    return !classes.some(c => c.level != null && c.level > cls.level!)
  }

  async function loadClassStudents(cls: Class): Promise<ActionStudent[]> {
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, admission_number')
      .eq('class_id', cls.id)
      .eq('is_active', true)
      .eq('is_graduated', false)
      .order('full_name')
    if (error) { toast.error(error.message); return [] }
    return (data ?? []) as ActionStudent[]
  }

  // ── Promote ───────────────────────────────────────────────────────────────
  async function openPromoteModal(cls: Class) {
    if (cls.level == null) {
      toast.error('Set a level on this class first so we know which class comes next.')
      return
    }
    const nextCls = classes.find(c => c.level === cls.level! + 1)
    if (!nextCls) {
      toast.error('No class found with the next level. Use the Graduate action for the highest level.')
      return
    }
    setPromoteLoading(true)
    setPromoteModal({ cls, nextCls })
    const list = await loadClassStudents(cls)
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
      p_student_ids: ids,
      p_target_class_id: promoteModal.nextCls.id,
    })
    if (error) { toast.error(error.message) }
    else {
      toast.success(
        `${ids.length} student${ids.length !== 1 ? 's' : ''} promoted to ${promoteModal.nextCls.name}. ` +
        'Outstanding balances carried forward.'
      )
    }
    setPromoteSaving(false)
    setPromoteModal(null)
  }

  // ── Graduate ──────────────────────────────────────────────────────────────
  async function openGraduateModal(cls: Class) {
    setGraduateLoading(true)
    setGraduateModal({ cls })
    const list = await loadClassStudents(cls)
    setGraduateStudents(list)
    setGraduateSelected(new Set(list.map(s => s.id)))
    setGraduateLoading(false)
  }

  async function executeGraduation() {
    if (!graduateModal) return
    const ids = Array.from(graduateSelected)
    if (ids.length === 0) { toast.error('No students selected.'); return }
    setGraduateSaving(true)
    const { error } = await supabase.rpc('graduate_students', { p_student_ids: ids })
    if (error) { toast.error(error.message) }
    else {
      toast.success(
        `${ids.length} student${ids.length !== 1 ? 's' : ''} graduated from ${graduateModal.cls.name}. ` +
        'Full history is preserved.'
      )
    }
    setGraduateSaving(false)
    setGraduateModal(null)
  }

  // ── Student selection helpers ─────────────────────────────────────────────
  function makeCheckboxList(
    students: ActionStudent[],
    selected: Set<string>,
    setSelected: (s: Set<string>) => void,
    listId: string,
  ) {
    return (
      <>
        <div className="flex items-center gap-2 pb-1 border-b border-border">
          <input
            type="checkbox"
            id={listId}
            className="rounded border-border"
            checked={selected.size === students.length && students.length > 0}
            onChange={(e) => {
              if (e.target.checked) setSelected(new Set(students.map(s => s.id)))
              else setSelected(new Set())
            }}
          />
          <label htmlFor={listId} className="text-sm font-medium text-fg cursor-pointer">
            Select all ({students.length})
          </label>
          <span className="ml-auto text-xs text-fg-muted">{selected.size} selected</span>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {students.map(s => (
            <label key={s.id} className="flex items-center gap-3 px-1 py-1.5 rounded hover:bg-surface-alt cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border"
                checked={selected.has(s.id)}
                onChange={() => {
                  const next = new Set(selected)
                  next.has(s.id) ? next.delete(s.id) : next.add(s.id)
                  setSelected(next)
                }}
              />
              <span className="text-sm text-fg flex-1">{s.full_name}</span>
              {s.admission_number && <span className="text-xs text-fg-muted">{s.admission_number}</span>}
            </label>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        subtitle="Define class structure. Set fees per term in the Terms page."
        action={<Button icon={<Plus size={16} />} onClick={openAdd}>Add Class</Button>}
      />

      <div className="card overflow-hidden">
        <Table>
          <thead>
            <tr>
              <th>Level</th>
              <th>Class Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={3} />
            ) : classes.length === 0 ? (
              <tr><td colSpan={3}>
                <EmptyState
                  title="No classes yet"
                  description="Add your first class, then set fees for each class in the Terms page."
                  action={<Button variant="secondary" icon={<Plus size={14} />} onClick={openAdd} size="sm">Add Class</Button>}
                />
              </td></tr>
            ) : (
              classes.map((cls) => {
                const isTop = isHighestLevel(cls)
                return (
                  <tr key={cls.id}>
                    <td className="text-fg-muted text-sm w-16">
                      {cls.level ?? <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className="font-medium">
                      {cls.name}
                      {isTop && cls.level != null && (
                        <span className="ml-2 text-xs text-fg-subtle border border-border rounded px-1.5 py-0.5">
                          Final Level
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(cls)}
                          className="btn-ghost p-2 rounded-lg"
                          aria-label="Edit class"
                        >
                          <Pencil size={15} />
                        </button>
                        {cls.level != null && (
                          isTop ? (
                            <button
                              onClick={() => openGraduateModal(cls)}
                              className="btn-ghost p-2 rounded-lg"
                              title="Graduate students from this final-level class"
                            >
                              <GraduationCap size={15} className="text-accent" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openPromoteModal(cls)}
                              className="btn-ghost p-2 rounded-lg"
                              title="Promote students to the next level"
                            >
                              <ChevronsUp size={15} className="text-accent" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
      </div>

      {/* ── Promote modal ── */}
      <Modal
        open={!!promoteModal}
        onClose={() => setPromoteModal(null)}
        title={promoteModal ? `Promote: ${promoteModal.cls.name} → ${promoteModal.nextCls.name}` : ''}
      >
        {promoteLoading ? (
          <div className="py-8 text-center text-fg-muted text-sm">Loading students…</div>
        ) : promoteStudents.length === 0 ? (
          <div className="py-8 text-center text-fg-muted text-sm">No active students in this class.</div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-fg-muted">
              Uncheck students to exclude. Selected students move to{' '}
              <span className="font-medium text-fg">{promoteModal?.nextCls.name}</span>.
              Outstanding balances carry forward.
            </p>
            {makeCheckboxList(promoteStudents, promoteSelected, setPromoteSelected, 'select-all-promote')}
            <div className="flex gap-3 pt-2">
              <Button className="flex-1 justify-center" onClick={executePromotion} loading={promoteSaving} disabled={promoteSelected.size === 0}>
                Promote {promoteSelected.size} Student{promoteSelected.size !== 1 ? 's' : ''}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPromoteModal(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Graduate modal ── */}
      <Modal
        open={!!graduateModal}
        onClose={() => setGraduateModal(null)}
        title={graduateModal ? `Graduate students from ${graduateModal.cls.name}` : ''}
      >
        {graduateLoading ? (
          <div className="py-8 text-center text-fg-muted text-sm">Loading students…</div>
        ) : graduateStudents.length === 0 ? (
          <div className="py-8 text-center text-fg-muted text-sm">No active students in this class.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              Graduated students are deactivated. Their full history — attendance, payments, and records — is kept permanently.
            </div>
            <p className="text-sm text-fg-muted">Uncheck any students to exclude from graduation.</p>
            {makeCheckboxList(graduateStudents, graduateSelected, setGraduateSelected, 'select-all-graduate')}
            <div className="flex gap-3 pt-2">
              <Button className="flex-1 justify-center" onClick={executeGraduation} loading={graduateSaving} disabled={graduateSelected.size === 0}>
                Graduate {graduateSelected.size} Student{graduateSelected.size !== 1 ? 's' : ''}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setGraduateModal(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add / Edit class modal ── */}
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
            <p className="text-xs text-fg-muted mt-1">
              Higher number = higher class. The class with the highest level gets a Graduate button instead of Promote.
            </p>
            {errors.level && <p className="field-error">{errors.level.message}</p>}
          </div>
          <div className="rounded bg-surface-alt border border-border px-3 py-2 text-xs text-fg-muted">
            Fees are set per term in <strong>Terms → expand term → Class Fees</strong>, not here.
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
