import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="text-fg-subtle mb-4">
          <span style={{ fontSize: 48 }}>{icon}</span>
        </div>
      )}
      <h3 className="section-title mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-fg-subtle mb-4 max-w-xs">{description}</p>
      )}
      {action}
    </div>
  )
}
