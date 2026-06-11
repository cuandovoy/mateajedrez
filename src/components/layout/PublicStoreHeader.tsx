import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { useCartStore } from '@/store/cartStore'
import { Organization } from '@/types/database.types'
import { usePublicCategoriesForMenu } from '@/hooks/usePublicCategories'
import { Menu, Search, ShoppingCart, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface PublicStoreHeaderProps {
  organization: Organization
  slug: string
}

export function PublicStoreHeader({ organization, slug }: PublicStoreHeaderProps) {
  const { getItemCount, fetchCart } = useCartStore()
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { categoriesWithSubs } = usePublicCategoriesForMenu(organization.id)

  useEffect(() => {
    fetchCart(organization.id)
  }, [fetchCart, organization.id])

  const handleCategoryChange = (categorySlug: string) => {
    if (categorySlug) {
      navigate(`/${slug}/categories/${categorySlug}`)
      setSelectedCategory('')
      setIsMobileMenuOpen(false)
    }
  }

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = searchQuery.trim()
    if (q) {
      navigate(`/${slug}/products?search=${encodeURIComponent(q)}`)
    } else {
      navigate(`/${slug}/products`)
    }
    setIsSearchOpen(false)
    setIsMobileMenuOpen(false)
  }

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus()
    }
  }, [isSearchOpen])

  const settings = (organization.settings as Record<string, unknown>) ?? {}
  const minimalLogoUrl =
    typeof settings.store_logo_minimal_url === 'string' ? (settings.store_logo_minimal_url as string) : null
  const desktopLogoUrl = organization.logo_url || null
  const mobileLogoUrl = minimalLogoUrl || desktopLogoUrl
  const primaryColor = organization.primary_color || '#6366f1'

  const showName = (settings.store_header_show_name as boolean) !== false
  const logoSizeKey = (settings.store_header_logo_size as string) ?? 'md'
  const logoSizeClass = { sm: 'h-10 w-10', md: 'h-16 w-16', lg: 'h-20 w-20' }[logoSizeKey] ?? 'h-16 w-16'
  const logoSizeClassMobile = { sm: 'h-8 w-8', md: 'h-12 w-12', lg: 'h-14 w-14' }[logoSizeKey] ?? 'h-12 w-12'

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        backgroundColor: primaryColor,
        borderColor: `${primaryColor}dd`
      }}
    >
      <div className="container-custom">
        {/* Desktop Layout */}
        <div className="hidden lg:flex items-center h-16 my-2">
          <div className="flex-1">
            <Link to={`/${slug}`} className="flex items-center space-x-3">
              {desktopLogoUrl ? (
                <img
                  src={desktopLogoUrl}
                  alt={organization.name}
                  className={`${logoSizeClass} object-contain`}
                />
              ) : (
                <div className={`${logoSizeClass} flex items-center justify-center bg-white/20 rounded-lg`}>
                  <span className="text-white font-bold text-lg">
                    {organization.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {showName && <span className="text-white font-semibold text-lg">{organization.name}</span>}
            </Link>
          </div>

          <div className="flex-1 flex justify-center items-center gap-3">
            {categoriesWithSubs.length > 0 && (
              <Dropdown
                options={categoriesWithSubs}
                value={selectedCategory}
                placeholder="Categorías"
                onSelect={handleCategoryChange}
                darkBackground={true}
              />
            )}
            <form onSubmit={handleSearch} className="flex items-center">
              <div className="flex items-center bg-white/20 hover:bg-white/30 focus-within:bg-white/30 rounded-full px-3 py-1.5 transition-colors">
                <Search className="h-4 w-4 text-white/80 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Buscar productos…"
                  className="bg-transparent text-white placeholder-white/60 text-sm outline-none ml-2 w-40 focus:w-56 transition-all duration-300"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="ml-1 text-white/60 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="flex-1 flex justify-end items-center space-x-4">
            <Link to={`/${slug}/cart`} className="relative">
              <Button variant="ghost" className="text-white hover:text-white/80" size="sm">
                <ShoppingCart className="h-6 w-6" />
                {getItemCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getItemCount()}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden flex items-center h-16 my-2">
          <div className="flex-1 flex items-center">
            <Button
              variant="ghost"
              className="text-white hover:text-white/80"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>

          <div className="flex-1 flex justify-center">
            <Link to={`/${slug}`} className="flex items-center space-x-2" onClick={() => setIsMobileMenuOpen(false)}>
              {mobileLogoUrl ? (
                <img
                  src={mobileLogoUrl}
                  alt={organization.name}
                  className={`${logoSizeClassMobile} object-contain`}
                />
              ) : (
                <div className={`${logoSizeClassMobile} flex items-center justify-center bg-white/20 rounded-lg`}>
                  <span className="text-white font-bold">
                    {organization.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {showName && <span className="text-white font-semibold text-sm">{organization.name}</span>}
            </Link>
          </div>

          <div className="flex-1 flex justify-end items-center gap-1">
            <Button
              variant="ghost"
              className="text-white hover:text-white/80"
              size="sm"
              onClick={() => { setIsSearchOpen((p) => !p); setIsMobileMenuOpen(false) }}
            >
              <Search className="h-5 w-5" />
            </Button>
            <Link to={`/${slug}/cart`} className="relative" onClick={() => setIsMobileMenuOpen(false)}>
              <Button variant="ghost" className="text-white hover:text-white/80" size="sm">
                <ShoppingCart className="h-5 w-5" />
                {getItemCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getItemCount()}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {isSearchOpen && (
          <div className="lg:hidden border-t px-4 py-3" style={{ borderColor: `${primaryColor}dd`, backgroundColor: primaryColor }}>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-white/20 focus-within:bg-white/30 rounded-full px-3 py-2">
                <Search className="h-4 w-4 text-white/80 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar productos…"
                  className="bg-transparent text-white placeholder-white/60 text-sm outline-none ml-2 flex-1"
                  autoFocus
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="text-white/60 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button type="submit" variant="ghost" size="sm" className="text-white hover:text-white/80 shrink-0">
                Buscar
              </Button>
            </form>
          </div>
        )}

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t" style={{ borderColor: `${primaryColor}dd`, backgroundColor: primaryColor }}>
            <div className="container-custom py-4">
              {categoriesWithSubs.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white mb-2">Categorías</label>
                  <div className="bg-white rounded-lg">
                    <Dropdown
                      options={categoriesWithSubs}
                      value={selectedCategory}
                      placeholder="Seleccionar categoría"
                      onSelect={handleCategoryChange}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
