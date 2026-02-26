import { cn } from '@/lib/utils/cn'

type BadgeVariant = 'green' | 'red' | 'yellow' | 'gray'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClass: Record<BadgeVariant, string> = {
  green:  'badge-green',
  red:    'badge-red',
  yellow: 'badge-yellow',
  gray:   'badge-gray',
}

// Auto-detect variant from common status strings
const statusMap: Record<string, BadgeVariant> = {
  active:    'green',
  present:   'green',
  success:   'green',
  paid:      'green',
  inactive:  'red',
  absent:    'red',
  failed:    'red',
  late:      'yellow',
  pending:   'yellow',
  excused:   'gray',
  other:     'gray',
}

export function Badge({ children, variant, className }: BadgeProps) {
  const resolved = variant ?? (
    statusMap[String(children).toLowerCase()] ?? 'gray'
  )
  return (
    <span className={cn(variantClass[resolved], className)}>
      {children}
    </span>
  )
}
