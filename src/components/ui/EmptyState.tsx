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
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-brand-line bg-brand-crema">
          <Icon className="h-7 w-7 text-brand-cuero" strokeWidth={1.25} />
        </div>
      )}
      <h3 className="font-heading text-base font-semibold uppercase tracking-[0.14em] text-brand-tinta">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-brand-muted max-w-sm mx-auto">{description}</p>
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
