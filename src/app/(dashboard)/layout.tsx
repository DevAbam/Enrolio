'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { RoleProvider, useRole } from '@/contexts/RoleContext'

const pageTitles: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/students':            'Students',
  '/students/new':        'Add Student',
  '/teachers':            'Teachers',
  '/classes':             'Classes',
  '/payments':            'Payments',
  '/attendance/students': 'Student Attendance',
  '/attendance/teachers': 'Teacher Attendance',
  '/sms':                 'SMS Center',
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname.startsWith('/students/')) return 'Student Detail'
  return 'SchoolOps Pro'
}

function getInitials(name?: string | null): string {
  if (!name) return 'A'
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { fullName, schoolName, role } = useRole()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        schoolName={schoolName ?? undefined}
        adminName={fullName ?? undefined}
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar
          pageTitle={getPageTitle(pathname)}
          userInitials={getInitials(fullName)}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-white dark:bg-[#0a0f0a] p-6 no-print">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <DashboardShell>{children}</DashboardShell>
    </RoleProvider>
  )
}
