'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users, FileText, CheckCircle, AlertCircle,
  GraduationCap, UserCheck, MessageSquare, ClipboardList
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { StatCard } from '@/components/ui/StatCard'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils/currency'
import { today } from '@/lib/utils/date'
import type { SchoolRevenueSummary, StudentFeeSummary } from '@/types'

interface AttendanceCounts { present: number; absent: number; total: number }

// ─── TEACHER DASHBOARD ──────────────────────────────────────────────────────
function TeacherDashboard() {
  const { fullName, teacherClassId } = useRole()
  const [students,  setStudents]  = useState<StudentFeeSummary[]>([])
  const [attCounts, setAttCounts] = useState<AttendanceCounts>({ present: 0, absent: 0, total: 0 })
  const [className, setClassName] = useState<string>('')
  const [loading,   setLoading]   = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const todayStr = today()

      const [{ data: studs }, { data: cls }] = await Promise.all([
        teacherClassId
          ? supabase.from('student_fee_summary').select('*').eq('class_id', teacherClassId).eq('is_active', true).order('full_name')
          : { data: [] },
        teacherClassId
          ? supabase.from('classes').select('name').eq('id', teacherClassId).single()
          : { data: null },
      ])

      setStudents(studs ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setClassName((cls as any)?.name ?? '')

      if (teacherClassId && studs && studs.length > 0) {
        const { data: att } = await supabase
          .from('student_attendance')
          .select('status')
          .eq('attendance_date', todayStr)
          .in('student_id', studs.map((s) => s.id))

        const total   = att?.length ?? 0
        const present = att?.filter((a) => a.status === 'present' || a.status === 'late').length ?? 0
        setAttCounts({ present, absent: total - present, total })
      }
      setLoading(false)
    }
    load()
  }, [supabase, teacherClassId])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">{greeting}{fullName ? `, ${fullName.split(' ')[0]}` : ''}!</h2>
        <p className="page-subtitle">{className ? `Class Teacher — ${className}` : 'Welcome to SchoolOps Pro'}</p>
      </div>

      {/* Quick action card */}
      <div className="card p-5 flex items-center justify-between bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
        <div>
          <p className="font-semibold text-green-800 dark:text-green-300">Mark Today&apos;s Attendance</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Record which students are present today</p>
        </div>
        <Link href={`/attendance/students${teacherClassId ? `?classId=${teacherClassId}` : ''}`}>
          <Button icon={<ClipboardList size={16} />}>Mark Attendance</Button>
        </Link>
      </div>

      {/* Today's attendance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Present Today"
          value={loading ? '—' : attCounts.present}
          sub={`of ${attCounts.total} students`}
          icon={<CheckCircle size={20} className="text-green-600" />}
          highlight="green"
        />
        <StatCard
          label="Absent Today"
          value={loading ? '—' : attCounts.absent}
          sub="recorded today"
          icon={<AlertCircle size={20} className="text-red-500" />}
          highlight={attCounts.absent > 0 ? 'red' : undefined}
        />
        <StatCard
          label="Total Students"
          value={loading ? '—' : students.length}
          sub={className || 'Your class'}
          icon={<GraduationCap size={20} className="text-green-600" />}
        />
      </div>

      {/* Student list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-green-100 dark:border-green-800">
          <h2 className="section-title">My Students</h2>
        </div>
        {!teacherClassId ? (
          <EmptyState icon={<span>🏫</span>} title="No class assigned yet" description="Ask your school admin to assign you a class" />
        ) : loading ? (
          <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : students.length === 0 ? (
          <EmptyState icon={<GraduationCap size={40} className="text-green-300" />} title="No students in your class" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Admission No.</th>
                <th>Parent Phone</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">
                    <Link href={`/students/${s.id}`} className="hover:text-green-600 dark:hover:text-green-400">
                      {s.full_name}
                    </Link>
                  </td>
                  <td className="text-gray-500 text-xs">{s.admission_number ?? '—'}</td>
                  <td className="text-gray-500">{s.parent_phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  )
}

// ─── ADMIN DASHBOARD ────────────────────────────────────────────────────────
function AdminDashboard() {
  const [revenue,    setRevenue]   = useState<SchoolRevenueSummary | null>(null)
  const [defaulters, setDefaulters] = useState<StudentFeeSummary[]>([])
  const [studentAtt, setStudentAtt] = useState<AttendanceCounts>({ present: 0, absent: 0, total: 0 })
  const [teacherAtt, setTeacherAtt] = useState<AttendanceCounts>({ present: 0, absent: 0, total: 0 })
  const [loading,    setLoading]   = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const todayStr = today()
      const [{ data: rev, error: revErr }, { data: defs, error: defErr }, { data: sAtt }, { data: tAtt }] = await Promise.all([
        supabase.from('school_revenue_summary').select('*').single(),
        supabase.from('student_fee_summary').select('*').gt('outstanding', 0).eq('is_active', true).order('outstanding', { ascending: false }).limit(20),
        supabase.from('student_attendance').select('status').eq('attendance_date', todayStr),
        supabase.from('teacher_attendance').select('status').eq('attendance_date', todayStr),
      ])
      if (revErr && revErr.code !== 'PGRST116') toast.error('Error loading revenue')
      if (defErr) toast.error('Error loading defaulters')
      setRevenue(rev ?? null)
      setDefaulters(defs ?? [])
      const sTotal   = sAtt?.length ?? 0
      const sPresent = sAtt?.filter((a) => a.status === 'present' || a.status === 'late').length ?? 0
      setStudentAtt({ present: sPresent, absent: sTotal - sPresent, total: sTotal })
      const tTotal   = tAtt?.length ?? 0
      const tPresent = tAtt?.filter((a) => a.status === 'present' || a.status === 'late').length ?? 0
      setTeacherAtt({ present: tPresent, absent: tTotal - tPresent, total: tTotal })
      setLoading(false)
    }
    load()
  }, [supabase])

  const collectionRate = revenue && Number(revenue.expected_revenue) > 0
    ? Math.round((Number(revenue.collected_revenue) / Number(revenue.expected_revenue)) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">Overview of your school&apos;s operations</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} variant="card" className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Students" value={revenue?.total_active_students ?? 0} sub="Enrolled this term" icon={<Users size={20} className="text-green-600" />} />
          <StatCard label="Expected Revenue" value={formatCurrency(Number(revenue?.expected_revenue ?? 0))} sub="This term" icon={<FileText size={20} className="text-green-600" />} />
          <StatCard label="Collected Revenue" value={formatCurrency(Number(revenue?.collected_revenue ?? 0))} sub={`${collectionRate}% collection rate`} icon={<CheckCircle size={20} className="text-green-600" />} />
          <StatCard label="Outstanding Balance" value={formatCurrency(Number(revenue?.outstanding_revenue ?? 0))} sub={`${revenue?.defaulters_count ?? 0} defaulter${(revenue?.defaulters_count ?? 0) !== 1 ? 's' : ''}`} icon={<AlertCircle size={20} className="text-red-500" />} highlight={Number(revenue?.outstanding_revenue ?? 0) > 0 ? 'red' : undefined} />
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Student Attendance Today" value={studentAtt.total > 0 ? `${Math.round((studentAtt.present / studentAtt.total) * 100)}%` : '—'} sub={`${studentAtt.present} present / ${studentAtt.absent} absent`} icon={<GraduationCap size={20} className="text-green-600" />} />
          <StatCard label="Teacher Attendance Today" value={teacherAtt.total > 0 ? `${Math.round((teacherAtt.present / teacherAtt.total) * 100)}%` : '—'} sub={`${teacherAtt.present} present / ${teacherAtt.absent} absent`} icon={<UserCheck size={20} className="text-green-600" />} />
          <div className="stat-card">
            <span className="stat-label">Collection Rate</span>
            <span className="stat-value">{collectionRate}%</span>
            <div className="mt-2">
              <div className="bg-green-100 dark:bg-green-900/40 rounded-full h-3 overflow-hidden">
                <div className="bg-green-600 rounded-full h-3 transition-all duration-500" style={{ width: `${collectionRate}%` }} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatCurrency(Number(revenue?.collected_revenue ?? 0))} of {formatCurrency(Number(revenue?.expected_revenue ?? 0))} collected
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-green-100 dark:border-green-800">
          <h2 className="section-title">Students with Outstanding Fees</h2>
          <Link href="/sms?tab=bulk">
            <button className="btn-secondary text-xs px-3 py-1.5">Send All Reminders</button>
          </Link>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : defaulters.length === 0 ? (
          <EmptyState icon={<CheckCircle size={48} className="text-green-400" />} title="All fees are up to date" description="No students have outstanding balances" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Name</th><th>Class</th><th>Term Fee</th><th>Paid</th><th>Outstanding</th><th>Parent Phone</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {defaulters.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`} className="font-medium hover:text-green-600 dark:hover:text-green-400">{s.full_name}</Link></td>
                  <td className="text-gray-500">{s.class_name ?? '—'}</td>
                  <td>{formatCurrency(Number(s.term_fee_amount))}</td>
                  <td className="text-green-600 dark:text-green-400">{formatCurrency(Number(s.total_paid))}</td>
                  <td><span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(Number(s.outstanding))}</span></td>
                  <td className="text-gray-500">{s.parent_phone ?? '—'}</td>
                  <td>
                    <Link href={`/sms?tab=single&studentId=${s.id}`}>
                      <button className="btn-ghost p-1.5 rounded"><MessageSquare size={15} /></button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  )
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { role, loading } = useRole()
  if (loading) return <div className="space-y-4"><Skeleton variant="card" className="h-28" /><Skeleton variant="card" className="h-48" /></div>
  return role === 'teacher' ? <TeacherDashboard /> : <AdminDashboard />
}
