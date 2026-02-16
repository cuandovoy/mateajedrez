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
  Users2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs'
import { CreateOrganizationModal } from '@/components/admin/CreateOrganizationModal'
import { PermissionGate } from '@/components/features/PermissionGate'
import type { Permission } from '@/lib/permissions'
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
}

type NavSection = {
  title: string
  items: NavItem[]
}

export function AdminLayout() {
  const { user, isAdmin, canAccessAdminPanel, signOut, loading } = useAuthStore()
  const { currentOrganization, organizations, setCurrentOrganization, fetchOrganizations, switchingOrganization } = useOrganizationStore()
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
      title: 'Principal',
      items: [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Gestión',
      items: [
        { path: '/products', label: 'Productos', icon: Package },
        { path: '/categories', label: 'Categorías', icon: Folder },
        { path: '/suppliers', label: 'Proveedores', icon: Truck },
        { path: '/branches', label: 'Sucursales', icon: Building2 },
        { path: '/inventory', label: 'Inventario', icon: Warehouse },
      ],
    },
    {
      title: 'Operaciones',
      items: [
        { path: '/orders', label: 'Órdenes', icon: ShoppingCart },
        { path: '/customers', label: 'Clientes', icon: Users2, permission: 'customers:view' },
        { path: '/cash-register', label: 'Caja', icon: Wallet },
        { path: '/transfers', label: 'Transferencias', icon: ArrowRight },
      ],
    },
    {
      title: 'Reportes',
      items: [
        { path: '/reports/sales', label: 'Ventas', icon: BarChart3 },
        { path: '/reports/audit-logs', label: 'Logs de Auditoría', icon: FileText },
      ],
    },
    {
      title: 'Configuración',
      items: [
        { path: '/organizations', label: 'Organizaciones', icon: Building2, adminOnly: true },
        { path: '/users', label: 'Usuarios', icon: Users, adminOnly: true },
        { path: '/roles-permissions', label: 'Roles y Permisos', icon: FileText, permission: 'settings:manage_roles' },
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
              <Link to="/" className="flex items-center space-x-3 group">
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
              <div className="relative">
                <button
                  onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
                >
                  <div className="h-8 w-8 rounded-lg bg-admin-100 flex items-center justify-center overflow-hidden shrink-0">
                    {currentOrganization?.logo_url ? (
                      <img src={currentOrganization.logo_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <Building2 className="h-4 w-4 text-admin-600" />
                    )}
                  </div>
                  <span className="font-medium text-gray-700 max-w-[120px] truncate">
                    {currentOrganization?.name ?? 'Seleccionar'}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-gray-500 transition-transform ${orgDropdownOpen ? 'rotate-90' : ''}`} />
                </button>
                {orgDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOrgDropdownOpen(false)} />
                    <div className="absolute right-0 mt-1 w-56 py-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
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
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${currentOrganization?.id === org.id ? 'bg-admin-50 text-admin-700 font-medium' : 'text-gray-700'}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                              {org.logo_url ? (
                                <img src={org.logo_url} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <Building2 className="h-4 w-4 text-gray-500" />
                              )}
                            </div>
                            <span className="truncate">{org.name}</span>
                          </div>
                          <span className={cn(
                            'shrink-0 px-1.5 py-0.5 rounded text-xs font-medium',
                            org.member?.role === 'admin' ? 'bg-admin-100 text-admin-800' : 'bg-gray-200 text-gray-700'
                          )}>
                            {org.member?.role === 'admin' ? 'Admin' : 'Manager'}
                          </span>
                        </button>
                      ))}
                      {isAdmin && (
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button
                            onClick={() => {
                              setOrgDropdownOpen(false)
                              setCreateOrgModalOpen(true)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-admin-600 hover:bg-admin-50 font-medium"
                          >
                            + Crear organización
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">{user.email}</div>
                  <div className="text-xs text-gray-500">{isAdmin ? 'Administrador' : 'Manager'}</div>
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
          'fixed left-0 top-[73px] h-[calc(100vh-73px)] bg-white shadow-sm border-r border-gray-200 overflow-y-auto z-20 transition-all duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed ? 'w-72 lg:w-16' : 'w-72'
        )}>
          <nav className={cn('p-4 transition-all duration-300', sidebarCollapsed ? 'px-2 py-4' : 'md:p-6')}>
            <div className={cn('space-y-6', sidebarCollapsed ? 'space-y-4' : 'md:space-y-8')}>
              {navSections.map((section) => (
                <div key={section.title}>
                  {!sidebarCollapsed && (
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
                      {section.title}
                    </h3>
                  )}
                  <ul className="space-y-1">
                    {section.items
                      .filter((item) => !item.adminOnly || isAdmin)
                      .map((item) => {
                      const Icon = item.icon
                      const active = isActive(item.path)

                      const content = (
                        <li key={item.path}>
                          <Link
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            title={sidebarCollapsed ? item.label : undefined}
                            className={cn(
                              'flex items-center rounded-lg transition-all duration-200 group',
                              sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5',
                              active
                                ? 'bg-admin-600 text-white shadow-sm'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                            )}
                          >
                            <div className={cn('flex items-center', sidebarCollapsed ? 'justify-center' : 'space-x-3')}>
                              <Icon className={cn(
                                'h-5 w-5 shrink-0 transition-colors',
                                active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'
                              )} />
                              {!sidebarCollapsed && (
                                <span className={cn(
                                  'text-sm font-medium',
                                  active ? 'text-white' : 'text-gray-700 group-hover:text-gray-900'
                                )}>
                                  {item.label}
                                </span>
                              )}
                            </div>
                            {!sidebarCollapsed && active && (
                              <ChevronRight className="h-4 w-4 text-white shrink-0" />
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
              className={cn(
                'mt-6 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors',
                sidebarCollapsed ? 'px-2' : 'px-3'
              )}
              title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <>
                  <ChevronLeft className="h-5 w-5" />
                  <span className="text-sm font-medium">Colapsar</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Admin Content */}
        <main className={cn(
          'w-full bg-gray-50 min-h-[calc(100vh-73px)] relative transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'
        )}>
          {switchingOrganization && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-admin-600" />
            </div>
          )}
          <div className="p-4 md:p-8">
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
    </div>
  )
}
