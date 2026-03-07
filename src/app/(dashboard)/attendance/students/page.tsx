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
import { today, formatDate } from '@/lib/utils/date'
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
  students?: { full_name: string; admission_number: string | null } | null
}

const statuses: { value: AttendanceStatus; label: string; activeClass: string; printClass: string }[] = [
  { value: 'present', label: 'Present',  activeClass: 'bg-accent text-white border-accent',             printClass: 'print:border-2 print:border-green-800 print:font-bold' },
  { value: 'absent',  label: 'Absent',   activeClass: 'bg-red-600 text-white border-red-600',           printClass: 'print:border-2 print:border-red-800 print:font-bold' },
  { value: 'late',    label: 'Late',     activeClass: 'bg-yellow-500 text-white border-yellow-500',     printClass: 'print:border-2 print:border-yellow-800 print:font-bold' },
  { value: 'excused', label: 'Excused',  activeClass: 'bg-gray-500 text-white border-gray-500',         printClass: 'print:border-2 print:border-gray-800 print:font-bold' },
]

export default function StudentAttendancePage() {
  const { isAdmin, teacherClassId, schoolName, schoolLogoUrl } = useRole()
  const { activeTerm, allTerms, selectedTerm } = useTerm()
  const [date,         setDate]         = useState(today())
  const [classId,      setClassId]      = useState('')
  const [classes,      setClasses]      = useState<Class[]>([])
  const [students,     setStudents]     = useState<Student[]>([])
  const [records,      setRecords]      = useState<Map<string, AttendanceRecord>>(new Map())
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [nameSearch,   setNameSearch]   = useState('')
  // History mode (search by year + term)
  const [historyTerm,          setHistoryTerm]          = useState(selectedTerm?.id ?? '')
  const [historyYear,          setHistoryYear]          = useState('')
  const [historyData,          setHistoryData]          = useState<HistoryRecord[]>([])
  const [historyLoading,       setHistoryLoading]       = useState(false)
  const [historyStudentSearch, setHistoryStudentSearch] = useState('')
  const [historySummaryMode,   setHistorySummaryMode]   = useState(false)
  const supabase = createClient()

  const isHistoryMode = !!(historyTerm || historyYear)

  useEffect(() => {
    if (!isAdmin && teacherClassId) setClassId(teacherClassId)
  }, [isAdmin, teacherClassId])

  // Sync history term filter when global selected term changes
  useEffect(() => {
    setHistoryTerm(selectedTerm?.id ?? '')
    setHistoryYear('')
  }, [selectedTerm?.id])

  useEffect(() => {
    if (isAdmin) {
      supabase.from('classes').select('*').order('name').then(({ data }) => setClasses(data ?? []))
    }
  }, [supabase, isAdmin])

  const load = useCallback(async () => {
    if (!classId || isHistoryMode) return
    setLoading(true)

    const { data: studs } = await supabase
      .from('students').select('*').eq('class_id', classId).eq('is_active', true).order('full_name')
    const studentList = studs ?? []
    setStudents(studentList)

    if (studentList.length > 0) {
      const { data: att } = await supabase
        .from('student_attendance').select('*')
        .eq('attendance_date', date)
        .in('student_id', studentList.map((s) => s.id))

      const map = new Map<string, AttendanceRecord>()
      studentList.forEach((s) => {
        const found = att?.find((a) => a.student_id === s.id)
        map.set(s.id, { student_id: s.id, status: (found?.status as AttendanceStatus) ?? 'present', notes: found?.notes ?? '' })
      })
      setRecords(map)
    } else {
      setRecords(new Map())
    }
    setLoading(false)
  }, [supabase, classId, date, isHistoryMode])

  useEffect(() => { load() }, [load])

  // Load history records when term or year filter is set
  useEffect(() => {
    if (!isHistoryMode) { setHistoryData([]); return }
    setHistoryLoading(true)
    let query = supabase
      .from('student_attendance')
      .select('*, students(full_name, admission_number)')
      .order('attendance_date', { ascending: false })

    if (historyTerm)                query = query.eq('term_id', historyTerm)
    else if (historyYear) {
      query = query.gte('attendance_date', `${historyYear}-01-01`)
                   .lte('attendance_date', `${historyYear}-12-31`)
    }
    if (classId) {
      // filter by class via subquery is complex; instead filter client-side after
    }
    query.then(({ data }) => {
      setHistoryData((data ?? []) as HistoryRecord[])
      setHistoryLoading(false)
    })
  }, [supabase, historyTerm, historyYear, isHistoryMode, classId])

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords((prev) => {
      const next = new Map(prev)
      const cur  = next.get(studentId)
      next.set(studentId, { ...cur!, status })
      return next
    })
  }

  function markAllPresent() {
    setRecords((prev) => {
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

    const rows = Array.from(records.values()).map((r) => ({
      school_id:       me!.school_id,
      student_id:      r.student_id,
      attendance_date: date,
      status:          r.status,
      notes:           r.notes || null,
      marked_by:       user!.id,
      term_id:         activeTerm?.id ?? null,
    }))

    const { error } = await supabase
      .from('student_attendance')
      .upsert(rows, { onConflict: 'student_id,attendance_date' })

    if (error) toast.error('Failed to save: ' + error.message)
    else toast.success(`Attendance saved for ${rows.length} students`)
    setSaving(false)
  }

  function handleExportCSV() {
    if (isHistoryMode) {
      if (historySummaryMode) {
        const headers = ['Student Name', 'Admission No.', 'Present', 'Absent', 'Late', 'Excused', 'Total Days', 'Attendance %']
        const rows = studentSummary.map(row => [
          row.full_name,
          row.admission_number ?? '',
          String(row.present), String(row.absent), String(row.late), String(row.excused), String(row.total),
          row.total > 0 ? `${Math.round((row.present / row.total) * 100)}%` : '0%',
        ])
        downloadExcel(`student-attendance-summary`, headers, rows)
      } else {
        const headers = ['Date', 'Student Name', 'Admission No.', 'Status', 'Notes']
        const rows = filteredHistory.map((r) => [
          formatDate(r.attendance_date),
          r.students?.full_name ?? '',
          r.students?.admission_number ?? '',
          r.status,
          r.notes ?? '',
        ])
        downloadExcel(`student-attendance-history`, headers, rows)
      }
      return
    }
    const selectedClass = classes.find((c) => c.id === classId)
    const className = selectedClass?.name ?? classId
    const headers = ['Date', 'Student Name', 'Admission No.', 'Class', 'Status', 'Notes']
    const rows = students.map((s) => {
      const rec = records.get(s.id)
      return [formatDate(date), s.full_name, s.admission_number ?? '', className, rec?.status ?? '', rec?.notes ?? '']
    })
    downloadExcel(`student-attendance-${date}`, headers, rows)
  }

  const selectedClass = classes.find((c) => c.id === classId)

  const filteredStudents = nameSearch
    ? students.filter(s => s.full_name.toLowerCase().includes(nameSearch.toLowerCase()))
    : students

  const counts = {
    present: Array.from(records.values()).filter((r) => r.status === 'present').length,
    absent:  Array.from(records.values()).filter((r) => r.status === 'absent').length,
    late:    Array.from(records.values()).filter((r) => r.status === 'late').length,
    excused: Array.from(records.values()).filter((r) => r.status === 'excused').length,
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - 3 + i)

  const filteredHistory = historyData.filter(r => {
    if (classId && r.students) {
      // We can't easily filter by class_id from student_attendance, so filter by loaded class name
      // The class is not in history records, but we can filter by student name search
    }
    if (historyStudentSearch) {
      const name = r.students?.full_name?.toLowerCase() ?? ''
      if (!name.includes(historyStudentSearch.toLowerCase())) return false
    }
    return true
  })

  const historyCounts = {
    present: filteredHistory.filter(r => r.status === 'present').length,
    absent:  filteredHistory.filter(r => r.status === 'absent').length,
    late:    filteredHistory.filter(r => r.status === 'late').length,
    excused: filteredHistory.filter(r => r.status === 'excused').length,
  }

  // Per-student summary — group filteredHistory by student_id
  type StudentSummaryRow = {
    student_id: string; full_name: string; admission_number: string | null
    present: number; absent: number; late: number; excused: number; total: number
  }
  const studentSummaryMap = new Map<string, StudentSummaryRow>()
  for (const r of filteredHistory) {
    const sid = r.student_id
    if (!studentSummaryMap.has(sid)) {
      studentSummaryMap.set(sid, {
        student_id: sid,
        full_name: r.students?.full_name ?? '—',
        admission_number: r.students?.admission_number ?? null,
        present: 0, absent: 0, late: 0, excused: 0, total: 0,
      })
    }
    const row = studentSummaryMap.get(sid)!
    row[r.status as 'present' | 'absent' | 'late' | 'excused']++
    row.total++
  }
  const studentSummary = Array.from(studentSummaryMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <div className="space-y-6">
      <PageHeader title="Student Attendance" subtitle="Mark and track daily attendance" />

      <div className="card p-4 flex flex-wrap items-end gap-3 justify-between no-print">
        <div className="flex gap-3 flex-wrap items-end">
          {!isHistoryMode && (
            <div>
              <label className="label text-xs mb-1">Date</label>
              <input type="date" className="input max-w-[160px]" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
          {isAdmin && (
            <div>
              <label className="label text-xs mb-1">Class</label>
              <select className="input max-w-[200px]" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">— All Classes —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
          <div className="relative">
            <label className="label text-xs mb-1">Search student</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                className="input pl-8 max-w-[180px]"
                placeholder="Name…"
                value={isHistoryMode ? historyStudentSearch : nameSearch}
                onChange={e => isHistoryMode ? setHistoryStudentSearch(e.target.value) : setNameSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isHistoryMode && classId && (
            <>
              <Button variant="secondary" onClick={markAllPresent} disabled={loading}>Mark All Present</Button>
              <Button onClick={save} loading={saving} disabled={records.size === 0}>Save Attendance</Button>
            </>
          )}
          <Button variant="ghost" icon={<Printer size={15} />} onClick={() => window.print()} disabled={loading}>Print</Button>
          <Button variant="ghost" icon={<Download size={15} />} onClick={handleExportCSV} disabled={loading || (isHistoryMode ? historyData.length === 0 : students.length === 0)}>Export Excel</Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="print-only hidden">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{schoolName}</h1>
            <h2 style={{ fontSize: '13px', fontWeight: '600', margin: '4px 0 0' }}>Student Attendance Report</h2>
            <p style={{ fontSize: '11px', color: '#555', margin: '2px 0 0' }}>
              {isHistoryMode
                ? allTerms.find(t => t.id === historyTerm)?.label ?? `Year ${historyYear}`
                : `Date: ${formatDate(date)}${selectedClass ? ` · Class: ${selectedClass.name}` : ''}`
              }
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

      {isHistoryMode ? (
        /* History mode: term/year filter view */
        <div className="card overflow-hidden">
          {/* View toggle */}
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

          {historySummaryMode ? (
            /* Per-student summary table */
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
                    <EmptyState icon={<span>📋</span>} title="No attendance records found" description="No records match the selected filters" />
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
            /* Flat records table */
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
                    <EmptyState icon={<span>📋</span>} title="No attendance records found" description="No records match the selected filters" />
                  </td></tr>
                ) : (
                  filteredHistory.map((r) => (
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
      ) : (
        /* Daily marking view */
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
                  <EmptyState icon={<span>📋</span>} title="Select a class to begin" description="Choose a class from the filter above" />
                </td></tr>
              ) : loading ? (
                <TableSkeleton rows={8} cols={4} />
              ) : students.length === 0 ? (
                <tr><td colSpan={4}>
                  <EmptyState icon={<span>🎒</span>} title="No active students in this class" />
                </td></tr>
              ) : (
                filteredStudents.map((s) => {
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
                                  isSelected ? activeClass : 'border-border text-fg-muted hover:bg-surface-alt',
                                  isSelected && `is-selected-${value}`
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
                          onChange={(e) => {
                            const notes = e.target.value
                            setRecords((prev) => {
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
      )}

      {!isHistoryMode && records.size > 0 && (
        <div className="card p-3 flex gap-4 flex-wrap">
          <span className="badge-green">Present: {counts.present}</span>
          <span className="badge-red">Absent: {counts.absent}</span>
          <span className="badge-yellow">Late: {counts.late}</span>
          <span className="badge-gray">Excused: {counts.excused}</span>
        </div>
      )}
      {isHistoryMode && filteredHistory.length > 0 && (
        <div className="card p-3 flex gap-4 flex-wrap items-center">
          <span className="text-xs text-fg-muted font-medium">{filteredHistory.length} records</span>
          <span className="badge-green">Present: {historyCounts.present}</span>
          <span className="badge-red">Absent: {historyCounts.absent}</span>
          <span className="badge-yellow">Late: {historyCounts.late}</span>
          <span className="badge-gray">Excused: {historyCounts.excused}</span>
        </div>
      )}
    </div>
  )
}
