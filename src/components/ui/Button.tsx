import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
    
    // Check if we're in admin context (body has admin-theme class)
    const isAdminContext = typeof document !== 'undefined' && document.body.classList.contains('admin-theme')
    
    const variants = {
      primary: isAdminContext 
        ? 'bg-admin-500 text-white hover:bg-admin-600 focus-visible:ring-admin-500'
        : 'text-white focus-visible:ring-[var(--org-primary-color,#6366f1)]',
      secondary: isAdminContext
        ? 'bg-gray-600 text-white hover:bg-gray-700 focus-visible:ring-gray-500'
        : 'text-white focus-visible:ring-[var(--org-secondary-color,#8b5cf6)]',
      outline: isAdminContext
        ? 'border-2 border-admin-500 text-admin-600 hover:bg-admin-50 focus-visible:ring-admin-500'
        : 'border-2 focus-visible:ring-[var(--org-primary-color,#6366f1)]',
      ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
    }
    
    // Estilos inline para colores dinámicos cuando no es admin
    const dynamicStyles = !isAdminContext && variant === 'primary' ? {
      backgroundColor: 'var(--org-primary-color, #6366f1)',
      '--hover-bg': 'var(--org-primary-color, #6366f1)',
    } : !isAdminContext && variant === 'secondary' ? {
      backgroundColor: 'var(--org-secondary-color, #8b5cf6)',
    } : !isAdminContext && variant === 'outline' ? {
      borderColor: 'var(--org-primary-color, #6366f1)',
      color: 'var(--org-primary-color, #6366f1)',
    } : {}

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        style={dynamicStyles}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Cargando...
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
