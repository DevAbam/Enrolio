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
import { today, formatDate, formatDateLong } from '@/lib/utils/date'
import { downloadExcel } from '@/lib/utils/csv'
import { cn } from '@/lib/utils/cn'
import type { Teacher, AttendanceStatus } from '@/types'

type StaffType = 'teaching' | 'non_teaching'

interface AttendanceRecord { teacher_id: string; status: AttendanceStatus }

interface HistoryRecord {
  id: string; attendance_date: string; teacher_id: string; status: AttendanceStatus
  teachers?: { full_name: string; employee_number: string | null; staff_type: string } | null
}

const statuses: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: 'Present', activeClass: 'bg-accent text-white border-accent' },
  { value: 'absent',  label: 'Absent',  activeClass: 'bg-red-600 text-white border-red-600' },
  { value: 'late',    label: 'Late',    activeClass: 'bg-yellow-500 text-white border-yellow-500' },
  { value: 'excused', label: 'Excused', activeClass: 'bg-gray-500 text-white border-gray-500' },
]

type Mode = 'mark' | 'history'

export default function TeacherAttendancePage() {
  const { isAdmin, schoolName, schoolLogoUrl } = useRole()
  const { activeTerm, allTerms } = useTerm()
  const [staffType, setStaffType] = useState<StaffType>('teaching')
  const [mode, setMode] = useState<Mode>('mark')
  const supabase = createClient()

  // mark mode
  const [date, setDate] = useState(today())
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [records, setRecords] = useState<Map<string, AttendanceRecord>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // history mode
  const [historyTermId, setHistoryTermId] = useState('')
  const [historyYear, setHistoryYear] = useState('')
  const [historyData, setHistoryData] = useState<HistoryRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [summaryMode, setSummaryMode] = useState(false)
  const [historyTeacherSearch, setHistoryTeacherSearch] = useState('')
  const [isAlreadyMarked, setIsAlreadyMarked] = useState(false)

  const loadMarkMode = useCallback(async () => {
    setLoading(true)
    const { data: teacherList } = await supabase
      .from('teachers').select('*').eq('is_active', true).eq('staff_type', staffType).order('full_name')
    setTeachers(teacherList ?? [])
    if (teacherList && teacherList.length > 0) {
      const { data: att } = await supabase.from('teacher_attendance').select('*')
        .eq('attendance_date', date).in('teacher_id', teacherList.map(t => t.id))
      setIsAlreadyMarked((att?.length ?? 0) > 0)
      const map = new Map<string, AttendanceRecord>()
      teacherList.forEach(t => {
        const found = att?.find(a => a.teacher_id === t.id)
        map.set(t.id, { teacher_id: t.id, status: (found?.status as AttendanceStatus) ?? 'present' })
      })
      setRecords(map)
    } else {
      setIsAlreadyMarked(false)
    }
    setLoading(false)
  }, [supabase, date, staffType])

  useEffect(() => { if (mode === 'mark') loadMarkMode() }, [loadMarkMode, mode])

  const loadHistory = useCallback(async () => {
    if (!historyTermId && !historyYear) { setHistoryData([]); return }
    setHistoryLoading(true)
    let query = supabase.from('teacher_attendance')
      .select('*, teachers(full_name, employee_number, staff_type)')
      .order('attendance_date', { ascending: false })
    if (historyTermId) query = query.eq('term_id', historyTermId)
    else if (historyYear) query = query.gte('attendance_date', `${historyYear}-01-01`).lte('attendance_date', `${historyYear}-12-31`)
    const { data } = await query
    setHistoryData((data ?? []) as HistoryRecord[])
    setHistoryLoading(false)
  }, [supabase, historyTermId, historyYear])

  useEffect(() => { if (mode === 'history') loadHistory() }, [loadHistory, mode])

  function setStatus(teacherId: string, status: AttendanceStatus) {
    if (!isAdmin) return
    setRecords(prev => { const next = new Map(prev); next.set(teacherId, { teacher_id: teacherId, status }); return next })
  }

  function markAllPresent() {
    if (!isAdmin) return
    setRecords(prev => {
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
    const rows = Array.from(records.values()).map(r => ({
      school_id: me!.school_id,
      teacher_id: r.teacher_id,
      attendance_date: date,
      status: r.status,
      marked_by: user!.id,
      term_id: activeTerm?.id ?? null,
    }))
    const { error } = await supabase.from('teacher_attendance').upsert(rows, { onConflict: 'teacher_id,attendance_date' })
    if (error) toast.error('Failed to save: ' + error.message)
    else toast.success(`Attendance saved for ${rows.length} staff member${rows.length !== 1 ? 's' : ''}`)
    setSaving(false)
  }

  function handleExportCSV() {
    if (mode === 'history') {
      if (summaryMode) {
        const headers = ['Teacher Name', 'Employee No.', 'Present', 'Absent', 'Late', 'Excused', 'Total Days', 'Attendance %']
        const rows = teacherSummary.map(r => [
          r.full_name, r.employee_number ?? '',
          String(r.present), String(r.absent), String(r.late), String(r.excused), String(r.total),
          r.total > 0 ? `${Math.round((r.present / r.total) * 100)}%` : '0%',
        ])
        downloadExcel('teacher-attendance-summary', headers, rows)
      } else {
        const headers = ['Date', 'Teacher Name', 'Employee No.', 'Status']
        const rows = filteredHistoryData.map(r => [formatDateLong(r.attendance_date), r.teachers?.full_name ?? '', r.teachers?.employee_number ?? '', r.status])
        downloadExcel('teacher-attendance-history', headers, rows)
      }
      return
    }
    const headers = ['Date', 'Teacher Name', 'Employee No.', 'Status']
    const rows = teachers.map(t => {
      const rec = records.get(t.id)
      return [formatDateLong(date), t.full_name, t.employee_number ?? '', rec?.status ?? '']
    })
    downloadExcel(`teacher-attendance-${date}`, headers, rows)
  }

  const counts = {
    present: Array.from(records.values()).filter(r => r.status === 'present').length,
    absent:  Array.from(records.values()).filter(r => r.status === 'absent').length,
    late:    Array.from(records.values()).filter(r => r.status === 'late').length,
    excused: Array.from(records.values()).filter(r => r.status === 'excused').length,
  }
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - 3 + i)

  const filteredHistoryData = historyData
    .filter(r => r.teachers?.staff_type === staffType)
    .filter(r => !historyTeacherSearch || r.teachers?.full_name?.toLowerCase().includes(historyTeacherSearch.toLowerCase()))

  type TSRow = {
    teacher_id: string; full_name: string; employee_number: string | null
    present: number; absent: number; late: number; excused: number; total: number
  }
  const summaryMap = new Map<string, TSRow>()
  for (const r of filteredHistoryData) {
    if (!summaryMap.has(r.teacher_id)) {
      summaryMap.set(r.teacher_id, {
        teacher_id: r.teacher_id,
        full_name: r.teachers?.full_name ?? '—',
        employee_number: r.teachers?.employee_number ?? null,
        present: 0, absent: 0, late: 0, excused: 0, total: 0,
      })
    }
    const row = summaryMap.get(r.teacher_id)!
    row[r.status as AttendanceStatus]++
    row.total++
  }
  const teacherSummary = Array.from(summaryMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Attendance"
        subtitle={`Mark and track ${staffType === 'teaching' ? 'teaching' : 'non-teaching'} staff attendance`}
      />

      {/* Staff type toggle */}
      <div className="flex gap-1 p-1 bg-surface-alt rounded-lg w-fit border border-border no-print">
        <button
          className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', staffType === 'teaching' ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg')}
          onClick={() => { setStaffType('teaching'); setTeachers([]); setRecords(new Map()) }}
        >
          Teaching Staff
        </button>
        <button
          className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', staffType === 'non_teaching' ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg')}
          onClick={() => { setStaffType('non_teaching'); setTeachers([]); setRecords(new Map()) }}
        >
          Non-Teaching Staff
        </button>
      </div>

      {/* Mode toggle */}
      <div className="card p-1 flex gap-1 w-fit no-print">
        <button
          onClick={() => setMode('mark')}
          className={cn('px-4 py-1.5 text-sm rounded font-medium transition-colors',
            mode === 'mark' ? 'bg-accent text-white' : 'text-fg-muted hover:bg-surface-alt')}
        >
          Mark Attendance
        </button>
        <button
          onClick={() => setMode('history')}
          className={cn('px-4 py-1.5 text-sm rounded font-medium transition-colors',
            mode === 'history' ? 'bg-accent text-white' : 'text-fg-muted hover:bg-surface-alt')}
        >
          View History
        </button>
      </div>

      {mode === 'mark' ? (
        <>
          {/* Filters */}
          <div className="card p-4 flex flex-wrap items-end gap-3 justify-between no-print">
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="label text-xs mb-1">Date</label>
                <input type="date" className="input max-w-[160px]" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              {activeTerm && (
                <div className="text-xs text-fg-muted self-end pb-2">
                  Active term: <span className="text-accent font-medium">{activeTerm.label}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {isAlreadyMarked && (
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-medium border border-green-200 dark:border-green-800">
                  ✓ Already marked for this date
                </span>
              )}
              {isAdmin && records.size > 0 && (
                <>
                  <Button variant="secondary" onClick={markAllPresent} disabled={loading}>Mark All Present</Button>
                  <Button onClick={save} loading={saving} disabled={records.size === 0 || isAlreadyMarked}>
                    {isAlreadyMarked ? 'Already Saved' : 'Save Attendance'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Print header */}
          <div className="print-only hidden">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{schoolName}</h1>
                <h2 style={{ fontSize: '13px', fontWeight: '600', margin: '4px 0 0' }}>Teacher Attendance Report</h2>
                <p style={{ fontSize: '11px', color: '#555', margin: '2px 0 0' }}>Date: {formatDate(date)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                {schoolLogoUrl
                  ? <img src={schoolLogoUrl} alt={schoolName ?? ''} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                  : <div style={{ width: '56px', height: '56px', borderRadius: '8px', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 'bold', color: '#374151' }}>{schoolName?.charAt(0) ?? 'S'}</div>
                }
              </div>
            </div>
            <hr style={{ borderTop: '1px solid #ccc', marginBottom: '8px' }} />
          </div>

          {/* Teacher list */}
          <div className="card overflow-hidden">
            <Table>
              <thead>
                <tr><th>Name</th><th>Employee No.</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={6} cols={3} />
                ) : teachers.length === 0 ? (
                  <tr><td colSpan={3}>
                    <EmptyState title="No active teachers found" description="Add teachers in the Teachers section" />
                  </td></tr>
                ) : (
                  teachers.map(t => {
                    const rec = records.get(t.id)
                    return (
                      <tr key={t.id}>
                        <td className="font-medium">{t.full_name}</td>
                        <td className="text-gray-500 text-xs">{t.employee_number ?? '—'}</td>
                        <td>
                          {isAdmin ? (
                            <div className="flex gap-1 flex-wrap">
                              {statuses.map(({ value, label, activeClass }) => (
                                <button
                                  key={value}
                                  onClick={() => setStatus(t.id, value)}
                                  className={cn(
                                    'attendance-status-btn px-3 py-1 text-xs rounded border font-medium transition-colors',
                                    rec?.status === value ? activeClass : 'border-border text-fg-muted hover:bg-surface-alt'
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className={cn(
                              'px-3 py-1 text-xs rounded border font-medium',
                              rec?.status === 'present' ? 'bg-accent text-white border-accent' :
                              rec?.status === 'absent' ? 'bg-red-600 text-white border-red-600' :
                              rec?.status === 'late' ? 'bg-yellow-500 text-white border-yellow-500' :
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

          {records.size > 0 && (
            <div className="card p-3 flex gap-4 flex-wrap">
              <span className="badge-green">Present: {counts.present}</span>
              <span className="badge-red">Absent: {counts.absent}</span>
              <span className="badge-yellow">Late: {counts.late}</span>
              <span className="badge-gray">Excused: {counts.excused}</span>
            </div>
          )}
        </>
      ) : (
        <>
          {/* History filters */}
          <div className="card p-4 flex flex-wrap items-end gap-3 justify-between no-print">
            <div className="flex gap-3 flex-wrap items-end">
              {allTerms.length > 0 && (
                <div>
                  <label className="label text-xs mb-1">Term</label>
                  <select
                    className="input max-w-[180px]"
                    value={historyTermId}
                    onChange={e => { setHistoryTermId(e.target.value); setHistoryYear('') }}
                  >
                    <option value="">— Select Term —</option>
                    {allTerms.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label text-xs mb-1">Or Year</label>
                <select
                  className="input max-w-[110px]"
                  value={historyYear}
                  onChange={e => { setHistoryYear(e.target.value); setHistoryTermId('') }}
                >
                  <option value="">—</option>
                  {yearOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
                </select>
              </div>
              {(historyTermId || historyYear) && (
                <div>
                  <label className="label text-xs mb-1">Search teacher</label>
                  <input
                    className="input max-w-[180px]"
                    placeholder="Name…"
                    value={historyTeacherSearch}
                    onChange={e => setHistoryTeacherSearch(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" icon={<Printer size={15} />} onClick={() => window.print()}>Print</Button>
              <Button variant="ghost" icon={<Download size={15} />} onClick={handleExportCSV} disabled={historyData.length === 0}>Export</Button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border no-print">
              <button
                onClick={() => setSummaryMode(false)}
                className={cn('px-3 py-1 text-xs rounded font-medium border transition-colors',
                  !summaryMode ? 'bg-accent text-white border-accent' : 'border-border text-fg-muted hover:bg-surface-alt')}
              >
                Records
              </button>
              <button
                onClick={() => setSummaryMode(true)}
                className={cn('px-3 py-1 text-xs rounded font-medium border transition-colors',
                  summaryMode ? 'bg-accent text-white border-accent' : 'border-border text-fg-muted hover:bg-surface-alt')}
              >
                Teacher Summary
              </button>
            </div>

            {!historyTermId && !historyYear ? (
              <div className="py-12 text-center text-fg-muted text-sm">
                Select a term or year to view history
              </div>
            ) : summaryMode ? (
              <Table>
                <thead>
                  <tr>
                    <th>Teacher</th><th>Employee No.</th>
                    <th className="text-green-700">Present</th><th className="text-red-600">Absent</th>
                    <th className="text-yellow-600">Late</th><th className="text-gray-500">Excused</th>
                    <th>Total Days</th><th>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <TableSkeleton rows={6} cols={8} />
                  ) : teacherSummary.length === 0 ? (
                    <tr><td colSpan={8}>
                      <EmptyState title="No attendance records found" description="No records match the selected filters" />
                    </td></tr>
                  ) : (
                    teacherSummary.map(row => {
                      const pct = row.total > 0 ? Math.round((row.present / row.total) * 100) : 0
                      return (
                        <tr key={row.teacher_id}>
                          <td className="font-medium">{row.full_name}</td>
                          <td className="text-fg-muted text-xs">{row.employee_number ?? '—'}</td>
                          <td className="text-green-700 font-medium">{row.present}</td>
                          <td className="text-red-600 font-medium">{row.absent}</td>
                          <td className="text-yellow-600 font-medium">{row.late}</td>
                          <td className="text-gray-500 font-medium">{row.excused}</td>
                          <td>{row.total}</td>
                          <td>
                            <span className={cn('font-medium', pct >= 80 ? 'text-green-700' : pct >= 60 ? 'text-yellow-600' : 'text-red-600')}>
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </Table>
            ) : (
              <Table>
                <thead>
                  <tr><th>Date</th><th>Teacher</th><th>Employee No.</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <TableSkeleton rows={6} cols={4} />
                  ) : filteredHistoryData.length === 0 ? (
                    <tr><td colSpan={4}>
                      <EmptyState title="No records found" description="No attendance records match the selected filters" />
                    </td></tr>
                  ) : (
                    filteredHistoryData.map(r => (
                      <tr key={r.id}>
                        <td className="text-sm">{formatDate(r.attendance_date)}</td>
                        <td className="font-medium">{r.teachers?.full_name ?? '—'}</td>
                        <td className="text-fg-muted text-xs">{r.teachers?.employee_number ?? '—'}</td>
                        <td>
                          <span className={cn(
                            'px-2 py-0.5 text-xs rounded border font-medium',
                            r.status === 'present' ? 'bg-accent text-white border-accent' :
                            r.status === 'absent' ? 'bg-red-600 text-white border-red-600' :
                            r.status === 'late' ? 'bg-yellow-500 text-white border-yellow-500' :
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
            )}
          </div>
        </>
      )}
    </div>
  )
}
