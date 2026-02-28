import { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: ReactNode
  highlight?: 'green' | 'red' | 'yellow'
}

export function StatCard({ label, value, sub, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="stat-label">{label}</span>
          <span className="stat-value">{value}</span>
          {sub && <span className="stat-sub">{sub}</span>}
        </div>
        {icon && (
          <div className="bg-surface-alt rounded-lg p-2 shrink-0 ml-2">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
