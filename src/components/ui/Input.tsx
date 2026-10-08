import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label visible para el input. Recomendado para accesibilidad. */
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-brand-tinta mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-label={label || props['aria-label'] || (typeof props.placeholder === 'string' ? props.placeholder : undefined)}
          className={cn(
            'w-full min-h-[44px] px-4 py-2 bg-white text-brand-tinta placeholder:text-brand-muted border border-brand-line rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cuero focus-visible:border-brand-cuero transition-colors',
            error && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
