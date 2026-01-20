import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, User, LogOut, LayoutDashboard } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/types'

export function Header() {
  const { user, signOut, isAdmin } = useAuthStore()
  const { getItemCount, fetchCart } = useCartStore()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  useEffect(() => {
    fetchCart()
  }, [user, fetchCart])

  useEffect(() => {
    let isMounted = true

    const fetchParentCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .is('parent_id', null)
          .order('name')

        if (error) throw error
        if (isMounted) {
          setCategories(data || [])
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

    fetchParentCategories()

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
    }
  }

  return (
    <header className="bg-primary-200 shadow-sm border-primary-300 sticky top-0 z-30">
      <div className="container-custom">
        <div className="flex items-center h-16 my-2">
          <div className="flex-1">
            <Link to="/" className="flex items-center space-x-3">
              <img src="/logo.svg" alt="Flormaria Soria González" className="h-16 w-16" />
            </Link>
          </div>

          <div className="flex-1 flex justify-center">
            <Dropdown
              options={categories.map((category) => ({
                value: category.slug,
                label: category.name,
              }))}
              value={selectedCategory}
              placeholder="Accesorios"
              onSelect={handleCategoryChange}
            />
          </div>

          <div className="flex-1 flex justify-end items-center space-x-4">
            <Link to="/cart" className="relative">
              <Button variant="ghost" className="text-white hover:text-gray-700" size="sm">
                <ShoppingCart className="h-5 w-5" />
                {getItemCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getItemCount()}
                  </span>
                )}
              </Button>
            </Link>

            <nav className="hidden lg:flex items-center space-x-4">
              {user ? (
                <>
                  {isAdmin && (
                    <Link to="/admin">
                      <Button variant="ghost" className="text-white hover:text-gray-700" size="sm">
                        <LayoutDashboard className="h-5 w-5 mr-2" />
                        Panel Admin
                      </Button>
                    </Link>
                  )}
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-gray-600" />
                    <span className="text-sm text-gray-700">
                      {user.email}
                    </span>
                  </div>
                  <Button variant="ghost" className="text-white hover:text-gray-700" size="sm" onClick={handleSignOut}>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" className="text-white hover:text-gray-700" size="sm">
                      Iniciar Sesión
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}
