import { ProductCard } from '@/components/features/ProductCard'
import { ProductListItem } from '@/components/features/ProductListItem'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization'
import { getProductsStock } from '@/lib/stock'
import { supabase } from '@/lib/supabase'
import { useOrganizationStore } from '@/store/organizationStore'
import type { Category, Product } from '@/types'
import { Filter, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_STORE_SLUG = 'default'

export function Products() {
  const { organization, isPublicStore, slug } = useCurrentOrganization()
  const fetchOrgBySlug = useOrganizationStore((s) => s.fetchOrgBySlug)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [stockByProduct, setStockByProduct] = useState<Record<string, number>>({})
  const [hasVariantsByProduct, setHasVariantsByProduct] = useState<Record<string, boolean>>({})
  const productsCacheRef = useRef<
    Map<string, { products: Product[]; stockByProduct: Record<string, number>; hasVariantsByProduct: Record<string, boolean> }>
  >(new Map())

  useEffect(() => {
    const loadOrg = async () => {
      if (isPublicStore && organization) {
        setOrgId(organization.id)
      } else {
        const id = organization?.id ?? (await fetchOrgBySlug(DEFAULT_STORE_SLUG))?.id
        setOrgId(id ?? null)
      }
    }
    loadOrg()
  }, [organization, isPublicStore, fetchOrgBySlug])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim())
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchTerm])

  useEffect(() => {
    if (!orgId) return
    fetchCategories()
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    fetchProducts()
  }, [orgId, selectedCategory, priceRange.min, priceRange.max, debouncedSearchTerm])

  const fetchProducts = async () => {
    if (!orgId) return

    const normalizedSearch = debouncedSearchTerm.toLowerCase()
    const cacheKey = JSON.stringify({
      orgId,
      selectedCategory,
      min: priceRange.min,
      max: priceRange.max,
      search: normalizedSearch,
    })
    const cachedResult = productsCacheRef.current.get(cacheKey)
    if (cachedResult) {
      setProducts(cachedResult.products)
      setStockByProduct(cachedResult.stockByProduct)
      setHasVariantsByProduct(cachedResult.hasVariantsByProduct)
      setLoading(false)
      setIsRefreshing(false)
      return
    }

    const shouldBlockPage = loading && products.length === 0
    try {
      if (!shouldBlockPage) {
        setIsRefreshing(true)
      }
      let query = supabase
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
        .eq('organization_id', orgId)
        .eq('is_active', true)

      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory)
      }

      if (priceRange.min) {
        query = query.gte('price', parseFloat(priceRange.min))
      }

      if (priceRange.max) {
        query = query.lte('price', parseFloat(priceRange.max))
      }

      if (normalizedSearch) {
        const safeTerm = normalizedSearch.replace(/[%]/g, '').replace(/,/g, ' ').trim()
        if (safeTerm) {
          query = query.or(`name.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%,sku.ilike.%${safeTerm}%`)
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      const productsData = (data || []) as Product[]
      const productIds = productsData.map((product) => product.id)
      const [stocks, variantsResult] = await Promise.all([
        getProductsStock(productIds, null, orgId),
        productIds.length > 0
          ? supabase
              .from('product_variants')
              .select('product_id')
              .in('product_id', productIds)
              .eq('is_active', true)
          : Promise.resolve({ data: [], error: null }),
      ])

      const variantsMap: Record<string, boolean> = {}
      if (!variantsResult.error && variantsResult.data) {
        for (const row of variantsResult.data as Array<{ product_id: string }>) {
          variantsMap[row.product_id] = true
        }
      }

      productsCacheRef.current.set(cacheKey, {
        products: productsData,
        stockByProduct: stocks,
        hasVariantsByProduct: variantsMap,
      })
      setProducts(productsData)
      setStockByProduct(stocks)
      setHasVariantsByProduct(variantsMap)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const fetchCategories = async () => {
    if (!orgId) return
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('organization_id', orgId)
        .is('parent_id', null)
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const filteredProducts = useMemo(() => products, [products])

  const clearFilters = () => {
    setSelectedCategory('')
    setPriceRange({ min: '', max: '' })
    setSearchTerm('')
  }

  const hasActiveFilters = selectedCategory || priceRange.min || priceRange.max

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200"></div>
      </div>
    )
  }

  return (
    <div className="container-custom py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Productos</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          {isRefreshing && (
            <div className="flex items-center text-sm text-gray-500 px-2">
              Buscando...
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar de filtros - Desktop */}
        <aside className="hidden md:block w-64 flex-shrink-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Filtros</CardTitle>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-primary-200 hover:text-primary-300"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Filtro por categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoría
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por precio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rango de Precio
                </label>
                <div className="space-y-2">
                  <Input
                    type="number"
                    placeholder="Precio mínimo"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Precio máximo"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Filtros móviles */}
        {showFilters && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden">
            <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-xl overflow-y-auto">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Filtros</h2>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoría
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">Todas las categorías</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rango de Precio
                  </label>
                  <div className="space-y-2">
                    <Input
                      type="number"
                      placeholder="Precio mínimo"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Precio máximo"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={() => setShowFilters(false)} className="w-full">
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de productos */}
        <div className="flex-1">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                {searchTerm || hasActiveFilters
                  ? 'No se encontraron productos con los filtros seleccionados'
                  : 'No hay productos disponibles'}
              </p>
              {hasActiveFilters && (
                <Button onClick={clearFilters} className="mt-4" variant="outline">
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Vista Cards para móvil y tablet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    stock={stockByProduct[product.id]}
                    hasVariants={Boolean(hasVariantsByProduct[product.id])}
                    basePath={isPublicStore && slug ? `/${slug}` : ''}
                  />
                ))}
              </div>

              {/* Vista Lista para desktop */}
              <div className="hidden lg:block space-y-4">
                {filteredProducts.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    stock={stockByProduct[product.id]}
                    hasVariants={Boolean(hasVariantsByProduct[product.id])}
                    basePath={isPublicStore && slug ? `/${slug}` : ''}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
