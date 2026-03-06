'use client'
import { useState, useEffect, useCallback } from 'react'
import { Printer, Download } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { useTerm } from '@/lib/term-context'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { today, formatDate } from '@/lib/utils/date'
import { downloadExcel } from '@/lib/utils/csv'
import { cn } from '@/lib/utils/cn'
import type { Teacher, AttendanceStatus } from '@/types'

interface AttendanceRecord {
  teacher_id: string
  status: AttendanceStatus
}

interface HistoryRecord {
  id: string
  attendance_date: string
  teacher_id: string
  status: AttendanceStatus
  teachers?: { full_name: string; employee_number: string | null } | null
}

const statuses: { value: AttendanceStatus; label: string; activeClass: string; printClass: string }[] = [
  { value: 'present', label: 'Present',  activeClass: 'bg-accent text-white border-accent',         printClass: 'print:border-2 print:border-green-800 print:font-bold' },
  { value: 'absent',  label: 'Absent',   activeClass: 'bg-red-600 text-white border-red-600',       printClass: 'print:border-2 print:border-red-800 print:font-bold' },
  { value: 'late',    label: 'Late',     activeClass: 'bg-yellow-500 text-white border-yellow-500', printClass: 'print:border-2 print:border-yellow-800 print:font-bold' },
  { value: 'excused', label: 'Excused',  activeClass: 'bg-gray-500 text-white border-gray-500',     printClass: 'print:border-2 print:border-gray-800 print:font-bold' },
]

