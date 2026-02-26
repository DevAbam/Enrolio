import { forwardRef, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 3, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          rows={rows}
          className={cn(
            'input resize-none',
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

Textarea.displayName = 'Textarea'
