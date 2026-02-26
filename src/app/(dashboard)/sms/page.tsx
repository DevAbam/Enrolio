'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageSquare, Send, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { buildFeeReminderMessage } from '@/lib/sms/provider'
import type { StudentFeeSummary, SmsLog } from '@/types'
import { cn } from '@/lib/utils/cn'

const CHAR_LIMIT = 160

function SMSPageInner() {
  const searchParams = useSearchParams()
  const initTab = (searchParams.get('tab') as 'single' | 'selected' | 'bulk') ?? 'single'
  const initStudentId = searchParams.get('studentId') ?? ''

  const [tab,           setTab]           = useState<'single' | 'selected' | 'bulk'>(initTab)
  const [school,        setSchool]        = useState<{ name: string } | null>(null)
  const [defaulters,    setDefaulters]    = useState<StudentFeeSummary[]>([])
  const [allStudents,   setAllStudents]   = useState<StudentFeeSummary[]>([])
  const [smsLogs,       setSmsLogs]       = useState<SmsLog[]>([])
  const [search,        setSearch]        = useState('')
  const [singleStudent, setSingleStudent] = useState<StudentFeeSummary | null>(null)
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [message,       setMessage]       = useState('')
  const [bulkMessage,   setBulkMessage]   = useState('')
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [sending,       setSending]       = useState(false)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: me } = await supabase.from('users').select('school_id, schools(name)').eq('id', user.id).single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSchool({ name: (me as any)?.schools?.name ?? 'Your School' })

    const [{ data: defs }, { data: studs }, { data: logs }] = await Promise.all([
      supabase.from('student_fee_summary').select('*').gt('outstanding', 0).eq('is_active', true).order('full_name'),
      supabase.from('student_fee_summary').select('*').eq('is_active', true).order('full_name'),
      supabase.from('sms_logs').select('*').order('sent_at', { ascending: false }).limit(50),
    ])

    setDefaulters(defs ?? [])
    setAllStudents(studs ?? [])
    setSmsLogs(logs ?? [])

    // Pre-select student if coming from another page
    if (initStudentId) {
      const found = (studs ?? []).find((s) => s.id === initStudentId)
      if (found) {
        setSingleStudent(found)
        setMessage(buildFeeReminderMessage({
          parentName:   found.parent_name ?? undefined,
          studentName:  found.full_name,
          className:    found.class_name ?? 'N/A',
          outstanding:  Number(found.outstanding),
          schoolName:   (me as any)?.schools?.name ?? 'School',
        }))
      }
    }
  }, [supabase, initStudentId])

  useEffect(() => { loadData() }, [loadData])

  // Build bulk reminder message when defaulters or school changes
  useEffect(() => {
    if (defaulters.length > 0 && school) {
      setBulkMessage(buildFeeReminderMessage({
        parentName:  undefined,
        studentName: '{student name}',
        className:   '{class}',
        outstanding: 0,
        schoolName:  school.name,
      }).replace('GHS 0.00', '{amount}'))
    }
  }, [defaulters, school])

  const filteredStudents = allStudents.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.admission_number ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function toggleSelectAll() {
    if (selectedIds.size === filteredStudents.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredStudents.map((s) => s.id)))
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function sendSingle() {
    if (!singleStudent?.parent_phone) {
      toast.error('No parent phone number for this student')
      return
    }
    if (!message.trim()) { toast.error('Message is required'); return }
    setSending(true)
    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: [{ student_id: singleStudent.id, phone: singleStudent.parent_phone, message }]
      }),
    })
    const data = await res.json()
    if (data.successCount > 0) toast.success('SMS sent successfully')
    else toast.error('Failed to send SMS')
    setSending(false)
    loadData()
  }

  async function sendBulk(recipients: Array<{ student_id: string; phone: string; message: string }>) {
    setSending(true)
    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients }),
    })
    const data = await res.json()
    if (data.failCount === 0) toast.success(`✓ ${data.successCount} messages sent successfully`)
    else if (data.successCount > 0) toast.warning(`${data.successCount} sent, ${data.failCount} failed`)
    else toast.error('All messages failed to send')
    setSending(false)
    setConfirmOpen(false)
    loadData()
  }

  async function handleBulkSend() {
    if (tab === 'selected') {
      const selected = allStudents.filter((s) => selectedIds.has(s.id))
      const recipients = selected
        .filter((s) => s.parent_phone)
        .map((s) => ({
          student_id: s.id,
          phone:      s.parent_phone!,
          message,
        }))
      await sendBulk(recipients)
    } else if (tab === 'bulk') {
      const recipients = defaulters
        .filter((s) => s.parent_phone)
        .map((s) => ({
          student_id: s.id,
          phone:      s.parent_phone!,
          message:    buildFeeReminderMessage({
            parentName:  s.parent_name ?? undefined,
            studentName: s.full_name,
            className:   s.class_name ?? 'N/A',
            outstanding: Number(s.outstanding),
            schoolName:  school?.name ?? 'School',
          }),
        }))
      await sendBulk(recipients)
    }
  }

  const confirmCount = tab === 'selected'
    ? allStudents.filter((s) => selectedIds.has(s.id) && s.parent_phone).length
    : defaulters.filter((s) => s.parent_phone).length

  const tabs = [
    { key: 'single',   label: 'Single Student' },
    { key: 'selected', label: 'Selected Students' },
    { key: 'bulk',     label: 'All Defaulters' },
  ] as const

  return (
    <div className="space-y-6">
      <PageHeader title="SMS Center" subtitle="Send fee reminders to parents" />

      {/* Tab bar */}
      <div className="border-b border-green-200 dark:border-green-800">
        <div className="flex gap-0">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'px-4 py-3 text-sm font-medium transition-colors border-b-2',
                tab === key
                  ? 'border-green-600 text-green-700 dark:text-green-400'
                  : 'border-transparent text-gray-500 hover:text-green-700 dark:hover:text-green-400'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1 — Single Student */}
      {tab === 'single' && (
        <div className="max-w-lg space-y-4">
          <SearchInput
            placeholder="Search student by name or admission no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && !singleStudent && (
            <div className="card overflow-hidden max-h-48 overflow-y-auto">
              {filteredStudents.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-4 py-3 hover:bg-green-50 dark:hover:bg-green-900/20 border-b border-green-100 dark:border-green-800/50 last:border-b-0"
                  onClick={() => {
                    setSingleStudent(s)
                    setSearch('')
                    setMessage(buildFeeReminderMessage({
                      parentName:  s.parent_name ?? undefined,
                      studentName: s.full_name,
                      className:   s.class_name ?? 'N/A',
                      outstanding: Number(s.outstanding),
                      schoolName:  school?.name ?? 'School',
                    }))
                  }}
                >
                  <span className="font-medium text-sm">{s.full_name}</span>
                  {s.class_name && <span className="text-xs text-gray-500 ml-2">· {s.class_name}</span>}
                </button>
              ))}
              {filteredStudents.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-500">No students found</p>
              )}
            </div>
          )}

          {singleStudent && (
            <div className="card p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{singleStudent.full_name}</p>
                <p className="text-xs text-gray-500">{singleStudent.class_name}</p>
              </div>
              <div className="flex items-center gap-2">
                {Number(singleStudent.outstanding) > 0 && (
                  <Badge variant="red">{formatCurrency(Number(singleStudent.outstanding))}</Badge>
                )}
                <button className="text-gray-400 hover:text-gray-600 text-xs" onClick={() => { setSingleStudent(null); setMessage('') }}>✕</button>
              </div>
            </div>
          )}

          <div>
            <label className="label">Message</label>
            <textarea
              rows={4}
              className="input resize-none"
              placeholder="Type your message here…"
              maxLength={CHAR_LIMIT}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className={cn('text-xs text-right mt-1', message.length > CHAR_LIMIT ? 'text-red-500' : 'text-gray-400')}>
              {message.length}/{CHAR_LIMIT}
            </p>
          </div>

          <Button icon={<Send size={14} />} loading={sending} onClick={sendSingle} disabled={!singleStudent || !message.trim()}>
            Send SMS
          </Button>
        </div>
      )}

      {/* TAB 2 — Selected Students */}
      {tab === 'selected' && (
        <div className="space-y-4">
          <SearchInput
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          {selectedIds.size > 0 && (
            <span className="badge-green">{selectedIds.size} selected</span>
          )}
          <div className="card overflow-hidden">
            <Table>
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox" checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0} onChange={toggleSelectAll} />
                  </th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Outstanding</th>
                  <th>Parent Phone</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                    <td className="font-medium">{s.full_name}</td>
                    <td className="text-gray-500">{s.class_name ?? '—'}</td>
                    <td>{Number(s.outstanding) > 0 ? <span className="text-red-600 font-medium">{formatCurrency(Number(s.outstanding))}</span> : <Badge variant="green">Paid</Badge>}</td>
                    <td className="text-gray-500">{s.parent_phone ?? <span className="text-red-400 text-xs">No phone</span>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="max-w-lg space-y-2">
            <label className="label">Message</label>
            <textarea rows={4} className="input resize-none" maxLength={CHAR_LIMIT} value={message} onChange={(e) => setMessage(e.target.value)} />
            <p className={cn('text-xs text-right', message.length > CHAR_LIMIT ? 'text-red-500' : 'text-gray-400')}>{message.length}/{CHAR_LIMIT}</p>
          </div>

          <Button
            icon={<Send size={14} />}
            onClick={() => setConfirmOpen(true)}
            disabled={selectedIds.size === 0 || !message.trim()}
          >
            Send to {selectedIds.size} Student{selectedIds.size !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* TAB 3 — All Defaulters */}
      {tab === 'bulk' && (
        <div className="space-y-4 max-w-lg">
          <div className="card p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-300">
              <strong>{defaulters.length} student{defaulters.length !== 1 ? 's' : ''}</strong> currently have outstanding fees.
              {defaulters.filter((s) => !s.parent_phone).length > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  {' '}({defaulters.filter((s) => !s.parent_phone).length} have no phone number and will be skipped)
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="label">Message Preview (per-student values inserted automatically)</label>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm italic border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300">
              {bulkMessage || 'Loading preview…'}
            </div>
          </div>

          <Button
            icon={<Send size={14} />}
            onClick={() => setConfirmOpen(true)}
            disabled={defaulters.filter((s) => s.parent_phone).length === 0}
          >
            Send Reminders to All {defaulters.filter((s) => s.parent_phone).length} Defaulters
          </Button>
        </div>
      )}

      {/* SMS Log */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-green-100 dark:border-green-800">
          <h2 className="section-title flex items-center gap-2">
            <MessageSquare size={18} />
            Recent SMS Activity
          </h2>
        </div>
        {smsLogs.length === 0 ? (
          <EmptyState icon={<MessageSquare size={48} className="text-green-300 dark:text-green-700" />} title="No SMS sent yet" description="Send your first message above" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Status</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {smsLogs.map((log) => (
                <tr key={log.id}>
                  <td className="text-xs text-gray-500">{formatDate(log.sent_at)}</td>
                  <td className="text-sm">{log.parent_phone}</td>
                  <td><Badge variant="gray">{log.sms_type}</Badge></td>
                  <td><Badge variant={log.status === 'success' ? 'green' : log.status === 'failed' ? 'red' : 'yellow'}>{log.status}</Badge></td>
                  <td className="text-xs text-gray-500 max-w-xs truncate">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {/* Confirm Modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Bulk SMS">
        <div className="space-y-4">
          <p className="text-sm text-green-800 dark:text-green-300">
            You are about to send <strong>{confirmCount} SMS message{confirmCount !== 1 ? 's' : ''}</strong>.
          </p>
          <div className="bg-green-50 dark:bg-[#111b11] rounded-lg p-3 text-sm border border-green-200 dark:border-green-700 italic text-green-800 dark:text-green-300">
            {tab === 'selected' ? message : bulkMessage}
          </div>
          <p className="text-sm text-gray-500">This action cannot be undone.</p>
          <div className="flex gap-3">
            <Button loading={sending} onClick={handleBulkSend} className="flex-1 justify-center" icon={<Send size={14} />}>
              Send Now
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function SMSPage() {
  return (
    <Suspense>
      <SMSPageInner />
    </Suspense>
  )
}
