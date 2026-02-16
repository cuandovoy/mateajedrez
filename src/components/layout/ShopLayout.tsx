import { MessageCircle } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { Footer } from './Footer'
import { Header } from './Header'
import { ToastContainer } from './ToastContainer'

export function ShopLayout() {
  const whatsappNumber = '59898257909'
  const whatsappMessage = encodeURIComponent('¡Hola! Me gustaría obtener más información sobre sus productos.')
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`

  return (
    <div className="min-h-screen flex flex-col">
      {/* Promotional Banner */}
      <div className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2.5 md:py-3 shadow-md">
        <div className="container-custom">
          <div className="flex items-center justify-center gap-2 md:gap-3">
            <p className="text-xs md:text-sm font-semibold text-center">
              🚚 Envío gratis en pedidos mayores a $2000 UY!
            </p>
          </div>
        </div>
      </div>
      
      <Header />
      <main className="flex-grow bg-primary-50">
        <Outlet />
      </main>
      <Footer />
      <ToastContainer />
      
      {/* WhatsApp Floating Button - min 44x44px touch target */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center justify-center min-h-[48px] min-w-[48px] w-12 h-12 sm:w-14 sm:h-14 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500"
        aria-label="Contactar por WhatsApp"
      >
        <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
      </a>
    </div>
  )
}
