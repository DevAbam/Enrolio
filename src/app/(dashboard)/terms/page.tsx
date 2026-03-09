'use client'
import { useState, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, CheckCircle, Circle, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { useTerm, type AcademicTerm } from '@/lib/term-context'

const termSchema = z.object({
  year:        z.coerce.number().min(2000).max(2100),
  term_number: z.coerce.number().min(1).max(10),
  label:       z.string().min(1, 'Label is required'),
})
type TermForm = z.infer<typeof termSchema>

type ClassRow = { id: string; name: string }
type ClassTermFee = { class_id: string; fee_amount: number }

export default function TermsPage() {
  const supabase      = createClient()
  const { isAdmin }   = useRole()
  const { allTerms, activeTerm, reload } = useTerm()

  const [showForm, setShowForm]           = useState(false)
  const [editingTerm, setEditingTerm]     = useState<AcademicTerm | null>(null)
  const [expandedTerm, setExpandedTerm]   = useState<string | null>(null)
  const [classes, setClasses]             = useState<ClassRow[]>([])
  const [termFees, setTermFees]           = useState<Record<string, ClassTermFee[]>>({})
  const [feeInputs, setFeeInputs]         = useState<Record<string, string>>({})
  const [savingFees, setSavingFees]       = useState(false)
  const [settingActive, setSettingActive] = useState<string | null>(null)
  const [deletingTerm, setDeletingTerm]   = useState<string | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<TermForm>({
    resolver: zodResolver(termSchema),
  })

  const loadClasses = useCallback(async () => {
    const { data } = await supabase.from('classes').select('id, name').order('level', { ascending: true, nullsFirst: false }).order('name')
    if (data) setClasses(data as ClassRow[])
  }, [supabase])

  const loadTermFees = useCallback(async (termId: string) => {
    const { data } = await supabase.from('class_term_fees').select('class_id, fee_amount').eq('term_id', termId)
    if (data) {
      setTermFees(prev => ({ ...prev, [termId]: data as ClassTermFee[] }))
      const inputs: Record<string, string> = {}
      for (const fee of data as ClassTermFee[]) {
        inputs[fee.class_id] = String(fee.fee_amount)
      }
      setFeeInputs(inputs)
    }
  }, [supabase])

  useEffect(() => { loadClasses() }, [loadClasses])

  async function onSubmit(values: TermForm) {
    if (editingTerm) {
      const { error } = await supabase.from('academic_terms')
        .update({ year: values.year, term_number: values.term_number, label: values.label })
        .eq('id', editingTerm.id)
      if (error) { toast.error(error.message); return }
      toast.success('Term updated')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()
      const { error } = await supabase.from('academic_terms').insert({
        school_id: me!.school_id,
        year: values.year, term_number: values.term_number, label: values.label,
      })
      if (error) { toast.error(error.message); return }
      toast.success('Term created')
    }
    setShowForm(false)
    setEditingTerm(null)
    reset()
    reload()
  }

  async function setActive(termId: string) {
    if (!confirm('Activating this term will carry forward any outstanding balances from the current active term into the next term. Continue?')) return
    setSettingActive(termId)
    const { error } = await supabase.rpc('activate_term_with_carryover', { p_new_term_id: termId })
    if (error) { toast.error(error.message); setSettingActive(null); return }
    toast.success('Term activated — outstanding balances carried forward')
    reload()
    setSettingActive(null)
  }

  async function deleteTerm(termId: string) {
    if (!confirm('Delete this term? All fee overrides for this term will also be deleted.')) return
    setDeletingTerm(termId)
    const { error } = await supabase.from('academic_terms').delete().eq('id', termId)
    if (error) { toast.error(error.message) } else { toast.success('Term deleted'); reload() }
    setDeletingTerm(null)
  }

  async function saveTermFees(termId: string) {
    setSavingFees(true)
    const rows = classes
      .filter(c => feeInputs[c.id] !== undefined && feeInputs[c.id] !== '')
      .map(c => ({
        class_id:   c.id,
        term_id:    termId,
        fee_amount: parseFloat(feeInputs[c.id] || '0'),
        school_id:  allTerms.find(t => t.id === termId)?.school_id ?? '',
      }))
    const { error } = await supabase.from('class_term_fees').upsert(rows, { onConflict: 'class_id,term_id' })
    if (error) { toast.error(error.message) } else { toast.success('Fee overrides saved') }
    setSavingFees(false)
  }

  function openEdit(term: AcademicTerm) {
    setEditingTerm(term)
    setValue('year', term.year)
    setValue('term_number', term.term_number)
    setValue('label', term.label)
    setShowForm(true)
  }

  function toggleExpand(termId: string) {
    if (expandedTerm === termId) {
      setExpandedTerm(null)
    } else {
      setExpandedTerm(termId)
      loadTermFees(termId)
    }
  }

  function openAddForYear(year: number) {
    setEditingTerm(null)
    setValue('year', year)
    setValue('label', '')
    setShowForm(true)
  }

  // Group terms by year (allTerms already sorted year DESC, term_number ASC)
  const termsByYear = allTerms.reduce<Record<number, typeof allTerms>>((acc, t) => {
    if (!acc[t.year]) acc[t.year] = []
    acc[t.year].push(t)
    return acc
  }, {})
  const sortedYears = Object.keys(termsByYear).map(Number).sort((a, b) => b - a)

  if (!isAdmin) {
    return <p className="text-fg-muted">Admin access required.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-fg">Terms &amp; Semesters</h2>
          <p className="text-sm text-fg-muted mt-0.5">
            Manage academic terms. Set one as active to link payments and attendance to it.
            {activeTerm && (
              <span className="ml-2 text-accent font-medium">Active: {activeTerm.label}</span>
            )}
          </p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingTerm(null); reset() }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Term
        </button>
      </div>

      {showForm && (
        <div className="card p-5">
          <h3 className="font-medium text-fg mb-4">{editingTerm ? 'Edit Term' : 'New Term'}</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Year</label>
              <input type="number" className="input" placeholder="2026" {...register('year')} />
              {errors.year && <p className="text-red-500 text-xs mt-1">{errors.year.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Term Number</label>
              <input type="number" className="input" placeholder="1" min={1} {...register('term_number')} />
              {errors.term_number && <p className="text-red-500 text-xs mt-1">{errors.term_number.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Label</label>
              <input type="text" className="input" placeholder="Term 1 2026" {...register('label')} />
              {errors.label && <p className="text-red-500 text-xs mt-1">{errors.label.message}</p>}
            </div>
            <div className="sm:col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditingTerm(null); reset() }} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? 'Saving…' : editingTerm ? 'Update Term' : 'Create Term'}
              </button>
            </div>
          </form>
        </div>
      )}

      {allTerms.length === 0 && (
        <div className="card text-center py-12 text-fg-muted">
          No terms yet. Create your first term to get started.
        </div>
      )}

      <div className="space-y-6">
        {sortedYears.map(year => (
          <div key={year}>
            {/* Year header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-bold text-fg-muted uppercase tracking-wide">{year}</h3>
              <button
                onClick={() => openAddForYear(year)}
                className="btn-ghost flex items-center gap-1 text-xs py-1 px-2"
                title={`Add a term to ${year}`}
              >
                <Plus size={13} /> Add Term
              </button>
            </div>

            <div className="space-y-2">
              {termsByYear[year].map(term => (
                <div key={term.id} className="card p-0 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => term.is_active ? undefined : setActive(term.id)}
                      disabled={settingActive === term.id}
                      title={term.is_active ? 'Active term' : 'Set as active'}
                      className={term.is_active ? 'text-accent' : 'text-fg-subtle hover:text-accent transition-colors'}
                    >
                      {term.is_active ? <CheckCircle size={20} /> : <Circle size={20} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-fg">{term.label}</p>
                      <p className="text-xs text-fg-muted">Term {term.term_number}</p>
                    </div>
                    {term.is_active && (
                      <span className="text-xs bg-accent-bg text-accent px-2 py-0.5 rounded-full font-medium">Active</span>
                    )}
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(term)} className="btn-ghost p-1.5" title="Edit"><Pencil size={14} /></button>
                      <button
                        onClick={() => deleteTerm(term.id)}
                        disabled={deletingTerm === term.id || term.is_active}
                        className="btn-ghost p-1.5 text-red-500 disabled:opacity-40"
                        title={term.is_active ? 'Cannot delete active term' : 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                      <button onClick={() => toggleExpand(term.id)} className="btn-ghost p-1.5" title="Set class fees">
                        {expandedTerm === term.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {expandedTerm === term.id && (
                    <div className="border-t border-border px-4 py-3 bg-surface-alt">
                      <p className="text-sm font-medium text-fg mb-1">Class Fees for this Term</p>
                      <p className="text-xs text-fg-muted mb-3">Enter the fee for each class for this term. Leave blank for 0 (no charge).</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        {classes.map(cls => (
                          <div key={cls.id}>
                            <label className="block text-xs text-fg-muted mb-1">{cls.name}</label>
                            <input
                              type="number"
                              className="input text-sm"
                              placeholder="0.00"
                              value={feeInputs[cls.id] ?? ''}
                              onChange={e => setFeeInputs(prev => ({ ...prev, [cls.id]: e.target.value }))}
                              min={0}
                              step={0.01}
                            />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => saveTermFees(term.id)} disabled={savingFees} className="btn-primary text-sm">
                        {savingFees ? 'Saving…' : 'Save Fee Overrides'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
