import { PublicStoreWrapper } from '@/components/layout/PublicStoreWrapper'
import { BrandLoader } from '@/components/ui/BrandLoader'
import { PublicStore } from '@/pages/PublicStore'
import { Products } from '@/pages/Products'
import { CategoryProducts } from '@/pages/CategoryProducts'
import { ProductDetail } from '@/pages/ProductDetail'
import { Cart } from '@/pages/Cart'
import { Checkout } from '@/pages/Checkout'
import { OrderConfirmation } from '@/pages/OrderConfirmation'
import { NotFound } from '@/pages/NotFound'
import { Visitanos } from '@/pages/Visitanos'
import { PoliticaPrivacidad } from './pages/PoliticaPrivacidad'
import { TerminosCondiciones } from './pages/TerminosCondiciones'
import { useAuthStore } from '@/store/authStore'
import { useSplashGate } from '@/hooks/useSplashGate'
import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

function App() {
  const { initialize, loading } = useAuthStore()
  const showSplash = useSplashGate(loading)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (showSplash) {
    return <BrandLoader />
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
          <Route path="/visitanos" element={<Visitanos />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />

          {/* Catch-all de la tienda pública: página 404 real (noindex) en vez de
              un redirect silencioso a "/" — ver comentario en NotFound.tsx. Vive
              dentro de PublicStoreWrapper para conservar header/footer. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
