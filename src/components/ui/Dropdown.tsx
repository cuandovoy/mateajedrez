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
  const [hoveredOption, setHoveredOption] = useState<string | null>(null)
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setHoveredOption(null)
        setExpandedOptions(new Set())
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
    setExpandedOptions(new Set())
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setHoveredOption(null)
      setExpandedOptions(new Set())
    }
  }

  const handleOptionClick = (optionValue: string, hasSubcategories: boolean, event: React.MouseEvent) => {
    // On mobile, toggle expansion on click
    if (hasSubcategories && window.innerWidth < 1024) {
      event.stopPropagation()
      const newExpanded = new Set(expandedOptions)
      if (newExpanded.has(optionValue)) {
        newExpanded.delete(optionValue)
      } else {
        newExpanded.add(optionValue)
      }
      setExpandedOptions(newExpanded)
    } else {
      // On desktop or if no subcategories, select directly
      handleSelect(optionValue)
    }
  }

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
      setHoveredOption(null)
    }, 200)
  }

  const handleOptionMouseEnter = (optionValue: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setHoveredOption(optionValue)
  }

  const handleOptionMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHoveredOption(null)
    }, 150)
  }

  const isAdminContext = typeof document !== 'undefined' && document.body.classList.contains('admin-theme')

  return (
    <div
      ref={dropdownRef}
      className={cn('relative', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
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
        <ChevronDown 
          className={cn(
            'h-4 w-4 transition-transform duration-200 ml-2',
            isOpen && 'transform rotate-180',
            darkBackground ? 'text-white' : 'text-gray-600'
          )} 
        />
      </button>

      {/* Dropdown Menu */}
      <div
        className={cn(
          'absolute z-50 left-1/2 transform -translate-x-1/2 mt-2',
          'bg-white rounded-lg shadow-2xl border border-gray-200',
          'transition-all duration-200 ease-out',
          'min-w-[240px] max-w-[320px]',
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="max-h-[70vh] overflow-y-auto py-2">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              No hay opciones disponibles
            </div>
          ) : (
            <div className="space-y-1">
              {options.map((option) => {
                const hasSubcategories = option.subcategories && option.subcategories.length > 0
                const isHovered = hoveredOption === option.value
                const isExpanded = expandedOptions.has(option.value)
                const showSubmenu = hasSubcategories && (isHovered || isExpanded)
                const isSelected = value === option.value

                return (
                  <div
                    key={option.value}
                    className="relative"
                    onMouseEnter={() => handleOptionMouseEnter(option.value)}
                    onMouseLeave={handleOptionMouseLeave}
                  >
                    {/* Main Category Button */}
                    <button
                      type="button"
                      onClick={(e) => handleOptionClick(option.value, hasSubcategories || false, e)}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-all duration-150',
                        'flex items-center justify-between group',
                        isSelected
                          ? isAdminContext 
                            ? 'bg-admin-100 text-admin-700 font-medium' 
                            : 'bg-primary-100 text-primary-700 font-medium'
                          : isAdminContext
                            ? 'hover:bg-admin-50 hover:text-admin-700'
                            : 'hover:bg-primary-50 hover:text-primary-700',
                        'focus:outline-none focus:ring-2 focus:ring-inset',
                        isAdminContext ? 'focus:ring-admin-500' : 'focus:ring-primary-500'
                      )}
                    >
                      <span className="flex-1 text-base">{option.label}</span>
                      {hasSubcategories && (
                        <ChevronDown 
                          className={cn(
                            'h-4 w-4 transition-transform duration-200 ml-2 flex-shrink-0',
                            showSubmenu && 'transform rotate-180',
                            isSelected 
                              ? isAdminContext ? 'text-admin-600' : 'text-primary-600'
                              : 'text-gray-400 group-hover:text-gray-600'
                          )} 
                        />
                      )}
                    </button>

                    {/* Subcategories - Desktop: Show below on hover, Mobile: Show below on click */}
                    {showSubmenu && option.subcategories && (
                      <div
                        className={cn(
                          'bg-gray-50 border-t border-gray-200',
                          'transition-all duration-200 ease-out',
                          'lg:absolute lg:left-0 lg:right-0 lg:top-full lg:mt-1 lg:bg-white lg:rounded-lg lg:shadow-lg lg:border lg:border-gray-200 lg:z-10',
                          'max-lg:relative max-lg:mt-0'
                        )}
                        onMouseEnter={() => handleOptionMouseEnter(option.value)}
                        onMouseLeave={handleOptionMouseLeave}
                      >
                        <div className="py-1">
                          {option.subcategories.map((subcategory) => {
                            const isSubSelected = value === subcategory.value
                            return (
                              <button
                                key={subcategory.value}
                                type="button"
                                onClick={() => handleSelect(subcategory.value)}
                                className={cn(
                                  'w-full px-6 py-2.5 text-left text-sm transition-all duration-150',
                                  'flex items-center',
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
                                <span className="flex items-center">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-3"></span>
                                  {subcategory.label}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
