import { Link, useLocation } from 'react-router-dom'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { usePublicCategoriesForMenu } from '@/hooks/usePublicCategories'
import { ShoppingCart, LayoutGrid, Instagram, Facebook, MessageCircle, MapPin, Truck, RotateCcw, CreditCard } from 'lucide-react'
import { buildWhatsappUrl } from '@/lib/storeLocation'
import logoSquare from '@/brand/mates-ajedrez-logo-square.jpeg'

export function PublicStoreFooter() {
  const { organization } = usePublicStore()
  const { pathname } = useLocation()
  const { categoriesWithSubs } = usePublicCategoriesForMenu(organization.id)

  const parentCategories = categoriesWithSubs

  // Redes sociales configuradas por variable de entorno (single-tenant fork).
  const instagramUrl = (import.meta.env.VITE_SOCIAL_INSTAGRAM ?? '').trim()
  const facebookUrl = (import.meta.env.VITE_SOCIAL_FACEBOOK ?? '').trim()
  const whatsappUrl = buildWhatsappUrl(import.meta.env.VITE_SOCIAL_WHATSAPP)
  const hasSocialLinks = Boolean(instagramUrl || facebookUrl || whatsappUrl)

  const columnHeading = 'font-heading text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-algarrobo mb-4 pb-3 border-b border-brand-crema/20'
  const linkClass = 'text-sm text-brand-crema/75 hover:text-brand-crema transition-colors'
  const socialClass = 'flex h-11 w-11 items-center justify-center rounded-full border border-brand-crema/30 text-brand-crema transition-colors hover:bg-brand-crema hover:text-brand-tinta'

  return (
    <footer className={`${pathname === '/' ? '' : 'mt-16'} bg-brand-tinta text-brand-crema`}>
      <div className="container-custom py-12 md:py-16">
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${parentCategories.length > 0 ? 'lg:grid-cols-3' : ''} gap-10 lg:gap-14`}>

          {/* Col 1: Brand */}
          <div>
            <Link to="/" className="flex items-center gap-4 mb-5">
              <img
                src={logoSquare}
                alt="Mates Ajedrez"
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover ring-1 ring-brand-crema/30"
              />
              <span className="font-heading font-light uppercase text-lg tracking-[0.2em] text-brand-crema">
                Mates Ajedrez
              </span>
            </Link>
            <p className="font-heading font-light text-sm tracking-[0.08em] text-brand-crema/80 mb-5">
              MATE, luego existo
            </p>
            <div className="flex flex-col gap-2.5">
              <Link to="/products" className={`flex items-center gap-2 ${linkClass}`}>
                <LayoutGrid className="h-4 w-4 shrink-0 text-brand-algarrobo" strokeWidth={1.5} />
                Ver todos los productos
              </Link>
              <Link to="/cart" className={`flex items-center gap-2 ${linkClass}`}>
                <ShoppingCart className="h-4 w-4 shrink-0 text-brand-algarrobo" strokeWidth={1.5} />
                Mi carrito
              </Link>
              <Link to="/visitanos" className={`flex items-center gap-2 ${linkClass}`}>
                <MapPin className="h-4 w-4 shrink-0 text-brand-algarrobo" strokeWidth={1.5} />
                Visitanos
              </Link>
            </div>

            {/* Trust signals — texto genérico, sin plazos/costos aún no
                confirmados (ver placeholders en TerminosCondiciones.tsx) */}
            <div className="flex flex-col gap-2.5 mt-6 pt-6 border-t border-brand-crema/20">
              <div className="flex items-center gap-2 text-xs text-brand-crema/70">
                <Truck className="h-4 w-4 shrink-0 text-brand-algarrobo" strokeWidth={1.5} />
                Coordinamos tu envío
              </div>
              <div className="flex items-center gap-2 text-xs text-brand-crema/70">
                <RotateCcw className="h-4 w-4 shrink-0 text-brand-algarrobo" strokeWidth={1.5} />
                Cambios dentro de los primeros días
              </div>
              <div className="flex items-center gap-2 text-xs text-brand-crema/70">
                <CreditCard className="h-4 w-4 shrink-0 text-brand-algarrobo" strokeWidth={1.5} />
                Múltiples medios de pago
              </div>
            </div>
          </div>

          {/* Col 2: Categories */}
          {parentCategories.length > 0 && (
            <div>
              <h2 className={columnHeading}>Categorías</h2>
              <ul className="space-y-2.5">
                {parentCategories.map((cat) => (
                  <li key={cat.value}>
                    <Link to={`/categories/${cat.value}`} className={linkClass}>
                      {cat.label}
                    </Link>
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <ul className="mt-1.5 ml-3 space-y-1.5 border-l border-brand-crema/20 pl-3">
                        {cat.subcategories.map((sub) => (
                          <li key={sub.value}>
                            <Link
                              to={`/categories/${sub.value}`}
                              className="text-xs text-brand-crema/60 hover:text-brand-crema transition-colors"
                            >
                              {sub.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Col 3: redes sociales */}
          {hasSocialLinks ? (
            <div>
              <h2 className={columnHeading}>Seguinos</h2>
              <div className="flex items-center gap-3">
                {instagramUrl && (
                  <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={socialClass}>
                    <Instagram className="h-4 w-4" strokeWidth={1.5} />
                  </a>
                )}
                {facebookUrl && (
                  <a href={facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={socialClass}>
                    <Facebook className="h-4 w-4" strokeWidth={1.5} />
                  </a>
                )}
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={socialClass}>
                    <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}

        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-brand-crema/20">
        <div className="container-custom py-4 flex flex-col lg:flex-row items-center justify-between gap-3">
          <p className="text-xs text-brand-crema/60">
            © {new Date().getFullYear()} {organization.name}. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/legal/privacidad" className="text-xs text-brand-crema/60 hover:text-brand-crema hover:underline transition-colors">
              Política de Privacidad
            </Link>
            <Link to="/legal/terminos" className="text-xs text-brand-crema/60 hover:text-brand-crema hover:underline transition-colors">
              Términos y Condiciones
            </Link>
          </div>
          <p className="text-xs text-brand-crema/60">
            Powered by{' '}
            <a
              href="https://ciceridev.vercel.app/home"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-algarrobo hover:underline"
            >
              Ciceridev
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
