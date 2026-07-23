import { useCartStore } from '@/store/cartStore'
import type { Organization } from '@/types/database.types'
import { usePublicCategoriesForMenu } from '@/hooks/usePublicCategories'
import type { CategoryWithSubcategories } from '@/hooks/usePublicCategories'
import { ChevronDown, Menu, Search, ShoppingCart, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import logoIsotipo from '@/brand/isotipo-cropped.png'

interface PublicStoreHeaderProps {
  organization: Organization
}

interface CategoryMenuProps {
  categories: CategoryWithSubcategories[]
  onNavigate: () => void
}

function CategoryMenu({ categories, onNavigate }: CategoryMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleLinkClick = () => {
    setIsOpen(false)
    onNavigate()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-base font-medium text-[color-mix(in_srgb,var(--org-primary-ink,white)_90%,transparent)] hover:text-[var(--org-primary-ink,white)] hover:bg-white/10 transition-colors duration-150"
      >
        Categorías
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-40">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 p-3 grid grid-cols-2 gap-x-8 gap-y-0.5 w-max max-w-md">
            {categories.map((cat) => (
              <div key={cat.value} className="py-1.5">
                <Link
                  to={`/categories/${cat.value}`}
                  onClick={handleLinkClick}
                  className="block px-2 py-1 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 hover:text-gray-900 transition-colors whitespace-nowrap"
                >
                  {cat.label}
                </Link>
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <div className="mt-0.5">
                    {cat.subcategories.map((sub) => (
                      <Link
                        key={sub.value}
                        to={`/categories/${sub.value}`}
                        onClick={handleLinkClick}
                        className="block px-2 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors whitespace-nowrap"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface MobileCategoryItemProps {
  cat: CategoryWithSubcategories
  onNavigate: () => void
}

function MobileCategoryItem({ cat, onNavigate }: MobileCategoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasSubcategories = cat.subcategories && cat.subcategories.length > 0

  return (
    <div>
      <div className="flex items-center">
        <Link
          to={`/categories/${cat.value}`}
          onClick={onNavigate}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--org-primary-ink,white)] hover:bg-white/10 transition-colors rounded-lg"
        >
          {cat.label}
        </Link>
        {hasSubcategories && (
          <button
            type="button"
            onClick={() => setIsExpanded((p) => !p)}
            className="p-2.5 text-[color-mix(in_srgb,var(--org-primary-ink,white)_70%,transparent)] hover:text-[var(--org-primary-ink,white)] transition-colors"
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
              to={`/categories/${sub.value}`}
              onClick={onNavigate}
              className="block px-3 py-2 text-sm text-[color-mix(in_srgb,var(--org-primary-ink,white)_75%,transparent)] hover:text-[var(--org-primary-ink,white)] hover:bg-white/10 transition-colors rounded-lg"
            >
              {sub.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const NAV_LINK_CLASS =
  'px-3 py-1.5 rounded-full text-base font-medium text-[color-mix(in_srgb,var(--org-primary-ink,white)_90%,transparent)] hover:text-[var(--org-primary-ink,white)] hover:bg-white/10 transition-colors duration-150'

export function PublicStoreHeader({ organization }: PublicStoreHeaderProps) {
  const { getItemCount, fetchCart } = useCartStore()
  const navigate = useNavigate()
  const location = useLocation()
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

  // En la home, "Inicio"/"Nosotros" hacen scroll suave en vez de navegar
  // (evita un remount innecesario de la página cuando ya estás ahí).
  const handleInicioClick = (e: React.MouseEvent) => {
    closeAll()
    if (location.pathname === '/') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNosotrosClick = (e: React.MouseEvent) => {
    closeAll()
    if (location.pathname === '/') {
      e.preventDefault()
      document.getElementById('nosotros')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = searchQuery.trim()
    navigate(q ? `/products?search=${encodeURIComponent(q)}` : '/products')
    closeAll()
  }

  useEffect(() => {
    if (isSearchOpen) {
      desktopSearchRef.current?.focus()
    }
  }, [isSearchOpen])

  // Marca hardcodeada: theming dinámico por organización fue removido
  // (single-tenant fork, org.branding/settings quedan permanentemente NULL).
  const primaryColor = '#46362B'

  const itemCount = getItemCount()

  return (
    <header
      className="sticky top-0 z-30"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="container-custom">

        {/* ─── Desktop ─── */}
        <div className="hidden lg:flex items-center gap-6 h-20 ">

          {/* Logo — mismo isotipo que en mobile, agrandado para jerarquía en desktop */}
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <img src={logoIsotipo} alt={organization.name} className="h-16 w-16 rounded-lg object-contain" />
          </Link>

          {/* Nav: Inicio / Categorías (trigger colapsable) / Nosotros */}
          <nav className="flex-1 flex items-center justify-center gap-1">
            <Link to="/" onClick={handleInicioClick} className={NAV_LINK_CLASS}>
              Inicio
            </Link>
            {categoriesWithSubs.length > 0 && (
              <CategoryMenu categories={categoriesWithSubs} onNavigate={closeAll} />
            )}
            <Link to="/#nosotros" onClick={handleNosotrosClick} className={NAV_LINK_CLASS}>
              Nosotros
            </Link>
          </nav>

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
                className={`shrink-0 text-[color-mix(in_srgb,var(--org-primary-ink,white)_80%,transparent)] hover:text-[var(--org-primary-ink,white)] transition-colors ${isSearchOpen ? 'py-2' : 'w-full h-full flex items-center justify-center'}`}
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
                    className="bg-transparent text-[var(--org-primary-ink,white)] placeholder-[color-mix(in_srgb,var(--org-primary-ink,white)_50%,transparent)] text-sm outline-none ml-2 w-full"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[color-mix(in_srgb,var(--org-primary-ink,white)_50%,transparent)] hover:text-[var(--org-primary-ink,white)] shrink-0 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </form>
              )}
            </div>

            {/* Cart */}
            <Link
              to="/cart"
              onClick={closeAll}
              className="relative p-2 text-[color-mix(in_srgb,var(--org-primary-ink,white)_80%,transparent)] hover:text-[var(--org-primary-ink,white)] transition-colors rounded-full hover:bg-white/15"
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
        <div className="lg:hidden flex items-center h-16">

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => { setIsMobileMenuOpen((p) => !p); setIsSearchOpen(false) }}
            className="p-2 -ml-1 text-[color-mix(in_srgb,var(--org-primary-ink,white)_80%,transparent)] hover:text-[var(--org-primary-ink,white)] transition-colors rounded-lg hover:bg-white/10"
            aria-label="Menú"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Center logo — isotipo compacto + nombre, ya que el monograma solo no identifica la marca */}
          <Link to="/" onClick={closeAll} className="flex-1 flex justify-center items-center gap-2">
            <img src={logoIsotipo} alt={organization.name} className="h-12 w-12 rounded-lg object-contain" />
            <span className="text-[var(--org-primary-ink,white)] font-semibold text-base">{organization.name}</span>
          </Link>

          {/* Right */}
          <div className="flex items-center gap-1 -mr-1">
            <button
              type="button"
              onClick={() => { setIsSearchOpen((p) => !p); setIsMobileMenuOpen(false) }}
              className="p-2 text-[color-mix(in_srgb,var(--org-primary-ink,white)_80%,transparent)] hover:text-[var(--org-primary-ink,white)] transition-colors rounded-lg hover:bg-white/10"
              aria-label="Buscar"
            >
              <Search className="h-5 w-5" />
            </button>
            <Link
              to="/cart"
              onClick={closeAll}
              className="relative p-2 text-[color-mix(in_srgb,var(--org-primary-ink,white)_80%,transparent)] hover:text-[var(--org-primary-ink,white)] transition-colors rounded-lg hover:bg-white/10"
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
                <Search className="h-4 w-4 text-[color-mix(in_srgb,var(--org-primary-ink,white)_60%,transparent)] shrink-0" />
                <input
                  ref={mobileSearchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar productos…"
                  className="bg-transparent text-[var(--org-primary-ink,white)] placeholder-[color-mix(in_srgb,var(--org-primary-ink,white)_50%,transparent)] text-sm outline-none ml-2 flex-1"
                  autoFocus
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="text-[color-mix(in_srgb,var(--org-primary-ink,white)_50%,transparent)] hover:text-[var(--org-primary-ink,white)] ml-1 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-[var(--org-primary-ink,white)] bg-white/20 hover:bg-white/30 rounded-full transition-colors shrink-0"
              >
                Buscar
              </button>
            </form>
          </div>
        )}

        {/* ─── Mobile menu panel ─── */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t" style={{ borderColor: `${primaryColor}33` }}>
            <div className="py-2">
              <Link
                to="/"
                onClick={handleInicioClick}
                className="block px-4 py-2.5 text-sm font-medium text-[var(--org-primary-ink,white)] hover:bg-white/10 transition-colors rounded-lg"
              >
                Inicio
              </Link>
              <Link
                to="/#nosotros"
                onClick={handleNosotrosClick}
                className="block px-4 py-2.5 text-sm font-medium text-[var(--org-primary-ink,white)] hover:bg-white/10 transition-colors rounded-lg"
              >
                Nosotros
              </Link>
            </div>
            {categoriesWithSubs.length > 0 ? (
              <div className="py-2">
                <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-widest text-[color-mix(in_srgb,var(--org-primary-ink,white)_50%,transparent)]">
                  Categorías
                </p>
                {categoriesWithSubs.map((cat) => (
                  <MobileCategoryItem key={cat.value} cat={cat} onNavigate={closeAll} />
                ))}
              </div>
            ) : (
              <div className="py-4 px-4 text-sm text-[color-mix(in_srgb,var(--org-primary-ink,white)_50%,transparent)] text-center">
                No hay categorías disponibles
              </div>
            )}
          </div>
        )}

      </div>
    </header>
  )
}
