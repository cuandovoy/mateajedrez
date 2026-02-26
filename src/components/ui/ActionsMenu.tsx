import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActionItem {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: 'default' | 'danger'
  disabled?: boolean
}

interface ActionsMenuProps {
  actions: ActionItem[]
  className?: string
}

export function ActionsMenu({ actions, className }: ActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setMenuPosition(null)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect()
      const menuWidth = 192 // w-48 = 12rem = 192px
      const spacing = 4 // mt-1 = 4px

      // Calcular posición desde la esquina superior derecha del botón
      let left = buttonRect.right - menuWidth
      let top = buttonRect.bottom + spacing

      // Ajustar si se sale por la izquierda
      if (left < 0) {
        left = buttonRect.left
      }

      // Verificar si hay espacio abajo, si no, mostrar arriba
      const spaceBelow = window.innerHeight - buttonRect.bottom
      const estimatedMenuHeight = actions.length * 40 + 8 // altura estimada por item + padding
      
      if (spaceBelow < estimatedMenuHeight && buttonRect.top > estimatedMenuHeight) {
        // Mostrar arriba del botón
        top = buttonRect.top - estimatedMenuHeight - spacing
      }

      // Asegurar que no se salga por arriba
      if (top < 0) {
        top = spacing
      }

      // Con position: fixed, las coordenadas son relativas al viewport (no necesitamos scrollY/scrollX)
      setMenuPosition({
        top: top,
        left: left,
      })
    }
  }, [isOpen, actions.length])

  const handleActionClick = (action: ActionItem) => {
    if (action.disabled) return
    action.onClick()
    setIsOpen(false)
    setMenuPosition(null)
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-500"
        aria-label="Acciones"
      >
        <MoreVertical className="h-5 w-5 text-gray-600" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false)
              setMenuPosition(null)
            }}
          />
          {/* Menu - Using fixed positioning to avoid overflow issues */}
          <div
            ref={menuContentRef}
            className="fixed w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
            style={
              menuPosition
                ? {
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                  }
                : { display: 'none' }
            }
          >
            <div className="py-1">
              {actions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  disabled={action.disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleActionClick(action)
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm flex items-center space-x-2 transition-colors',
                    action.disabled
                      ? 'cursor-not-allowed text-gray-400'
                      : action.variant === 'danger'
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  {action.icon && <span className="flex-shrink-0">{action.icon}</span>}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
