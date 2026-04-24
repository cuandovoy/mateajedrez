import { ProductCard } from '@/components/features/ProductCard'
import { ProductListItem } from '@/components/features/ProductListItem'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization'
import { useOrganizationStore } from '@/store/organizationStore'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useFilteredProducts } from '@/hooks/usePublicProducts'
import type { Product } from '@/types'
import { Filter, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const DEFAULT_STORE_SLUG = 'default'

export function Products() {
  const { organization, isPublicStore, slug } = useCurrentOrganization()
  const fetchOrgBySlug = useOrganizationStore((s) => s.fetchOrgBySlug)
  const [searchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Productos acumulados para "cargar más"
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [allStock, setAllStock] = useState<Record<string, number>>({})
  const [allVariants, setAllVariants] = useState<Record<string, boolean>>({})

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
    return () => window.clearTimeout(timeoutId)
  }, [searchTerm])

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1)
    setAllProducts([])
    setAllStock({})
    setAllVariants({})
  }, [orgId, selectedCategory, priceRange.min, priceRange.max, debouncedSearchTerm])

  const { data: categoriesData } = usePublicCategories(orgId ?? '')
  const categories = (categoriesData ?? []).filter((cat) => !cat.parent_id)

  const { data: pageData, isFetching, isLoading } = useFilteredProducts(orgId, {
    categoryId: selectedCategory,
    minPrice: priceRange.min,
    maxPrice: priceRange.max,
    search: debouncedSearchTerm,
    page: currentPage,
  })

  // Acumular productos al llegar datos de cada página
  useEffect(() => {
    if (!pageData) return
    if (currentPage === 1) {
      setAllProducts(pageData.products)
      setAllStock(pageData.stockByProduct)
      setAllVariants(pageData.hasVariantsByProduct)
    } else {
      setAllProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        return [...prev, ...pageData.products.filter((p) => !existingIds.has(p.id))]
      })
      setAllStock((prev) => ({ ...prev, ...pageData.stockByProduct }))
      setAllVariants((prev) => ({ ...prev, ...pageData.hasVariantsByProduct }))
    }
  }, [pageData, currentPage])

  const clearFilters = () => {
    setSelectedCategory('')
    setPriceRange({ min: '', max: '' })
    setSearchTerm('')
  }

  const hasActiveFilters = selectedCategory || priceRange.min || priceRange.max
  const isLoadingMore = isFetching && currentPage > 1
  const isRefreshing = isFetching && currentPage === 1 && allProducts.length > 0
  const hasMore = pageData?.hasMore ?? false

  if (isLoading && allProducts.length === 0) {
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
          {allProducts.length === 0 ? (
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
                {allProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    stock={allStock[product.id]}
                    hasVariants={Boolean(allVariants[product.id])}
                    basePath={isPublicStore && slug ? `/${slug}` : ''}
                  />
                ))}
              </div>

              {/* Vista Lista para desktop */}
              <div className="hidden lg:block space-y-4">
                {allProducts.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    stock={allStock[product.id]}
                    hasVariants={Boolean(allVariants[product.id])}
                    basePath={isPublicStore && slug ? `/${slug}` : ''}
                  />
                ))}
              </div>

              {(hasMore || isLoadingMore) && (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? 'Cargando...' : 'Cargar más'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
