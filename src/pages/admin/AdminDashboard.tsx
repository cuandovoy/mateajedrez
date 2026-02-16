import { Link } from 'react-router-dom'
import { Package, Folder, ShoppingCart, Users, Building2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { DashboardMetrics } from '@/components/admin/DashboardMetrics'
import { useAuthStore } from '@/store/authStore'

export function AdminDashboard() {
  const { isAdmin } = useAuthStore()
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-600 mt-2">Gestiona tu tienda desde aquí</p>
      </div>

      {/* Métricas del Dashboard */}
      <DashboardMetrics />
      
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Accesos Rápidos</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/products">
          <Card className="hover:shadow-lg hover:-translate-y-0.5 hover:border-admin-200 transition-all duration-200 cursor-pointer h-full border-2 border-transparent">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-lg bg-admin-100 flex items-center justify-center">
                  <Package className="h-6 w-6 text-admin-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Productos</h3>
                  <p className="text-gray-700 text-sm">Gestionar productos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/categories">
          <Card className="hover:shadow-lg hover:-translate-y-0.5 hover:border-admin-200 transition-all duration-200 cursor-pointer h-full border-2 border-transparent">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-lg bg-admin-100 flex items-center justify-center">
                  <Folder className="h-6 w-6 text-admin-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Categorías</h3>
                  <p className="text-gray-700 text-sm">Gestionar categorías</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/orders">
          <Card className="hover:shadow-lg hover:-translate-y-0.5 hover:border-admin-200 transition-all duration-200 cursor-pointer h-full border-2 border-transparent">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-lg bg-admin-100 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-admin-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Órdenes</h3>
                  <p className="text-gray-700 text-sm">Ver órdenes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {isAdmin && (
          <>
            <Link to="/organizations">
              <Card className="hover:shadow-lg hover:-translate-y-0.5 hover:border-admin-200 transition-all duration-200 cursor-pointer h-full border-2 border-transparent">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-lg bg-admin-100 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-admin-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Organizaciones</h3>
                      <p className="text-gray-700 text-sm">Administrar organizaciones</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/users">
              <Card className="hover:shadow-lg hover:-translate-y-0.5 hover:border-admin-200 transition-all duration-200 cursor-pointer h-full border-2 border-transparent">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-lg bg-admin-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-admin-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Usuarios</h3>
                      <p className="text-gray-700 text-sm">Gestionar usuarios</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
