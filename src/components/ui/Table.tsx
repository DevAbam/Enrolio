import { ReactNode, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode
}

export function Table({ children, className, ...props }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('table-base', className)} {...props}>
        {children}
      </table>
    </div>
  )
}
