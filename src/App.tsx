import { AdminLayout } from '@/components/layout/AdminLayout'
import { Login } from '@/pages/Login'
import { AdminAuditLogs } from '@/pages/admin/AdminAuditLogs'
import { AdminBranches } from '@/pages/admin/AdminBranches'
import { AdminCashRegister } from '@/pages/admin/AdminCashRegister'
import { AdminCategories } from '@/pages/admin/AdminCategories'
import { AdminCustomers } from '@/pages/admin/AdminCustomers'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { AdminInventory } from '@/pages/admin/AdminInventory'
import { AdminOrderDetail } from '@/pages/admin/AdminOrderDetail'
import { AdminOrders } from '@/pages/admin/AdminOrders'
import { AdminProducts } from '@/pages/admin/AdminProducts'
import { AdminRolesPermissions } from '@/pages/admin/AdminRolesPermissions'
import { AdminSales } from '@/pages/admin/AdminSales'
import { AdminSuppliers } from '@/pages/admin/AdminSuppliers'
import { AdminTransfers } from '@/pages/admin/AdminTransfers'
import { AdminOrganizations } from '@/pages/admin/AdminOrganizations'
import { AdminPlans } from '@/pages/admin/AdminPlans'
import { AdminUsers } from '@/pages/admin/AdminUsers'
import { useAuthStore } from '@/store/authStore'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

function App() {
  const { initialize, loading } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200"></div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Login (sin auth) */}
        <Route path="/login" element={<Login />} />

        {/* Panel Admin en ruta raíz */}
        <Route element={<AdminLayout />}>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/products" element={<AdminProducts />} />
          <Route path="/categories" element={<AdminCategories />} />
          <Route path="/suppliers" element={<AdminSuppliers />} />
          <Route path="/orders" element={<AdminOrders />} />
          <Route path="/orders/:id" element={<AdminOrderDetail />} />
          <Route path="/customers" element={<AdminCustomers />} />
          <Route path="/reports/sales" element={<AdminSales />} />
          <Route path="/reports/audit-logs" element={<AdminAuditLogs />} />
          <Route path="/branches" element={<AdminBranches />} />
          <Route path="/inventory" element={<AdminInventory />} />
          <Route path="/transfers" element={<AdminTransfers />} />
          <Route path="/cash-register" element={<AdminCashRegister />} />
          <Route path="/organizations" element={<AdminOrganizations />} />
          <Route path="/planes" element={<AdminPlans />} />
          <Route path="/users" element={<AdminUsers />} />
          <Route path="/roles-permissions" element={<AdminRolesPermissions />} />
        </Route>

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
