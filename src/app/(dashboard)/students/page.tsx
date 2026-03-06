'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, MessageSquare, Pencil, X, Power } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { PaymentForm } from '@/components/payments/PaymentForm'
import { formatCurrency } from '@/lib/utils/currency'
import type { StudentFeeSummary, Class } from '@/types'

const PAGE_SIZE = 10

export default function StudentsPage() {
  const { isAdmin, teacherClassId } = useRole()
  const router = useRouter()
  const [students,     setStudents]     = useState<StudentFeeSummary[]>([])
  const [classes,      setClasses]      = useState<Class[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [classFilter,  setClassFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [page,         setPage]         = useState(1)
  const [total,        setTotal]        = useState(0)
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [payModal,     setPayModal]     = useState<StudentFeeSummary | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('student_fee_summary')
      .select('*', { count: 'exact' })
      .order('full_name')
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (search)       query = query.or(`full_name.ilike.%${search}%,admission_number.ilike.%${search}%`)
    if (genderFilter) query = query.eq('gender', genderFilter)
    const effectiveClass = !isAdmin && teacherClassId ? teacherClassId : classFilter
    if (effectiveClass) query = query.eq('class_id', effectiveClass)
    if (isAdmin) {
      if (statusFilter === 'has_balance') query = query.gt('outstanding', 0).eq('is_active', true)
      if (statusFilter === 'fully_paid')  query = query.eq('outstanding', 0).eq('is_active', true)
      if (statusFilter === 'inactive')    query = query.eq('is_active', false)
    } else {
      query = query.eq('is_active', true)
    }

    const { data, count, error } = await query
    if (error) toast.error(error.message)
    else { setStudents(data ?? []); setTotal(count ?? 0) }
    setLoading(false)
  }, [supabase, search, classFilter, statusFilter, genderFilter, page, isAdmin, teacherClassId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.from('classes').select('*').order('name').then(({ data }) => setClasses(data ?? []))
  }, [supabase])

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function clearFilters() {
    setSearch(''); setClassFilter(''); setStatusFilter(''); setGenderFilter(''); setPage(1)
  }

  async function toggleActive(s: StudentFeeSummary) {
    const { error } = await supabase.from('students').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) { toast.error(error.message); return }
    setStudents(prev => prev.map(st => st.id === s.id ? { ...st, is_active: !st.is_active } : st))
  }

  const hasFilters = search || classFilter || statusFilter || genderFilter

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        subtitle={`${total} student${total !== 1 ? 's' : ''}`}
        action={isAdmin ? (
          <Link href="/students/new">
            <Button icon={<Plus size={16} />}>Add Student</Button>
          </Link>
        ) : undefined}
      />

      <div className="card p-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              placeholder="Search by name or admission no."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="input max-w-[140px]"
            value={genderFilter}
            onChange={(e) => { setGenderFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          {isAdmin && (
            <>
              <select
                className="input max-w-[150px]"
                value={classFilter}
                onChange={(e) => { setClassFilter(e.target.value); setPage(1) }}
              >
                <option value="">All Classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                className="input max-w-[150px]"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              >
                <option value="">All Status</option>
                <option value="has_balance">Has Balance</option>
                <option value="fully_paid">Fully Paid</option>
                <option value="inactive">Inactive</option>
              </select>
            </>
          )}
          {hasFilters && isAdmin && (
            <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {isAdmin && selected.size > 0 && (
        <div className="card p-3 flex items-center justify-between bg-surface-alt border border-border">
          <span className="text-sm text-fg font-medium">{selected.size} selected</span>
          <Link href={`/sms?tab=selected&ids=${Array.from(selected).join(',')}`}>
            <Button variant="secondary" size="sm" icon={<MessageSquare size={14} />}>Send SMS to Selected</Button>
          </Link>
        </div>
      )}

      <div className="card overflow-hidden">
        <Table>
          <thead>
            <tr>
              {isAdmin && (
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={selected.size === students.length && students.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(students.map((s) => s.id)))
                      else setSelected(new Set())
                    }}
                  />
                </th>
              )}
              <th>Adm. No.</th>
              <th>Name</th>
              <th>Class</th>
              <th>Parent Phone</th>
              {isAdmin && <th>Outstanding</th>}
              <th>Status</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={8} cols={isAdmin ? 8 : 5} />
            ) : students.length === 0 ? (
              <tr><td colSpan={isAdmin ? 8 : 5}>
                <EmptyState
                  icon={<span>🎒</span>}
                  title="No students found"
                  description={hasFilters ? 'Try clearing your filters' : 'Add your first student to get started'}
                  action={hasFilters && isAdmin
                    ? <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
                    : isAdmin ? <Link href="/students/new"><Button variant="secondary" size="sm">Add Student</Button></Link> : undefined
                  }
                />
              </td></tr>
            ) : (
              students.map((s) => {
                const outstanding = Number(s.outstanding)
                return (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-surface-alt transition-colors"
                    onClick={() => router.push(`/students/${s.id}`)}
                  >
                    {isAdmin && (
                      <td onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selected.has(s.id)}
                          onChange={() => toggleSelect(s.id)}
                        />
                      </td>
                    )}
                    <td className="text-fg-subtle text-xs">{s.admission_number ?? '—'}</td>
                    <td className="font-medium">{s.full_name}</td>
                    <td>
                      {s.class_name
                        ? <span className="text-sm">{s.class_name}</span>
                        : <Badge variant="yellow">No Class</Badge>
                      }
                    </td>
                    <td className="text-gray-500 dark:text-gray-400">{s.parent_phone ?? '—'}</td>
                    {isAdmin && (
                      <td>
                        {!s.is_active
                          ? <Badge variant="gray">Inactive</Badge>
                          : outstanding === 0
                          ? <Badge variant="green">Paid</Badge>
                          : <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(outstanding)}</span>
                        }
                      </td>
                    )}
                    <td>
                      <Badge variant={s.is_active ? 'green' : 'gray'}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            className="btn-ghost p-1.5 rounded"
                            title="Add payment"
                            onClick={() => setPayModal(s)}
                          >
                            <Plus size={15} />
                          </button>
                          <Link href={`/sms?tab=single&studentId=${s.id}`}>
                            <button className="btn-ghost p-1.5 rounded" title="Send SMS">
                              <MessageSquare size={15} />
                            </button>
                          </Link>
                          <Link href={`/students/${s.id}?edit=1`}>
                            <button className="btn-ghost p-1.5 rounded" title="Edit">
                              <Pencil size={15} />
                            </button>
                          </Link>
                          <button
                            className="btn-ghost p-1.5 rounded"
                            title={s.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleActive(s)}
                          >
                            <Power size={15} className={!s.is_active ? 'text-accent' : ''} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      <Modal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title={`Record Payment — ${payModal?.full_name}`}
      >
        {payModal && (
          <PaymentForm
            studentId={payModal.id}
            outstanding={Number(payModal.outstanding)}
            onSuccess={() => { setPayModal(null); load() }}
            onCancel={() => setPayModal(null)}
          />
        )}
      </Modal>
    </div>
  )
}
