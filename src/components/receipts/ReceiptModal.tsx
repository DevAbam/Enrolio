'use client'
import { Printer, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import type { Payment } from '@/types'

interface ReceiptModalProps {
  payment:     Payment
  studentName: string
  className?:  string
  schoolName:  string
  onClose:     () => void
}

export function ReceiptModal({ payment, studentName, className, schoolName, onClose }: ReceiptModalProps) {
  function handlePrint() {
    window.print()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
      <div className="card max-w-sm w-full p-0 overflow-hidden">
        {/* Modal controls — hidden when printing */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-green-100 dark:border-green-800 no-print">
          <span className="text-sm font-medium text-green-800 dark:text-green-300">Payment Receipt</span>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg"><X size={16} /></button>
        </div>

        {/* ─── RECEIPT AREA — this is what prints ─────────────────── */}
        <div id="receipt-print-area" className="p-6 bg-white dark:bg-[#1a2e1a] print:bg-white print:text-black">
          {/* School Header */}
          <div className="text-center mb-5">
            <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center text-lg font-bold mx-auto mb-2">
              S
            </div>
            <h1 className="text-base font-bold text-green-900 dark:text-green-50 print:text-black">{schoolName}</h1>
            <p className="text-xs text-gray-500 print:text-gray-600 uppercase tracking-widest mt-1">Official Receipt</p>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-dashed border-green-200 dark:border-green-700 print:border-gray-300 my-4" />

          {/* Receipt meta */}
          <div className="flex justify-between text-xs mb-4">
            <span className="text-gray-500 print:text-gray-600">Receipt No.</span>
            <span className="font-mono font-semibold text-green-900 dark:text-green-50 print:text-black">{payment.receipt_number ?? '—'}</span>
          </div>
          <div className="flex justify-between text-xs mb-4">
            <span className="text-gray-500 print:text-gray-600">Date</span>
            <span className="font-semibold text-green-900 dark:text-green-50 print:text-black">{formatDate(payment.payment_date)}</span>
          </div>

          <div className="border-t border-green-100 dark:border-green-800 print:border-gray-200 my-3" />

          {/* Student info */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 print:text-gray-600">Student</span>
              <span className="font-semibold text-green-900 dark:text-green-50 print:text-black text-right max-w-[180px] truncate">{studentName}</span>
            </div>
            {className && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 print:text-gray-600">Class</span>
                <span className="font-semibold text-green-900 dark:text-green-50 print:text-black">{className}</span>
              </div>
            )}
          </div>

          <div className="border-t border-green-100 dark:border-green-800 print:border-gray-200 my-3" />

          {/* Amount */}
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-500 print:text-gray-600">Amount Paid</span>
            <span className="text-xl font-bold text-green-600 print:text-green-700">{formatCurrency(Number(payment.amount_paid))}</span>
          </div>
          {payment.payment_method && (
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-500 print:text-gray-600">Method</span>
              <span className="capitalize text-green-900 dark:text-green-50 print:text-black">{payment.payment_method.replace('_', ' ')}</span>
            </div>
          )}
          {payment.notes && (
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-500 print:text-gray-600">Notes</span>
              <span className="text-green-900 dark:text-green-50 print:text-black text-right max-w-[180px]">{payment.notes}</span>
            </div>
          )}

          <div className="border-t-2 border-dashed border-green-200 dark:border-green-700 print:border-gray-300 mt-4 mb-4" />

          <p className="text-center text-xs text-gray-400 print:text-gray-500">
            Thank you for your payment
          </p>
        </div>
        {/* ─── END RECEIPT AREA ──────────────────────────────────────── */}

        {/* Action buttons — hidden on print */}
        <div className="px-5 pb-4 flex gap-3 no-print">
          <button onClick={handlePrint} className="btn-primary flex-1 justify-center gap-2">
            <Printer size={16} />
            Print / Save as PDF
          </button>
          <button onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  )
}
