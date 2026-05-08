import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, User, LogOut, LayoutDashboard, Menu, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Category, UserProfile } from '@/types'
import { cn } from '@/lib/utils'

interface CategoryWithSubcategories {
  value: string
  label: string
  subcategories?: Array<{ value: string; label: string }>
}

export function Header() {
  const { user, profile, signOut, isAdmin } = useAuthStore()
  const { getItemCount, fetchCart } = useCartStore()
  const navigate = useNavigate()
  const [categoriesWithSubs, setCategoriesWithSubs] = useState<CategoryWithSubcategories[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    fetchCart()
  }, [user, fetchCart])

  useEffect(() => {
    let isMounted = true

    const fetchCategories = async () => {
      try {
        // Fetch all categories
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name')

        if (error) throw error
        if (isMounted && data) {
          const categoriesData: Category[] = data as Category[]
          
          // Organize categories with subcategories
          const parentCategories = categoriesData.filter((cat) => !cat.parent_id)
          const subcategoriesMap = new Map<string, Category[]>()
          
          // Group subcategories by parent
          categoriesData.forEach((cat) => {
            if (cat.parent_id) {
              if (!subcategoriesMap.has(cat.parent_id)) {
                subcategoriesMap.set(cat.parent_id, [])
              }
              subcategoriesMap.get(cat.parent_id)!.push(cat)
            }
          })
          
          // Build options with subcategories
          const options: CategoryWithSubcategories[] = parentCategories.map((parent) => {
            const subcategories = subcategoriesMap.get(parent.id) || []
            return {
              value: parent.slug,
              label: parent.name,
              subcategories: subcategories.length > 0
                ? subcategories.map((sub) => ({
                    value: sub.slug,
                    label: sub.name,
                  }))
                : undefined,
            }
          })
          
          setCategoriesWithSubs(options)
        }
      } catch (error) {
        // Ignore abort errors - they're expected in development mode with StrictMode
        if ((error instanceof Error && error.name !== 'AbortError') || !(error instanceof Error)) {
          if (isMounted) {
            console.error('Error fetching categories:', error)
          }
        }
      }
    }

    fetchCategories()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleCategoryChange = (categorySlug: string) => {
    if (categorySlug) {
      navigate(`/${categorySlug}`)
      setSelectedCategory('')
      setIsMobileMenuOpen(false)
    }
  }

  return (
    <header className="bg-primary-200 border-primary-300 sticky top-0 z-30">
      <div className="container-custom">
        {/* Desktop Layout */}
        <div className="hidden lg:flex items-center h-16 my-2">
          <div className="flex-1">
            <Link to="/" className="flex items-center space-x-3">
              <img src="/logo.svg" className="h-16 w-16" />
            </Link>
          </div>

          <div className="flex-1 flex justify-center">
            <Dropdown
              options={categoriesWithSubs}
              value={selectedCategory}
              placeholder="Accesorios"
              onSelect={handleCategoryChange}
              darkBackground={true}
            />
          </div>

          <div className="flex-1 flex justify-end items-center space-x-4">
            <Link to="/cart" className="relative">
              <Button variant="ghost" className="text-white hover:text-gray-700" size="sm">
                <ShoppingCart className="h-6 w-6" />
                {getItemCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getItemCount()}
                  </span>
                )}
              </Button>
            </Link>

            <nav className="flex items-center space-x-4">
              {user ? (
                <UserMenu user={user} profile={profile} isAdmin={isAdmin} onSignOut={handleSignOut} />
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" className="text-white hover:text-gray-700" size="md">
                      Iniciar Sesión
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden flex items-center h-16 my-2">
          {/* Hamburger Menu */}
          <div className="flex-1 flex items-center">
            <Button
              variant="ghost"
              className="text-white hover:text-gray-700"
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

          {/* Logo in center */}
          <div className="flex-1 flex justify-center">
            <Link to="/" className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
              <img src="/logo.svg" className="h-12 w-12" />
            </Link>
          </div>

          {/* Cart */}
          <div className="flex-1 flex justify-end">
            <Link to="/cart" className="relative" onClick={() => setIsMobileMenuOpen(false)}>
              <Button variant="ghost" className="text-white hover:text-gray-700" size="sm">
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

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-primary-300 bg-primary-200">
            <div className="container-custom py-4">
              {/* Categories Dropdown for Mobile */}
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

              {/* Navigation Links */}
              <nav className="space-y-2">
                {user ? (
                  <>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full text-white hover:text-gray-700 justify-start" size="sm">
                          <LayoutDashboard className="h-5 w-5 mr-2" />
                          Panel de control
                        </Button>
                      </Link>
                    )}
                    <div className="flex items-center space-x-2 px-4 py-2 text-white">
                      <User className="h-5 w-5 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        {profile?.full_name && (
                          <span className="text-sm font-medium truncate">{profile.full_name}</span>
                        )}
                        <span className="text-xs text-white/70 truncate">{user.email}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full text-white hover:text-gray-700 justify-start"
                      size="sm"
                      onClick={() => {
                        handleSignOut()
                        setIsMobileMenuOpen(false)
                      }}
                    >
                      <LogOut className="h-5 w-5 mr-2" />
                      Cerrar Sesión
                    </Button>
                  </>
                ) : (
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full text-white hover:text-gray-700 justify-start" size="sm">
                      Iniciar Sesión
                    </Button>
                  </Link>
                )}
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  user: 'Usuario',
  viewer: 'Visualizador',
}

interface UserMenuProps {
  user: { email?: string | null }
  profile: UserProfile | null
  isAdmin: boolean
  onSignOut: () => void
}

function UserMenu({ user, profile, isAdmin, onSignOut }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isOpen])

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 200)
  }

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Menú de usuario"
      >
        <User className="h-5 w-5 text-white" />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl z-50',
            'transition-all duration-300 ease-out',
            'opacity-100 translate-y-0'
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="h-11 w-11 rounded-full bg-primary-100 border-2 border-primary-200 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                {profile?.full_name ? (
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {profile.full_name}
                  </p>
                ) : null}
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                {profile?.role && (
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                    {ROLE_LABELS[profile.role] ?? profile.role}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="py-2">
            {isAdmin && (
              <Link to="/admin" onClick={() => setIsOpen(false)}>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors flex items-center space-x-2"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Panel de control</span>
                </button>
              </Link>
            )}
          </div>

          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => {
                onSignOut()
                setIsOpen(false)
              }}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
