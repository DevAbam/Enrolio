export interface SmsResult {
  success: boolean
  providerResponse: string
}

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  // STUB MODE: SMS sending is disabled. Set SMS_API_BASE_URL and SMS_API_KEY to enable.
  if (!process.env.SMS_API_BASE_URL || process.env.SMS_API_BASE_URL.includes('your-sms-provider')) {
    console.log(`[SMS STUB] To: ${phone} | Message: ${message}`)
    return { success: true, providerResponse: 'STUB_MODE' }
  }

  try {
    const res = await fetch(`${process.env.SMS_API_BASE_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SMS_API_KEY}`,
      },
      body: JSON.stringify({
        to: phone,
        from: process.env.SMS_SENDER_ID,
        message,
      }),
    })
    const data = await res.json()
    return { success: res.ok, providerResponse: JSON.stringify(data) }
  } catch (err) {
    return { success: false, providerResponse: String(err) }
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
  return `Dear ${parent}, your ward ${p.studentName} (${p.className}) has an outstanding fee balance of ${c} ${p.outstanding.toFixed(2)}. Please make payment at ${p.schoolName}. Thank you.`
}
