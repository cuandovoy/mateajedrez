import { useEffect } from 'react'
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
  Wallet
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useLocation } from 'react-router-dom'

export function AdminLayout() {
  const { user, isAdmin, signOut, loading } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

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

  const adminNavItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/products', label: 'Productos', icon: Package },
    { path: '/admin/categories', label: 'Categorías', icon: Folder },
    { path: '/admin/suppliers', label: 'Proveedores', icon: Truck },
    { path: '/admin/branches', label: 'Sucursales', icon: Building2 },
    { path: '/admin/cash-register', label: 'Caja', icon: Wallet },
    { path: '/admin/orders', label: 'Órdenes', icon: ShoppingCart },
    { path: '/admin/reports/sales', label: 'Reportes → Ventas', icon: BarChart3 },
    { path: '/admin/users', label: 'Usuarios', icon: Users },
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
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/admin" className="flex items-center space-x-2">
                <LayoutDashboard className="h-6 w-6 text-admin-600" />
                <span className="text-xl font-bold text-gray-900">Admin Panel</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="outline" size="sm">
                  <Store className="h-4 w-4 mr-2" />
                  Ver Tienda
                </Button>
              </Link>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>{user.email}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Admin Sidebar */}
        <aside className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-[calc(100vh-73px)] sticky top-[73px]">
          <nav className="p-4">
            <ul className="space-y-2">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                        active
                          ? 'bg-admin-50 text-admin-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Admin Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
