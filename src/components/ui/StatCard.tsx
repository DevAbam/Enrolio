import { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: ReactNode
  highlight?: 'green' | 'red' | 'yellow'
}

const highlightBorder: Record<string, string> = {
  green:  'border-green-400 dark:border-green-600',
  red:    'border-red-300 dark:border-red-700',
  yellow: 'border-yellow-300 dark:border-yellow-700',
}

export function StatCard({ label, value, sub, icon, highlight }: StatCardProps) {
  return (
    <div className={cn('stat-card', highlight && highlightBorder[highlight])}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="stat-label">{label}</span>
          <span className="stat-value">{value}</span>
          {sub && <span className="stat-sub">{sub}</span>}
        </div>
        {icon && (
          <div className="bg-green-100 dark:bg-green-900/40 rounded-lg p-2 shrink-0 ml-2">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
