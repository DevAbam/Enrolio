import { forwardRef, InputHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          ref={ref}
          type="search"
          className={cn('input pl-9', className)}
          {...props}
        />
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'
