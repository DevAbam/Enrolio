import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  const from = Math.min((page - 1) * pageSize + 1, total)
  const to   = Math.min(page * pageSize, total)

  if (total === 0) return null

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <p className="text-sm text-fg-subtle">
        Showing <span className="font-medium text-fg">{from}–{to}</span>{' '}
        of <span className="font-medium text-fg">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
