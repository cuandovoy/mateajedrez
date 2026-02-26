import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Check } from 'lucide-react'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { useOrganizationStore } from '@/store/organizationStore'
import { useLocation } from 'react-router-dom'
import { useMemo } from 'react'

const PLANS = [
  {
    name: 'Starter',
    price: '$UY 1.700',
    period: '/mes',
    description: 'Ideal para emprendimientos que arrancan con control básico.',
    features: [
      'Hasta 500 productos',
      '1 sucursal',
      'Control de stock básico',
      'Gestión de órdenes',
      'Gestión de proveedores',
      'Códigos de barras',
      'Manejo de cajas y cierres',
    ],
    cta: 'Plan actual',
    highlighted: false,
    tier: 'starter',
  },
  {
    name: 'Profesional',
    price: '$UY 3.400',
    period: '/mes',
    description: 'Para negocios en crecimiento que necesitan más control.',
    features: [
      'Productos ilimitados',
      'Múltiples sucursales',
      'Inventario multi-sucursal',
      'Transferencias internas',
      'Tienda y catálogo online',
      'Soporte prioritario',
      'Configuración de notificaciones',
      'Gestión de compras/egresos',
      'Reportes avanzados de ventas y stock',
    ],
    cta: 'Elegir Profesional',
    highlighted: true,
    tier: 'profesional',
  },
]

export function AdminPlans() {
  const { tier } = usePlanLimits()
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization)
  const location = useLocation()
  const fromPath = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('from') || location.pathname
  }, [location.pathname, location.search])
  const whatsappNumber = '59898257909'

  const handleChooseProfessional = () => {
    const message = encodeURIComponent(
      `Hola, quiero activar el Plan Profesional.\nOrganización: ${currentOrganization?.name || 'N/A'}\nPlan actual: ${tier}\nPantalla origen: ${fromPath}`
    )
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Planes</h1>
        <p className="text-gray-600 mt-2">
          Elegí el plan que mejor se adapte a tu negocio
        </p>
        {fromPath && fromPath !== '/planes' && (
          <p className="text-xs text-gray-500 mt-1">
            Llegaste aquí desde: <span className="font-mono">{fromPath}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = tier === plan.tier
          return (
            <Card
              key={plan.name}
              className={`relative overflow-hidden ${
                plan.highlighted ? 'ring-2 ring-admin-600' : ''
              }`}
            >
              {plan.highlighted && (
                <div className="absolute top-0 right-0 bg-admin-600 text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
                  Recomendado
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.name}</span>
                  {isCurrent && (
                    <span className="text-xs font-normal bg-admin-100 text-admin-800 px-2 py-0.5 rounded">
                      Plan actual
                    </span>
                  )}
                </CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600">{plan.period}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{plan.description}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-green-600 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button
                    disabled
                    variant="outline"
                    className="w-full border-gray-300 bg-gray-100 text-gray-500 hover:bg-gray-100"
                  >
                    Plan actual seleccionado
                  </Button>
                ) : plan.tier === 'profesional' ? (
                  <Button className="w-full" onClick={handleChooseProfessional}>
                    {plan.cta}
                  </Button>
                ) : (
                  <Button disabled variant="outline" className="w-full border-gray-300 text-gray-500">
                    Plan básico
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Para actualizar al plan Profesional, usá el botón "Elegir Profesional" y te contactamos por WhatsApp.
      </p>
    </div>
  )
}
