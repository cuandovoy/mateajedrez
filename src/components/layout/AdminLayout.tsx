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
  ChevronDown,
  FileText,
  Warehouse,
  ArrowRight,
  Menu,
  X,
  Users2,
  CreditCard,
  Store,
  StoreIcon,
  Receipt,
  Share2,
  Globe,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs'
import { InstallBanner } from '@/components/admin/InstallBanner'
import { NotificationBell } from '@/components/admin/NotificationBell'
import { ToastContainer } from './ToastContainer'
import { CreateOrganizationModal } from '@/components/admin/CreateOrganizationModal'
import { ShareStoreModal } from '@/components/admin/ShareStoreModal'
import { PermissionGate } from '@/components/features/PermissionGate'
import { OrgAccessGate } from '@/components/features/OrgAccessGate'
import type { Permission } from '@/lib/permissions'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { useBillerConfig } from '@/hooks/useBillerConfig'
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
  /** Ocultar si la org tiene menos sucursales activas que este valor */
  minBranches?: number
  /** Mostrar solo si la organización tiene configuración de Biller */
  requiresBillerConfig?: boolean
  /** Acción custom en lugar de navegación */
  onClick?: () => void
}

type NavSection = {
  title: string
  icon: React.ComponentType<{ className?: string }>
  path?: string
  items?: NavItem[]
}

