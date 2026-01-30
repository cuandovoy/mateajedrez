import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  LayoutDashboard, 
  Package, 
  Folder, 
  ShoppingCart, 
  Users,
  LogOut,
  Store,
  Truck,
  BarChart3,
  Building2,
  Wallet,
  ChevronRight,
  FileText,
  Warehouse,
  ArrowRight,
  Menu,
  X,
  Users2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PermissionGate } from '@/components/features/PermissionGate'
import type { Permission } from '@/lib/permissions'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useLocation } from 'react-router-dom'

type NavItem = {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  // Optional permission required to show this nav item
  permission?: Permission
}

type NavSection = {
  title: string
  items: NavItem[]
}

export function AdminLayout() {
  const { user, isAdmin, signOut, loading } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/')
        return
      }
      if (!isAdmin) {
        navigate('/')
        return
      }
    }
  }, [user, isAdmin, loading, navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const navSections: NavSection[] = [
    {
      title: 'Principal',
      items: [
        { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Gestión',
      items: [
        { path: '/admin/products', label: 'Productos', icon: Package },
        { path: '/admin/categories', label: 'Categorías', icon: Folder },
        { path: '/admin/suppliers', label: 'Proveedores', icon: Truck },
        { path: '/admin/branches', label: 'Sucursales', icon: Building2 },
        { path: '/admin/inventory', label: 'Inventario', icon: Warehouse },
      ],
    },
    {
      title: 'Operaciones',
      items: [
        { path: '/admin/orders', label: 'Órdenes', icon: ShoppingCart },
        { path: '/admin/customers', label: 'Clientes', icon: Users2, permission: 'customers:view' },
        { path: '/admin/cash-register', label: 'Caja', icon: Wallet },
        { path: '/admin/transfers', label: 'Transferencias', icon: ArrowRight },
      ],
    },
    {
      title: 'Reportes',
      items: [
        { path: '/admin/reports/sales', label: 'Ventas', icon: BarChart3 },
        { path: '/admin/reports/audit-logs', label: 'Logs de Auditoría', icon: FileText },
      ],
    },
    {
      title: 'Configuración',
      items: [
        { path: '/admin/users', label: 'Usuarios', icon: Users },
        { path: '/admin/roles-permissions', label: 'Roles y Permisos', icon: FileText, permission: 'settings:manage_roles' },
      ],
    },
  ]

  // Apply admin theme class to body when component mounts
  useEffect(() => {
    document.body.classList.add('admin-theme')
    return () => {
      document.body.classList.remove('admin-theme')
    }
  }, [])

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-600"></div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
              <Link to="/admin" className="flex items-center space-x-3 group">
                <div className="p-2 bg-admin-600 rounded-lg group-hover:bg-admin-700 transition-colors">
                  <LayoutDashboard className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg md:text-xl font-bold text-gray-900 block">Panel Admin</span>
                  <span className="text-xs text-gray-500 hidden sm:block">Gestión de E-commerce</span>
                </div>
              </Link>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <Link to="/" className="hidden md:block">
                <Button variant="outline" size="sm" className="border-gray-300 hover:bg-gray-50">
                  <Store className="h-4 w-4 mr-2" />
                  Ver Tienda
                </Button>
              </Link>
              <div className="h-8 w-px bg-gray-300 hidden md:block"></div>
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">{user.email}</div>
                  <div className="text-xs text-gray-500">Administrador</div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSignOut}
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Overlay for mobile when sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 lg:hidden z-10 top-[73px]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Admin Sidebar */}
        <aside className={cn(
          'fixed left-0 top-[73px] w-72 h-[calc(100vh-73px)] bg-white shadow-sm border-r border-gray-200 overflow-y-auto z-20 transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}>
          <nav className="p-4 md:p-6">
            <div className="space-y-6 md:space-y-8">
              {navSections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
                    {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const active = isActive(item.path)

                      const content = (
                        <li key={item.path}>
                          <Link
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                              'flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group',
                              active
                                ? 'bg-admin-600 text-white shadow-sm'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                            )}
                          >
                            <div className="flex items-center space-x-3">
                              <Icon className={cn(
                                'h-5 w-5 transition-colors',
                                active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'
                              )} />
                              <span className={cn(
                                'text-sm font-medium',
                                active ? 'text-white' : 'text-gray-700 group-hover:text-gray-900'
                              )}>
                                {item.label}
                              </span>
                            </div>
                            {active && (
                              <ChevronRight className="h-4 w-4 text-white" />
                            )}
                          </Link>
                        </li>
                      )

                      if (item.permission) {
                        return (
                          <PermissionGate permission={item.permission} key={item.path}>
                            {content}
                          </PermissionGate>
                        )
                      }

                      return content
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </aside>

        {/* Admin Content */}
        <main className="w-full lg:ml-72 bg-gray-50 min-h-[calc(100vh-73px)]">
          <div className="p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
