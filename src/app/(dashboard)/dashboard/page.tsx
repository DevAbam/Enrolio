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
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { StatCard } from '@/components/ui/StatCard'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
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
  const [revenue, setRevenue] = useState<SchoolRevenueSummary | null>(null)
  const [defaulters, setDefaulters] = useState<StudentFeeSummary[]>([])
  const [studentAtt, setStudentAtt] = useState<AttendanceCounts>({ present: 0, absent: 0, total: 0 })
  const [teacherAtt, setTeacherAtt] = useState<AttendanceCounts>({ present: 0, absent: 0, total: 0 })
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyPoint[]>([])
  const [weeklyAtt, setWeeklyAtt] = useState<WeeklyAttPoint[]>([])
  const [classFees, setClassFees] = useState<ClassFeePoint[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const todayStr = today()
      const now = new Date()

      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

      const [
        { data: rev, error: revErr },
        { data: defs },
        { data: sAtt },
        { data: tAtt },
        { data: payments },
        { data: weekAtt },
        { data: allFees },
      ] = await Promise.all([
        supabase.from('school_revenue_summary').select('*').single(),
        supabase.from('student_fee_summary').select('*').gt('outstanding', 0).eq('is_active', true).order('outstanding', { ascending: false }).limit(20),
        supabase.from('student_attendance').select('status').eq('attendance_date', todayStr),
        supabase.from('teacher_attendance').select('status').eq('attendance_date', todayStr),
        supabase.from('payments').select('amount_paid, payment_date').gte('payment_date', sixMonthsAgoStr).order('payment_date'),
        supabase.from('student_attendance').select('attendance_date, status').gte('attendance_date', sevenDaysAgoStr).lte('attendance_date', todayStr),
        supabase.from('student_fee_summary').select('class_name, total_paid, outstanding').eq('is_active', true),
      ])

      if (revErr && revErr.code !== 'PGRST116') toast.error('Error loading revenue')
      setRevenue(rev ?? null)
      setDefaulters(defs ?? [])

      const sTotal = sAtt?.length ?? 0
      const sPresent = sAtt?.filter((a) => a.status === 'present' || a.status === 'late').length ?? 0
      setStudentAtt({ present: sPresent, absent: sTotal - sPresent, total: sTotal })
      const tTotal = tAtt?.length ?? 0
      const tPresent = tAtt?.filter((a) => a.status === 'present' || a.status === 'late').length ?? 0
      setTeacherAtt({ present: tPresent, absent: tTotal - tPresent, total: tTotal })

      // Monthly revenue (last 6 months)
      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthly: MonthlyPoint[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const total = payments?.filter((p) => p.payment_date.startsWith(key)).reduce((s, p) => s + Number(p.amount_paid), 0) ?? 0
        monthly.push({ month: MONTHS[d.getMonth()], collected: total })
      }
      setMonthlyRevenue(monthly)

      // Weekly attendance (last 7 days)
      const weekly: WeeklyAttPoint[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const dayAtts = weekAtt?.filter((a) => a.attendance_date === dateStr) ?? []
        const present = dayAtts.filter((a) => a.status === 'present' || a.status === 'late').length
        weekly.push({ day: d.toLocaleDateString('en', { weekday: 'short' }), present, absent: dayAtts.length - present })
      }
      setWeeklyAtt(weekly)

      // Class fee breakdown
      const classMap = new Map<string, { paid: number; outstanding: number }>()
      allFees?.forEach((s) => {
        const name = s.class_name ?? 'No Class'
        const ex = classMap.get(name) ?? { paid: 0, outstanding: 0 }
        classMap.set(name, { paid: ex.paid + Number(s.total_paid), outstanding: ex.outstanding + Number(s.outstanding) })
      })
      setClassFees(Array.from(classMap.entries()).map(([name, v]) => ({ name, ...v })))

      setLoading(false)
    }
    load()
  }, [supabase])

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
            <h3 className="section-title">Monthly Fee Collections</h3>
            <p className="text-xs text-fg-subtle mt-0.5 mb-5">Last 6 months</p>
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
                  tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`} width={42} />
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
            <h3 className="section-title">Weekly Student Attendance</h3>
            <p className="text-xs text-fg-subtle mt-0.5 mb-5">Last 7 days</p>
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

      {/* ── Row 5: Defaulters table ─────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="section-title">Students with Outstanding Fees</h2>
            <p className="text-xs text-fg-subtle mt-0.5">
              {defaulters.length} student{defaulters.length !== 1 ? 's' : ''} with unpaid balances
            </p>
          </div>
          <Link href="/sms?tab=bulk">
            <button className="btn-secondary text-xs px-3 py-1.5">Send All Reminders</button>
          </Link>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : defaulters.length === 0 ? (
          <EmptyState icon={<CheckCircle size={48} className="text-accent" />} title="All fees are up to date" description="No students have outstanding balances" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Name</th><th>Class</th><th>Term Fee</th>
                <th>Paid</th><th>Outstanding</th><th>Parent Phone</th><th></th>
              </tr>
            </thead>
            <tbody>
              {defaulters.map((s) => (
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
        )}
      </div>
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
