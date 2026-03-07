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
  activeTerm:      AcademicTerm | null
  selectedTerm:    AcademicTerm | null
  setSelectedTerm: (t: AcademicTerm) => void
  allTerms:        AcademicTerm[]
  loading:         boolean
  reload:          () => void
}

const TermContext = createContext<TermContextValue>({
  activeTerm:      null,
  selectedTerm:    null,
  setSelectedTerm: () => {},
  allTerms:        [],
  loading:         true,
  reload:          () => {},
})

const STORAGE_KEY = 'schoolops_selected_term_id'

export function TermProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [activeTerm,   setActiveTerm]   = useState<AcademicTerm | null>(null)
  const [selectedTerm, setSelectedTermState] = useState<AcademicTerm | null>(null)
  const [allTerms,     setAllTerms]     = useState<AcademicTerm[]>([])
  const [loading,      setLoading]      = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('academic_terms')
      .select('*')
      .order('year',        { ascending: false })
      .order('term_number', { ascending: true })
    if (data) {
      const terms = data as AcademicTerm[]
      setAllTerms(terms)
      const active = terms.find(t => t.is_active) ?? null
      setActiveTerm(active)

      // Restore selected term from localStorage, fall back to active
      const storedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      const stored   = storedId ? terms.find(t => t.id === storedId) ?? null : null
      setSelectedTermState(stored ?? active)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function setSelectedTerm(t: AcademicTerm) {
    setSelectedTermState(t)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, t.id)
    }
  }

  return (
    <TermContext.Provider value={{ activeTerm, selectedTerm, setSelectedTerm, allTerms, loading, reload: load }}>
      {children}
    </TermContext.Provider>
  )
}

export function useTerm() {
  return useContext(TermContext)
}
