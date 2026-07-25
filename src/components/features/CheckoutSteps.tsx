import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CheckoutStep = 'cart' | 'checkout' | 'confirmation'

interface CheckoutStepsProps {
  currentStep: CheckoutStep
}

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: 'cart', label: 'Carrito' },
  { key: 'checkout', label: 'Datos y pago' },
  { key: 'confirmation', label: 'Confirmación' },
]

// Indicador puro de "dónde estoy" en el flujo de compra — no es navegable
// (los pasos ya completados no llevan a ningún lado al tocarlos).
export function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  const currentIndex = STEPS.findIndex((step) => step.key === currentStep)

  return (
    <nav aria-label="Progreso de la compra" className="flex items-center justify-center mb-8">
      {STEPS.map((step, index) => {
        const isActive = index === currentIndex
        const isCompleted = index < currentIndex

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  !isActive && !isCompleted && 'bg-gray-100 text-gray-400'
                )}
                style={
                  isActive
                    ? { backgroundColor: 'var(--org-primary-color, #46362B)', color: 'var(--org-primary-ink, white)' }
                    : isCompleted
                      ? {
                          backgroundColor: 'color-mix(in srgb, var(--org-primary-color, #46362B) 25%, white)',
                          color: 'var(--org-primary-color, #46362B)',
                        }
                      : undefined
                }
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={cn('text-xs font-medium whitespace-nowrap', isActive ? 'text-gray-900' : 'text-gray-400')}>
                {step.label}
              </span>
            </div>

            {index < STEPS.length - 1 && (
              <div
                className="h-0.5 w-10 sm:w-20 mx-2 sm:mx-3 mb-5 rounded-full transition-colors"
                style={{ backgroundColor: index < currentIndex ? 'var(--org-primary-color, #46362B)' : '#e5e7eb' }}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
