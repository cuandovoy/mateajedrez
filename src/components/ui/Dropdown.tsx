import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'

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
  darkBackground?: boolean // For header context with dark background
}

export function Dropdown({ options, value, placeholder = 'Seleccionar', onSelect, className, darkBackground = false }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredOption, setHoveredOption] = useState<string | null>(null)
  const [clickedOption, setClickedOption] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setHoveredOption(null)
        setClickedOption(null)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isOpen])

  const selectedOption = options.find(opt => opt.value === value)

  const handleSelect = (optionValue: string) => {
    onSelect(optionValue)
    setIsOpen(false)
    setHoveredOption(null)
    setClickedOption(null)
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setHoveredOption(null)
      setClickedOption(null)
    }
  }

  const handleOptionClick = (optionValue: string, hasSubcategories: boolean) => {
    if (hasSubcategories) {
      // Toggle submenu on click (for mobile)
      setClickedOption(clickedOption === optionValue ? null : optionValue)
    } else {
      handleSelect(optionValue)
    }
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
      setHoveredOption(null)
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
        onClick={handleToggle}
        className={cn(
          'flex items-center justify-between w-full px-5 py-2.5 text-base font-medium',
          'bg-transparent border border-transparent rounded-lg',
          'hover:bg-white/20 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50',
          'transition-all duration-200',
          'min-w-[220px]'
        )}
      >
        <span className={cn(
          'truncate',
          selectedOption 
            ? 'text-gray-800 font-semibold text-xl' 
            : darkBackground ? 'text-white' : 'text-gray-800'
        )}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
      </button>

      <div
        className={cn(
          'absolute z-20 left-1/2 transform -translate-x-1/2 mt-2 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl overflow-hidden min-w-[220px]',
          'transition-all duration-300 ease-out',
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="max-h-60 overflow-y-auto relative">
          {options.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500 text-center">
              No hay opciones disponibles
            </div>
          ) : (
            <div className="flex relative">
              {/* Main categories */}
              <div className="flex-1">
                {options.map((option) => {
                  const hasSubcategories = option.subcategories && option.subcategories.length > 0 || false
                  const isHovered = hoveredOption === option.value
                  const isClicked = clickedOption === option.value
                  const showSubmenu = hasSubcategories && (isHovered || isClicked)
                  
                  return (
                    <div
                      key={option.value}
                      className="relative"
                      onMouseEnter={() => hasSubcategories && setHoveredOption(option.value)}
                      onMouseLeave={() => setHoveredOption(null)}
                    >
                      <button
                        type="button"
                        onClick={() => handleOptionClick(option.value, hasSubcategories)}
                        className={cn(
                          'w-full px-5 py-3 text-left text-base transition-all duration-150 flex items-center justify-between',
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
                        <span>{option.label}</span>
                        {hasSubcategories && (
                          <ChevronRight className={cn(
                            'h-4 w-4 ml-2 flex-shrink-0 transition-transform duration-200',
                            (isHovered || isClicked) && 'transform rotate-90'
                          )} />
                        )}
                      </button>
                      
                      {/* Subcategories submenu */}
                      {showSubmenu && (
                        <div
                          className={cn(
                            'absolute bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl min-w-[200px] z-[100]',
                            'transition-all duration-200 ease-out',
                            'opacity-100 translate-x-0',
                            // On desktop, show to the right
                            'lg:left-full lg:top-0 lg:ml-1',
                            // On mobile, show below with full width to avoid overlap
                            'max-lg:left-0 max-lg:top-full max-lg:ml-0 max-lg:mt-1 max-lg:w-full'
                          )}
                          onMouseEnter={() => setHoveredOption(option.value)}
                          onMouseLeave={() => setHoveredOption(null)}
                        >
                          {option.subcategories!.map((subcategory) => (
                            <button
                              key={subcategory.value}
                              type="button"
                              onClick={() => handleSelect(subcategory.value)}
                              className={cn(
                                'w-full px-5 py-3 text-left text-sm transition-all duration-150',
                                (() => {
                                  const isAdminContext = typeof document !== 'undefined' && document.body.classList.contains('admin-theme')
                                  return isAdminContext
                                    ? 'hover:bg-admin-50 hover:text-admin-700 focus:bg-admin-50 focus:outline-none'
                                    : 'hover:bg-primary-50 hover:text-primary-700 focus:bg-primary-50 focus:outline-none'
                                })(),
                                (() => {
                                  const isAdminContext = typeof document !== 'undefined' && document.body.classList.contains('admin-theme')
                                  return value === subcategory.value 
                                    ? (isAdminContext ? 'bg-admin-100 text-admin-700 font-medium' : 'bg-primary-100 text-primary-700 font-medium')
                                    : ''
                                })()
                              )}
                            >
                              {subcategory.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
