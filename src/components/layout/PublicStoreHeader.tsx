import { useCartStore } from '@/store/cartStore'
import type { Organization } from '@/types/database.types'
import type { Product, ProductImage } from '@/types'
import { usePublicCategoriesForMenu } from '@/hooks/usePublicCategories'
import type { CategoryWithSubcategories } from '@/hooks/usePublicCategories'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, cn, formatPrice, getEffectivePrice, getProductImageUrl } from '@/lib/utils'
import { ChevronDown, Menu, Minus, Plus, Search, ShoppingCart, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import logoSquare from '@/brand/mates-ajedrez-logo-square.jpeg'

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
    // `group` habilita el hover CSS-only del dropdown de abajo — se mantiene
    // como comportamiento adicional en desktop (mouse), mientras que el click
    // (necesario en híbridos táctiles donde el hover no es confiable) sigue
    // controlado por `isOpen`, con cierre al click afuera ya manejado arriba.
    <div ref={containerRef} className="relative group">
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-cuero border-b border-transparent hover:border-brand-cuero transition-colors duration-150"
      >
        Categorías
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'group-hover:rotate-180'}`} />
      </button>

      <div
        className={`absolute top-full left-1/2 -translate-x-1/2 pt-3 z-40 transition-opacity duration-150 ${
          isOpen
            ? 'opacity-100 visible pointer-events-auto'
            : 'opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto'
        }`}
      >
        <div className="bg-white rounded-lg shadow-lg border border-brand-line p-3 grid grid-cols-2 gap-x-8 gap-y-0.5 w-max max-w-md">
          {categories.map((cat) => (
            <div key={cat.value} className="py-1.5">
              <Link
                to={`/categories/${cat.value}`}
                onClick={handleLinkClick}
                className="block px-2 py-1 rounded-lg text-sm font-medium text-brand-tinta hover:bg-brand-crema hover:text-brand-tinta transition-colors whitespace-nowrap"
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
                      className="block px-2 py-1 rounded-lg text-xs text-brand-muted hover:bg-brand-crema hover:text-brand-tinta transition-colors whitespace-nowrap"
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
          className="flex-1 px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-cuero hover:bg-brand-crema transition-colors rounded-lg"
        >
          {cat.label}
        </Link>
        {hasSubcategories && (
          <button
            type="button"
            onClick={() => setIsExpanded((p) => !p)}
            className="p-2.5 text-brand-cuero hover:text-brand-tinta transition-colors"
            aria-label={isExpanded ? 'Contraer' : 'Expandir'}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>
      {hasSubcategories && isExpanded && (
        <div className="ml-4 pl-3 border-l border-brand-line mb-1">
          {cat.subcategories!.map((sub) => (
            <Link
              key={sub.value}
              to={`/categories/${sub.value}`}
              onClick={onNavigate}
              className="block px-3 py-2 text-sm text-brand-cuero hover:text-brand-tinta hover:bg-brand-crema transition-colors rounded-lg"
            >
              {sub.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

interface CartMenuProps {
  triggerClassName: string
  badgeClassName: string
  ariaLabel: string
  enableHover?: boolean
}

// Dropdown de vista rápida del carrito — evita tener que entrar a /cart solo
// para sacar un producto o cambiar la cantidad. Se usa una instancia por
// breakpoint (desktop/mobile) porque los triggers viven en bloques de layout
// distintos; cada una abre/cierra de forma independiente con el mismo patrón
// de click-afuera que CategoryMenu.
function CartMenu({ triggerClassName, badgeClassName, ariaLabel, enableHover = false }: CartMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const settings = useOrgSettings()
  const { items, updateQuantity, removeFromCart, getTotal, getItemCount } = useCartStore()

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

  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  const itemCount = getItemCount()

  const goTo = (path: string) => {
    setIsOpen(false)
    navigate(path)
  }

  return (
    <div ref={containerRef} className={cn('relative', enableHover && 'group')}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className={triggerClassName}
      >
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 && (
          <span className={badgeClassName}>{itemCount > 99 ? '99+' : itemCount}</span>
        )}
      </button>

      <div
        className={cn(
          'absolute top-full right-0 pt-3 z-40 transition-opacity duration-150',
          isOpen
            ? 'opacity-100 visible pointer-events-auto'
            : enableHover
              ? 'opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto'
              : 'opacity-0 invisible pointer-events-none'
        )}
      >
        <div className="bg-white rounded-lg shadow-lg border border-brand-line w-[calc(100vw-2rem)] max-w-sm max-h-[70vh] flex flex-col">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-brand-muted text-center">Tu carrito está vacío</p>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto divide-y divide-brand-line">
                {items.map((item) => {
                  const productWithImages = item.product as Product & { product_images?: ProductImage[] }
                  const imageUrl = getProductImageUrl(productWithImages, item.variant?.image_url || null)
                  const unitPrice = item.variant?.price ?? getEffectivePrice(item.product)

                  return (
                    <div key={item.id} className="flex gap-3 p-3">
                      <div className="flex-shrink-0 w-14 h-14 bg-brand-crema rounded-lg overflow-hidden border border-brand-line">
                        {imageUrl ? (
                          <img src={imageUrl} alt={capitalizeFirst(item.product.name)} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-brand-muted text-[10px] text-center">
                            Sin imagen
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-brand-tinta truncate">
                          {capitalizeFirst(item.product.name)}
                        </p>
                        {item.variant?.name && (
                          <p className="text-xs text-brand-muted truncate">{capitalizeFirst(item.variant.name)}</p>
                        )}
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1).catch(() => {})}
                              disabled={item.quantity <= 1}
                              aria-label="Disminuir cantidad"
                              className="h-6 w-6 flex items-center justify-center rounded-full border border-brand-line text-brand-muted hover:bg-brand-crema disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-medium text-brand-tinta w-4 text-center tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1).catch(() => {})}
                              aria-label="Aumentar cantidad"
                              className="h-6 w-6 flex items-center justify-center rounded-full border border-brand-line text-brand-muted hover:bg-brand-crema transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-brand-tinta">
                            {formatPrice(unitPrice * item.quantity, settings)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id).catch(() => {})}
                        aria-label="Eliminar producto del carrito"
                        className="self-start text-brand-algarrobo hover:text-red-500 transition-colors p-1 -mr-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-brand-line p-4 space-y-3">
                <div className="flex justify-between text-sm font-bold text-brand-tinta">
                  <span>Subtotal</span>
                  <span>{formatPrice(getTotal(), settings)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => goTo('/checkout')}
                  className="w-full h-10 rounded-md bg-brand-cuero text-brand-crema text-sm font-semibold transition-colors hover:bg-brand-cuero-oscuro"
                >
                  Finalizar compra
                </button>
                <button
                  type="button"
                  onClick={() => goTo('/cart')}
                  className="w-full h-10 rounded-lg border border-brand-line text-sm font-medium text-brand-muted hover:bg-brand-crema transition-colors"
                >
                  Ver carrito
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const NAV_LINK_CLASS =
  'px-3 py-1.5 font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-cuero border-b border-transparent hover:border-brand-cuero transition-colors duration-150'

export function PublicStoreHeader({ organization }: PublicStoreHeaderProps) {
  const { fetchCart } = useCartStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const desktopSearchRef = useRef<HTMLInputElement>(null)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLElement>(null)

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

  // El menú y el buscador mobile (paneles inline debajo de la barra) no tenían
  // forma de cerrarse al tocar afuera, a diferencia del dropdown de categorías
  // desktop (ver CategoryMenu más arriba) — mismo patrón acá, sobre el <header>.
  useEffect(() => {
    if (!isMobileMenuOpen && !isSearchOpen) return

    const handleOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false)
        setIsSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isMobileMenuOpen, isSearchOpen])

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 bg-brand-bg border-b border-brand-line"
    >
      <div className="container-custom">

        {/* ─── Desktop ─── */}
        <div className="hidden lg:grid grid-cols-[1fr_auto_1fr] items-center gap-4 h-20">

          {/* Logo seal — same square logo as mobile, larger for desktop hierarchy */}
          <Link to="/" className="flex items-center gap-3 shrink-0 justify-self-start">
            <img src={logoSquare} alt="Mates Ajedrez" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
          </Link>

          {/* Nav: Inicio / Categorías (trigger colapsable) / Nosotros */}
          <nav className="flex-1 flex items-center justify-center gap-1">
            <Link to="/" onClick={handleInicioClick} className={NAV_LINK_CLASS}>
              Inicio
            </Link>
            <Link to="/products" onClick={closeAll} className={NAV_LINK_CLASS}>
              Tienda
            </Link>
            {categoriesWithSubs.length > 0 && (
              <CategoryMenu categories={categoriesWithSubs} onNavigate={closeAll} />
            )}
            <Link to="/#nosotros" onClick={handleNosotrosClick} className={NAV_LINK_CLASS}>
              Nosotros
            </Link>
            <Link to="/visitanos" onClick={closeAll} className={NAV_LINK_CLASS}>
              Visitanos
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0 justify-self-end">

            {/* Expandable search */}
            <div
              className={`flex items-center bg-white border border-brand-line hover:border-brand-algarrobo rounded-full transition-all duration-300 overflow-hidden ${
                isSearchOpen ? 'w-52 pr-1 pl-3' : 'w-9 h-9 justify-center'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsSearchOpen((p) => !p)}
                className={`shrink-0 text-brand-cuero hover:text-brand-tinta transition-colors ${isSearchOpen ? 'py-2' : 'w-full h-full flex items-center justify-center'}`}
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
                    className="bg-transparent text-brand-tinta placeholder-brand-muted text-sm outline-none ml-2 w-full"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-brand-cuero hover:text-brand-tinta shrink-0 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </form>
              )}
            </div>

            {/* Cart */}
            <CartMenu
              enableHover
              ariaLabel="Ver carrito"
              triggerClassName="relative p-2 text-brand-cuero hover:text-brand-tinta transition-colors rounded-full hover:bg-brand-crema"
              badgeClassName="absolute -top-0.5 -right-0.5 bg-brand-cuero text-brand-crema text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center leading-none px-1 tabular-nums"
            />
          </div>
        </div>

        {/* ─── Mobile ─── */}
        <div className="lg:hidden grid grid-cols-[1fr_auto_1fr] items-center h-16">

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => { setIsMobileMenuOpen((p) => !p); setIsSearchOpen(false) }}
            className="h-11 w-11 flex items-center justify-center justify-self-start -ml-1 text-brand-cuero hover:text-brand-tinta transition-colors rounded-lg hover:bg-brand-crema"
            aria-label="Menú"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Center logo seal (the square logo already includes the brand name) */}
          <Link to="/" onClick={closeAll} className="flex justify-center items-center h-11 w-11">
            <img src={logoSquare} alt="Mates Ajedrez" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
          </Link>

          {/* Right */}
          <div className="flex items-center justify-self-end -mr-1">
            <button
              type="button"
              onClick={() => { setIsSearchOpen((p) => !p); setIsMobileMenuOpen(false) }}
              className="h-11 w-11 flex items-center justify-center text-brand-cuero hover:text-brand-tinta transition-colors rounded-lg hover:bg-brand-crema"
              aria-label="Buscar"
            >
              <Search className="h-5 w-5" />
            </button>
            <CartMenu
              ariaLabel="Carrito"
              triggerClassName="relative h-11 w-11 flex items-center justify-center text-brand-cuero hover:text-brand-tinta transition-colors rounded-lg hover:bg-brand-crema"
              badgeClassName="absolute top-0.5 right-0.5 bg-brand-cuero text-brand-crema text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center leading-none px-1 tabular-nums"
            />
          </div>
        </div>

        {/* ─── Mobile search panel ─── */}
        {isSearchOpen && (
          <div className="lg:hidden border-t border-brand-line px-3 py-3">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-white border border-brand-line focus-within:border-brand-cuero rounded-full px-4 py-2 transition-colors">
                <Search className="h-4 w-4 text-brand-cuero shrink-0" />
                <input
                  ref={mobileSearchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar productos…"
                  className="bg-transparent text-brand-tinta placeholder-brand-muted text-sm outline-none ml-2 flex-1"
                  autoFocus
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="text-brand-cuero hover:text-brand-tinta ml-1 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium bg-brand-cuero text-brand-crema hover:bg-brand-cuero-oscuro rounded-full transition-colors shrink-0"
              >
                Buscar
              </button>
            </form>
          </div>
        )}

        {/* ─── Mobile menu panel ─── */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-brand-line">
            <div className="py-2">
              <Link
                to="/"
                onClick={handleInicioClick}
                className="block px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-cuero hover:bg-brand-crema transition-colors rounded-lg"
              >
                Inicio
              </Link>
              <Link
                to="/products"
                onClick={closeAll}
                className="block px-4 py-3 font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-cuero hover:bg-brand-crema transition-colors rounded-lg"
              >
                Tienda
              </Link>
              <Link
                to="/#nosotros"
                onClick={handleNosotrosClick}
                className="block px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-cuero hover:bg-brand-crema transition-colors rounded-lg"
              >
                Nosotros
              </Link>
              <Link
                to="/visitanos"
                onClick={closeAll}
                className="block px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-cuero hover:bg-brand-crema transition-colors rounded-lg"
              >
                Visitanos
              </Link>
            </div>
            {categoriesWithSubs.length > 0 ? (
              <div className="py-2">
                <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-widest text-brand-cuero">
                  Categorías
                </p>
                {categoriesWithSubs.map((cat) => (
                  <MobileCategoryItem key={cat.value} cat={cat} onNavigate={closeAll} />
                ))}
              </div>
            ) : null}
          </div>
        )}

      </div>
    </header>
  )
}
