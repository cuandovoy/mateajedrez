import { Link } from 'react-router-dom'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { usePublicCategoriesForMenu } from '@/hooks/usePublicCategories'
import { ShoppingCart, LayoutGrid, Instagram, Facebook, MessageCircle } from 'lucide-react'
import logoWordmark from '@/brand/logo-principal-fondo1.png'

export function PublicStoreFooter() {
  const { organization } = usePublicStore()
  const { categoriesWithSubs } = usePublicCategoriesForMenu(organization.id)

  // Marca hardcodeada: theming dinámico por organización fue removido
  // (single-tenant fork, org.branding/settings quedan permanentemente NULL).
  const primaryColor = '#46362B'

  const parentCategories = categoriesWithSubs

  // Redes sociales configuradas por variable de entorno (single-tenant fork).
  const instagramUrl = (import.meta.env.VITE_SOCIAL_INSTAGRAM ?? '').trim()
  const facebookUrl = (import.meta.env.VITE_SOCIAL_FACEBOOK ?? '').trim()
  const whatsappNumber = (import.meta.env.VITE_SOCIAL_WHATSAPP ?? '').trim()
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}` : ''
  const hasSocialLinks = Boolean(instagramUrl || facebookUrl || whatsappUrl)

  return (
    <footer
      className="mt-16 border-t"
      style={{
        backgroundColor: `${primaryColor}10`,
        borderColor: `${primaryColor}22`,
      }}
    >
      <div className="container-custom py-10 md:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">

          {/* Col 1: Brand */}
          <div>
            <Link to="/" className="flex items-center gap-3 mb-4">
              <img
                src={logoWordmark}
                alt={organization.name}
                className="h-10 w-10 rounded-lg object-contain"
              />
              <span
                className="font-semibold text-base text-gray-900"
                style={{ fontFamily: 'var(--org-font-heading, var(--org-font-family, Cambria))', letterSpacing: '0.05em' }}
              >
                {organization.name}
              </span>
            </Link>
            <div className="flex flex-col gap-2 mt-4">
              <Link
                to="/products"
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <LayoutGrid className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                Ver todos los productos
              </Link>
              <Link
                to="/cart"
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <ShoppingCart className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                Mi carrito
              </Link>
            </div>
          </div>

          {/* Col 2: Categories */}
          {parentCategories.length > 0 && (
            <div>
              <h4
                className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4"
                style={{ fontFamily: 'var(--org-font-heading, var(--org-font-family, Cambria))', letterSpacing: '0.05em' }}
              >
                Categorías
              </h4>
              <ul className="space-y-2.5">
                {parentCategories.map((cat) => (
                  <li key={cat.value}>
                    <Link
                      to={`/categories/${cat.value}`}
                      className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {cat.label}
                    </Link>
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <ul className="mt-1.5 ml-3 space-y-1.5 border-l-2 pl-3" style={{ borderColor: `${primaryColor}30` }}>
                        {cat.subcategories.map((sub) => (
                          <li key={sub.value}>
                            <Link
                              to={`/categories/${sub.value}`}
                              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
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
              <h4
                className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4"
                style={{ fontFamily: 'var(--org-font-heading, var(--org-font-family, Cambria))', letterSpacing: '0.05em' }}
              >
                Seguinos
              </h4>
              <div className="flex items-center gap-3">
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="flex h-9 w-9 items-center justify-center rounded-full border transition-opacity hover:opacity-70"
                    style={{ borderColor: `${primaryColor}30`, color: primaryColor }}
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                    className="flex h-9 w-9 items-center justify-center rounded-full border transition-opacity hover:opacity-70"
                    style={{ borderColor: `${primaryColor}30`, color: primaryColor }}
                  >
                    <Facebook className="h-4 w-4" />
                  </a>
                )}
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="flex h-9 w-9 items-center justify-center rounded-full border transition-opacity hover:opacity-70"
                    style={{ borderColor: `${primaryColor}30`, color: primaryColor }}
                  >
                    <MessageCircle className="h-4 w-4" />
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
      <div
        className="border-t"
        style={{ borderColor: `${primaryColor}18` }}
      >
        <div className="container-custom py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} {organization.name}. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-400">
            Powered by{' '}
            <a
              href="https://ciceridev.vercel.app/home"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: primaryColor }}
            >
              Ciceridev
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
