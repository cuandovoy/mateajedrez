import { useEffect } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Semántica de foco para diálogos hechos a mano: al abrir enfoca el elemento con
// `data-autofocus` (o el primero enfocable), mantiene Tab dentro del contenedor y al
// cerrar devuelve el foco a quien lo tenía antes (el disparador). No maneja Escape:
// cada diálogo ya tiene su propio handler.
export function useDialogFocus(open: boolean, containerRef: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const getFocusable = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

    const initial = container.querySelector<HTMLElement>('[data-autofocus]') ?? getFocusable()[0] ?? container
    initial.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !container.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus()
    }
  }, [open, containerRef])
}
