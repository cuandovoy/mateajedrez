import { Link } from 'react-router-dom'
import { Package, Folder, ShoppingCart, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { DashboardMetrics } from '@/components/admin/DashboardMetrics'

export function AdminDashboard() {
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
        <Link to="/admin/products">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-lg bg-admin-100 flex items-center justify-center">
                  <Package className="h-6 w-6 text-admin-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Productos</h3>
                  <p className="text-gray-600 text-sm">Gestionar productos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/categories">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-lg bg-admin-100 flex items-center justify-center">
                  <Folder className="h-6 w-6 text-admin-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Categorías</h3>
                  <p className="text-gray-600 text-sm">Gestionar categorías</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/orders">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-lg bg-admin-100 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-admin-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Órdenes</h3>
                  <p className="text-gray-600 text-sm">Ver órdenes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/users">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-lg bg-admin-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-admin-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Usuarios</h3>
                  <p className="text-gray-600 text-sm">Gestionar usuarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
