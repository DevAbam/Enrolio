export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type PaymentMethod    = 'cash' | 'bank_transfer' | 'momo' | 'card' | 'other'
export type SmsType          = 'fee_reminder' | 'general' | 'bulk'
export type SmsStatus        = 'success' | 'failed' | 'pending'
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
  discount_amount: number; is_active: boolean
  created_at: string; updated_at: string
}

export interface Teacher {
  id: string; school_id: string; full_name: string; phone?: string
  email?: string; employee_number?: string; is_active: boolean
  created_at: string; updated_at: string
}

export interface Class {
  id: string; school_id: string; name: string
  term_fee_amount: number; academic_year?: string
  created_at: string; updated_at: string
}

export interface Payment {
  id: string; school_id: string; student_id: string
  amount_paid: number; payment_date: string
  payment_method?: PaymentMethod; receipt_number?: string
  recorded_by?: string; notes?: string; created_at: string
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
  parent_phone: string; message: string; sms_type: SmsType
  status: SmsStatus; provider_response?: string; sent_at: string
}

// View types — these come from the DB views
export interface StudentFeeSummary {
  id: string; school_id: string; full_name: string; admission_number?: string
  parent_name?: string; parent_phone?: string; is_active: boolean
  class_id?: string; class_name?: string; term_fee_amount: number
  discount_amount: number; total_owed: number; total_paid: number; outstanding: number
}

export interface SchoolRevenueSummary {
  school_id: string; total_active_students: number
  expected_revenue: number; collected_revenue: number
  outstanding_revenue: number; defaulters_count: number
}

export interface AppUser {
  id: string; school_id: string; full_name?: string; role: UserRole; is_active: boolean
}
