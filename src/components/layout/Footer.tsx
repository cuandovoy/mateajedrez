// Legacy alias — only used by ShopLayout (currently unused layout)
export function Footer() { return null }

import { Link } from 'react-router-dom'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { usePublicCategoriesForMenu } from '@/hooks/usePublicCategories'
import { ShoppingCart, LayoutGrid } from 'lucide-react'

export function PublicStoreFooter() {
  const { organization, slug } = usePublicStore()
  const { categoriesWithSubs } = usePublicCategoriesForMenu(organization.id)

  const primaryColor = organization.primary_color || '#6366f1'
  const settings = (organization.settings as Record<string, unknown>) ?? {}
  const logoUrl = organization.logo_url || null
  const showName = (settings.store_header_show_name as boolean) !== false

  const parentCategories = categoriesWithSubs

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
            <Link to={`/${slug}`} className="flex items-center gap-3 mb-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={organization.name}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-base shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {organization.name.charAt(0).toUpperCase()}
                </div>
              )}
              {showName && (
                <span
                  className="font-semibold text-base text-gray-900"
                  style={{ fontFamily: 'var(--org-font-heading, var(--org-font-family, Poppins))' }}
                >
                  {organization.name}
                </span>
              )}
            </Link>
            <div className="flex flex-col gap-2 mt-4">
              <Link
                to={`/${slug}/products`}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <LayoutGrid className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                Ver todos los productos
              </Link>
              <Link
                to={`/${slug}/cart`}
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
                style={{ fontFamily: 'var(--org-font-heading, var(--org-font-family, Poppins))' }}
              >
                Categorías
              </h4>
              <ul className="space-y-2.5">
                {parentCategories.map((cat) => (
                  <li key={cat.value}>
                    <Link
                      to={`/${slug}/categories/${cat.value}`}
                      className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {cat.label}
                    </Link>
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <ul className="mt-1.5 ml-3 space-y-1.5 border-l-2 pl-3" style={{ borderColor: `${primaryColor}30` }}>
                        {cat.subcategories.map((sub) => (
                          <li key={sub.value}>
                            <Link
                              to={`/${slug}/categories/${sub.value}`}
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

          {/* Col 3: placeholder for future contact/social */}
          <div className="hidden lg:block" />

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
              Axiostock
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
