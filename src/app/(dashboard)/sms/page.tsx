'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageSquare, Send, AlertTriangle, Zap, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'
import { buildFeeReminderMessage } from '@/lib/sms/provider'
import type { StudentFeeSummary, SmsLog } from '@/types'
import { cn } from '@/lib/utils/cn'

const CHAR_LIMIT = 160

const SMS_PACKAGES = [
  { credits: 645,    price: 'GHS 25.00'    },
  { credits: 1667,   price: 'GHS 60.00'    },
  { credits: 3448,   price: 'GHS 115.00'   },
  { credits: 7143,   price: 'GHS 220.00'   },
  { credits: 18519,  price: 'GHS 525.00'   },
  { credits: 38462,  price: 'GHS 1,030.00' },
  { credits: 80000,  price: 'GHS 2,035.00' },
  { credits: 208333, price: 'GHS 5,040.00' },
] as const

type CreditPackage = typeof SMS_PACKAGES[number]['credits']

function SMSPageInner() {
  const searchParams = useSearchParams()
  const initTab = (searchParams.get('tab') as 'single' | 'selected' | 'bulk' | 'broadcast') ?? 'single'
  const initStudentId = searchParams.get('studentId') ?? ''

  const [tab,           setTab]           = useState<'single' | 'selected' | 'bulk' | 'broadcast'>(initTab)
  const [school,        setSchool]        = useState<{ name: string } | null>(null)
  const [userRole,      setUserRole]      = useState<string>('')
  const [defaulters,    setDefaulters]    = useState<StudentFeeSummary[]>([])
  const [allStudents,   setAllStudents]   = useState<StudentFeeSummary[]>([])
  const [smsLogs,       setSmsLogs]       = useState<SmsLog[]>([])
  const [credits,       setCredits]       = useState<number>(0)
  const [search,        setSearch]        = useState('')
  const [singleStudent, setSingleStudent] = useState<StudentFeeSummary | null>(null)
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [message,       setMessage]       = useState('')
  const [bulkMessage,   setBulkMessage]   = useState('')
  const [broadcastMsg,  setBroadcastMsg]  = useState('')
  const [confirmOpen,     setConfirmOpen]     = useState(false)
  const [rechargeOpen,    setRechargeOpen]    = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null)
  const [sending,         setSending]         = useState(false)
  const [rechargeLoading, setRechargeLoading] = useState(false)
  const [clearLogsOpen,   setClearLogsOpen]   = useState(false)
  const [clearingLogs,    setClearingLogs]    = useState(false)
  const [logPage,       setLogPage]       = useState(1)
  const [logTotal,      setLogTotal]      = useState(0)
  const [selectedStudentPage, setSelectedStudentPage] = useState(1)
  const supabase = createClient()
  const LOG_PAGE_SIZE = 10
  const STUDENT_PAGE_SIZE = 10

  const loadCredits = useCallback(async () => {
    const res = await fetch('/api/sms/credits')
    if (res.ok) {
      const data = await res.json()
      setCredits(data.credits ?? 0)
    }
  }, [])

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: me } = await supabase.from('users').select('school_id, role, schools(name)').eq('id', user.id).single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSchool({ name: (me as any)?.schools?.name ?? 'Your School' })
    setUserRole((me as any)?.role ?? '')

    const [{ data: defs }, { data: studs }, { data: logs, count }] = await Promise.all([
      supabase.from('student_fee_summary').select('*').gt('outstanding', 0).eq('is_active', true).order('full_name'),
      supabase.from('student_fee_summary').select('*').eq('is_active', true).order('full_name'),
      supabase.from('sms_logs').select('*', { count: 'exact' }).order('sent_at', { ascending: false })
        .range((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE - 1),
    ])

    setDefaulters(defs ?? [])
    setAllStudents(studs ?? [])
    setSmsLogs(logs ?? [])
    setLogTotal(count ?? 0)

    if (initStudentId) {
      const found = (studs ?? []).find((s) => s.id === initStudentId)
      if (found) {
        setSingleStudent(found)
        setMessage(buildFeeReminderMessage({
          parentName:  found.parent_name ?? undefined,
          studentName: found.full_name,
          className:   found.class_name ?? 'N/A',
          outstanding: Number(found.outstanding),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          schoolName:  (me as any)?.schools?.name ?? 'School',
        }))
      }
    }
  }, [supabase, initStudentId, logPage])

  useEffect(() => { loadData(); loadCredits() }, [loadData, loadCredits])

  useEffect(() => {
    if (school) {
      setBulkMessage(`Dear (parent name), your ward (student name) ((class)) has an outstanding fee balance of (amount). Please make payment at ${school.name}. Thank you.`)
    }
  }, [school])

  // Handle Paystack redirect-back (runs once on mount when query params are present)
  useEffect(() => {
    const paystackRef = searchParams.get('paystack_ref')
    const cbStatus    = searchParams.get('status')
    if (!paystackRef || cbStatus !== 'success') return

    const toastId = toast.loading('Verifying payment…')

    async function verify(ref: string) {
      try {
        const res  = await fetch(`/api/sms/recharge/verify?reference=${encodeURIComponent(ref)}`)
        const data = await res.json() as { status: string; credits: number }
        toast.dismiss(toastId)
        if (data.status === 'success') {
          setCredits(data.credits)
          toast.success(`Recharge successful! New balance: ${data.credits.toLocaleString()} credits`)
        } else if (data.status === 'pending') {
          toast.info('Payment received. Credits will appear shortly.')
          // Retry once after 5 s in case webhook is still in transit
          setTimeout(async () => {
            const res2  = await fetch(`/api/sms/recharge/verify?reference=${encodeURIComponent(ref)}`)
            const data2 = await res2.json() as { status: string; credits: number }
            if (data2.status === 'success') {
              setCredits(data2.credits)
              toast.success(`Credits added! Balance: ${data2.credits.toLocaleString()}`)
            }
          }, 5000)
        } else {
          toast.error('Payment could not be confirmed. Contact support if you were charged.')
        }
      } catch {
        toast.dismiss(toastId)
        toast.error('Could not verify payment. Refresh the page to check your balance.')
      }
      // Strip query params from URL without navigating
      const url = new URL(window.location.href)
      url.searchParams.delete('paystack_ref')
      url.searchParams.delete('status')
      window.history.replaceState({}, '', url.toString())
    }

    verify(paystackRef)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // run once on mount only

  const filteredStudents = allStudents.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.admission_number ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const pagedSelectedStudents = filteredStudents.slice(
    (selectedStudentPage - 1) * STUDENT_PAGE_SIZE,
    selectedStudentPage * STUDENT_PAGE_SIZE
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

  async function handleClearLogs() {
    setClearingLogs(true)
    const { error } = await supabase.from('sms_logs').delete().gte('created_at', '1970-01-01')
    if (error) { toast.error('Failed to clear logs') }
    else { setSmsLogs([]); setLogTotal(0); toast.success('SMS logs cleared') }
    setClearingLogs(false)
    setClearLogsOpen(false)
  }

  async function callSmsApi(
    recipients: Array<{ student_id?: string; phone: string; message: string }>,
    sms_type: string
  ) {
    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients, sms_type }),
    })
    const data = await res.json()
    if (res.status === 402) {
      toast.error(`Insufficient credits. You need ${data.required} but have ${data.credits}.`)
      return null
    }
    return data
  }

  async function sendSingle() {
    if (!singleStudent?.parent_phone) {
      toast.error('No parent phone number for this student')
      return
    }
    if (!message.trim()) { toast.error('Message is required'); return }
    setSending(true)
    const data = await callSmsApi(
      [{ student_id: singleStudent.id, phone: singleStudent.parent_phone, message }],
      'fee_reminder'
    )
    if (data) {
      if (data.successCount > 0) toast.success('SMS sent successfully')
      else toast.error('Failed to send SMS')
    }
    setSending(false)
    loadData(); loadCredits()
  }

  async function sendBulk(
    recipients: Array<{ student_id?: string; phone: string; message: string }>,
    sms_type: string
  ) {
    setSending(true)
    const data = await callSmsApi(recipients, sms_type)
    if (data) {
      if (data.failCount === 0) toast.success(`✓ ${data.successCount} messages sent successfully`)
      else if (data.successCount > 0) toast.warning(`${data.successCount} sent, ${data.failCount} failed`)
      else toast.error('All messages failed to send')
    }
    setSending(false)
    setConfirmOpen(false)
    loadData(); loadCredits()
  }

  async function handleBulkSend() {
    if (tab === 'selected') {
      const selected = allStudents.filter((s) => selectedIds.has(s.id))
      const recipients = selected.filter((s) => s.parent_phone).map((s) => ({
        student_id: s.id,
        phone:      s.parent_phone!,
        message,
      }))
      await sendBulk(recipients, 'general')
    } else if (tab === 'bulk') {
      const recipients = defaulters.filter((s) => s.parent_phone).map((s) => ({
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
      await sendBulk(recipients, 'bulk')
    } else if (tab === 'broadcast') {
      const recipients = allStudents.filter((s) => s.parent_phone).map((s) => ({
        student_id: s.id,
        phone:      s.parent_phone!,
        message:    broadcastMsg,
      }))
      await sendBulk(recipients, 'broadcast')
    }
  }

  async function handleRecharge() {
    if (!selectedPackage) { toast.error('Select a credit package'); return }
    setRechargeLoading(true)
    try {
      const res  = await fetch('/api/sms/recharge', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ credits: selectedPackage }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not initialize payment')
        setRechargeLoading(false)
        return
      }
      // Redirect to Paystack hosted checkout — page leaves app
      window.location.href = data.authorization_url
    } catch {
      toast.error('Network error. Please try again.')
      setRechargeLoading(false)
    }
  }

  const confirmCount = tab === 'selected'
    ? allStudents.filter((s) => selectedIds.has(s.id) && s.parent_phone).length
    : tab === 'bulk'
    ? defaulters.filter((s) => s.parent_phone).length
    : allStudents.filter((s) => s.parent_phone).length

  const tabs = [
    { key: 'single',    label: 'Single Student' },
    { key: 'selected',  label: 'Selected Students' },
    { key: 'bulk',      label: 'All Defaulters' },
    { key: 'broadcast', label: 'Custom Broadcast' },
  ] as const

  return (
    <div className="space-y-6">
      <PageHeader title="SMS Center" subtitle="Send messages to parents" />

      {/* SMS Credits Banner */}
      <div className="card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', credits > 10 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
            <Zap size={18} className={credits > 10 ? 'text-green-600' : 'text-red-500'} />
          </div>
          <div>
            <p className="text-sm font-medium text-fg">SMS Credits</p>
            <p className={cn('text-2xl font-bold', credits > 10 ? 'text-green-600' : 'text-red-500')}>
              {credits.toLocaleString()}
            </p>
          </div>
          {credits <= 10 && (
            <Badge variant="red">Low balance</Badge>
          )}
        </div>
        {userRole === 'admin' && (
          <Button
            icon={<Plus size={14} />}
            variant="secondary"
            onClick={() => setRechargeOpen(true)}
          >
            Recharge
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'px-4 py-3 text-sm font-medium transition-colors border-b-2',
                tab === key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-fg-muted hover:text-fg'
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
                  className="w-full text-left px-4 py-3 hover:bg-surface-alt border-b border-border last:border-b-0"
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
                  {s.class_name && <span className="text-xs text-fg-muted ml-2">· {s.class_name}</span>}
                </button>
              ))}
              {filteredStudents.length === 0 && (
                <p className="px-4 py-3 text-sm text-fg-muted">No students found</p>
              )}
            </div>
          )}

          {singleStudent && (
            <div className="card p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{singleStudent.full_name}</p>
                <p className="text-xs text-fg-muted">{singleStudent.class_name}</p>
              </div>
              <div className="flex items-center gap-2">
                {Number(singleStudent.outstanding) > 0 && (
                  <Badge variant="red">{formatCurrency(Number(singleStudent.outstanding))}</Badge>
                )}
                <button className="text-fg-muted hover:text-fg text-xs" onClick={() => { setSingleStudent(null); setMessage('') }}>✕</button>
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
            <p className={cn('text-xs text-right mt-1', message.length > CHAR_LIMIT ? 'text-red-500' : 'text-fg-muted')}>
              {message.length}/{CHAR_LIMIT}
            </p>
          </div>

          <Button icon={<Send size={14} />} loading={sending} onClick={sendSingle} disabled={!singleStudent || !message.trim() || credits < 1}>
            Send SMS
          </Button>
          {credits < 1 && <p className="text-xs text-red-500">No credits available. Please recharge first.</p>}
        </div>
      )}

      {/* TAB 2 — Selected Students */}
      {tab === 'selected' && (
        <div className="space-y-4">
          <SearchInput
            placeholder="Search students…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedStudentPage(1) }}
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
                {pagedSelectedStudents.map((s) => (
                  <tr key={s.id}>
                    <td><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                    <td className="font-medium">{s.full_name}</td>
                    <td className="text-fg-muted">{s.class_name ?? '—'}</td>
                    <td>{Number(s.outstanding) > 0 ? <span className="text-red-600 font-medium">{formatCurrency(Number(s.outstanding))}</span> : <Badge variant="green">Paid</Badge>}</td>
                    <td className="text-fg-muted">{s.parent_phone ?? <span className="text-red-400 text-xs">No phone</span>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={selectedStudentPage} pageSize={STUDENT_PAGE_SIZE} total={filteredStudents.length} onPageChange={setSelectedStudentPage} />
          </div>

          <div className="max-w-lg space-y-2">
            <label className="label">Message</label>
            <textarea rows={4} className="input resize-none" maxLength={CHAR_LIMIT} value={message} onChange={(e) => setMessage(e.target.value)} />
            <p className={cn('text-xs text-right', message.length > CHAR_LIMIT ? 'text-red-500' : 'text-fg-muted')}>{message.length}/{CHAR_LIMIT}</p>
          </div>

          <Button
            icon={<Send size={14} />}
            onClick={() => setConfirmOpen(true)}
            disabled={selectedIds.size === 0 || !message.trim() || credits < selectedIds.size}
          >
            Send to {selectedIds.size} Student{selectedIds.size !== 1 ? 's' : ''}
          </Button>
          {credits < selectedIds.size && selectedIds.size > 0 && (
            <p className="text-xs text-red-500">Need {selectedIds.size} credits, but you only have {credits}.</p>
          )}
        </div>
      )}

      {/* TAB 3 — All Defaulters */}
      {tab === 'bulk' && (
        <div className="space-y-4 max-w-lg">
          <div className="card p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-sm text-fg">
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
            <div className="bg-surface-alt rounded-lg p-3 text-sm italic border border-border text-fg">
              {bulkMessage || 'Loading preview…'}
            </div>
          </div>

          <Button
            icon={<Send size={14} />}
            onClick={() => setConfirmOpen(true)}
            disabled={defaulters.filter((s) => s.parent_phone).length === 0 || credits < defaulters.filter((s) => s.parent_phone).length}
          >
            Send Reminders to All {defaulters.filter((s) => s.parent_phone).length} Defaulters
          </Button>
          {credits < defaulters.filter((s) => s.parent_phone).length && (
            <p className="text-xs text-red-500">
              Need {defaulters.filter((s) => s.parent_phone).length} credits, but you only have {credits}.
            </p>
          )}
        </div>
      )}

      {/* TAB 4 — Custom Broadcast */}
      {tab === 'broadcast' && (
        <div className="space-y-4 max-w-lg">
          <div className="card p-4 flex items-start gap-3">
            <MessageSquare size={18} className="text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-fg">
              Send a custom message to all <strong>{allStudents.filter((s) => s.parent_phone).length} parents</strong> with a phone number on file.
              {allStudents.filter((s) => !s.parent_phone).length > 0 && (
                <span className="text-fg-muted">
                  {' '}({allStudents.filter((s) => !s.parent_phone).length} students have no phone and will be skipped)
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="label">Your Message</label>
            <textarea
              rows={5}
              className="input resize-none"
              placeholder="Type your custom message here… e.g. School will be closed on Friday for PTA meeting."
              maxLength={CHAR_LIMIT}
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
            />
            <p className={cn('text-xs text-right mt-1', broadcastMsg.length > CHAR_LIMIT ? 'text-red-500' : 'text-fg-muted')}>
              {broadcastMsg.length}/{CHAR_LIMIT}
            </p>
          </div>

          <Button
            icon={<Send size={14} />}
            onClick={() => setConfirmOpen(true)}
            disabled={!broadcastMsg.trim() || allStudents.filter((s) => s.parent_phone).length === 0 || credits < allStudents.filter((s) => s.parent_phone).length}
          >
            Broadcast to All {allStudents.filter((s) => s.parent_phone).length} Parents
          </Button>
          {credits < allStudents.filter((s) => s.parent_phone).length && broadcastMsg.trim() && (
            <p className="text-xs text-red-500">
              Need {allStudents.filter((s) => s.parent_phone).length} credits, but you only have {credits}.
            </p>
          )}
        </div>
      )}

      {/* SMS Log */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2">
            <MessageSquare size={18} />
            Recent SMS Activity
          </h2>
          {smsLogs.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setClearLogsOpen(true)}>
              Clear Logs
            </Button>
          )}
        </div>
        {smsLogs.length === 0 ? (
          <EmptyState icon={<MessageSquare size={48} className="text-fg-subtle" />} title="No SMS sent yet" description="Send your first message above" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Recipients</th>
                <th>Type</th>
                <th>Status</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {smsLogs.map((log) => (
                <tr key={log.id}>
                  <td className="text-xs text-fg-subtle">{formatDateTime(log.sent_at)}</td>
                  <td className="text-sm">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(log as any).recipient_count > 1 ? `${(log as any).recipient_count} recipients` : log.parent_phone}
                  </td>
                  <td><Badge variant="gray">{log.sms_type}</Badge></td>
                  <td><Badge variant={log.status === 'success' ? 'green' : log.status === 'failed' ? 'red' : 'yellow'}>{log.status}</Badge></td>
                  <td className="text-xs text-fg-muted max-w-xs truncate">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {logTotal > LOG_PAGE_SIZE && (
          <Pagination page={logPage} pageSize={LOG_PAGE_SIZE} total={logTotal} onPageChange={setLogPage} />
        )}
      </div>

      {/* Clear Logs Modal */}
      <Modal open={clearLogsOpen} onClose={() => setClearLogsOpen(false)} title="Clear SMS Logs">
        <div className="space-y-4">
          <p className="text-sm text-fg">This will permanently delete all SMS activity logs for your school. This cannot be undone.</p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setClearLogsOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={clearingLogs} onClick={handleClearLogs}>Clear All Logs</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Bulk SMS Modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Bulk SMS">
        <div className="space-y-4">
          <p className="text-sm text-fg">
            You are about to send <strong>{confirmCount} SMS message{confirmCount !== 1 ? 's' : ''}</strong>.
            This will use <strong>{confirmCount} credit{confirmCount !== 1 ? 's' : ''}</strong> (balance after: {credits - confirmCount}).
          </p>
          <div className="bg-surface-alt rounded-lg p-3 text-sm border border-border italic text-fg">
            {tab === 'broadcast' ? broadcastMsg : tab === 'selected' ? message : bulkMessage}
          </div>
          <p className="text-sm text-fg-muted">This action cannot be undone.</p>
          <div className="flex gap-3">
            <Button loading={sending} onClick={handleBulkSend} className="flex-1 justify-center" icon={<Send size={14} />}>
              Send Now
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Recharge Modal (admin only) — Paystack */}
      <Modal
        open={rechargeOpen}
        onClose={() => { setRechargeOpen(false); setSelectedPackage(null) }}
        title="Recharge SMS Credits"
      >
        <div className="space-y-4">
          <div className="bg-surface-alt rounded-lg p-3 text-sm border border-border text-fg space-y-1">
            <p className="font-medium">Current balance: <span className="text-accent">{credits.toLocaleString()} credits</span></p>
            <p className="text-fg-muted text-xs">1 credit = 1 SMS. You will be redirected to Paystack to complete your payment securely.</p>
          </div>

          {/* Package selection grid — Arkesel tiers with markup */}
          <div>
            <label className="label">Select a Package</label>
            <div className="grid grid-cols-2 gap-2 mt-1 max-h-72 overflow-y-auto pr-1">
              {SMS_PACKAGES.map((pkg) => (
                <button
                  key={pkg.credits}
                  onClick={() => setSelectedPackage(pkg.credits)}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-all',
                    selectedPackage === pkg.credits
                      ? 'border-accent bg-accent-bg'
                      : 'border-border bg-surface hover:border-accent/50'
                  )}
                >
                  <p className="font-semibold text-sm text-fg">{pkg.credits.toLocaleString()} SMS</p>
                  <p className="text-xs font-medium text-accent mt-0.5">{pkg.price}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-fg-muted mt-2">Supports card, Mobile Money, and bank transfer.</p>
          </div>

          <div className="flex gap-3">
            <Button
              loading={rechargeLoading}
              onClick={handleRecharge}
              className="flex-1 justify-center"
              icon={<Zap size={14} />}
              disabled={!selectedPackage || rechargeLoading}
            >
              {selectedPackage
                ? `Pay ${SMS_PACKAGES.find((p) => p.credits === selectedPackage)?.price} via Paystack`
                : 'Select a package'}
            </Button>
            <Button variant="ghost" onClick={() => { setRechargeOpen(false); setSelectedPackage(null) }}>
              Cancel
            </Button>
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
