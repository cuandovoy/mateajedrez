import { PublicStoreWrapper } from '@/components/layout/PublicStoreWrapper'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import { BrandLoader } from '@/components/ui/BrandLoader'
import { PublicStore } from '@/pages/PublicStore'
import { Products } from '@/pages/Products'
import { CategoryProducts } from '@/pages/CategoryProducts'
import { ProductDetail } from '@/pages/ProductDetail'
import { Skeleton } from '@/components/ui/Skeleton'
import { lazyWithRetry } from '@/lib/lazyWithRetry'
import { useAuthStore } from '@/store/authStore'
import { useSplashGate } from '@/hooks/useSplashGate'
import { Suspense, useEffect } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

// Landing y páginas de producto/categoría (Home, Products, CategoryProducts,
// ProductDetail) quedan eager: son la entrada y los links compartidos, no deben
// pagar un round trip extra. El resto se carga bajo demanda.
const Cart = lazyWithRetry(() => import('@/pages/Cart'), 'Cart')
const Checkout = lazyWithRetry(() => import('@/pages/Checkout'), 'Checkout')
const OrderConfirmation = lazyWithRetry(() => import('@/pages/OrderConfirmation'), 'OrderConfirmation')
const NotFound = lazyWithRetry(() => import('@/pages/NotFound'), 'NotFound')
const Visitanos = lazyWithRetry(() => import('@/pages/Visitanos'), 'Visitanos')
const PoliticaPrivacidad = lazyWithRetry(() => import('@/pages/PoliticaPrivacidad'), 'PoliticaPrivacidad')
const TerminosCondiciones = lazyWithRetry(() => import('@/pages/TerminosCondiciones'), 'TerminosCondiciones')

function RouteFallback() {
  return (
    <div className="container-custom py-8 space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

// Suspense por ruta (no uno global): el header/footer de PublicStoreWrapper siguen
// montados mientras llega el chunk de la página.
function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

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
      <ScrollToTop />
      <Routes>
        {/* Legal — páginas públicas sin autenticación, linkeadas desde el checkout y el footer */}
        <Route path="/legal/privacidad" element={lazyRoute(<PoliticaPrivacidad />)} />
        <Route path="/legal/terminos" element={lazyRoute(<TerminosCondiciones />)} />

        {/* Tienda pública — organización única, resuelta desde VITE_STORE_SLUG */}
        <Route element={<PublicStoreWrapper />}>
          <Route path="/" element={<PublicStore />} />
          <Route path="/products" element={<Products />} />
          <Route path="/categories/:categorySlug" element={<CategoryProducts />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/visitanos" element={lazyRoute(<Visitanos />)} />
          <Route path="/cart" element={lazyRoute(<Cart />)} />
          <Route path="/checkout" element={lazyRoute(<Checkout />)} />
          <Route path="/order-confirmation/:orderId" element={lazyRoute(<OrderConfirmation />)} />

          {/* Catch-all de la tienda pública: página 404 real (noindex) en vez de
              un redirect silencioso a "/" — ver comentario en NotFound.tsx. Vive
              dentro de PublicStoreWrapper para conservar header/footer. */}
          <Route path="*" element={lazyRoute(<NotFound />)} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
