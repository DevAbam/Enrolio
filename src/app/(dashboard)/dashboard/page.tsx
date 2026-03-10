'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  Users, FileText, CheckCircle, AlertCircle,
  GraduationCap, UserCheck, MessageSquare, ClipboardList,
  ChevronLeft, ChevronRight, Cake,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { useTerm } from '@/lib/term-context'
import { StatCard } from '@/components/ui/StatCard'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { formatCurrency } from '@/lib/utils/currency'
import { today } from '@/lib/utils/date'
import type { SchoolRevenueSummary, StudentFeeSummary } from '@/types'

// ── Chart types ───────────────────────────────────────────────────────────────
interface MonthlyPoint { month: string; collected: number }
interface WeeklyAttPoint { day: string; present: number; absent: number }
interface ClassFeePoint { name: string; paid: number; outstanding: number }

// ── Chart palette ─────────────────────────────────────────────────────────────
// const G600 = '#16a34a'
const G600 = '#2563eb'
// const R300 = '#fca5a5'
const R300 = '#ABAB4B'

// ── Custom tooltips ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface rounded-xl px-3 py-2 shadow-xl border border-border text-sm">
      <p className="font-semibold text-fg mb-0.5">{label}</p>
      <p className="text-accent-fg font-medium">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AttTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface rounded-xl px-3 py-2 shadow-xl border border-border text-sm">
      <p className="font-semibold text-fg mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  )
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ClassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface rounded-xl px-3 py-2 shadow-xl border border-border text-sm">
      <p className="font-semibold text-fg mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }} className="font-medium">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── Attendance progress card ──────────────────────────────────────────────────
function AttBar({ label, icon, counts }: {
  label: string; icon: React.ReactNode
  counts: { present: number; absent: number; total: number }
}) {
  const rate = counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0
  return (
    <div className="bg-surface-alt rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-sm font-medium text-fg">
          {icon}{label}
        </span>
        <span className="text-lg font-bold text-accent-fg">
          {counts.total > 0 ? `${rate}%` : '—'}
        </span>
      </div>
      <div className="bg-border rounded-full h-2 overflow-hidden">
        <div className="bg-accent h-2 rounded-full transition-all duration-700"
          style={{ width: counts.total > 0 ? `${rate}%` : '0%' }} />
      </div>
      <p className="text-xs text-fg-subtle mt-2">
        {counts.present} present · {counts.absent} absent
      </p>
    </div>
  )
}

interface AttendanceCounts { present: number; absent: number; total: number }

// ─── BIRTHDAY HELPERS ─────────────────────────────────────────────────────────
interface BirthdayEntry { id: string; name: string; days: number; type: 'student' | 'teacher' }

