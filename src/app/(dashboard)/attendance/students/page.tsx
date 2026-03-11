'use client'
import { useState, useEffect, useCallback } from 'react'
import { Printer, Download, Search } from 'lucide-react'
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
import type { Student, Class, AttendanceStatus } from '@/types'

interface AttendanceRecord {
  student_id: string
  status: AttendanceStatus
  notes: string
}

interface HistoryRecord {
  id: string
  attendance_date: string
  student_id: string
  status: AttendanceStatus
  notes: string | null
  students?: { full_name: string; admission_number: string | null; class_id?: string | null } | null
}

const statuses: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: 'Present', activeClass: 'bg-accent text-white border-accent' },
  { value: 'absent',  label: 'Absent',  activeClass: 'bg-red-600 text-white border-red-600' },
  { value: 'late',    label: 'Late',    activeClass: 'bg-yellow-500 text-white border-yellow-500' },
  { value: 'excused', label: 'Excused', activeClass: 'bg-gray-500 text-white border-gray-500' },
]

type Mode = 'mark' | 'history'

export default function StudentAttendancePage() {
  const { isAdmin, teacherClassId, schoolName, schoolLogoUrl } = useRole()
  const { activeTerm, allTerms } = useTerm()

  // ── shared ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('mark')
  const [classes, setClasses] = useState<Class[]>([])
  const supabase = createClient()

  // ── mark mode ───────────────────────────────────────────────────────────
  const [date, setDate] = useState(today())
  const [classId, setClassId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<Map<string, AttendanceRecord>>(new Map())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nameSearch, setNameSearch] = useState('')

  // ── history mode ─────────────────────────────────────────────────────────
  const [historyTermId, setHistoryTermId] = useState('')
  const [historyYear, setHistoryYear] = useState('')
  const [historyClassId, setHistoryClassId] = useState('')
  const [historyDate, setHistoryDate] = useState('')
  const [historyData, setHistoryData] = useState<HistoryRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyStudentSearch, setHistoryStudentSearch] = useState('')
  const [historySummaryMode, setHistorySummaryMode] = useState(false)
  const [isAlreadyMarked, setIsAlreadyMarked] = useState(false)
  const [historyFilterClassId, setHistoryFilterClassId] = useState('')

  // ── init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin && teacherClassId) setClassId(teacherClassId)
  }, [isAdmin, teacherClassId])

  useEffect(() => {
    if (isAdmin) {
      supabase.from('classes').select('*').order('level', { ascending: true, nullsFirst: false }).order('name')
        .then(({ data }) => setClasses(data ?? []))
    }
  }, [supabase, isAdmin])

  // ── mark mode: load students + today's records ────────────────────────
  const loadMarkMode = useCallback(async () => {
    if (!classId) { setStudents([]); setRecords(new Map()); return }
    setLoading(true)

    const { data: studs } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .eq('is_active', true)
      .eq('is_graduated', false)
      .order('full_name')
    const studentList = studs ?? []
    setStudents(studentList)

    if (studentList.length > 0) {
      const { data: att } = await supabase
        .from('student_attendance')
        .select('*')
        .eq('attendance_date', date)
        .in('student_id', studentList.map(s => s.id))

      setIsAlreadyMarked((att?.length ?? 0) > 0)

      const map = new Map<string, AttendanceRecord>()
      studentList.forEach(s => {
        const found = att?.find(a => a.student_id === s.id)
        map.set(s.id, {
          student_id: s.id,
          status: (found?.status as AttendanceStatus) ?? 'present',
          notes: found?.notes ?? '',
        })
      })
      setRecords(map)
    } else {
      setIsAlreadyMarked(false)
      setRecords(new Map())
    }
    setLoading(false)
  }, [supabase, classId, date])

  useEffect(() => { if (mode === 'mark') loadMarkMode() }, [loadMarkMode, mode])

  // ── history mode: load records ────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!historyTermId && !historyYear) { setHistoryData([]); return }
    setHistoryLoading(true)

    let query = supabase
      .from('student_attendance')
      .select('*, students(full_name, admission_number, class_id)')
      .order('attendance_date', { ascending: false })

    if (historyTermId) {
      query = query.eq('term_id', historyTermId)
    } else if (historyYear) {
      query = query
        .gte('attendance_date', `${historyYear}-01-01`)
        .lte('attendance_date', `${historyYear}-12-31`)
    }

    const { data } = await query
    setHistoryData((data ?? []) as HistoryRecord[])
    setHistoryLoading(false)
  }, [supabase, historyTermId, historyYear])

  useEffect(() => { if (mode === 'history') loadHistory() }, [loadHistory, mode])

  // ── mark mode actions ─────────────────────────────────────────────────
  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords(prev => {
      const next = new Map(prev)
      next.set(studentId, { ...next.get(studentId)!, status })
      return next
    })
  }

  function markAllPresent() {
    setRecords(prev => {
      const next = new Map(prev)
      next.forEach((v, k) => next.set(k, { ...v, status: 'present' }))
      return next
    })
  }

  async function save() {
    if (!classId || records.size === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('users').select('school_id').eq('id', user!.id).single()

    const rows = Array.from(records.values()).map(r => ({
      school_id: me!.school_id,
      student_id: r.student_id,
      attendance_date: date,
      status: r.status,
      notes: r.notes || null,
      marked_by: user!.id,
      term_id: activeTerm?.id ?? null,
    }))

    const { error } = await supabase
      .from('student_attendance')
      .upsert(rows, { onConflict: 'student_id,attendance_date' })

    if (error) toast.error('Failed to save: ' + error.message)
    else { toast.success(`Attendance saved for ${rows.length} students`); setIsAlreadyMarked(true) }
    setSaving(false)
  }

  // ── exports ────────────────────────────────────────────────────────────
  function handleExportCSV() {
    if (mode === 'history') {
      if (historySummaryMode) {
        const headers = ['Student Name', 'Admission No.', 'Present', 'Absent', 'Late', 'Excused', 'Total Days', 'Attendance %']
        const rows = studentSummary.map(row => [
          row.full_name, row.admission_number ?? '',
          String(row.present), String(row.absent), String(row.late), String(row.excused), String(row.total),
          row.total > 0 ? `${Math.round((row.present / row.total) * 100)}%` : '0%',
        ])
        downloadExcel('student-attendance-summary', headers, rows)
      } else {
        const headers = ['Date', 'Student Name', 'Admission No.', 'Status', 'Notes']
        const rows = filteredHistory.map(r => [
          formatDateLong(r.attendance_date),
          r.students?.full_name ?? '', r.students?.admission_number ?? '',
          r.status, r.notes ?? '',
        ])
        downloadExcel('student-attendance-history', headers, rows)
      }
      return
    }
    const selectedClass = classes.find(c => c.id === classId)
    const className = selectedClass?.name ?? classId
    const headers = ['Date', 'Student Name', 'Admission No.', 'Class', 'Status', 'Notes']
    const rows = students.map(s => {
      const rec = records.get(s.id)
      return [formatDateLong(date), s.full_name, s.admission_number ?? '', className, rec?.status ?? '', rec?.notes ?? '']
    })
    downloadExcel(`student-attendance-${date}`, headers, rows)
  }

  // ── derived values ─────────────────────────────────────────────────────
  const filteredStudents = nameSearch
    ? students.filter(s => s.full_name.toLowerCase().includes(nameSearch.toLowerCase()))
    : students

  const counts = {
    present: Array.from(records.values()).filter(r => r.status === 'present').length,
    absent:  Array.from(records.values()).filter(r => r.status === 'absent').length,
    late:    Array.from(records.values()).filter(r => r.status === 'late').length,
    excused: Array.from(records.values()).filter(r => r.status === 'excused').length,
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - 3 + i)

  // Base filter (applied to both Records and Summary tabs)
  const baseFilteredHistory = historyData.filter(r => {
    if (!isAdmin && teacherClassId && r.students?.class_id !== teacherClassId) return false
    if (historyStudentSearch) {
      const name = r.students?.full_name?.toLowerCase() ?? ''
      if (!name.includes(historyStudentSearch.toLowerCase())) return false
    }
    if (historyFilterClassId && r.students?.class_id !== historyFilterClassId) return false
    return true
  })
  // Records tab also filters by specific date; Summary tab uses unfiltered totals
  const filteredHistory = historyDate
    ? baseFilteredHistory.filter(r => r.attendance_date === historyDate)
    : baseFilteredHistory

  const historyCounts = {
    present: baseFilteredHistory.filter(r => r.status === 'present').length,
    absent:  baseFilteredHistory.filter(r => r.status === 'absent').length,
    late:    baseFilteredHistory.filter(r => r.status === 'late').length,
    excused: baseFilteredHistory.filter(r => r.status === 'excused').length,
  }

  type StudentSummaryRow = {
    student_id: string; full_name: string; admission_number: string | null
    present: number; absent: number; late: number; excused: number; total: number
  }
  const studentSummaryMap = new Map<string, StudentSummaryRow>()
  for (const r of baseFilteredHistory) {
    if (!studentSummaryMap.has(r.student_id)) {
      studentSummaryMap.set(r.student_id, {
        student_id: r.student_id,
        full_name: r.students?.full_name ?? '—',
        admission_number: r.students?.admission_number ?? null,
        present: 0, absent: 0, late: 0, excused: 0, total: 0,
      })
    }
    const row = studentSummaryMap.get(r.student_id)!
    row[r.status as AttendanceStatus]++
    row.total++
  }
  const studentSummary = Array.from(studentSummaryMap.values())
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  const selectedClass = classes.find(c => c.id === classId)

  return (
    <div className="space-y-6">
      <PageHeader title="Student Attendance" subtitle="Mark and track daily attendance" />

      {/* ── Mode toggle ── */}
      <div className="card p-1 flex gap-1 w-fit no-print">
        <button
          onClick={() => setMode('mark')}
          className={cn(
            'px-4 py-1.5 text-sm rounded font-medium transition-colors',
            mode === 'mark' ? 'bg-accent text-white' : 'text-fg-muted hover:bg-surface-alt'
          )}
        >
          Mark Attendance
        </button>
        <button
          onClick={() => setMode('history')}
          className={cn(
            'px-4 py-1.5 text-sm rounded font-medium transition-colors',
            mode === 'history' ? 'bg-accent text-white' : 'text-fg-muted hover:bg-surface-alt'
          )}
        >
          View History
        </button>
      </div>

      {mode === 'mark' ? (
        /* ════════════════════════════════════════════════════════
           MARK ATTENDANCE MODE
           Flow: Date → Class → immediately shows student list
           ════════════════════════════════════════════════════════ */
        <>
          {/* Filters */}
          <div className="card p-4 flex flex-wrap items-end gap-3 justify-between no-print">
            <div className="flex gap-3 flex-wrap items-end">
              {/* Date — always visible */}
              <div>
                <label className="label text-xs mb-1">Date</label>
                <input
                  type="date"
                  className="input max-w-[160px]"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              {/* Term context indicator */}
              {activeTerm && (
                <div className="text-xs text-fg-muted self-end pb-2">
                  Active term: <span className="text-accent font-medium">{activeTerm.label}</span>
                </div>
              )}

              {/* Class — admin picks; teacher sees their class automatically */}
              {isAdmin ? (
                <div>
                  <label className="label text-xs mb-1">Class</label>
                  <select
                    className="input max-w-[200px]"
                    value={classId}
                    onChange={e => setClassId(e.target.value)}
                  >
                    <option value="">— Select Class —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ) : (
                teacherClassId && (
                  <div className="text-xs text-fg-muted self-end pb-2">
                    Class: <span className="font-medium text-fg">{classes.find(c => c.id === teacherClassId)?.name ?? '—'}</span>
                  </div>
                )
              )}

              {/* Student search */}
              {classId && students.length > 0 && (
                <div>
                  <label className="label text-xs mb-1">Search student</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
                    <input
                      className="input pl-8 max-w-[180px]"
                      placeholder="Name…"
                      value={nameSearch}
                      onChange={e => setNameSearch(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              {classId && isAlreadyMarked && (
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-medium border border-green-200 dark:border-green-800">
                  ✓ Already marked for this date
                </span>
              )}
              {classId && records.size > 0 && (
                <>
                  <Button variant="secondary" onClick={markAllPresent} disabled={loading}>
                    Mark All Present
                  </Button>
                  <Button onClick={save} loading={saving} disabled={records.size === 0 || isAlreadyMarked}>
                    {isAlreadyMarked ? 'Already Saved' : 'Save Attendance'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Print-only header */}
          <div className="print-only hidden">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{schoolName}</h1>
                <h2 style={{ fontSize: '13px', fontWeight: '600', margin: '4px 0 0' }}>Student Attendance Report</h2>
                <p style={{ fontSize: '11px', color: '#555', margin: '2px 0 0' }}>
                  {`Date: ${formatDate(date)}${selectedClass ? ` · Class: ${selectedClass.name}` : ''}`}
                </p>
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

          {/* Student list */}
          <div className="card overflow-hidden">
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Adm. No.</th>
                  <th>Status</th>
                  <th className="no-print">Notes</th>
                </tr>
              </thead>
              <tbody>
                {!classId ? (
                  <tr><td colSpan={4}>
                    <EmptyState title="Select a class to begin" description="Choose a class from the filters above" />
                  </td></tr>
                ) : loading ? (
                  <TableSkeleton rows={8} cols={4} />
                ) : students.length === 0 ? (
                  <tr><td colSpan={4}>
                    <EmptyState title="No active students in this class" />
                  </td></tr>
                ) : (
                  filteredStudents.map(s => {
                    const rec = records.get(s.id)
                    return (
                      <tr key={s.id}>
                        <td className="font-medium">{s.full_name}</td>
                        <td className="text-gray-500 text-xs">{s.admission_number ?? '—'}</td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {statuses.map(({ value, label, activeClass }) => {
                              const isSelected = rec?.status === value
                              return (
                                <button
                                  key={value}
                                  onClick={() => setStatus(s.id, value)}
                                  className={cn(
                                    'attendance-status-btn px-3 py-1 text-xs rounded border font-medium transition-colors',
                                    isSelected ? activeClass : 'border-border text-fg-muted hover:bg-surface-alt'
                                  )}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                        <td className="no-print">
                          <input
                            type="text"
                            className="input text-xs py-1 max-w-[200px]"
                            placeholder="Optional note"
                            value={rec?.notes ?? ''}
                            onChange={e => {
                              const notes = e.target.value
                              setRecords(prev => {
                                const next = new Map(prev)
                                next.set(s.id, { ...next.get(s.id)!, notes })
                                return next
                              })
                            }}
                          />
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
        /* ════════════════════════════════════════════════════════
           HISTORY MODE
           Filters: Term or Year, optional student search
           ════════════════════════════════════════════════════════ */
        <>
          <div className="card p-4 flex flex-wrap items-end gap-3 justify-between no-print">
            <div className="flex gap-3 flex-wrap items-end">
              {/* Term filter */}
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
              {/* Year filter (fallback) */}
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
              {/* Class filter — only show when a term or year is selected */}
              {(historyTermId || historyYear) && isAdmin && classes.length > 0 && (
                <div>
                  <label className="label text-xs mb-1">Class</label>
                  <select
                    className="input max-w-[160px]"
                    value={historyFilterClassId}
                    onChange={e => setHistoryFilterClassId(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {/* Student name search */}
              <div>
                <label className="label text-xs mb-1">Search student</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
                  <input
                    className="input pl-8 max-w-[180px]"
                    placeholder="Name…"
                    value={historyStudentSearch}
                    onChange={e => setHistoryStudentSearch(e.target.value)}
                  />
                </div>
              </div>
              {/* Date filter */}
              <div>
                <label className="label text-xs mb-1">Filter by date</label>
                <input
                  type="date"
                  className="input max-w-[160px]"
                  value={historyDate}
                  onChange={e => setHistoryDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" icon={<Printer size={15} />} onClick={() => window.print()}>Print</Button>
              <Button variant="ghost" icon={<Download size={15} />} onClick={handleExportCSV} disabled={filteredHistory.length === 0}>Export</Button>
            </div>
          </div>

          {/* History view toggle */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border no-print">
              <button
                onClick={() => setHistorySummaryMode(false)}
                className={cn('px-3 py-1 text-xs rounded font-medium border transition-colors', !historySummaryMode ? 'bg-accent text-white border-accent' : 'border-border text-fg-muted hover:bg-surface-alt')}
              >
                Records
              </button>
              <button
                onClick={() => setHistorySummaryMode(true)}
                className={cn('px-3 py-1 text-xs rounded font-medium border transition-colors', historySummaryMode ? 'bg-accent text-white border-accent' : 'border-border text-fg-muted hover:bg-surface-alt')}
              >
                Student Summary
              </button>
            </div>

            {!historyTermId && !historyYear ? (
              <div className="py-12 text-center text-fg-muted text-sm">
                Select a term or year to view history
              </div>
            ) : historySummaryMode ? (
              <Table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Adm. No.</th>
                    <th className="text-green-700">Present</th>
                    <th className="text-red-600">Absent</th>
                    <th className="text-yellow-600">Late</th>
                    <th className="text-gray-500">Excused</th>
                    <th>Total Days</th>
                    <th>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <TableSkeleton rows={8} cols={8} />
                  ) : studentSummary.length === 0 ? (
                    <tr><td colSpan={8}>
                      <EmptyState title="No attendance records found" description="No records match the selected filters" />
                    </td></tr>
                  ) : (
                    studentSummary.map(row => {
                      const pct = row.total > 0 ? Math.round((row.present / row.total) * 100) : 0
                      return (
                        <tr key={row.student_id}>
                          <td className="font-medium">{row.full_name}</td>
                          <td className="text-fg-muted text-xs">{row.admission_number ?? '—'}</td>
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
                  <tr>
                    <th>Date</th>
                    <th>Student</th>
                    <th>Admission No.</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <TableSkeleton rows={8} cols={5} />
                  ) : filteredHistory.length === 0 ? (
                    <tr><td colSpan={5}>
                      <EmptyState title="No attendance records found" description="No records match the selected filters" />
                    </td></tr>
                  ) : (
                    filteredHistory.map(r => (
                      <tr key={r.id}>
                        <td className="text-sm">{formatDate(r.attendance_date)}</td>
                        <td className="font-medium">{r.students?.full_name ?? '—'}</td>
                        <td className="text-fg-muted text-xs">{r.students?.admission_number ?? '—'}</td>
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
                        <td className="text-fg-muted text-sm">{r.notes ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            )}
          </div>

          {filteredHistory.length > 0 && (
            <div className="card p-3 flex gap-4 flex-wrap items-center">
              <span className="text-xs text-fg-muted font-medium">{filteredHistory.length} records</span>
              <span className="badge-green">Present: {historyCounts.present}</span>
              <span className="badge-red">Absent: {historyCounts.absent}</span>
              <span className="badge-yellow">Late: {historyCounts.late}</span>
              <span className="badge-gray">Excused: {historyCounts.excused}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
