import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ProductCard } from '@/components/features/ProductCard'
import { CategoryCard } from '@/components/features/CategoryCard'
import type { Product, Category } from '@/types'
import { Button } from '@/components/ui/Button'
import { ArrowRight } from 'lucide-react'

export function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            product_images (
              id,
              image_url,
              display_order,
              is_primary
            )
          `)
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


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200"></div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      {/* Hero Banner Section */}
      <section className="relative w-full mb-0">
        <div className="relative w-full">
          <img
            src="/banner1.png"
            alt="Banner Flormaria Soria González"
            className="w-full h-auto object-cover max-h-[50vh] md:max-h-[70vh] lg:max-h-[80vh]"
          />
          <Link 
            to="/products" 
            className="absolute bottom-8 md:bottom-12 left-1/2 transform -translate-x-1/2 z-10"
          >
            <Button 
              size="lg" 
              className="px-8 py-4 md:px-12 md:py-5 text-base md:text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <span className="flex items-center gap-2">
                <span>💎</span>
                <span>Accesorios</span>
              </span>
            </Button>
          </Link>
        </div>
      </section>

      {/* Categories Section */}
      {categories.length > 0 && (
        <section className="py-12 md:py-16 bg-gray-50 border-b border-gray-200">
          <div className="container-custom">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                🛍️ Nuestras Categorías
              </h2>
              <p className="text-gray-600 text-lg md:text-xl">
                Explora nuestras colecciones
              </p>
            </div>
            <div className="w-full max-w-7xl mx-auto px-4 md:px-6">
              {categories.length <= 2 ? (
                // Layout centrado para pocas categorías
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 md:gap-8 lg:gap-12">
                  {categories.map((category) => (
                    <div key={category.id} className="w-full sm:w-[400px] md:w-[450px] lg:w-[500px]">
                      <CategoryCard category={category} />
                    </div>
                  ))}
                </div>
              ) : categories.length <= 4 ? (
                // Grid de 2 columnas para 3-4 categorías
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
                  {categories.map((category) => (
                    <div key={category.id} className="w-full">
                      <CategoryCard category={category} />
                    </div>
                  ))}
                </div>
              ) : (
                // Grid estándar para muchas categorías
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  {categories.map((category) => (
                    <div key={category.id} className="w-full">
                      <CategoryCard category={category} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products Section */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container-custom">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              ✨ Productos Destacados
            </h2>
            <p className="text-gray-600 text-lg md:text-xl">
              Lo más nuevo de nuestra colección
            </p>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-600 text-lg">
                No hay productos disponibles
              </p>
            </div>
          ) : (
            <div className="w-full max-w-7xl mx-auto px-4 md:px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {products.slice(0, 4).map((product) => (
                  <div key={product.id} className="w-full">
                    <ProductCard product={product} noAddToCart={false} />
                  </div>
                ))}
              </div>
              {products.length > 4 && (
                <div className="text-center mt-10 md:mt-12">
                  <Link to="/products">
                    <Button size="lg" className="bg-primary-400 text-white px-8 py-3 text-base font-semibold flex items-center justify-center gap-2">
                      Ver todos los productos
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
