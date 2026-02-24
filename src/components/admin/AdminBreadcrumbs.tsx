import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/reports': 'Reportes',
  '/products': 'Productos',
  '/categories': 'Categorías',
  '/suppliers': 'Proveedores',
  '/orders': 'Órdenes',
  '/customers': 'Clientes',
  '/reports/sales': 'Ventas',
  '/reports/audit-logs': 'Logs de Auditoría',
  '/reports/customers': 'Reporte de Clientes',
  '/reports/inventory': 'Reporte de Inventario',
  '/branches': 'Sucursales',
  '/inventory': 'Inventario',
  '/transfers': 'Transferencias',
  '/cash-register': 'Caja',
  '/organizations': 'Organizaciones',
  '/users': 'Usuarios',
  '/roles-permissions': 'Roles y Permisos',
}

export function AdminBreadcrumbs() {
  const location = useLocation()
  const pathname = location.pathname

  if (pathname === '/') return null

  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: { path: string; label: string }[] = []

  let currentPath = ''
  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`
    let label = ROUTE_LABELS[currentPath]
    if (!label) {
      const prevSegment = segments[i - 1]
      if (prevSegment === 'orders' && /^[0-9a-f-]{36}$/i.test(segments[i])) label = 'Detalle orden'
      else if (/^[0-9a-f-]{36}$/i.test(segments[i])) label = 'Detalle'
      else label = segments[i].charAt(0).toUpperCase() + segments[i].slice(1)
    }
    breadcrumbs.push({ path: currentPath, label })
  }

  if (breadcrumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex items-center gap-1 text-xs text-gray-500 flex-wrap">
        <li>
          <Link to="/" className="hover:text-admin-600 transition-colors">
            Admin
          </Link>
        </li>
        {breadcrumbs.map((crumb, i) => (
          <li key={crumb.path} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-gray-700">{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="hover:text-admin-600 transition-colors">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
