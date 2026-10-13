import { useLocation } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { buildWhatsappUrl } from '@/lib/storeLocation'

// Hidden on checkout so it doesn't pull attention away from finishing the purchase.
const HIDDEN_PATHS = ['/checkout']

export function WhatsappFloatingButton() {
  const { pathname } = useLocation()
  const whatsappUrl = buildWhatsappUrl(import.meta.env.VITE_WHATSAPP_SALES_NUMBER)

  if (!whatsappUrl || HIDDEN_PATHS.includes(pathname)) return null

  const message = encodeURIComponent('¡Hola! Quería hacer una consulta.')

  return (
    <a
      href={`${whatsappUrl}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand-crema bg-brand-cuero text-brand-crema transition-colors hover:bg-brand-cuero-oscuro focus-ring"
    >
      <MessageCircle className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
    </a>
  )
}
