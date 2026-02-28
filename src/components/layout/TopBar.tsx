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
        <ThemeToggle />
        <div className="h-8 w-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-semibold select-none">
          {userInitials}
        </div>
      </div>
    </header>
  )
}
