'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type AcademicTerm = {
  id: string
  school_id: string
  year: number
  term_number: number
  label: string
  is_active: boolean
  created_at: string
}

type TermContextValue = {
  activeTerm: AcademicTerm | null
  allTerms: AcademicTerm[]
  loading: boolean
  reload: () => void
}

const TermContext = createContext<TermContextValue>({
  activeTerm: null,
  allTerms: [],
  loading: true,
  reload: () => {},
})

export function TermProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(null)
  const [allTerms, setAllTerms]     = useState<AcademicTerm[]>([])
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('academic_terms')
      .select('*')
      .order('year', { ascending: false })
      .order('term_number', { ascending: false })
    if (data) {
      setAllTerms(data as AcademicTerm[])
      setActiveTerm((data as AcademicTerm[]).find(t => t.is_active) ?? null)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  return (
    <TermContext.Provider value={{ activeTerm, allTerms, loading, reload: load }}>
      {children}
    </TermContext.Provider>
  )
}

export function useTerm() {
  return useContext(TermContext)
}
