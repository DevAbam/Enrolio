'use client'
import { Menu } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useTerm } from '@/lib/term-context'

interface TopBarProps {
  pageTitle?: string
  userInitials?: string
  onMenuClick?: () => void
}

export function TopBar({ pageTitle, userInitials = 'A', onMenuClick }: TopBarProps) {
  const { selectedTerm, allTerms, setSelectedTerm } = useTerm()

  // Unique years sorted newest first
  const years = Array.from(new Set(allTerms.map(t => t.year))).sort((a, b) => b - a)
  const selectedYear = selectedTerm?.year ?? years[0] ?? null
  const termsInYear = allTerms.filter(t => t.year === selectedYear)

  function handleYearChange(year: number) {
    // When switching year, prefer the active term if it's in that year, else first term
    const inYear = allTerms.filter(t => t.year === year)
    const preferred = inYear.find(t => t.is_active) ?? inYear[0]
    if (preferred) setSelectedTerm(preferred)
  }

  const selectClass = "text-xs border border-border rounded-md bg-surface text-fg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-surface border-b border-border">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="btn-ghost p-2 md:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold text-fg">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {allTerms.length > 0 && (
          <div className="flex items-center gap-1.5">
            {selectedTerm?.is_active && (
              <span className="h-2 w-2 rounded-full bg-accent shrink-0" title="Active term" />
            )}
            {/* Year selector */}
            <select
              value={selectedYear ?? ''}
              onChange={e => handleYearChange(Number(e.target.value))}
              className={selectClass}
              aria-label="Select year"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {/* Term selector (filtered to selected year) */}
            {termsInYear.length > 0 && (
              <select
                value={selectedTerm?.id ?? ''}
                onChange={e => {
                  const t = allTerms.find(t => t.id === e.target.value)
                  if (t) setSelectedTerm(t)
                }}
                className={selectClass}
                aria-label="Select term"
              >
                {termsInYear.map(t => (
                  <option key={t.id} value={t.id}>
                    Term {t.term_number}{t.is_active ? ' ●' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <ThemeToggle />
        <div className="h-8 w-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-semibold select-none">
          {userInitials}
        </div>
      </div>
    </header>
  )
}
