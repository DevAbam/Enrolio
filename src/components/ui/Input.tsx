import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            'input',
            error && 'border-red-500 dark:border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />
        {error && <p className="field-error">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
