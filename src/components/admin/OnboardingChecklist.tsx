import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '@/hooks/useOrganization'
import { supabase } from '@/lib/supabase'
import {
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ImageIcon,
  LayoutGrid,
  Package,
  ShoppingCart,
  Store,
  Truck,
  Users,
  X,
} from 'lucide-react'

interface OnboardingStep {
  id: string
  label: string
  sublabel: string
  completed: boolean
  href: string
  icon: React.ElementType
}

const INITIAL_STEPS: Omit<OnboardingStep, 'completed'>[] = [
  {
    id: 'org_logo',
    label: 'Personalizá tu tienda',
    sublabel: 'Subí el logo y configurá los colores de marca',
    href: '/organizations',
    icon: ImageIcon,
  },
  {
    id: 'branch_details',
    label: 'Completá tu sucursal',
    sublabel: 'Agregá dirección y teléfono de tu punto de venta',
    href: '/branches',
    icon: Store,
  },
  {
    id: 'team',
    label: 'Invitá a tu equipo',
    sublabel: 'Sumá empleados con el rol que les corresponde',
    href: '/users',
    icon: Users,
  },
  {
    id: 'category',
    label: 'Organizá tu catálogo',
    sublabel: 'Creá las categorías de tus productos',
    href: '/categories',
    icon: LayoutGrid,
  },
  {
    id: 'product',
    label: 'Cargá tu primer producto',
    sublabel: 'Armá el inventario inicial de tu negocio',
    href: '/products',
    icon: Package,
  },
  {
    id: 'cash_session',
    label: 'Abrí tu primera caja',
    sublabel: 'Iniciá una sesión de caja antes de vender',
    href: '/pos',
    icon: CreditCard,
  },
  {
    id: 'first_order',
    label: 'Registrá tu primera venta',
    sublabel: 'Hacé una venta desde el punto de venta',
    href: '/pos',
    icon: ShoppingCart,
  },
  {
    id: 'supplier',
    label: 'Registrá un proveedor',
    sublabel: 'Vinculá tus proveedores habituales',
    href: '/suppliers',
    icon: Truck,
  },
]

const RADIUS = 38
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function getHeadline(progress: number): { title: string; sub: string } {
  if (progress === 0) return { title: '¡Bienvenido a Axiostock!', sub: 'Completá estos pasos para tener todo listo.' }
  if (progress < 34) return { title: 'Empezaste bien.', sub: 'Seguí configurando tu cuenta paso a paso.' }
  if (progress < 67) return { title: 'Vas por buen camino.', sub: 'Ya completaste más de la mitad del setup.' }
  if (progress < 100) return { title: '¡Casi listo!', sub: 'Unos pasos más y tu cuenta estará al 100%.' }
  return { title: '¡Todo configurado!', sub: 'Tu cuenta está lista para operar.' }
}

export function OnboardingChecklist() {
  const { organizationId } = useOrganization()
  const [steps, setSteps] = useState<OnboardingStep[]>(
    INITIAL_STEPS.map((s) => ({ ...s, completed: false }))
  )
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(false)

  const storageKey = organizationId ? `axiostock_onboarding_v2_${organizationId}` : null

  useEffect(() => {
    if (storageKey && localStorage.getItem(storageKey) === 'dismissed') {
      setDismissed(true)
    }
  }, [storageKey])

  useEffect(() => {
    if (organizationId) checkSteps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(timer)
    }
  }, [loading])

  const checkSteps = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any

      const [
        orgResult,
        branchDetailsResult,
        teamResult,
        categoryResult,
        productResult,
        cashSessionResult,
        orderResult,
        supplierResult,
      ] = await Promise.all([
        supabase
          .from('organizations')
          .select('logo_url')
          .eq('id', organizationId)
          .single(),
        // Sucursal "Principal" se crea automáticamente — el paso se completa cuando
        // el usuario agrega datos de contacto reales (dirección o teléfono)
        sb
          .from('branches')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .not('address', 'is', null),
        sb
          .from('organization_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        sb
          .from('categories')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        sb
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('is_active', true),
        sb
          .from('cash_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        sb
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        sb
          .from('suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
      ])

      setSteps((prev) =>
        prev.map((step) => {
          switch (step.id) {
            case 'org_logo':
              return { ...step, completed: !!orgResult.data?.logo_url }
            case 'branch_details':
              return { ...step, completed: (branchDetailsResult.count ?? 0) > 0 }
            case 'team':
              // > 1 porque el creador ya cuenta como miembro
              return { ...step, completed: (teamResult.count ?? 0) > 1 }
            case 'category':
              return { ...step, completed: (categoryResult.count ?? 0) > 0 }
            case 'product':
              return { ...step, completed: (productResult.count ?? 0) > 0 }
            case 'cash_session':
              return { ...step, completed: (cashSessionResult.count ?? 0) > 0 }
            case 'first_order':
              return { ...step, completed: (orderResult.count ?? 0) > 0 }
            case 'supplier':
              return { ...step, completed: (supplierResult.count ?? 0) > 0 }
            default:
              return step
          }
        })
      )
    } catch (err) {
      console.error('Error checking onboarding steps:', err)
    } finally {
      setLoading(false)
    }
  }

  const completedCount = steps.filter((s) => s.completed).length
  const totalCount = steps.length
  const progress = Math.round((completedCount / totalCount) * 100)
  const strokeDashoffset = CIRCUMFERENCE * (1 - completedCount / totalCount)
  const { title, sub } = getHeadline(progress)

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(() => {
      if (storageKey) localStorage.setItem(storageKey, 'dismissed')
      setDismissed(true)
    }, 300)
  }

  if (dismissed) return null
  if (!loading && completedCount === totalCount) return null

  return (
    <div
      className={`mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 ${
        visible && !loading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {/* Top band */}
      <div className="relative flex items-center gap-5 bg-admin-900 px-5 py-4 sm:px-6">
        {/* SVG ring */}
        <div className="relative shrink-0">
          <svg width="76" height="76" viewBox="0 0 100 100" className="-rotate-90">
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="#fd2525"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={loading ? CIRCUMFERENCE : strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-bold leading-none text-white">
              {loading ? '…' : `${progress}%`}
            </span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-white">{title}</p>
          <p className="mt-0.5 text-sm text-white/60">{sub}</p>
          {/* Segment bar */}
          <div className="mt-2.5 flex gap-1">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  step.completed ? 'bg-[#fd2525]' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-white/40 font-mono">
            {completedCount}/{totalCount} pasos completados
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
          aria-label="Ocultar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 sm:p-5">
        {steps.map((step) => {
          const Icon = step.icon
          const isCompleted = step.completed

          const inner = (
            <div
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-150 ${
                isCompleted
                  ? 'bg-gray-50'
                  : 'bg-white border border-gray-200 shadow-sm hover:border-admin-300 hover:shadow group'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isCompleted
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-admin-50 text-admin-600 ring-1 ring-admin-100 group-hover:bg-admin-100'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-admin-500" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'
                  }`}
                >
                  {step.label}
                </p>
                {!isCompleted && (
                  <p className="text-xs text-gray-500 truncate">{step.sublabel}</p>
                )}
              </div>
              {!isCompleted && (
                <ChevronRight className="h-4 w-4 shrink-0 text-admin-400 group-hover:text-admin-600 transition-colors" />
              )}
            </div>
          )

          if (isCompleted) {
            return <div key={step.id}>{inner}</div>
          }

          return (
            <Link key={step.id} to={step.href} className="block">
              {inner}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