export function AdminLayout() {
  const { user, isAdmin, canAccessAdminPanel, signOut, loading, profile } = useAuthStore()
  const canCreateOrganization = profile?.role === 'admin'
  const { currentOrganization, organizations, setCurrentOrganization, fetchOrganizations, switchingOrganization } = useOrganizationStore()
  const { canUseFeature, branchCount } = usePlanLimits()
  const { config: billerConfig, loading: billerConfigLoading } = useBillerConfig(currentOrganization?.id ?? null)
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('admin-sidebar-sections')
      return saved ? JSON.parse(saved) : { 'Operación': true, 'Catálogo': false, 'Reportes': false, 'Administración': false }
    } catch {
      return { 'Operación': true, 'Catálogo': false, 'Reportes': false, 'Administración': false }
    }
  })

  const toggleSection = (title: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [title]: !prev[title] }
      try { localStorage.setItem('admin-sidebar-sections', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const [shareStoreOpen, setShareStoreOpen] = useState(false)
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false)
  const [pendingOrgSwitch, setPendingOrgSwitch] = useState<typeof organizations[0] | null>(null)
  const hasUnsavedChanges = useAdminStore((s) => s.hasUnsavedChanges)

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('admin-sidebar-collapsed', String(next))
      } catch {
        // Ignore storage errors (private mode / blocked localStorage).
      }
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
      icon: LayoutDashboard,
      path: '/',
    },
    {
      title: 'Operación',
      icon: ShoppingCart,
      items: [
        { path: '/orders', label: 'Órdenes', icon: ShoppingCart },
        { path: '/billing/comprobantes', label: 'Comprobantes CFE', icon: Receipt, requiresBillerConfig: true },
        { path: '/expenses', label: 'Compras y Egresos', icon: Wallet },
        { path: '/customers', label: 'Clientes', icon: Users2, permission: 'customers:view' },
        { path: '/cash-register', label: 'Punto de Venta', icon: StoreIcon, planFeature: 'cash_register' },
        { path: '/transfers', label: 'Transferencias', icon: ArrowRight, planFeature: 'transfers', minBranches: 2 },
      ],
    },
    {
      title: 'Catálogo',
      icon: Package,
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
      icon: BarChart3,
      items: [
        { path: '/reports/sales', label: 'Ventas', icon: BarChart3, planFeature: 'advanced_reports' },
        { path: '/reports/financial', label: 'Finanzas', icon: Wallet, planFeature: 'advanced_reports' },
        { path: '/reports/audit-logs', label: 'Auditoría', icon: FileText, planFeature: 'advanced_reports' },
        { path: '/reports/customers', label: 'Clientes', icon: Users2, planFeature: 'advanced_reports' },
        { path: '/reports/inventory', label: 'Inventario', icon: Warehouse, planFeature: 'advanced_reports' },
      ],
    },
    {
      title: 'Tienda',
      icon: Globe,
      items: [
        ...(currentOrganization?.slug ? [{
          path: `/${currentOrganization.slug}`,
          label: 'Ver tienda',
          icon: Store,
        }] : []),
        {
          path: '#compartir',
          label: 'Compartir',
          icon: Share2,
          onClick: () => setShareStoreOpen(true),
        },
        {
          path: '/store/stats',
          label: 'Estadísticas',
          icon: BarChart3,
        },
      ],
    },
    {
      title: 'Administración',
      icon: Users,
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
              <NotificationBell orgId={currentOrganization?.id} />
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
          'fixed left-0 top-[52px] h-[calc(100vh-52px)] bg-white/95 backdrop-blur-xl border-r border-slate-200 shadow-sm overflow-y-auto z-20 transition-all duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed ? 'lg:w-14' : 'w-64 lg:w-64'
        )}>
          <nav className={cn('p-3 transition-all duration-300', sidebarCollapsed ? 'px-2 py-3' : 'py-3')}>
            <div className={cn('space-y-4', sidebarCollapsed ? 'space-y-3' : 'space-y-4')}>
              {navSections.map((section) => {
                const SectionIcon = section.icon
                const isStandaloneLink = Boolean(section.path && !section.items)
                const filteredItems = section.items?.filter((item) => {
                  if (item.adminOnly && !isAdmin) return false
                  if (item.minBranches && branchCount < item.minBranches) return false
                  if (item.requiresBillerConfig && (billerConfigLoading || !billerConfig)) return false
                  if (section.title === 'Reportes') return true
                  return !item.planFeature || canUseFeature(item.planFeature)
                }) ?? []

                if (isStandaloneLink) {
                  const active = isActive(section.path!)
                  return (
                    <div key={section.title}>
                      <Link
                        to={section.path!}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'flex items-center rounded-2xl transition-colors group w-full border-l-4 border-transparent',
                          sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2 gap-3',
                          active
                            ? 'bg-admin-600 text-white border-admin-600 shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        )}
                      >
                        <SectionIcon className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-white' : 'text-gray-500 group-hover:text-gray-600'
                        )} />
                        {!sidebarCollapsed && (
                          <span className={cn(
                            'text-sm truncate',
                            active ? 'text-white font-medium' : 'text-gray-700'
                          )}>
                            {section.title}
                          </span>
                        )}
                        {!sidebarCollapsed && active && (
                          <ChevronRight className="h-4 w-4 text-white/80 shrink-0 ml-auto" />
                        )}
                      </Link>
                    </div>
                  )
                }

                if (filteredItems.length === 0) return null
                const isOpen = sidebarCollapsed || openSections[section.title]
                const hasActiveItem = filteredItems.some((item) => isActive(item.path))

                return (
                  <div key={section.title}>
                    {!sidebarCollapsed && (
                      <button
                        type="button"
                        onClick={() => toggleSection(section.title)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-2xl mb-1 group transition-colors',
                          isOpen
                            ? hasActiveItem
                              ? 'bg-admin-50 text-admin-700 shadow-sm'
                              : 'bg-slate-50 text-slate-700'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                        )}
                      >
                        <SectionIcon className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isOpen ? hasActiveItem ? 'text-admin-600' : 'text-gray-600' : 'text-gray-400'
                        )} />
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider flex-1 text-left">
                          {section.title}
                        </h3>
                        <ChevronDown className={cn(
                          'h-3 w-3 shrink-0 transition-transform duration-200',
                          isOpen ? 'rotate-0' : '-rotate-90',
                          isOpen ? hasActiveItem ? 'text-admin-500' : 'text-gray-500' : 'text-gray-400'
                        )} />
                      </button>
                    )}
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-200 ease-in-out',
                        isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      )}
                    >
                      <ul className="space-y-0.5 pb-1">
                        {filteredItems.map((item) => {
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

                          const itemClass = cn(
                            'flex items-center rounded-2xl transition-colors group w-full border-l-4 border-transparent',
                            sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2 gap-3 ml-1',
                            isLockedByPlan
                              ? 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-500'
                              : active
                              ? 'bg-admin-600 text-white border-admin-600 shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          )
                          const itemInner = (
                            <>
                              <Icon className={cn(
                                'h-4 w-4 shrink-0',
                                isLockedByPlan ? 'text-gray-400' : active ? 'text-white' : 'text-gray-500 group-hover:text-gray-600'
                              )} />
                              {!sidebarCollapsed && (
                                <span className={cn(
                                  'text-sm truncate',
                                  isLockedByPlan ? 'text-gray-500' : active ? 'text-white font-medium' : 'text-gray-700'
                                )}>
                                  {item.label}
                                </span>
                              )}
                              {!sidebarCollapsed && isLockedByPlan && (
                                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">Pro</span>
                              )}
                              {!sidebarCollapsed && active && (
                                <ChevronRight className="h-4 w-4 text-white/80 shrink-0 ml-auto" />
                              )}
                            </>
                          )
                          const content = (
                            <li key={item.path}>
                              {item.onClick ? (
                                <button
                                  type="button"
                                  title={itemTitle}
                                  onClick={() => { item.onClick!(); setSidebarOpen(false) }}
                                  className={itemClass}
                                >
                                  {itemInner}
                                </button>
                              ) : (
                                <Link
                                  to={targetPath}
                                  onClick={() => setSidebarOpen(false)}
                                  title={itemTitle}
                                  className={itemClass}
                                >
                                  {itemInner}
                                </Link>
                              )}
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
                  </div>
                )
              })}
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

        {sidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            aria-label="Expandir barra lateral"
            className="hidden lg:flex fixed left-14 top-24 z-30 h-10 w-10 items-center justify-center rounded-r-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {/* Admin Content */}
        <main className={cn(
          'flex-1 min-w-0 bg-gray-50 min-h-[calc(100vh-52px)] relative transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-14' : 'lg:ml-64'
        )}>
          {switchingOrganization && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-admin-600" />
            </div>
          )}
          <OrgAccessGate>
            <div className="p-4 md:p-6 pb-20 lg:pb-6">
              <AdminBreadcrumbs />
              <Outlet />
            </div>
          </OrgAccessGate>
        </main>
      </div>

      {/* Bottom Navigation - solo mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
        <div className="flex items-stretch h-16">
          {[
            { path: '/', label: 'Inicio', icon: LayoutDashboard },
            { path: '/orders', label: 'Órdenes', icon: ShoppingCart },
            { path: '/products', label: 'Productos', icon: Package },
            { path: '/cash-register', label: 'PdV', icon: StoreIcon },
          ].map(({ path, label, icon: Icon }) => {
            const active = isActive(path)
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                  active ? 'text-admin-600' : 'text-gray-500'
                )}
              >
                <Icon className={cn('h-5 w-5', active ? 'text-admin-600' : 'text-gray-400')} />
                {label}
              </Link>
            )
          })}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
              sidebarOpen ? 'text-admin-600' : 'text-gray-500'
            )}
          >
            <Menu className={cn('h-5 w-5', sidebarOpen ? 'text-admin-600' : 'text-gray-400')} />
            Más
          </button>
        </div>
      </nav>

      {createOrgModalOpen && (
        <CreateOrganizationModal onClose={() => setCreateOrgModalOpen(false)} />
      )}

      {shareStoreOpen && currentOrganization?.slug && (
        <ShareStoreModal
          storeUrl={`${window.location.origin}/${currentOrganization.slug}`}
          storeName={currentOrganization.name}
          onClose={() => setShareStoreOpen(false)}
        />
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