export default function TeacherAttendancePage() {
  const { isAdmin, schoolName } = useRole()
  const { activeTerm, allTerms } = useTerm()
  const [date,         setDate]         = useState(today())
  const [teachers,     setTeachers]     = useState<Teacher[]>([])
  const [records,      setRecords]      = useState<Map<string, AttendanceRecord>>(new Map())
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [historyTerm,  setHistoryTerm]  = useState('')
  const [historyYear,  setHistoryYear]  = useState('')
  const [historyData,  setHistoryData]  = useState<HistoryRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const supabase = createClient()

  const isHistoryMode = !!(historyTerm || historyYear)

  const load = useCallback(async () => {
    if (isHistoryMode) return
    setLoading(true)
    const { data: teacherList } = await supabase
      .from('teachers').select('*').eq('is_active', true).order('full_name')

    setTeachers(teacherList ?? [])

    if (teacherList && teacherList.length > 0) {
      const { data: att } = await supabase
        .from('teacher_attendance').select('*')
        .eq('attendance_date', date)
        .in('teacher_id', teacherList.map((t) => t.id))

      const map = new Map<string, AttendanceRecord>()
      teacherList.forEach((t) => {
        const found = att?.find((a) => a.teacher_id === t.id)
        map.set(t.id, { teacher_id: t.id, status: (found?.status as AttendanceStatus) ?? 'present' })
      })
      setRecords(map)
    }
    setLoading(false)
  }, [supabase, date, isHistoryMode])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!isHistoryMode) { setHistoryData([]); return }
    setHistoryLoading(true)
    let query = supabase
      .from('teacher_attendance')
      .select('*, teachers(full_name, employee_number)')
      .order('attendance_date', { ascending: false })

    if (historyTerm)      query = query.eq('term_id', historyTerm)
    else if (historyYear) {
      query = query.gte('attendance_date', `${historyYear}-01-01`)
                   .lte('attendance_date', `${historyYear}-12-31`)
    }
    query.then(({ data }) => {
      setHistoryData((data ?? []) as HistoryRecord[])
      setHistoryLoading(false)
    })
  }, [supabase, historyTerm, historyYear, isHistoryMode])

  function setStatus(teacherId: string, status: AttendanceStatus) {
    if (!isAdmin) return
    setRecords((prev) => {
      const next = new Map(prev)
      next.set(teacherId, { teacher_id: teacherId, status })
      return next
    })
  }

  function markAllPresent() {
    if (!isAdmin) return
    setRecords((prev) => {
      const next = new Map(prev)
      next.forEach((v, k) => next.set(k, { ...v, status: 'present' }))
      return next
    })
  }

  async function save() {
    if (records.size === 0 || !isAdmin) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()

    const rows = Array.from(records.values()).map((r) => ({
      school_id:       me!.school_id,
      teacher_id:      r.teacher_id,
      attendance_date: date,
      status:          r.status,
      marked_by:       user!.id,
      term_id:         activeTerm?.id ?? null,
    }))

    const { error } = await supabase
      .from('teacher_attendance')
      .upsert(rows, { onConflict: 'teacher_id,attendance_date' })

    if (error) toast.error('Failed to save: ' + error.message)
    else toast.success(`Attendance saved for ${rows.length} teachers`)
    setSaving(false)
  }

  function handleExportCSV() {
    if (isHistoryMode) {
      const headers = ['Date', 'Teacher Name', 'Employee No.', 'Status']
      const rows = historyData.map((r) => [
        formatDate(r.attendance_date),
        r.teachers?.full_name ?? '',
        r.teachers?.employee_number ?? '',
        r.status,
      ])
      downloadExcel('teacher-attendance-history', headers, rows)
      return
    }
    const headers = ['Date', 'Teacher Name', 'Employee No.', 'Status']
    const rows = teachers.map((t) => {
      const rec = records.get(t.id)
      return [formatDate(date), t.full_name, t.employee_number ?? '', rec?.status ?? '']
    })
    downloadExcel(`teacher-attendance-${date}`, headers, rows)
  }

  const counts = {
    present: Array.from(records.values()).filter((r) => r.status === 'present').length,
    absent:  Array.from(records.values()).filter((r) => r.status === 'absent').length,
    late:    Array.from(records.values()).filter((r) => r.status === 'late').length,
    excused: Array.from(records.values()).filter((r) => r.status === 'excused').length,
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - 3 + i)

  return (
    <div className="space-y-6">
      <PageHeader title="Teacher Attendance" subtitle="Mark and track teacher attendance" />

      <div className="card p-4 flex flex-wrap items-end gap-3 justify-between no-print">
        <div className="flex gap-3 flex-wrap items-end">
          {!isHistoryMode && (
            <div>
              <label className="label text-xs mb-1">Date</label>
              <input type="date" className="input max-w-[160px]" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label text-xs mb-1">Year</label>
            <select className="input max-w-[110px]" value={historyYear} onChange={(e) => { setHistoryYear(e.target.value); setHistoryTerm('') }}>
              <option value="">Any Year</option>
              {yearOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
          {allTerms.length > 0 && (
            <div>
              <label className="label text-xs mb-1">Term</label>
              <select className="input max-w-[160px]" value={historyTerm} onChange={(e) => { setHistoryTerm(e.target.value); setHistoryYear('') }}>
                <option value="">Mark by Date</option>
                {allTerms.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isHistoryMode && isAdmin && (
            <>
              <Button variant="secondary" onClick={markAllPresent} disabled={loading}>Mark All Present</Button>
              <Button onClick={save} loading={saving} disabled={records.size === 0}>Save Attendance</Button>
            </>
          )}
          <Button variant="ghost" icon={<Printer size={15} />} onClick={() => window.print()} disabled={loading}>Print</Button>
          <Button variant="ghost" icon={<Download size={15} />} onClick={handleExportCSV} disabled={loading || (isHistoryMode ? historyData.length === 0 : teachers.length === 0)}>Export Excel</Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="print-only hidden">
        <h1 className="text-lg font-bold">{schoolName}</h1>
        <h2 className="text-base font-semibold mt-1">Teacher Attendance Report</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          {isHistoryMode
            ? allTerms.find(t => t.id === historyTerm)?.label ?? `Year ${historyYear}`
            : `Date: ${formatDate(date)}`
          }
        </p>
      </div>

      {isHistoryMode ? (
        <div className="card overflow-hidden">
          <Table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Teacher</th>
                <th>Employee No.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <TableSkeleton rows={6} cols={4} />
              ) : historyData.length === 0 ? (
                <tr><td colSpan={4}>
                  <EmptyState icon={<span>📋</span>} title="No records found" description="No attendance records match the selected year or term" />
                </td></tr>
              ) : (
                historyData.map((r) => (
                  <tr key={r.id}>
                    <td className="text-sm">{formatDate(r.attendance_date)}</td>
                    <td className="font-medium">{r.teachers?.full_name ?? '—'}</td>
                    <td className="text-fg-muted text-xs">{r.teachers?.employee_number ?? '—'}</td>
                    <td>
                      <span className={cn(
                        'px-2 py-0.5 text-xs rounded border font-medium',
                        r.status === 'present' ? 'bg-accent text-white border-accent' :
                        r.status === 'absent'  ? 'bg-red-600 text-white border-red-600' :
                        r.status === 'late'    ? 'bg-yellow-500 text-white border-yellow-500' :
                        'bg-gray-500 text-white border-gray-500'
                      )}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Employee No.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={6} cols={3} />
              ) : teachers.length === 0 ? (
                <tr><td colSpan={3}>
                  <EmptyState icon={<span>👨‍🏫</span>} title="No active teachers found" description="Add teachers in the Teachers section" />
                </td></tr>
              ) : (
                teachers.map((t) => {
                  const rec = records.get(t.id)
                  return (
                    <tr key={t.id}>
                      <td className="font-medium">{t.full_name}</td>
                      <td className="text-gray-500 text-xs">{t.employee_number ?? '—'}</td>
                      <td>
                        {isAdmin ? (
                          <div className="flex gap-1 flex-wrap">
                            {statuses.map(({ value, label, activeClass }) => {
                              const isSelected = rec?.status === value
                              return (
                                <button
                                  key={value}
                                  onClick={() => setStatus(t.id, value)}
                                  className={cn(
                                    'attendance-status-btn px-3 py-1 text-xs rounded border font-medium transition-colors',
                                    isSelected ? activeClass : 'border-border text-fg-muted hover:bg-surface-alt',
                                    isSelected && `is-selected-${value}`
                                  )}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <span className={cn(
                            'px-3 py-1 text-xs rounded border font-medium',
                            rec?.status === 'present' ? 'bg-accent text-white border-accent' :
                            rec?.status === 'absent'  ? 'bg-red-600 text-white border-red-600' :
                            rec?.status === 'late'    ? 'bg-yellow-500 text-white border-yellow-500' :
                            'bg-gray-500 text-white border-gray-500'
                          )}>
                            {rec?.status ?? 'present'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </div>
      )}

      {!isHistoryMode && records.size > 0 && (
        <div className="card p-3 flex gap-4 flex-wrap">
          <span className="badge-green">Present: {counts.present}</span>
          <span className="badge-red">Absent: {counts.absent}</span>
          <span className="badge-yellow">Late: {counts.late}</span>
          <span className="badge-gray">Excused: {counts.excused}</span>
        </div>
      )}
    </div>
  )
}
