import { useCartStore } from '@/store/cartStore'
import type { Organization } from '@/types/database.types'
import { usePublicCategoriesForMenu } from '@/hooks/usePublicCategories'
import type { CategoryWithSubcategories } from '@/hooks/usePublicCategories'
import { ChevronDown, Menu, Search, ShoppingCart, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface PublicStoreHeaderProps {
  organization: Organization
  slug: string
}

interface CategoryNavItemProps {
  cat: CategoryWithSubcategories
  slug: string
  onNavigate: () => void
}

function CategoryNavItem({ cat, slug, onNavigate }: CategoryNavItemProps) {
  const hasSubcategories = cat.subcategories && cat.subcategories.length > 0

  if (!hasSubcategories) {
    return (
      <Link
        to={`/${slug}/categories/${cat.value}`}
        onClick={onNavigate}
        className="relative px-3 py-1.5 text-sm font-medium text-white/90 hover:text-white transition-colors duration-150 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-white/70 after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-250 after:origin-center"
      >
        {cat.label}
      </Link>
    )
  }

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white/90 hover:text-white transition-colors duration-150"
      >
        {cat.label}
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-180" />
      </button>

      {/* Flyout */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 invisible group-hover:visible opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 z-50 pointer-events-none group-hover:pointer-events-auto">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden min-w-[180px] w-max">
          <Link
            to={`/${slug}/categories/${cat.value}`}
            onClick={onNavigate}
            className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 border-b border-gray-100 transition-colors"
          >
            Ver todos
          </Link>
          {cat.subcategories!.map((sub) => (
            <Link
              key={sub.value}
              to={`/${slug}/categories/${sub.value}`}
              onClick={onNavigate}
              className="flex items-center px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              {sub.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

interface MobileCategoryItemProps {
  cat: CategoryWithSubcategories
  slug: string
  onNavigate: () => void
}

function MobileCategoryItem({ cat, slug, onNavigate }: MobileCategoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasSubcategories = cat.subcategories && cat.subcategories.length > 0

  return (
    <div>
      <div className="flex items-center">
        <Link
          to={`/${slug}/categories/${cat.value}`}
          onClick={onNavigate}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors rounded-lg"
        >
          {cat.label}
        </Link>
        {hasSubcategories && (
          <button
            type="button"
            onClick={() => setIsExpanded((p) => !p)}
            className="p-2.5 text-white/70 hover:text-white transition-colors"
            aria-label={isExpanded ? 'Contraer' : 'Expandir'}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>
      {hasSubcategories && isExpanded && (
        <div className="ml-4 pl-3 border-l border-white/20 mb-1">
          {cat.subcategories!.map((sub) => (
            <Link
              key={sub.value}
              to={`/${slug}/categories/${sub.value}`}
              onClick={onNavigate}
              className="block px-3 py-2 text-sm text-white/75 hover:text-white hover:bg-white/10 transition-colors rounded-lg"
            >
              {sub.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function PublicStoreHeader({ organization, slug }: PublicStoreHeaderProps) {
  const { getItemCount, fetchCart } = useCartStore()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const desktopSearchRef = useRef<HTMLInputElement>(null)
  const mobileSearchRef = useRef<HTMLInputElement>(null)

  const { categoriesWithSubs } = usePublicCategoriesForMenu(organization.id)

  useEffect(() => {
    fetchCart(organization.id)
  }, [fetchCart, organization.id])

  const closeAll = () => {
    setIsMobileMenuOpen(false)
    setIsSearchOpen(false)
  }

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = searchQuery.trim()
    navigate(q ? `/${slug}/products?search=${encodeURIComponent(q)}` : `/${slug}/products`)
    closeAll()
  }

  useEffect(() => {
    if (isSearchOpen) {
      desktopSearchRef.current?.focus()
    }
  }, [isSearchOpen])

  const settings = (organization.settings as Record<string, unknown>) ?? {}
  const minimalLogoUrl =
    typeof settings.store_logo_minimal_url === 'string' ? settings.store_logo_minimal_url : null
  const desktopLogoUrl = organization.logo_url || null
  const mobileLogoUrl = minimalLogoUrl || desktopLogoUrl
  const primaryColor = organization.primary_color || '#6366f1'

  const showName = (settings.store_header_show_name as boolean) !== false
  const logoSizeKey = (settings.store_header_logo_size as string) ?? 'md'
  const logoSizeClass = { sm: 'h-10 w-10', md: 'h-16 w-16', lg: 'h-20 w-20' }[logoSizeKey] ?? 'h-16 w-16'
  const logoSizeClassMobile = { sm: 'h-8 w-8', md: 'h-12 w-12', lg: 'h-14 w-14' }[logoSizeKey] ?? 'h-12 w-12'

  const itemCount = getItemCount()

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        backgroundColor: `${primaryColor}ee`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderColor: `${primaryColor}33`,
      }}
    >
      <div className="container-custom">

        {/* ─── Desktop ─── */}
        <div className="hidden lg:flex items-center gap-6 h-16 my-2">

          {/* Logo */}
          <Link to={`/${slug}`} className="flex items-center gap-3 shrink-0">
            {desktopLogoUrl ? (
              <img src={desktopLogoUrl} alt={organization.name} className={`${logoSizeClass} object-contain`} />
            ) : (
              <div className={`${logoSizeClass} flex items-center justify-center bg-white/20 rounded-lg`}>
                <span className="text-white font-bold text-lg">{organization.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            {showName && (
              <span className="text-white font-semibold text-lg leading-tight">{organization.name}</span>
            )}
          </Link>

          {/* Category nav */}
          {categoriesWithSubs.length > 0 && (
            <nav className="flex-1 flex items-center justify-center gap-0.5">
              {categoriesWithSubs.map((cat) => (
                <CategoryNavItem key={cat.value} cat={cat} slug={slug} onNavigate={closeAll} />
              ))}
            </nav>
          )}
          {categoriesWithSubs.length === 0 && <div className="flex-1" />}

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Expandable search */}
            <div
              className={`flex items-center bg-white/15 hover:bg-white/20 rounded-full transition-all duration-300 overflow-hidden ${
                isSearchOpen ? 'w-52 pr-1 pl-3' : 'w-9 h-9 justify-center'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsSearchOpen((p) => !p)}
                className={`shrink-0 text-white/80 hover:text-white transition-colors ${isSearchOpen ? 'py-2' : 'w-full h-full flex items-center justify-center'}`}
                aria-label={isSearchOpen ? 'Cerrar búsqueda' : 'Abrir búsqueda'}
              >
                {isSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>
              {isSearchOpen && (
                <form onSubmit={handleSearch} className="flex-1 flex items-center">
                  <input
                    ref={desktopSearchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar productos…"
                    className="bg-transparent text-white placeholder-white/50 text-sm outline-none ml-2 w-full"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-white/50 hover:text-white shrink-0 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </form>
              )}
            </div>

            {/* Cart */}
            <Link
              to={`/${slug}/cart`}
              onClick={closeAll}
              className="relative p-2 text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/15"
              aria-label="Ver carrito"
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center leading-none px-1 tabular-nums">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* ─── Mobile ─── */}
        <div className="lg:hidden flex items-center h-14">

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => { setIsMobileMenuOpen((p) => !p); setIsSearchOpen(false) }}
            className="p-2 -ml-1 text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            aria-label="Menú"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Center logo */}
          <Link to={`/${slug}`} onClick={closeAll} className="flex-1 flex justify-center items-center gap-2">
            {mobileLogoUrl ? (
              <img src={mobileLogoUrl} alt={organization.name} className={`${logoSizeClassMobile} object-contain`} />
            ) : (
              <div className={`${logoSizeClassMobile} flex items-center justify-center bg-white/20 rounded-lg`}>
                <span className="text-white font-bold">{organization.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            {showName && <span className="text-white font-semibold text-sm">{organization.name}</span>}
          </Link>

          {/* Right */}
          <div className="flex items-center gap-1 -mr-1">
            <button
              type="button"
              onClick={() => { setIsSearchOpen((p) => !p); setIsMobileMenuOpen(false) }}
              className="p-2 text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              aria-label="Buscar"
            >
              <Search className="h-5 w-5" />
            </button>
            <Link
              to={`/${slug}/cart`}
              onClick={closeAll}
              className="relative p-2 text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              aria-label="Carrito"
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center leading-none px-1 tabular-nums">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* ─── Mobile search panel ─── */}
        {isSearchOpen && (
          <div className="lg:hidden border-t px-3 py-3" style={{ borderColor: `${primaryColor}33` }}>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-white/15 focus-within:bg-white/25 rounded-full px-4 py-2 transition-colors">
                <Search className="h-4 w-4 text-white/60 shrink-0" />
                <input
                  ref={mobileSearchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar productos…"
                  className="bg-transparent text-white placeholder-white/50 text-sm outline-none ml-2 flex-1"
                  autoFocus
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="text-white/50 hover:text-white ml-1 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-white/20 hover:bg-white/30 rounded-full transition-colors shrink-0"
              >
                Buscar
              </button>
            </form>
          </div>
        )}

        {/* ─── Mobile menu panel ─── */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t" style={{ borderColor: `${primaryColor}33` }}>
            {categoriesWithSubs.length > 0 ? (
              <div className="py-2">
                <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-widest text-white/50">
                  Categorías
                </p>
                {categoriesWithSubs.map((cat) => (
                  <MobileCategoryItem key={cat.value} cat={cat} slug={slug} onNavigate={closeAll} />
                ))}
              </div>
            ) : (
              <div className="py-4 px-4 text-sm text-white/50 text-center">
                No hay categorías disponibles
              </div>
            )}
          </div>
        )}

      </div>
    </header>
  )
}