function daysUntilBirthday(dob: string): number {
  const now  = new Date(); now.setHours(0, 0, 0, 0)
  const b    = new Date(dob + 'T00:00:00')
  const next = new Date(now.getFullYear(), b.getMonth(), b.getDate())
  if (next < now) next.setFullYear(now.getFullYear() + 1)
  return Math.round((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function BirthdayWidget({ entries, title }: { entries: BirthdayEntry[]; title?: string }) {
  if (entries.length === 0) return null
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Cake size={17} className="text-accent" />
        <h3 className="section-title">{title ?? 'Upcoming Birthdays'}</h3>
        <span className="ml-auto text-xs bg-accent-bg text-accent px-2 py-0.5 rounded-full">{entries.length}</span>
      </div>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={`${e.type}-${e.id}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-fg truncate">{e.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              {e.type === 'teacher' && (
                <span className="text-[10px] bg-surface-alt border border-border text-fg-muted px-1.5 py-0.5 rounded">Teacher</span>
              )}
              <span className={
                e.days === 0 ? 'text-xs font-bold text-accent' :
                e.days === 1 ? 'text-xs font-semibold text-yellow-500' :
                'text-xs text-fg-muted'
              }>
                {e.days === 0 ? 'Today!' : e.days === 1 ? 'Tomorrow' : `in ${e.days}d`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── TEACHER DASHBOARD ───────────────────────────────────────────────────────
function TeacherDashboard() {
  const { fullName, teacherClassId } = useRole()
  const [students, setStudents] = useState<StudentFeeSummary[]>([])
  const [attCounts, setAttCounts] = useState<AttendanceCounts>({ present: 0, absent: 0, total: 0 })
  const [className, setClassName] = useState<string>('')
  const [loading, setLoading] = useState(true)
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

        const total = att?.length ?? 0
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
      <div className="card p-5 flex items-center justify-between bg-surface-alt border border-border">
        <div>
          <p className="font-semibold text-fg">Mark Today&apos;s Attendance</p>
          <p className="text-sm text-fg-subtle mt-0.5">Record which students are present today</p>
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
          icon={<CheckCircle size={20} className="text-accent" />}
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
          icon={<GraduationCap size={20} className="text-accent" />}
        />
      </div>

      {/* Birthday widget — students only for teachers */}
      {(() => {
        const upcoming = students
          .filter(s => s.date_of_birth)
          .map(s => ({ id: s.id, name: s.full_name, days: daysUntilBirthday(s.date_of_birth!), type: 'student' as const }))
          .filter(s => s.days <= 14)
          .sort((a, b) => a.days - b.days)
        return upcoming.length > 0 ? <BirthdayWidget entries={upcoming} title="Student Birthdays (next 14 days)" /> : null
      })()}

      {/* Student list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="section-title">My Students</h2>
        </div>
        {!teacherClassId ? (
          <EmptyState icon={<span>🏫</span>} title="No class assigned yet" description="Ask your school admin to assign you a class" />
        ) : loading ? (
          <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : students.length === 0 ? (
          <EmptyState icon={<GraduationCap size={40} className="text-fg-subtle" />} title="No students in your class" />
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
                    <Link href={`/students/${s.id}`} className="hover:text-accent">
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

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDashboard() {
  const now = new Date()
  const [revenue, setRevenue] = useState<SchoolRevenueSummary | null>(null)
  const [defaulters, setDefaulters] = useState<StudentFeeSummary[]>([])
  const [studentAtt, setStudentAtt] = useState<AttendanceCounts>({ present: 0, absent: 0, total: 0 })
  const [teacherAtt, setTeacherAtt] = useState<AttendanceCounts>({ present: 0, absent: 0, total: 0 })
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyPoint[]>([])
  const [weeklyAtt, setWeeklyAtt] = useState<WeeklyAttPoint[]>([])
  const [classFees,  setClassFees]  = useState<ClassFeePoint[]>([])
  const [birthdays,  setBirthdays]  = useState<BirthdayEntry[]>([])
  const [loading,    setLoading]    = useState(true)
  const [chartYear,  setChartYear]  = useState(now.getFullYear())
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week, 1 = prev week, etc.
  const [defaulterPage, setDefaulterPage] = useState(1)
  const [defaulterClassFilter, setDefaulterClassFilter] = useState('')
  const DEFAULTER_PAGE_SIZE = 10
  const supabase = createClient()
  const { selectedTerm, activeTerm } = useTerm()

  // ── Main data: KPIs, today's attendance, class fees ──────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      setDefaulterPage(1)
      setDefaulterClassFilter('')
      const todayStr = today()
      const isActiveTerm = !selectedTerm || selectedTerm.id === activeTerm?.id

      // ── Attendance + birthdays (always the same) ──────────────────────────
      const [{ data: sAtt }, { data: tAtt }, { data: sBirths }, { data: tBirths }] = await Promise.all([
        supabase.from('student_attendance').select('status').eq('attendance_date', todayStr),
        supabase.from('teacher_attendance').select('status').eq('attendance_date', todayStr),
        supabase.from('students').select('id, full_name, date_of_birth').eq('is_active', true).not('date_of_birth', 'is', null),
        supabase.from('teachers').select('id, full_name, date_of_birth').eq('is_active', true).not('date_of_birth', 'is', null),
      ])

      const sTotal = sAtt?.length ?? 0
      const sPresent = sAtt?.filter((a) => a.status === 'present' || a.status === 'late').length ?? 0
      setStudentAtt({ present: sPresent, absent: sTotal - sPresent, total: sTotal })
      const tTotal = tAtt?.length ?? 0
      const tPresent = tAtt?.filter((a) => a.status === 'present' || a.status === 'late').length ?? 0
      setTeacherAtt({ present: tPresent, absent: tTotal - tPresent, total: tTotal })

      const upcoming: BirthdayEntry[] = []
      for (const s of sBirths ?? []) {
        if (!s.date_of_birth) continue
        const days = daysUntilBirthday(s.date_of_birth)
        if (days <= 14) upcoming.push({ id: s.id, name: s.full_name, days, type: 'student' })
      }
      for (const t of tBirths ?? []) {
        if (!t.date_of_birth) continue
        const days = daysUntilBirthday(t.date_of_birth)
        if (days <= 14) upcoming.push({ id: t.id, name: t.full_name, days, type: 'teacher' })
      }
      setBirthdays(upcoming.sort((a, b) => a.days - b.days))

      if (isActiveTerm) {
        // ── Active term: use existing views ─────────────────────────────────
        const [{ data: rev, error: revErr }, { data: defs }, { data: allFees }] = await Promise.all([
          supabase.from('school_revenue_summary').select('*').single(),
          supabase.from('student_fee_summary').select('*').gt('outstanding', 0).eq('is_active', true).eq('is_graduated', false).order('outstanding', { ascending: false }).limit(200),
          supabase.from('student_fee_summary').select('class_name, total_paid, outstanding').eq('is_active', true),
        ])
        if (revErr && revErr.code !== 'PGRST116') toast.error('Error loading revenue')
        setRevenue(rev ?? null)
        setDefaulters(defs ?? [])

        const classMap = new Map<string, { paid: number; outstanding: number }>()
        allFees?.forEach((s) => {
          const name = s.class_name ?? 'No Class'
          const ex = classMap.get(name) ?? { paid: 0, outstanding: 0 }
          classMap.set(name, { paid: ex.paid + Number(s.total_paid), outstanding: ex.outstanding + Number(s.outstanding) })
        })
        setClassFees(Array.from(classMap.entries()).map(([name, v]) => ({ name, ...v })))
      } else {
        // ── Non-active term: query underlying tables ─────────────────────────
        const termId = selectedTerm!.id
        const [{ data: enrollments }, { data: termFeesData }, { data: termPayments }, { data: studentsList }, { data: classesList }] = await Promise.all([
          supabase.from('student_enrollments').select('student_id, class_id').eq('term_id', termId),
          supabase.from('class_term_fees').select('class_id, fee_amount').eq('term_id', termId),
          supabase.from('payments').select('amount_paid, student_id').eq('term_id', termId),
          supabase.from('students').select('id, full_name, parent_phone, is_active, is_graduated').eq('is_active', true).eq('is_graduated', false),
          supabase.from('classes').select('id, name'),
        ])

        const feeMap = new Map((termFeesData ?? []).map(f => [f.class_id, Number(f.fee_amount)]))
        const payMap = new Map<string, number>()
        ;(termPayments ?? []).forEach(p => {
          payMap.set(p.student_id, (payMap.get(p.student_id) ?? 0) + Number(p.amount_paid))
        })
        const studentMap = new Map((studentsList ?? []).map(s => [s.id, s]))
        const classNameMap = new Map((classesList ?? []).map(c => [c.id, c.name]))

        let expected = 0, collected = 0
        const defList: StudentFeeSummary[] = []
        const classMap = new Map<string, { paid: number; outstanding: number }>()

        ;(enrollments ?? []).forEach(e => {
          const student = studentMap.get(e.student_id)
          if (!student) return
          const fee = feeMap.get(e.class_id) ?? 0
          const paid = Math.min(payMap.get(e.student_id) ?? 0, fee)
          const outstanding = Math.max(0, fee - (payMap.get(e.student_id) ?? 0))
          expected += fee
          collected += paid
          const className = classNameMap.get(e.class_id) ?? undefined
          if (outstanding > 0) {
            defList.push({
              id: student.id, school_id: '', full_name: student.full_name,
              parent_phone: student.parent_phone ?? undefined,
              is_active: true, is_graduated: false,
              class_id: e.class_id, class_name: className,
              term_fee_amount: fee, discount_amount: 0, carried_over_balance: 0,
              total_owed: fee, total_paid: paid, outstanding,
            } as StudentFeeSummary)
          }
          const name = className ?? 'No Class'
          const ex = classMap.get(name) ?? { paid: 0, outstanding: 0 }
          classMap.set(name, { paid: ex.paid + paid, outstanding: ex.outstanding + outstanding })
        })

        setRevenue({
          school_id: termId,
          total_active_students: enrollments?.length ?? 0,
          expected_revenue: expected,
          collected_revenue: collected,
          outstanding_revenue: Math.max(0, expected - collected),
          defaulters_count: defList.length,
        })
        setDefaulters(defList.sort((a, b) => b.outstanding - a.outstanding))
        setClassFees(Array.from(classMap.entries()).map(([name, v]) => ({ name, ...v })))
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, selectedTerm?.id])

  // ── Monthly revenue: reloads when chartYear changes ───────────────────────
  useEffect(() => {
    async function loadMonthly() {
      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const from = `${chartYear}-01-01`
      const to   = `${chartYear}-12-31`
      const { data: payments } = await supabase
        .from('payments').select('amount_paid, payment_date')
        .gte('payment_date', from).lte('payment_date', to)
      const monthly: MonthlyPoint[] = MONTHS.map((month, idx) => {
        const key = `${chartYear}-${String(idx + 1).padStart(2, '0')}`
        const collected = payments?.filter((p) => p.payment_date.startsWith(key))
          .reduce((s, p) => s + Number(p.amount_paid), 0) ?? 0
        return { month, collected }
      })
      setMonthlyRevenue(monthly)
    }
    loadMonthly()
  }, [supabase, chartYear])

  // ── Weekly attendance: reloads when weekOffset changes ────────────────────
  useEffect(() => {
    async function loadWeekly() {
      const end = new Date()
      end.setDate(end.getDate() - weekOffset * 7)
      const endStr = end.toISOString().split('T')[0]
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      const startStr = start.toISOString().split('T')[0]

      const { data: weekAtt } = await supabase
        .from('student_attendance').select('attendance_date, status')
        .gte('attendance_date', startStr).lte('attendance_date', endStr)

      const weekly: WeeklyAttPoint[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(end); d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const dayAtts = weekAtt?.filter((a) => a.attendance_date === dateStr) ?? []
        const present = dayAtts.filter((a) => a.status === 'present' || a.status === 'late').length
        weekly.push({ day: d.toLocaleDateString('en', { weekday: 'short' }), present, absent: dayAtts.length - present })
      }
      setWeeklyAtt(weekly)
    }
    loadWeekly()
  }, [supabase, weekOffset])

  const collectionRate = revenue && Number(revenue.expected_revenue) > 0
    ? Math.round((Number(revenue.collected_revenue) / Number(revenue.expected_revenue)) * 100) : 0

  const donutData = [
    { name: 'Collected', value: Number(revenue?.collected_revenue ?? 0) },
    { name: 'Outstanding', value: Number(revenue?.outstanding_revenue ?? 0) },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">
          {new Date().toLocaleDateString('en-GH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} variant="card" className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Students" value={revenue?.total_active_students ?? 0}
            sub="Enrolled this term" icon={<Users size={20} className="text-accent" />} />
          <StatCard label="Expected Revenue" value={formatCurrency(Number(revenue?.expected_revenue ?? 0))}
            sub="This term" icon={<FileText size={20} className="text-accent" />} />
          <StatCard label="Collected" value={formatCurrency(Number(revenue?.collected_revenue ?? 0))}
            sub={`${collectionRate}% of target`}
            icon={<CheckCircle size={20} className="text-accent" />} highlight="green" />
          <StatCard label="Outstanding" value={formatCurrency(Number(revenue?.outstanding_revenue ?? 0))}
            sub={`${revenue?.defaulters_count ?? 0} defaulter${(revenue?.defaulters_count ?? 0) !== 1 ? 's' : ''}`}
            icon={<AlertCircle size={20} className="text-red-500" />}
            highlight={Number(revenue?.outstanding_revenue ?? 0) > 0 ? 'red' : undefined} />
        </div>
      )}

      {/* ── Row 2: Monthly Revenue + Fee Donut ─────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Monthly Revenue Area Chart */}
          <div className="card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="section-title">Monthly Fee Collections</h3>
              <select
                className="input max-w-[90px] text-xs py-1"
                value={chartYear}
                onChange={(e) => setChartYear(Number(e.target.value))}
              >
                {[-2,-1,0,1].map(offset => {
                  const y = now.getFullYear() + offset
                  return <option key={y} value={y}>{y}</option>
                })}
              </select>
            </div>
            <p className="text-xs text-fg-subtle mt-0.5 mb-5">All 12 months of {chartYear}</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={G600} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={G600} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.7} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => {
                    if (v === 0) return '0'
                    if (v >= 1000000) return `GHS ${(v / 1000000).toFixed(1)}M`
                    if (v >= 1000) return `GHS ${(v / 1000).toFixed(0)}k`
                    return `GHS ${v}`
                  }} width={64} />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: G600, strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="collected" stroke={G600} strokeWidth={2.5}
                  fill="url(#revGrad)"
                  dot={{ fill: G600, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: G600, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Fee Collection Donut */}
          <div className="card p-6 flex flex-col">
            <h3 className="section-title">Fee Breakdown</h3>
            <p className="text-xs text-fg-subtle mt-0.5 mb-2">Collected vs outstanding</p>
            <div className="flex-1 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%"
                    innerRadius={52} outerRadius={75}
                    paddingAngle={3} dataKey="value"
                    startAngle={90} endAngle={-270}>
                    <Cell fill={G600} />
                    <Cell fill={R300} />
                  </Pie>
                  <Tooltip formatter={(val) => formatCurrency(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-fg">{collectionRate}%</span>
                <span className="text-xs text-fg-subtle">collected</span>
              </div>
            </div>
            <div className="space-y-3 mt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-fg-muted">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: G600 }} />Collected
                </span>
                <span className="font-semibold text-accent-fg">
                  {formatCurrency(Number(revenue?.collected_revenue ?? 0))}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-fg-muted">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: R300 }} />Outstanding
                </span>
                <span className="font-semibold text-red-500 dark:text-red-400">
                  {formatCurrency(Number(revenue?.outstanding_revenue ?? 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Row 3: Weekly Attendance + Today summary ────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Weekly Attendance Bar Chart */}
          <div className="card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="section-title">Weekly Student Attendance</h3>
              <div className="flex items-center gap-1">
                <button
                  className="btn-ghost p-1 rounded"
                  onClick={() => setWeekOffset(w => w + 1)}
                  title="Previous week"
                ><ChevronLeft size={15} /></button>
                <span className="text-xs text-fg-muted px-1">
                  {weekOffset === 0 ? 'This week' : `${weekOffset}w ago`}
                </span>
                <button
                  className="btn-ghost p-1 rounded"
                  onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
                  disabled={weekOffset === 0}
                  title="Next week"
                ><ChevronRight size={15} /></button>
              </div>
            </div>
            <p className="text-xs text-fg-subtle mt-0.5 mb-5">7-day student attendance</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyAtt} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.7} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<AttTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="present" name="Present" fill={G600} radius={[5, 5, 0, 0]} maxBarSize={30} />
                <Bar dataKey="absent" name="Absent" fill={R300} radius={[5, 5, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3 justify-end">
              <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: G600 }} />Present
              </span>
              <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: R300 }} />Absent
              </span>
            </div>
          </div>

          {/* Today's Attendance summary */}
          <div className="card p-6 flex flex-col gap-4">
            <div>
              <h3 className="section-title">Today&apos;s Attendance</h3>
              <p className="text-xs text-fg-subtle mt-0.5">Recorded so far today</p>
            </div>
            <div className="flex flex-col gap-3 flex-1">
              <AttBar label="Students" icon={<GraduationCap size={15} />} counts={studentAtt} />
              <AttBar label="Teachers" icon={<UserCheck size={15} />} counts={teacherAtt} />
            </div>
            <Link href="/attendance/students">
              <Button variant="secondary" className="w-full justify-center">
                <ClipboardList size={15} />Mark Attendance
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Row 4: Class fee breakdown ──────────────────────────────────────── */}
      {!loading && classFees.length > 0 && (
        <div className="card p-6">
          <h3 className="section-title">Class-wise Fee Breakdown</h3>
          <p className="text-xs text-fg-subtle mt-0.5 mb-5">Collected vs outstanding per class</p>
          <ResponsiveContainer width="100%" height={Math.max(160, classFees.length * 52)}>
            <BarChart data={classFees} layout="vertical"
              margin={{ top: 4, right: 20, left: 8, bottom: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.7} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ClassTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="paid" name="Collected" fill={G600} radius={[0, 5, 5, 0]} maxBarSize={22} />
              <Bar dataKey="outstanding" name="Outstanding" fill={R300} radius={[0, 5, 5, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-3 justify-end">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: G600 }} />Collected
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: R300 }} />Outstanding
            </span>
          </div>
        </div>
      )}

      {/* ── Birthdays ───────────────────────────────────────────────────────── */}
      {!loading && birthdays.length > 0 && (
        <BirthdayWidget entries={birthdays} title="Upcoming Birthdays (next 14 days)" />
      )}

      {/* ── Row 5: Defaulters table ─────────────────────────────────────────── */}
      {(() => {
        const uniqueClasses = Array.from(new Set(defaulters.map(d => d.class_name).filter(Boolean))) as string[]
        const filteredDefaulters = defaulterClassFilter
          ? defaulters.filter(d => d.class_name === defaulterClassFilter)
          : defaulters
        return (
      <div className="card overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="section-title">Students with Outstanding Fees</h2>
            <p className="text-xs text-fg-subtle mt-0.5">
              {filteredDefaulters.length} student{filteredDefaulters.length !== 1 ? 's' : ''} with unpaid balances
              {selectedTerm && selectedTerm.id !== activeTerm?.id && (
                <span className="ml-2 text-accent font-medium">· {selectedTerm.label}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {uniqueClasses.length > 1 && (
              <select
                className="input text-sm max-w-[160px] py-1"
                value={defaulterClassFilter}
                onChange={e => { setDefaulterClassFilter(e.target.value); setDefaulterPage(1) }}
              >
                <option value="">All Classes</option>
                {uniqueClasses.sort().map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <Link href="/sms?tab=bulk">
              <button className="btn-secondary text-xs px-3 py-1.5">Send All Reminders</button>
            </Link>
          </div>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : defaulters.length === 0 ? (
          <EmptyState icon={<CheckCircle size={48} className="text-accent" />} title="All fees are up to date" description="No students have outstanding balances" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Name</th><th>Class</th><th>Term Fee</th>
                  <th>Paid</th><th>Outstanding</th><th>Parent Phone</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredDefaulters.slice((defaulterPage - 1) * DEFAULTER_PAGE_SIZE, defaulterPage * DEFAULTER_PAGE_SIZE).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/students/${s.id}`} className="font-medium hover:text-accent">
                        {s.full_name}
                      </Link>
                    </td>
                    <td className="text-gray-500">{s.class_name ?? '—'}</td>
                    <td>{formatCurrency(Number(s.term_fee_amount))}</td>
                    <td className="text-accent-fg font-medium">{formatCurrency(Number(s.total_paid))}</td>
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
            <Pagination page={defaulterPage} pageSize={DEFAULTER_PAGE_SIZE} total={filteredDefaulters.length} onPageChange={setDefaulterPage} />
          </>
        )}
      </div>
        )
      })()}
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { role, loading } = useRole()
  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} variant="card" className="h-28" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton variant="card" className="h-72 lg:col-span-2" />
        <Skeleton variant="card" className="h-72" />
      </div>
    </div>
  )
  return role === 'teacher' ? <TeacherDashboard /> : <AdminDashboard />
}
