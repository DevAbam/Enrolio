'use client'
import { useState, useEffect, useCallback } from 'react'
import { Printer, Download } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { today, formatDate } from '@/lib/utils/date'
import { downloadCSV } from '@/lib/utils/csv'
import { cn } from '@/lib/utils/cn'
import type { Student, Class, AttendanceStatus } from '@/types'

interface AttendanceRecord {
  student_id: string
  status: AttendanceStatus
  notes: string
}

const statuses: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: 'Present',  activeClass: 'bg-accent text-white border-accent' },
  { value: 'absent',  label: 'Absent',   activeClass: 'bg-red-600 text-white border-red-600' },
  { value: 'late',    label: 'Late',     activeClass: 'bg-yellow-500 text-white border-yellow-500' },
  { value: 'excused', label: 'Excused',  activeClass: 'bg-gray-500 text-white border-gray-500' },
]

export default function StudentAttendancePage() {
  const { isAdmin, teacherClassId, schoolName } = useRole()
  const [date,       setDate]       = useState(today())
  const [classId,    setClassId]    = useState('')
  const [classes,    setClasses]    = useState<Class[]>([])
  const [students,   setStudents]   = useState<Student[]>([])
  const [records,    setRecords]    = useState<Map<string, AttendanceRecord>>(new Map())
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const supabase = createClient()

  // Lock teacher to their assigned class
  useEffect(() => {
    if (!isAdmin && teacherClassId) {
      setClassId(teacherClassId)
    }
  }, [isAdmin, teacherClassId])

  // Load classes list (admins only need this for selector)
  useEffect(() => {
    if (isAdmin) {
      supabase.from('classes').select('*').order('name').then(({ data }) => setClasses(data ?? []))
    }
  }, [supabase, isAdmin])

  const load = useCallback(async () => {
    if (!classId) return
    setLoading(true)

    const { data: studs } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('full_name')

    const studentList = studs ?? []
    setStudents(studentList)

    if (studentList.length > 0) {
      const { data: att } = await supabase
        .from('student_attendance')
        .select('*')
        .eq('attendance_date', date)
        .in('student_id', studentList.map((s) => s.id))

      const map = new Map<string, AttendanceRecord>()
      studentList.forEach((s) => {
        const found = att?.find((a) => a.student_id === s.id)
        map.set(s.id, {
          student_id: s.id,
          status:     (found?.status as AttendanceStatus) ?? 'present',
          notes:      found?.notes ?? '',
        })
      })
      setRecords(map)
    } else {
      setRecords(new Map())
    }

    setLoading(false)
  }, [supabase, classId, date])

  useEffect(() => { load() }, [load])

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
    }))

    const { error } = await supabase
      .from('student_attendance')
      .upsert(rows, { onConflict: 'student_id,attendance_date' })

    if (error) toast.error('Failed to save: ' + error.message)
    else toast.success(`Attendance saved for ${rows.length} students`)
    setSaving(false)
  }

  function handleExportCSV() {
    const selectedClass = classes.find((c) => c.id === classId)
    const className = selectedClass?.name ?? classId
    const headers = ['Date', 'Student Name', 'Admission No.', 'Class', 'Status', 'Notes']
    const rows = students.map((s) => {
      const rec = records.get(s.id)
      return [
        date,
        s.full_name,
        s.admission_number ?? '',
        className,
        rec?.status ?? '',
        rec?.notes ?? '',
      ]
    })
    downloadCSV(`student-attendance-${date}`, headers, rows)
  }

  const selectedClass = classes.find((c) => c.id === classId)

  const counts = {
    present: Array.from(records.values()).filter((r) => r.status === 'present').length,
    absent:  Array.from(records.values()).filter((r) => r.status === 'absent').length,
    late:    Array.from(records.values()).filter((r) => r.status === 'late').length,
    excused: Array.from(records.values()).filter((r) => r.status === 'excused').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Student Attendance" subtitle="Mark and track daily attendance" />

      {/* Filter bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3 justify-between no-print">
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="label text-xs mb-1">Date</label>
            <input
              type="date"
              className="input max-w-[160px]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {isAdmin && (
            <div>
              <label className="label text-xs mb-1">Class</label>
              <select
                className="input max-w-[200px]"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">— Select Class —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={markAllPresent} disabled={!classId || loading}>
            Mark All Present
          </Button>
          <Button onClick={save} loading={saving} disabled={!classId || records.size === 0}>
            Save Attendance
          </Button>
          <Button variant="ghost" icon={<Printer size={15} />} onClick={() => window.print()} disabled={!classId || loading}>
            Print
          </Button>
          <Button variant="ghost" icon={<Download size={15} />} onClick={handleExportCSV} disabled={!classId || students.length === 0}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="print-only hidden">
        <h1 className="text-lg font-bold">{schoolName}</h1>
        <h2 className="text-base font-semibold mt-1">Student Attendance Report</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          Date: {formatDate(date)}{selectedClass ? ` · Class: ${selectedClass.name}` : ''}
        </p>
      </div>

      {/* Table */}
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
              students.map((s) => {
                const rec = records.get(s.id)
                return (
                  <tr key={s.id}>
                    <td className="font-medium">{s.full_name}</td>
                    <td className="text-gray-500 text-xs">{s.admission_number ?? '—'}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {statuses.map(({ value, label, activeClass }) => (
                          <button
                            key={value}
                            onClick={() => setStatus(s.id, value)}
                            className={cn(
                              'px-3 py-1 text-xs rounded border font-medium transition-colors',
                              rec?.status === value
                                ? activeClass
                                : 'border-border text-fg-muted hover:bg-surface-alt'
                            )}
                          >
                            {label}
                          </button>
                        ))}
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

      {/* Summary strip */}
      {records.size > 0 && (
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
