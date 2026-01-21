import { AdminLayout } from '@/components/layout/AdminLayout'
import { ShopLayout } from '@/components/layout/ShopLayout'
import { Cart } from '@/pages/Cart'
import { CategoryProducts } from '@/pages/CategoryProducts'
import { Checkout } from '@/pages/Checkout'
import { Home } from '@/pages/Home'
import { Login } from '@/pages/Login'
import { OrderConfirmation } from '@/pages/OrderConfirmation'
import { ProductDetail } from '@/pages/ProductDetail'
import { Products } from '@/pages/Products'
import { AdminCategories } from '@/pages/admin/AdminCategories'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { AdminProducts } from '@/pages/admin/AdminProducts'
import { AdminOrders } from '@/pages/admin/AdminOrders'
import { AdminOrderDetail } from '@/pages/admin/AdminOrderDetail'
import { AdminUsers } from '@/pages/admin/AdminUsers'
import { AdminSuppliers } from '@/pages/admin/AdminSuppliers'
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
        {/* Rutas de la tienda (ShopLayout) */}
        <Route element={<ShopLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          {/* <Route path="/register" element={<Register />} /> */}
          <Route path="/cart" element={<Cart />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders/:id" element={<OrderConfirmation />} />
          <Route path="/:categorySlug" element={<CategoryProducts />} />
        </Route>

        {/* Rutas de administración (AdminLayout) */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/suppliers" element={<AdminSuppliers />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Route>

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
