export interface SmsResult {
  success: boolean
  providerResponse: string
  messageId?: string   // Arkesel message ID for delivery status polling
}

export interface ArkeselBalance {
  sms_balance: string      // e.g. "2003"
  main_balance: string     // e.g. "GHS 20.99"
}

/** Arkesel delivery status for a single message */
export type ArkeselDeliveryStatus = 'sent' | 'delivered' | 'failed' | 'expired' | 'rejected' | 'pending'

const ARKESEL_BASE = 'https://sms.arkesel.com/api/v2'

function isConfigured() {
  return !!(process.env.ARKESEL_API_KEY && process.env.ARKESEL_API_KEY !== 'your-arkesel-api-key')
}

/** Returns true when ARKESEL_SANDBOX=true — sends go to Arkesel but are not billed or forwarded to carriers. */
function isSandbox() {
  return process.env.ARKESEL_SANDBOX === 'true'
}

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  if (!isConfigured()) {
    console.log(`[SMS STUB] To: ${phone} | Message: ${message}`)
    return { success: true, providerResponse: 'STUB_MODE' }
  }

  try {
    const res = await fetch(`${ARKESEL_BASE}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.ARKESEL_API_KEY!,
      },
      body: JSON.stringify({
        sender:     process.env.ARKESEL_SENDER_ID ?? 'SchoolOps',
        message,
        recipients: [phone],
        ...(isSandbox() && { sandbox: true }),
      }),
    })
    const data = await res.json()
    const success = res.ok && data.status === 'success'
    // Extract the message ID from the first recipient in the response
    const messageId = success && Array.isArray(data.data) ? data.data[0]?.id : undefined
    return { success, providerResponse: JSON.stringify(data), messageId }
  } catch (err) {
    return { success: false, providerResponse: String(err) }
  }
}

/** Send to multiple recipients in a single Arkesel API call (up to 100 at a time). */
export async function sendSmsBatch(
  recipients: Array<{ phone: string; message: string }>
): Promise<{ phone: string; success: boolean; messageId?: string }[]> {
  if (!isConfigured()) {
    for (const r of recipients) {
      console.log(`[SMS STUB] To: ${r.phone} | Message: ${r.message}`)
    }
    return recipients.map((r) => ({ phone: r.phone, success: true }))
  }

  const results: { phone: string; success: boolean; messageId?: string }[] = []

  // Group by identical message to reduce API calls
  const byMessage = new Map<string, string[]>()
  for (const r of recipients) {
    const list = byMessage.get(r.message) ?? []
    list.push(r.phone)
    byMessage.set(r.message, list)
  }

  for (const [message, phones] of byMessage) {
    // Arkesel accepts up to 100 recipients per call; chunk if needed
    for (let i = 0; i < phones.length; i += 100) {
      const chunk = phones.slice(i, i + 100)
      try {
        const res = await fetch(`${ARKESEL_BASE}/sms/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.ARKESEL_API_KEY!,
          },
          body: JSON.stringify({
            sender:     process.env.ARKESEL_SENDER_ID ?? 'SchoolOps',
            message,
            recipients: chunk,
            ...(isSandbox() && { sandbox: true }),
          }),
        })
        const data = await res.json()
        const success = res.ok && data.status === 'success'
        // Map phone → message ID from Arkesel's per-recipient response
        const idMap = new Map<string, string>()
        if (success && Array.isArray(data.data)) {
          for (const item of data.data) {
            if (item.recipient && item.id) idMap.set(item.recipient, item.id)
          }
        }
        for (const phone of chunk) {
          results.push({ phone, success, messageId: idMap.get(phone) })
        }
      } catch {
        for (const phone of chunk) results.push({ phone, success: false })
      }
    }
  }

  return results
}

/**
 * Check delivery status of one or more Arkesel message IDs.
 * Returns a map of messageId → ArkeselDeliveryStatus.
 */
export async function checkSmsDeliveryStatus(
  messageIds: string[]
): Promise<Map<string, ArkeselDeliveryStatus>> {
  const statusMap = new Map<string, ArkeselDeliveryStatus>()
  if (!isConfigured() || messageIds.length === 0) return statusMap

  for (const id of messageIds) {
    try {
      const res = await fetch(`${ARKESEL_BASE}/sms/status?id=${encodeURIComponent(id)}`, {
        headers: { 'api-key': process.env.ARKESEL_API_KEY! },
      })
      const data = await res.json()
      if (res.ok && data.status === 'success' && data.data?.status) {
        statusMap.set(id, data.data.status as ArkeselDeliveryStatus)
      } else {
        statusMap.set(id, 'pending')
      }
    } catch {
      statusMap.set(id, 'pending')
    }
  }
  return statusMap
}

/** Fetches the platform's Arkesel account balance (sms_balance + main_balance). */
export async function getArkeselBalance(): Promise<ArkeselBalance | null> {
  if (!isConfigured()) return null
  try {
    const res = await fetch(`${ARKESEL_BASE}/clients/balance-details`, {
      headers: { 'api-key': process.env.ARKESEL_API_KEY! },
    })
    const data = await res.json()
    if (res.ok && data.status === 'success') return data.data as ArkeselBalance
    return null
  } catch {
    return null
  }
}

export function buildFeeReminderMessage(p: {
  parentName?: string
  studentName: string
  className: string
  outstanding: number
  schoolName: string
  currency?: string
}): string {
  const c = p.currency ?? 'GHS'
  const parent = p.parentName ?? 'Parent/Guardian'
  return `${p.schoolName}: Dear ${parent}, ${p.studentName} (${p.className}) has an outstanding fee of ${c}${p.outstanding.toFixed(2)}. Please settle at the school. Thank you.`
}
