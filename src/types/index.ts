export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type PaymentMethod    = 'cash' | 'bank_transfer' | 'momo' | 'card' | 'other'
export type SmsType          = 'fee_reminder' | 'general' | 'bulk' | 'broadcast'
export type SmsStatus        = 'sent' | 'delivered' | 'failed' | 'partial' | 'pending' | 'success'
export type UserRole         = 'admin' | 'accountant' | 'teacher' | 'receptionist'

export interface School {
  id: string; name: string; logo_url?: string; address?: string
  phone?: string; email?: string; subscription_plan: string
  is_active: boolean; created_at: string; updated_at: string
}

export interface Student {
  id: string; school_id: string; class_id?: string; full_name: string
  admission_number?: string; date_of_birth?: string; gender?: string
  parent_name?: string; parent_phone?: string; parent_email?: string
  discount_amount: number; is_active: boolean; is_graduated: boolean
  graduated_at?: string; photo_url?: string
  created_at: string; updated_at: string
}

export interface Teacher {
  id: string; school_id: string; full_name: string; phone?: string
  email?: string; employee_number?: string; gender?: string; is_active: boolean
  user_id?: string | null; class_id?: string | null
  date_of_birth?: string; photo_url?: string; staff_type?: string; staff_role?: string | null
  created_at: string; updated_at: string
}

export type SalaryPaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque'

export interface TeacherSalaryPayment {
  id:             string
  school_id:      string
  teacher_id:     string
  amount_paid:    number
  payment_date:   string
  period_label:   string | null
  payment_method: SalaryPaymentMethod
  notes:          string | null
  paid_by:        string | null
  created_at:     string
  updated_at:     string
}

export interface Class {
  id: string; school_id: string; name: string
  level?: number | null
  created_at: string; updated_at: string
}

export interface StudentEnrollment {
  id: string; school_id: string; student_id: string
  class_id: string; term_id: string; enrolled_at: string
}

export interface Payment {
  id: string; school_id: string; student_id: string
  amount_paid: number; payment_date: string
  payment_method?: PaymentMethod; receipt_number?: string
  recorded_by?: string; notes?: string; term_id?: string
  balance_after?: number | null; created_at: string
}

export interface StudentAttendance {
  id: string; school_id: string; student_id: string
  attendance_date: string; status: AttendanceStatus
  marked_by?: string; notes?: string
}

export interface TeacherAttendance {
  id: string; school_id: string; teacher_id: string
  attendance_date: string; status: AttendanceStatus; marked_by?: string
}

export interface SmsLog {
  id: string; school_id: string; student_id?: string; sent_by?: string
  parent_phone: string; message: string; sms_type: SmsType; recipient_count: number
  status: SmsStatus; provider_response?: string; sent_at: string; arkesel_msg_ids?: string | null
}

export interface SmsCreditTransaction {
  id: string; school_id: string; amount: number
  type: 'recharge' | 'deduction'; description?: string
  created_by?: string; created_at: string
}

export type PurchaseStatus = 'pending' | 'success' | 'failed'

export interface SmsCreditPurchase {
  id: string; school_id: string; paystack_reference: string
  credits_purchased: number; amount_pesewas: number
  status: PurchaseStatus; initiated_by?: string | null
  verified_at?: string | null; created_at: string; updated_at: string
}

// View types — these come from the DB views
export interface StudentFeeSummary {
  id: string; school_id: string; full_name: string; admission_number?: string
  gender?: string; parent_name?: string; parent_phone?: string; is_active: boolean
  is_graduated: boolean; graduated_at?: string
  class_id?: string; class_name?: string; class_level?: number | null
  active_term_id?: string; active_term_label?: string; term_fee_amount: number
  discount_amount: number; carried_over_balance: number
  total_owed: number; total_paid: number; outstanding: number
  date_of_birth?: string; photo_url?: string; admitted_at?: string
}

export interface SchoolRevenueSummary {
  school_id: string; total_active_students: number
  expected_revenue: number; collected_revenue: number
  outstanding_revenue: number; defaulters_count: number
}

export interface AppUser {
  id: string; school_id: string; full_name?: string; role: UserRole; is_active: boolean
}
