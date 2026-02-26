'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, UserCheck, BookOpen,
  CreditCard, ClipboardList, MessageSquare, GraduationCap, X, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface SidebarProps {
  schoolName?: string
  adminName?:  string
  role?:       UserRole | null
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const allNavSections = [
  {
    label: 'MAIN',
    items: [
      { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard, roles: ['admin', 'accountant'] },
      { href: '/students',  label: 'Students',   icon: GraduationCap,   roles: ['admin', 'accountant', 'teacher'] },
      { href: '/teachers',  label: 'Teachers',   icon: Users,           roles: ['admin'] },
      { href: '/classes',   label: 'Classes',    icon: BookOpen,        roles: ['admin', 'accountant'] },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { href: '/payments', label: 'Payments', icon: CreditCard, roles: ['admin', 'accountant'] },
    ],
  },
  {
    label: 'ATTENDANCE',
    items: [
      { href: '/attendance/students', label: 'Students', icon: ClipboardList, roles: ['admin', 'accountant', 'teacher'] },
      { href: '/attendance/teachers', label: 'Teachers', icon: UserCheck,     roles: ['admin', 'accountant'] },
    ],
  },
  {
    label: 'COMMUNICATION',
    items: [
      { href: '/sms', label: 'SMS Center', icon: MessageSquare, roles: ['admin', 'accountant'] },
    ],
  },
]

export function Sidebar({ schoolName, adminName, role, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
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
      <div className="flex items-center justify-between px-4 py-5 border-b border-green-200 dark:border-green-800">
        <span className="font-bold text-green-700 dark:text-green-400 text-base tracking-tight">
          🏫 SchoolOps Pro
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
            <p className="text-xs uppercase tracking-widest text-gray-400 px-3 mb-1 mt-4 first:mt-1">
              {section.label}
            </p>
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                    active
                      ? 'bg-green-600 text-white font-medium hover:bg-green-700'
                      : 'text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40'
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

      <div className="px-3 py-4 border-t border-green-200 dark:border-green-800 space-y-3">
        <div className="px-2">
          {schoolName && (
            <p className="font-medium text-green-800 dark:text-green-300 text-sm truncate">{schoolName}</p>
          )}
          {adminName && (
            <p className="text-xs text-gray-500 truncate">{adminName}</p>
          )}
          {role && role !== 'admin' && (
            <p className="text-xs text-green-600 dark:text-green-500 capitalize mt-0.5">{role}</p>
          )}
        </div>
        <button onClick={handleLogout} className="btn-ghost text-red-600 dark:text-red-400 w-full justify-start">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex flex-col w-60 shrink-0 h-full bg-green-50 dark:bg-[#111b11] border-r border-green-200 dark:border-green-800 no-print">
        {sidebarContent}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden no-print">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="relative z-50 flex flex-col w-60 h-full bg-green-50 dark:bg-[#111b11] border-r border-green-200 dark:border-green-800">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
