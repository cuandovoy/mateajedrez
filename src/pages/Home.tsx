import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ProductCard } from '@/components/features/ProductCard'
import { ProductListItem } from '@/components/features/ProductListItem'
import { CategoryCard } from '@/components/features/CategoryCard'
import type { Product, Category } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    let isMounted = true

    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (error) throw error

        if (isMounted) {
          setProducts(data || [])
        }
      } catch (error) {
        // Ignore abort errors - they're expected in development mode with StrictMode
        if ((error instanceof Error && error.name !== 'AbortError') || !(error instanceof Error)) {
          if (isMounted) {
            console.error('Error fetching products:', error)
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    const fetchCategories = async () => {
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

    // Fetch both in parallel
    Promise.all([fetchProducts(), fetchCategories()])

    return () => {
      isMounted = false
    }
  }, [])

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200"></div>
      </div>
    )
  }

  return (
    <div className="bg-primary-50">
      {/* Banner Section - Responsive Height */}
      <div className="min-h-[60vh] md:min-h-screen flex flex-col justify-center items-center py-8 md:py-12">
        <div className="container-custom w-full px-4">
          <div className="flex justify-center mb-6 md:mb-8">
            <div className="relative w-full max-w-6xl">
              <img
                src="/banner1.png"
                alt="Banner Flormaria Soria González"
                className="w-full h-auto rounded-lg shadow-lg object-cover max-h-[50vh] md:max-h-none"
              />
            </div>
          </div>
          <div className="flex justify-center">
            <Link to="/products">
              <Button size="lg" className="px-6 py-2.5 md:px-8 md:py-3 text-sm md:text-base">
                Ver colección
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Rest of content */}
      <div className="container-custom py-8">

        {/* Categories Section */}
        {categories.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
              Nuestras Categorías
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </div>
        )}

        {/* Products Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Productos Destacados
          </h1>
          <Input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
            </p>
          </div>
        ) : (
          <>
            {/* Vista Cards para móvil y tablet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} noAddToCart={true} />
              ))}
            </div>

            {/* Vista Lista para desktop */}
            <div className="hidden lg:block space-y-4">
              {filteredProducts.map((product) => (
                <ProductListItem key={product.id} product={product} noAddToCart={true} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
