import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAdminStore } from '@/store/adminStore'
import { useAuthStore } from '@/store/authStore'
import { useOrganizationStore } from '@/store/organizationStore'
import {
  LayoutDashboard, 
  Package, 
  Folder, 
  ShoppingCart, 
  Users,
  LogOut,
  Truck,
  BarChart3,
  Building2,
  Wallet,
  ChevronRight,
  ChevronLeft,
  FileText,
  Warehouse,
  ArrowRight,
  Menu,
  X,
  Users2,
  CreditCard,
  Store,
  StoreIcon
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs'
import { InstallBanner } from '@/components/admin/InstallBanner'
import { ToastContainer } from './ToastContainer'
import { CreateOrganizationModal } from '@/components/admin/CreateOrganizationModal'
import { PermissionGate } from '@/components/features/PermissionGate'
import type { Permission } from '@/lib/permissions'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import { useLocation } from 'react-router-dom'

type NavItem = {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  permission?: Permission
  /** Solo visible para admins (no managers) */
  adminOnly?: boolean
  /** Feature requerida por plan (ej: transfers, cash_register) */
  planFeature?: 'transfers' | 'cash_register' | 'advanced_reports'
}

type NavSection = {
  title: string
  items: NavItem[]
}

export function AdminLayout() {
  const { user, isAdmin, canAccessAdminPanel, signOut, loading, profile } = useAuthStore()
  const canCreateOrganization = profile?.role === 'admin'
  const { currentOrganization, organizations, setCurrentOrganization, fetchOrganizations, switchingOrganization } = useOrganizationStore()
  const { canUseFeature } = usePlanLimits()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false)
  const [pendingOrgSwitch, setPendingOrgSwitch] = useState<typeof organizations[0] | null>(null)
  const hasUnsavedChanges = useAdminStore((s) => s.hasUnsavedChanges)

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('admin-sidebar-collapsed', String(next))
      } catch {}
      return next
    })
  }

  useEffect(() => {
    if (user) fetchOrganizations()
  }, [user, fetchOrganizations])

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/login')
        return
      }
      if (!canAccessAdminPanel) {
        navigate('/login')
        return
      }
    }
  }, [user, canAccessAdminPanel, loading, navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navSections: NavSection[] = [
    {
      title: 'Inicio',
      items: [
        { path: '/', label: 'Inicio', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Operación',
      items: [
        { path: '/orders', label: 'Órdenes', icon: ShoppingCart },
        { path: '/expenses', label: 'Compras y Egresos', icon: Wallet },
        { path: '/customers', label: 'Clientes', icon: Users2, permission: 'customers:view' },
        { path: '/cash-register', label: 'Punto de Venta', icon: StoreIcon, planFeature: 'cash_register' },
        { path: '/transfers', label: 'Transferencias', icon: ArrowRight, planFeature: 'transfers' },
      ],
    },
    {
      title: 'Catálogo',
      items: [
        { path: '/products', label: 'Productos', icon: Package },
        { path: '/categories', label: 'Categorías', icon: Folder },
        { path: '/inventory', label: 'Inventario', icon: Warehouse },
        { path: '/suppliers', label: 'Proveedores', icon: Truck },
        { path: '/branches', label: 'Sucursales', icon: Building2 },
      ],
    },
    {
      title: 'Reportes',
      items: [
        { path: '/reports/sales', label: 'Ventas', icon: BarChart3, planFeature: 'advanced_reports' },
        { path: '/reports/financial', label: 'Finanzas', icon: Wallet, planFeature: 'advanced_reports' },
        { path: '/reports/audit-logs', label: 'Auditoría', icon: FileText, planFeature: 'advanced_reports' },
        { path: '/reports/customers', label: 'Clientes', icon: Users2, planFeature: 'advanced_reports' },
        { path: '/reports/inventory', label: 'Inventario', icon: Warehouse, planFeature: 'advanced_reports' },
      ],
    },
    {
      title: 'Administración',
      items: [
        { path: '/organizations', label: 'Organizaciones', icon: Building2, adminOnly: true },
        { path: '/planes', label: 'Planes', icon: CreditCard },
        { path: '/users', label: 'Usuarios', icon: Users, adminOnly: true },
        { path: '/roles-permissions', label: 'Roles', icon: FileText, permission: 'settings:manage_roles' },
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
    if (path === '/') {
      return location.pathname === '/'
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

  if (!user || !canAccessAdminPanel) {
    return null
  }
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header - compacto */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 md:px-6 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-1.5 hover:bg-gray-100 rounded-md transition-colors shrink-0"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <Link to="/" className="flex items-center gap-2.5 min-w-0 group">
                <img src="/logo3.png" alt="Axios" className="h-8 w-8 object-contain shrink-0" />
                <span className="font-semibold text-gray-900 truncate">Axios</span>
              </Link>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <button
                  onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-sm min-w-0"
                >
                  <div className="h-6 w-6 rounded flex items-center justify-center overflow-hidden shrink-0 bg-gray-100">
                    {currentOrganization?.logo_url ? (
                      <img src={currentOrganization.logo_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <Building2 className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  <span className="font-medium text-gray-700 max-w-[100px] truncate text-xs md:text-sm">
                    {currentOrganization?.name ?? 'Org'}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium hidden sm:inline',
                      currentOrganization?.subscription_tier === 'profesional'
                        ? 'bg-admin-100 text-admin-800'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {currentOrganization?.subscription_tier === 'profesional' ? 'Pro' : 'Starter'}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${orgDropdownOpen ? 'rotate-90' : ''}`} />
                </button>
                {orgDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOrgDropdownOpen(false)} />
                    <div className="absolute right-0 mt-1 w-52 py-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                      {organizations.map((org) => (
                        <button
                          key={org.id}
                          onClick={() => {
                            if (currentOrganization?.id === org.id) {
                              setOrgDropdownOpen(false)
                              return
                            }
                            if (hasUnsavedChanges) {
                              setPendingOrgSwitch(org)
                              setOrgDropdownOpen(false)
                            } else {
                              setCurrentOrganization(org)
                              setOrgDropdownOpen(false)
                            }
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${currentOrganization?.id === org.id ? 'bg-admin-50 text-admin-700 font-medium' : 'text-gray-700'}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-6 w-6 rounded bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                              {org.logo_url ? (
                                <img src={org.logo_url} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <Building2 className="h-4 w-4 text-gray-500" />
                              )}
                            </div>
                            <span className="truncate text-sm">{org.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                org.subscription_tier === 'profesional' ? 'bg-admin-100 text-admin-800' : 'bg-gray-100 text-gray-600'
                              )}
                            >
                              {org.subscription_tier === 'profesional' ? 'Pro' : 'Starter'}
                            </span>
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
                              org.member?.role === 'admin' ? 'bg-admin-100 text-admin-800' : 'bg-gray-200 text-gray-700'
                            )}>
                              {org.member?.role === 'admin' ? 'Admin' : 'Manager'}
                            </span>
                          </div>
                        </button>
                      ))}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <Link
                          to="/planes"
                          onClick={() => setOrgDropdownOpen(false)}
                          className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Ver planes
                        </Link>
                        {canCreateOrganization && (
                          <button
                            onClick={() => {
                              setOrgDropdownOpen(false)
                              setCreateOrgModalOpen(true)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-admin-600 hover:bg-admin-50 font-medium"
                          >
                            + Crear organización
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {currentOrganization?.slug && (
                <a
                  href={`/${currentOrganization.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                  title="Ver tienda pública"
                >
                  <Store className="h-4 w-4" />
                  <span className="text-xs font-medium">Ver tienda</span>
                </a>
              )}
              <div className="flex items-center gap-1">
                <span className="hidden md:block text-xs text-gray-500 truncate max-w-[140px]">{user.email}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  title="Cerrar sesión"
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
            className="fixed inset-0 bg-black/50 lg:hidden z-10 top-[52px]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Admin Sidebar - más compacto */}
        <aside className={cn(
          'fixed left-0 top-[52px] h-[calc(100vh-52px)] bg-white border-r border-gray-200 overflow-y-auto z-20 transition-all duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed ? 'lg:w-14' : 'w-56 lg:w-56'
        )}>
          <nav className={cn('p-3 transition-all duration-300', sidebarCollapsed ? 'px-2 py-3' : 'py-3')}>
            <div className={cn('space-y-4', sidebarCollapsed ? 'space-y-3' : 'space-y-4')}>
              {navSections.map((section) => (
                <div key={section.title}>
                  {!sidebarCollapsed && (
                    <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 px-2">
                      {section.title}
                    </h3>
                  )}
                  <ul className="space-y-0.5">
                    {section.items
                      .filter((item) => {
                        if (item.adminOnly && !isAdmin) return false
                        if (section.title === 'Reportes') return true
                        return !item.planFeature || canUseFeature(item.planFeature)
                      })
                      .map((item) => {
                      const isLockedByPlan = Boolean(
                        section.title === 'Reportes' &&
                        item.planFeature &&
                        !canUseFeature(item.planFeature)
                      )
                      const Icon = item.icon
                      const active = !isLockedByPlan && isActive(item.path)
                      const targetPath = isLockedByPlan
                        ? `/planes?from=${encodeURIComponent(item.path)}`
                        : item.path
                      const itemTitle = sidebarCollapsed
                        ? `${item.label}${isLockedByPlan ? ' (Disponible en Plan Profesional)' : ''}`
                        : undefined

                      const content = (
                        <li key={item.path}>
                          <Link
                            to={targetPath}
                            onClick={() => setSidebarOpen(false)}
                            title={itemTitle}
                            className={cn(
                              'flex items-center rounded-md transition-colors group',
                              sidebarCollapsed ? 'justify-center p-2' : 'px-2 py-2 gap-2',
                              isLockedByPlan
                                ? 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-500'
                                : active
                                ? 'bg-admin-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            )}
                          >
                            <Icon className={cn(
                              'h-4 w-4 shrink-0',
                              isLockedByPlan
                                ? 'text-gray-400'
                                : active
                                ? 'text-white'
                                : 'text-gray-500 group-hover:text-gray-600'
                            )} />
                            {!sidebarCollapsed && (
                              <span className={cn(
                                'text-sm truncate',
                                isLockedByPlan
                                  ? 'text-gray-500'
                                  : active
                                  ? 'text-white font-medium'
                                  : 'text-gray-700'
                              )}>
                                {item.label}
                              </span>
                            )}
                            {!sidebarCollapsed && isLockedByPlan && (
                              <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                                Pro
                              </span>
                            )}
                            {!sidebarCollapsed && active && (
                              <ChevronRight className="h-4 w-4 text-white/80 shrink-0 ml-auto" />
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
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="mt-4 w-full flex items-center justify-center p-2 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors lg:flex"
              title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </nav>
        </aside>

        {/* Admin Content */}
        <main className={cn(
          'flex-1 min-w-0 bg-gray-50 min-h-[calc(100vh-52px)] relative transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-14' : 'lg:ml-56'
        )}>
          {switchingOrganization && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-admin-600" />
            </div>
          )}
          <div className="p-4 md:p-6">
            <AdminBreadcrumbs />
            <Outlet />
          </div>
        </main>
      </div>

      {createOrgModalOpen && (
        <CreateOrganizationModal onClose={() => setCreateOrgModalOpen(false)} />
      )}

      <ConfirmDialog
        open={pendingOrgSwitch !== null}
        title="Cambiar de organización"
        message="Tienes cambios sin guardar. ¿Seguro que deseas cambiar? Los cambios se perderán."
        confirmLabel="Cambiar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (pendingOrgSwitch) {
            useAdminStore.getState().setHasUnsavedChanges(false)
            setCurrentOrganization(pendingOrgSwitch)
            setOrgDropdownOpen(false)
            setPendingOrgSwitch(null)
          }
        }}
        onCancel={() => setPendingOrgSwitch(null)}
      />

      <ToastContainer />
      <InstallBanner />
    </div>
  )
}
