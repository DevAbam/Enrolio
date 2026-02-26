import { cn } from '@/lib/utils/cn'

type SkeletonVariant = 'line' | 'circle' | 'card'

interface SkeletonProps {
  variant?: SkeletonVariant
  className?: string
  count?: number
}

const base = 'animate-pulse bg-green-100 dark:bg-green-900/40'

function SkeletonItem({ variant = 'line', className }: { variant?: SkeletonVariant; className?: string }) {
  if (variant === 'circle')
    return <div className={cn(base, 'h-10 w-10 rounded-full', className)} />
  if (variant === 'card')
    return <div className={cn(base, 'h-24 w-full rounded-xl', className)} />
  return <div className={cn(base, 'h-4 w-full rounded', className)} />
}

export function Skeleton({ variant = 'line', className, count = 1 }: SkeletonProps) {
  if (count === 1) return <SkeletonItem variant={variant} className={className} />
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonItem key={i} variant={variant} className={className} />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className={cn(base, 'h-4 rounded', j === 0 ? 'w-8' : 'w-full')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
