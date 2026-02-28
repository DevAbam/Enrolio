'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, UserCheck, BookOpen,
  CreditCard, ClipboardList, MessageSquare, GraduationCap, X, LogOut, Banknote
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface SidebarProps {
  schoolName?: string
  adminName?: string
  role?: UserRole | null
  mobileOpen?: boolean
  onMobileClose?: () => void
}

interface NavItem {
  href: string
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>
  roles: string[]
  exact: boolean
}

const allNavSections: { label: string; items: NavItem[] }[] = [
  {
    label: 'MAIN',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'accountant'], exact: false },
      { href: '/students', label: 'Students', icon: GraduationCap, roles: ['admin', 'accountant', 'teacher'], exact: false },
      { href: '/teachers', label: 'Teachers', icon: Users, roles: ['admin'], exact: true },
      { href: '/classes', label: 'Classes', icon: BookOpen, roles: ['admin', 'accountant'], exact: false },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { href: '/payments', label: 'Fee Payments', icon: CreditCard, roles: ['admin', 'accountant'], exact: false },
      { href: '/teachers/salaries', label: 'Teacher Salaries', icon: Banknote, roles: ['admin'], exact: false },
    ],
  },
  {
    label: 'ATTENDANCE',
    items: [
      { href: '/attendance/students', label: 'Students', icon: ClipboardList, roles: ['admin', 'accountant', 'teacher'], exact: false },
      { href: '/attendance/teachers', label: 'Teachers', icon: UserCheck, roles: ['admin', 'accountant'], exact: false },
    ],
  },
  {
    label: 'COMMUNICATION',
    items: [
      { href: '/sms', label: 'SMS Center', icon: MessageSquare, roles: ['admin', 'accountant'], exact: false },
    ],
  },
]

export function Sidebar({ schoolName, adminName, role, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navSections = allNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !role || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0)

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-5">
        <span className="font-bold text-accent text-base tracking-tight">
          SchoolOps Pro
        </span>
        {onMobileClose && (
          <button onClick={onMobileClose} className="btn-ghost p-1 md:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-xs uppercase tracking-widest text-fg-subtle px-3 mb-1 mt-4 first:mt-1">
              {section.label}
            </p>
            {section.items.map(({ href, label, icon: Icon, exact }) => {
              const active = pathname === href || (!exact && pathname.startsWith(href + '/'))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                    active
                      ? 'bg-accent text-white font-medium hover:bg-accent-dark'
                      : 'text-fg-muted hover:bg-surface-alt hover:text-fg'
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 space-y-3 border-t border-border">
        <div className="px-2">
          {schoolName && (
            <p className="font-medium text-fg text-sm truncate">{schoolName}</p>
          )}
          {adminName && (
            <p className="text-xs text-fg-subtle truncate">{adminName}</p>
          )}
          {role && role !== 'admin' && (
            <p className="text-xs text-accent-fg capitalize mt-0.5">{role}</p>
          )}
        </div>
        <button onClick={handleLogout} className="btn-ghost text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full justify-start">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex flex-col w-60 shrink-0 h-full bg-surface border-r border-border no-print">
        {sidebarContent}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden no-print">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="relative z-50 flex flex-col w-60 h-full bg-surface border-r border-border">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
