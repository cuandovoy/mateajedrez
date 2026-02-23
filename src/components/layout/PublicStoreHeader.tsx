import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, Menu, X } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Category, Organization } from '@/types'
import { cn } from '@/lib/utils'

interface CategoryWithSubcategories {
  value: string
  label: string
  subcategories?: Array<{ value: string; label: string }>
}

interface PublicStoreHeaderProps {
  organization: Organization
  slug: string
}

export function PublicStoreHeader({ organization, slug }: PublicStoreHeaderProps) {
  const { getItemCount, fetchCart } = useCartStore()
  const navigate = useNavigate()
  const [categoriesWithSubs, setCategoriesWithSubs] = useState<CategoryWithSubcategories[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  useEffect(() => {
    let isMounted = true

    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('organization_id', organization.id)
          .order('name')

        if (error) throw error
        if (isMounted && data) {
          const categoriesData: Category[] = data as Category[]
          
          const parentCategories = categoriesData.filter((cat) => !cat.parent_id)
          const subcategoriesMap = new Map<string, Category[]>()
          
          categoriesData.forEach((cat) => {
            if (cat.parent_id) {
              if (!subcategoriesMap.has(cat.parent_id)) {
                subcategoriesMap.set(cat.parent_id, [])
              }
              subcategoriesMap.get(cat.parent_id)!.push(cat)
            }
          })
          
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
        if ((error instanceof Error && error.name !== 'AbortError') || !(error instanceof Error)) {
          if (isMounted) {
            console.error('Error fetching categories:', error)
          }
        }
      }
    }

    if (organization.id) {
      fetchCategories()
    }

    return () => {
      isMounted = false
    }
  }, [organization.id])

  const handleCategoryChange = (categorySlug: string) => {
    if (categorySlug) {
      navigate(`/${slug}/categories/${categorySlug}`)
      setSelectedCategory('')
      setIsMobileMenuOpen(false)
    }
  }

  const primaryColor = organization.primary_color || '#6366f1'

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
              {organization.logo_url ? (
                <img 
                  src={organization.logo_url} 
                  alt={organization.name} 
                  className="h-16 w-16 object-contain" 
                />
              ) : (
                <div className="h-16 w-16 flex items-center justify-center bg-white/20 rounded-lg">
                  <span className="text-white font-bold text-lg">
                    {organization.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-white font-semibold text-lg">{organization.name}</span>
            </Link>
          </div>

          <div className="flex-1 flex justify-center">
            {categoriesWithSubs.length > 0 && (
              <Dropdown
                options={categoriesWithSubs}
                value={selectedCategory}
                placeholder="Categorías"
                onSelect={handleCategoryChange}
                darkBackground={true}
              />
            )}
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
              {organization.logo_url ? (
                <img 
                  src={organization.logo_url} 
                  alt={organization.name} 
                  className="h-12 w-12 object-contain" 
                />
              ) : (
                <div className="h-12 w-12 flex items-center justify-center bg-white/20 rounded-lg">
                  <span className="text-white font-bold">
                    {organization.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-white font-semibold text-sm">{organization.name}</span>
            </Link>
          </div>

          <div className="flex-1 flex justify-end">
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
