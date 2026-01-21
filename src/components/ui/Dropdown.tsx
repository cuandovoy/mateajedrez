import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface DropdownOption {
  value: string
  label: string
  subcategories?: DropdownOption[]
}

interface DropdownProps {
  options: DropdownOption[]
  value?: string
  placeholder?: string
  onSelect: (value: string) => void
  className?: string
  darkBackground?: boolean
}

export function Dropdown({ 
  options, 
  value, 
  placeholder = 'Seleccionar', 
  onSelect, 
  className, 
  darkBackground = false 
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedOption = options.find(opt => opt.value === value)

  const handleSelect = (optionValue: string) => {
    onSelect(optionValue)
    setIsOpen(false)
  }

  const isAdminContext = typeof document !== 'undefined' && document.body.classList.contains('admin-theme')

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-2.5 text-base font-medium',
          'bg-transparent border border-transparent rounded-lg',
          'hover:border-b-2 focus:border-none',
          'transition-all duration-200',
          'min-w-[180px] sm:min-w-[220px]'
        )}
      >
        <span className={cn(
          'truncate',
          selectedOption 
            ? 'text-gray-800 font-semibold' 
            : darkBackground ? 'text-white' : 'text-gray-800'
        )}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          className={cn(
            'h-4 w-4 transition-transform duration-200 ml-2 flex-shrink-0',
            isOpen && 'transform rotate-180',
            darkBackground ? 'text-white' : 'text-gray-600'
          )} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 left-1/2 transform -translate-x-1/2 mt-2',
            'bg-white rounded-lg shadow-2xl border border-gray-200',
            'min-w-[240px] max-w-[320px]',
            'max-h-[80vh] overflow-y-auto'
          )}
        >
          <div className="py-2">
            {options.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No hay opciones disponibles
              </div>
            ) : (
              <div className="space-y-0.5">
                {options.map((option) => {
                  const hasSubcategories = option.subcategories && option.subcategories.length > 0
                  const isSelected = value === option.value

                  return (
                    <div key={option.value}>
                      {/* Main Category */}
                      <button
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        className={cn(
                          'w-full px-4 py-2.5 text-left transition-colors duration-150',
                          'text-sm sm:text-base',
                          isSelected
                            ? isAdminContext 
                              ? 'bg-admin-100 text-admin-700 font-medium' 
                              : 'bg-primary-100 text-primary-700 font-medium'
                            : isAdminContext
                              ? 'hover:bg-admin-50 hover:text-admin-700'
                              : 'hover:bg-primary-50 hover:text-primary-700',
                          'focus:outline-none'
                        )}
                      >
                        {option.label}
                      </button>

                      {/* Subcategories - Indented to the right */}
                      {hasSubcategories && option.subcategories && (
                        <div className="pl-4">
                          {option.subcategories.map((subcategory) => {
                            const isSubSelected = value === subcategory.value
                            return (
                              <button
                                key={subcategory.value}
                                type="button"
                                onClick={() => handleSelect(subcategory.value)}
                                className={cn(
                                  'w-full px-4 py-2 text-left text-sm transition-colors duration-150',
                                  isSubSelected
                                    ? isAdminContext 
                                      ? 'bg-admin-100 text-admin-700 font-medium' 
                                      : 'bg-primary-100 text-primary-700 font-medium'
                                    : isAdminContext
                                      ? 'hover:bg-admin-50 hover:text-admin-700'
                                      : 'hover:bg-primary-50 hover:text-primary-700',
                                  'focus:outline-none'
                                )}
                              >
                                {subcategory.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
