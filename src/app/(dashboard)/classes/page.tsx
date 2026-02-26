'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil } from 'lucide-react'
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

const classSchema = z.object({
  name:            z.string().min(1, 'Class name is required'),
  term_fee_amount: z.coerce.number().min(0, 'Fee must be 0 or more'),
  academic_year:   z.string().optional(),
})
type ClassForm = z.infer<typeof classSchema>

export default function ClassesPage() {
  const [classes,  setClasses]  = useState<Class[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modalOpen, setModal]   = useState(false)
  const [editing,  setEditing]  = useState<Class | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('name')
    if (error) toast.error(error.message)
    else setClasses(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
  })

  function openAdd() {
    setEditing(null)
    reset({ name: '', term_fee_amount: 0, academic_year: '' })
    setModal(true)
  }

  function openEdit(cls: Class) {
    setEditing(cls)
    reset({ name: cls.name, term_fee_amount: cls.term_fee_amount, academic_year: cls.academic_year ?? '' })
    setModal(true)
  }

  async function onSubmit(values: ClassForm) {
    if (editing) {
      const { error } = await supabase
        .from('classes')
        .update({ name: values.name, term_fee_amount: values.term_fee_amount, academic_year: values.academic_year || null })
        .eq('id', editing.id)
      if (error) { toast.error(error.message); return }
      toast.success('Class updated')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()
      const { error } = await supabase
        .from('classes')
        .insert({ name: values.name, term_fee_amount: values.term_fee_amount, academic_year: values.academic_year || null, school_id: me!.school_id })
      if (error) { toast.error(error.message); return }
      toast.success('Class added')
    }
    setModal(false)
    load()
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
              <th>Class Name</th>
              <th>Term Fee</th>
              <th>Academic Year</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={4} />
            ) : classes.length === 0 ? (
              <tr><td colSpan={4}>
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
                  <td className="font-medium">{cls.name}</td>
                  <td>{formatCurrency(Number(cls.term_fee_amount))}</td>
                  <td className="text-gray-500 dark:text-gray-400">{cls.academic_year ?? '—'}</td>
                  <td>
                    <button
                      onClick={() => openEdit(cls)}
                      className="btn-ghost p-2 rounded-lg"
                      aria-label="Edit class"
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

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
            <label className="label">Term Fee (GHS) *</label>
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
