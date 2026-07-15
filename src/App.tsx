import { AdminLayout } from '@/components/layout/AdminLayout'
import { POSLayout } from '@/components/layout/POSLayout'
import { PublicStoreWrapper } from '@/components/layout/PublicStoreWrapper'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { Login } from '@/pages/Login'
import { ResetPassword } from '@/pages/ResetPassword'
import { PublicStore } from '@/pages/PublicStore'
import { Products } from '@/pages/Products'
import { CategoryProducts } from '@/pages/CategoryProducts'
import { ProductDetail } from '@/pages/ProductDetail'
import { Cart } from '@/pages/Cart'
import { Checkout } from '@/pages/Checkout'
import { OrderConfirmation } from '@/pages/OrderConfirmation'
import { AdminAuditLogs } from '@/pages/admin/AdminAuditLogs'
import { AdminBranches } from '@/pages/admin/AdminBranches'
import { AdminCashRegister } from '@/pages/admin/AdminCashRegister'
import { AdminCategories } from '@/pages/admin/AdminCategories'
import { AdminCustomerReports } from '@/pages/admin/AdminCustomerReports'
import { AdminCustomers } from '@/pages/admin/AdminCustomers'
import { AdminCustomerDetail } from '@/pages/admin/AdminCustomerDetail'
import { AdminProductDetail } from '@/pages/admin/AdminProductDetail'
import { AdminDebtors } from '@/pages/admin/AdminDebtors'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { AdminExpenses } from '@/pages/admin/AdminExpenses'
import { AdminFinancialReports } from '@/pages/admin/AdminFinancialReports'
import { AdminInventory } from '@/pages/admin/AdminInventory'
import { AdminReposicion } from '@/pages/admin/AdminReposicion'
import { AdminInventoryReports } from '@/pages/admin/AdminInventoryReports'
import { AdminLots } from '@/pages/admin/AdminLots'
import { AdminOrderDetail } from '@/pages/admin/AdminOrderDetail'
import { AdminOrders } from '@/pages/admin/AdminOrders'
import { AdminBillerComprobantes } from '@/pages/admin/AdminBillerComprobantes'
import { AdminProducts } from '@/pages/admin/AdminProducts'
import { AdminRolesPermissions } from '@/pages/admin/AdminRolesPermissions'
import { AdminStoreStats } from '@/pages/admin/AdminStoreStats'
import { AdminSales } from '@/pages/admin/AdminSales'
import { AdminSuppliers } from '@/pages/admin/AdminSuppliers'
import { AdminTransfers } from '@/pages/admin/AdminTransfers'
import { AdminOrganizations } from '@/pages/admin/AdminOrganizations'
import { AdminPlans } from '@/pages/admin/AdminPlans'
import { AdminUsers } from '@/pages/admin/AdminUsers'
import { useAuthStore } from '@/store/authStore'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { Landing } from './pages/Landing'
import { LandingFacturacion } from './pages/LandingFacturacion'
import { PoliticaPrivacidad } from './pages/PoliticaPrivacidad'
import { TerminosCondiciones } from './pages/TerminosCondiciones'
import { POSHome } from '@/pages/pos/POSHome'
import { POSSale } from '@/pages/pos/POSSale'

function ReportsRouteGuard({ children }: { children: JSX.Element }) {
  const { canUseFeature } = usePlanLimits()
  const location = useLocation()

  if (!canUseFeature('advanced_reports')) {
    return <Navigate to={`/planes?from=${encodeURIComponent(location.pathname)}`} replace />
  }

  return children
}

function OrgFeatureRouteGuard({
  feature,
  children,
}: {
  feature: 'branches_enabled' | 'transfers_enabled'
  children: JSX.Element
}) {
  const settings = useOrgSettings()

  if (settings[feature] === false) {
    return <Navigate to="/" replace />
  }

  return children
}

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
        {/* Auth (sin sesión requerida) */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/landing/app" element={<Landing />} />
        <Route path="/facturacion-electronica" element={<LandingFacturacion />} />

        {/* Legal — páginas públicas sin autenticación */}
        <Route path="/legal/privacidad" element={<PoliticaPrivacidad />} />
        <Route path="/legal/terminos" element={<TerminosCondiciones />} />

        {/* Rutas públicas de tienda por slug */}
        <Route element={<PublicStoreWrapper />}>
          <Route path="/:slug" element={<PublicStore />} />
          <Route path="/:slug/products" element={<Products />} />
          <Route path="/:slug/categories/:categorySlug" element={<CategoryProducts />} />
          <Route path="/:slug/product/:id" element={<ProductDetail />} />
          <Route path="/:slug/cart" element={<Cart />} />
          <Route path="/:slug/checkout" element={<Checkout />} />
          <Route path="/:slug/order-confirmation/:orderId" element={<OrderConfirmation />} />
        </Route>

        {/* Panel Admin en ruta raíz */}
        <Route element={<AdminLayout />}>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/products" element={<AdminProducts />} />
          <Route path="/products/:id" element={<AdminProductDetail />} />
          <Route path="/categories" element={<AdminCategories />} />
          <Route path="/suppliers" element={<AdminSuppliers />} />
          <Route path="/orders" element={<AdminOrders />} />
          <Route path="/orders/:id" element={<AdminOrderDetail />} />
          <Route path="/billing/comprobantes" element={<AdminBillerComprobantes />} />
          <Route path="/customers" element={<AdminCustomers />} />
          <Route path="/customers/deudores" element={<AdminDebtors />} />
          <Route path="/customers/:id" element={<AdminCustomerDetail />} />
          <Route path="/expenses" element={<AdminExpenses />} />
          <Route path="/reports/sales" element={<ReportsRouteGuard><AdminSales /></ReportsRouteGuard>} />
          <Route path="/reports/financial" element={<ReportsRouteGuard><AdminFinancialReports /></ReportsRouteGuard>} />
          <Route path="/reports/audit-logs" element={<ReportsRouteGuard><AdminAuditLogs /></ReportsRouteGuard>} />
          <Route path="/reports/customers" element={<ReportsRouteGuard><AdminCustomerReports /></ReportsRouteGuard>} />
          <Route path="/reports/inventory" element={<ReportsRouteGuard><AdminInventoryReports /></ReportsRouteGuard>} />
          <Route path="/branches" element={<OrgFeatureRouteGuard feature="branches_enabled"><AdminBranches /></OrgFeatureRouteGuard>} />
          <Route path="/inventory" element={<AdminInventory />} />
          <Route path="/inventory/lots" element={<AdminLots />} />
          <Route path="/reposicion" element={<AdminReposicion />} />
          <Route path="/transfers" element={<OrgFeatureRouteGuard feature="transfers_enabled"><AdminTransfers /></OrgFeatureRouteGuard>} />
          <Route path="/cash-register" element={<AdminCashRegister />} />
          <Route path="/organizations" element={<AdminOrganizations />} />
          <Route path="/planes" element={<AdminPlans />} />
          <Route path="/users" element={<AdminUsers />} />
          <Route path="/roles-permissions" element={<AdminRolesPermissions />} />
          <Route path="/store/stats" element={<AdminStoreStats />} />
        </Route>

        {/* POS móvil — layout sin sidebar */}
        <Route element={<POSLayout />}>
          <Route path="/pos" element={<POSHome />} />
          <Route path="/pos/sale/:branchId" element={<POSSale />} />
        </Route>

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
