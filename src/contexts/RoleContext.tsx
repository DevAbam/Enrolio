'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface RoleContextValue {
  role:            UserRole | null
  isAdmin:         boolean
  teacherClassId:  string | null   // set only when role === 'teacher'
  fullName:        string | null
  schoolId:        string | null
  schoolName:      string | null
  schoolLogoUrl:   string | null
  schoolAddress:   string | null
  schoolPhone:     string | null
  schoolEmail:     string | null
  loading:         boolean
  reload:          () => void
}

const RoleContext = createContext<RoleContextValue>({
  role: null, isAdmin: false, teacherClassId: null,
  fullName: null, schoolId: null, schoolName: null, schoolLogoUrl: null,
  schoolAddress: null, schoolPhone: null, schoolEmail: null,
  loading: true, reload: () => {},
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<RoleContextValue>({
    role: null, isAdmin: false, teacherClassId: null,
    fullName: null, schoolId: null, schoolName: null, schoolLogoUrl: null,
    schoolAddress: null, schoolPhone: null, schoolEmail: null,
    loading: true, reload: () => {},
  })

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setValue((v) => ({ ...v, loading: false })); return }

    // Fetch user profile + school info + (if teacher) their class_id
    const { data: profile } = await supabase
      .from('users')
      .select('role, full_name, school_id, schools(name, logo_url, address, phone, email)')
      .eq('id', user.id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s             = (profile as any)?.schools
    const schoolName    = s?.name      ?? null
    const schoolLogoUrl = s?.logo_url  ?? null
    const schoolAddress = s?.address   ?? null
    const schoolPhone   = s?.phone     ?? null
    const schoolEmail   = s?.email     ?? null
    const schoolId      = (profile as any)?.school_id ?? null
    const role          = (profile?.role as UserRole) ?? null
    const fullName      = profile?.full_name ?? null

    let teacherClassId: string | null = null
    if (role === 'teacher') {
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('class_id')
        .eq('user_id', user.id)
        .single()
      teacherClassId = teacherRow?.class_id ?? null
    }

    setValue((v) => ({ ...v, role, isAdmin: role === 'admin', teacherClassId, fullName, schoolId, schoolName, schoolLogoUrl, schoolAddress, schoolPhone, schoolEmail, loading: false }))
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return <RoleContext.Provider value={{ ...value, reload: load }}>{children}</RoleContext.Provider>
}

export function useRole() {
  return useContext(RoleContext)
}
