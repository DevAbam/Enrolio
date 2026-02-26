import { cn } from '@/lib/utils/cn'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export function Card({ children, className, padding = false, ...props }: CardProps) {
  return (
    <div className={cn('card', padding && 'p-5', className)} {...props}>
      {children}
    </div>
  )
}
