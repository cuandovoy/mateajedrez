import { useCallback, useEffect, useRef, useState } from 'react'

// Flag booleano que se apaga solo después de `durationMs` — para estados de
// feedback breves como el "Agregado" de los botones de compra.
export function useTransientFlag(durationMs = 1500): [boolean, () => void] {
  const [active, setActive] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const trigger = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setActive(true)
    timer.current = setTimeout(() => setActive(false), durationMs)
  }, [durationMs])

  return [active, trigger]
}
