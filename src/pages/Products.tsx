import { ProductCard } from '@/components/features/ProductCard'
import { Skeleton, SkeletonProductCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useFilteredProducts } from '@/hooks/usePublicProducts'
import type { Product } from '@/types'
import { Search, X, PackageSearch } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export function Products() {
  const { organization } = useCurrentOrganization()
  const [searchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const orgId = organization?.id ?? null
  const [currentPage, setCurrentPage] = useState(1)

  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [allStock, setAllStock] = useState<Record<string, number>>({})
  const [allVariants, setAllVariants] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim())
    }, 350)
    return () => window.clearTimeout(timeoutId)
  }, [searchTerm])

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

  const hasActiveFilters = !!(selectedCategory || priceRange.min || priceRange.max || searchTerm)
  const isLoadingMore = isFetching && currentPage > 1
  const hasMore = pageData?.hasMore ?? false

  if (isLoading && allProducts.length === 0) {
    return (
      <div className="container-custom py-8">
        <Skeleton className="h-10 w-72 mb-6 rounded-xl" />
        <div className="flex gap-3 flex-wrap mb-8">
          <Skeleton className="h-10 flex-1 min-w-[200px] rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <SkeletonProductCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container-custom py-8">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-gray-900 mb-1"
          style={{ fontFamily: 'var(--org-font-heading, var(--org-font-family, Cambria))' }}
        >
          Todos los productos
        </h1>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full h-10 pl-9 pr-8 border border-gray-200 rounded-full text-sm bg-white focus:outline-none focus:ring-2 transition-shadow"
            style={{ '--tw-ring-color': 'var(--org-primary-color, #46362B)' } as React.CSSProperties}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('')}
              className={`h-10 px-4 rounded-full text-sm font-medium transition-all border ${
                !selectedCategory
                  ? 'border-transparent shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={!selectedCategory ? { backgroundColor: 'var(--org-primary-color, #46362B)', color: 'var(--org-primary-ink, white)' } : undefined}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`h-10 px-4 rounded-full text-sm font-medium transition-all border ${
                  selectedCategory === cat.id
                    ? 'border-transparent shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                style={selectedCategory === cat.id ? { backgroundColor: 'var(--org-primary-color, #46362B)', color: 'var(--org-primary-ink, white)' } : undefined}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Price range */}
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="number"
            placeholder="Precio mín."
            value={priceRange.min}
            onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
            className="w-28 h-10 px-3 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 bg-white"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="number"
            placeholder="Precio máx."
            value={priceRange.max}
            onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
            className="w-28 h-10 px-3 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 bg-white"
          />
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="h-10 px-3 text-sm text-red-500 border border-red-200 rounded-full hover:bg-red-50 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Products grid */}
      {allProducts.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={searchTerm || hasActiveFilters ? 'Sin resultados' : 'Sin productos'}
          description={
            searchTerm || hasActiveFilters
              ? 'No encontramos productos con esos filtros.'
              : 'No hay productos disponibles.'
          }
          action={hasActiveFilters ? { label: 'Limpiar filtros', onClick: clearFilters } : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {allProducts.map((product, index) => (
              <div
                key={product.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(index * 30, 250)}ms` }}
              >
                <ProductCard
                  product={product}
                  stock={allStock[product.id]}
                  hasVariants={Boolean(allVariants[product.id])}
                />
              </div>
            ))}
          </div>

          {(hasMore || isLoadingMore) && (
            <div className="mt-10 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={isLoadingMore}
                className="rounded-full px-8"
              >
                {isLoadingMore ? 'Cargando...' : 'Cargar más'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
