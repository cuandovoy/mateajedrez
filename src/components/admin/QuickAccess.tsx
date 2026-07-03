import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  Banknote,
  BarChart2,
} from 'lucide-react'

interface QuickAccessButton {
  label: string
  icon: React.ElementType
  route: string
  colorClass: string
}

interface QuickAccessProps {
  compact?: boolean
}

const BUTTONS: QuickAccessButton[] = [
  {
    label: 'Punto de venta',
    icon: ShoppingCart,
    route: '/pos',
    colorClass: 'bg-admin-600 hover:bg-admin-700 text-white',
  },
  {
    label: 'Productos',
    icon: Package,
    route: '/products',
    colorClass: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  {
    label: 'Inventario',
    icon: Warehouse,
    route: '/inventory',
    colorClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  {
    label: 'Clientes',
    icon: Users,
    route: '/customers',
    colorClass: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
  {
    label: 'Caja',
    icon: Banknote,
    route: '/cash-register',
    colorClass: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  {
    label: 'Reportes',
    icon: BarChart2,
    route: '/reports/sales',
    colorClass: 'bg-slate-700 hover:bg-slate-800 text-white',
  },
]

export function QuickAccess({ compact = false }: QuickAccessProps) {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {BUTTONS.map(({ label, icon: Icon, route, colorClass }) => (
        <button
          key={route}
          onClick={() => navigate(route)}
          className={`w-full flex flex-col items-center justify-center transition-all duration-150 active:scale-95 shadow-sm hover:shadow-md ${colorClass} ${
            compact
              ? 'rounded-xl p-3 gap-2'
              : 'rounded-2xl p-5 gap-3'
          }`}
        >
          <Icon className={compact ? 'h-5 w-5' : 'h-8 w-8'} />
          <span className={compact ? 'text-xs' : 'text-sm font-semibold'}>{label}</span>
        </button>
      ))}
    </div>
  )
}
