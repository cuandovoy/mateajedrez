import { PublicStoreWrapper } from '@/components/layout/PublicStoreWrapper'
import { SkeletonFullPage } from '@/components/ui/Skeleton'
import { PublicStore } from '@/pages/PublicStore'
import { Products } from '@/pages/Products'
import { CategoryProducts } from '@/pages/CategoryProducts'
import { ProductDetail } from '@/pages/ProductDetail'
import { Cart } from '@/pages/Cart'
import { Checkout } from '@/pages/Checkout'
import { OrderConfirmation } from '@/pages/OrderConfirmation'
import { PoliticaPrivacidad } from './pages/PoliticaPrivacidad'
import { TerminosCondiciones } from './pages/TerminosCondiciones'
import { useAuthStore } from '@/store/authStore'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

function App() {
  const { initialize, loading } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (loading) {
    return <SkeletonFullPage />
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Legal — páginas públicas sin autenticación, linkeadas desde el checkout y el footer */}
        <Route path="/legal/privacidad" element={<PoliticaPrivacidad />} />
        <Route path="/legal/terminos" element={<TerminosCondiciones />} />

        {/* Tienda pública — organización única, resuelta desde VITE_STORE_SLUG */}
        <Route element={<PublicStoreWrapper />}>
          <Route path="/" element={<PublicStore />} />
          <Route path="/products" element={<Products />} />
          <Route path="/categories/:categorySlug" element={<CategoryProducts />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
        </Route>

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
