import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  options: DropdownOption[]
  value?: string
  placeholder?: string
  onSelect: (value: string) => void
  className?: string
}

export function Dropdown({ options, value, placeholder = 'Seleccionar', onSelect, className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const selectedOption = options.find(opt => opt.value === value)

  const handleSelect = (optionValue: string) => {
    onSelect(optionValue)
    setIsOpen(false)
  }

  const handleMouseEnter = () => {
    // Cancelar cualquier timeout pendiente
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    // Agregar un delay antes de cerrar para permitir movimiento entre botón y menú
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 200)
  }

  return (
    <div
      ref={dropdownRef}
      className={cn('relative', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className={cn(
          'flex items-center justify-between w-full px-5 py-2.5 text-base font-medium',
          'bg-transparent border border-transparent rounded-lg',
          'hover:bg-white/20 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50',
          'transition-all duration-200',
          'min-w-[220px]',
          'text-gray-800'
        )}
      >
        <span className={cn(
          'truncate',
          selectedOption ? 'text-gray-800 font-semibold text-xl' : 'text-white'
        )}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
      </button>

      {isOpen && (
        <div 
          className="absolute z-20 left-1/2 transform -translate-x-1/2 mt-2 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl overflow-hidden min-w-[220px]"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500 text-center">
                No hay opciones disponibles
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'w-full px-5 py-3 text-left text-base transition-all duration-150',
                    (() => {
                      const isAdminContext = typeof document !== 'undefined' && document.body.classList.contains('admin-theme')
                      return isAdminContext
                        ? 'hover:bg-admin-50 hover:text-admin-700 focus:bg-admin-50 focus:outline-none'
                        : 'hover:bg-primary-50 hover:text-primary-700 focus:bg-primary-50 focus:outline-none'
                    })(),
                    (() => {
                      const isAdminContext = typeof document !== 'undefined' && document.body.classList.contains('admin-theme')
                      return value === option.value 
                        ? (isAdminContext ? 'bg-admin-100 text-admin-700 font-medium' : 'bg-primary-100 text-primary-700 font-medium')
                        : ''
                    })()
                  )}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
