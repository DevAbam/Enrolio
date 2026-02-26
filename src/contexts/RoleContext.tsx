'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface RoleContextValue {
  role:        UserRole | null
  isAdmin:     boolean
  teacherClassId: string | null   // set only when role === 'teacher'
  fullName:    string | null
  schoolName:  string | null
  loading:     boolean
}

const RoleContext = createContext<RoleContextValue>({
  role: null, isAdmin: false, teacherClassId: null,
  fullName: null, schoolName: null, loading: true,
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<RoleContextValue>({
    role: null, isAdmin: false, teacherClassId: null,
    fullName: null, schoolName: null, loading: true,
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setValue((v) => ({ ...v, loading: false })); return }

      // Fetch user profile + school name + (if teacher) their class_id
      const { data: profile } = await supabase
        .from('users')
        .select('role, full_name, schools(name)')
        .eq('id', user.id)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schoolName = (profile as any)?.schools?.name ?? null
      const role       = (profile?.role as UserRole) ?? null
      const fullName   = profile?.full_name ?? null

      let teacherClassId: string | null = null
      if (role === 'teacher') {
        const { data: teacherRow } = await supabase
          .from('teachers')
          .select('class_id')
          .eq('user_id', user.id)
          .single()
        teacherClassId = teacherRow?.class_id ?? null
      }

      setValue({ role, isAdmin: role === 'admin', teacherClassId, fullName, schoolName, loading: false })
    }
    load()
  }, [])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  return useContext(RoleContext)
}
