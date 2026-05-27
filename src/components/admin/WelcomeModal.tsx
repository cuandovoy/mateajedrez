import { useEffect, useState } from 'react'
import { useOrganization } from '@/hooks/useOrganization'
import { BookOpen, CreditCard, Package, ShoppingCart, Store, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const HIGHLIGHTS = [
  { icon: Store, text: 'Inventario multi-sucursal en tiempo real' },
  { icon: CreditCard, text: 'Punto de venta con auditoría de caja por operador' },
  { icon: ShoppingCart, text: 'Tienda online integrada al mismo inventario' },
  { icon: Package, text: 'Compras, proveedores y gestión de stock' },
  { icon: BookOpen, text: 'Reportes financieros e insights con IA' },
]

export function WelcomeModal() {
  const { organizationId } = useOrganization()
  const [isOpen, setIsOpen] = useState(false)
  const [visible, setVisible] = useState(false)

  const storageKey = organizationId ? `axiostock_welcome_v2_${organizationId}` : null

  useEffect(() => {
    if (storageKey && !localStorage.getItem(storageKey)) {
      setIsOpen(true)
      setTimeout(() => setVisible(true), 30)
    }
  }, [storageKey])

  const handleClose = () => {
    setVisible(false)
    setTimeout(() => {
      if (storageKey) localStorage.setItem(storageKey, 'dismissed')
      setIsOpen(false)
    }, 200)
  }

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
        visible ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-200 ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
        }`}
      >
        {/* Header navy */}
        <div className="relative bg-[#1c1d33] px-7 py-7">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <img src="/logo3.png" alt="Axiostock" className="h-9 w-9 object-contain" />
            <span className="font-mono text-sm font-semibold tracking-widest text-white/50 uppercase">
              Axiostock
            </span>
          </div>

          <h2 className="text-2xl font-bold text-white leading-snug">
            ¡Bienvenido al panel<br />de administración!
          </h2>
          <p className="mt-2 text-sm text-white/60 leading-relaxed">
            Tu cuenta está lista. Seguí el checklist de configuración para tener todo operativo desde el primer día.
          </p>

          {/* Decorative dots */}
          <div className="absolute right-6 bottom-4 flex gap-1.5 opacity-20">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-white" />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-7 py-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Qué podés gestionar desde acá
          </p>
          <ul className="space-y-2.5">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-admin-50 text-admin-600">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-gray-700">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-7 py-4 flex justify-end">
          <Button onClick={handleClose} className="gap-2">
            Empezar configuración
          </Button>
        </div>
      </div>
    </div>
  )
}
