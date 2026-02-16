import { LucideIcon } from 'lucide-react'
import { Button } from './Button'

type Props = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: Props) {
  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      {Icon && (
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Icon className="h-8 w-8 text-gray-400" />
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-gray-600 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          <Button onClick={action.onClick} className="gap-2">
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}
