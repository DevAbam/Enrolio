'use client'
import { Menu } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface TopBarProps {
  pageTitle?: string
  userInitials?: string
  onMenuClick?: () => void
}

export function TopBar({ pageTitle, userInitials = 'A', onMenuClick }: TopBarProps) {
  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-white dark:bg-[#0a0f0a] border-b border-green-200 dark:border-green-800/50 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="btn-ghost p-2 md:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold text-green-900 dark:text-green-50">
          {pageTitle}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="h-8 w-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-semibold select-none">
          {userInitials}
        </div>
      </div>
    </header>
  )
}
