import { ProductCard } from '@/components/features/ProductCard'
import { Skeleton, SkeletonProductCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useFilteredProducts } from '@/hooks/usePublicProducts'
import { sortByStockFirst } from '@/lib/stock'
import { absoluteUrl } from '@/lib/siteUrl'
import type { Product } from '@/types'
import { Search, X, PackageSearch } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'

const META_DESCRIPTION =
  'Explorá todo el catálogo de mates y accesorios artesanales de Mates Ajedrez — mates en cuero crudo y algarrobo, hechos a mano en Paysandú, Uruguay.'

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

  // No limpiamos allProducts acá: TanStack Query mantiene los resultados
  // anteriores visibles (placeholderData) mientras carga los nuevos — vaciar
  // el estado local a mano generaba un flash de "Sin resultados" falso antes
  // de que llegara la respuesta real. El efecto de sync de más abajo
  // reemplaza allProducts en cuanto llegan los datos de la página 1.
  useEffect(() => {
    setCurrentPage(1)
  }, [orgId, selectedCategory, priceRange.min, priceRange.max, debouncedSearchTerm])

  const { data: categoriesData } = usePublicCategories(orgId ?? '')
  const categories = (categoriesData ?? []).filter((cat) => !cat.parent_id)
  // Subcategorías (ej. LLAVEROS, BOMBILLAS APLIQUES) — antes solo alcanzables vía
  // el dropdown del header o el footer. selectCategory(id) ya soporta cualquier
  // category_id (padre o hijo): useFilteredProducts filtra por category_id
  // directo + junction table, sin necesidad de lógica adicional acá.
  const subcategories = (categoriesData ?? []).filter((cat) => !!cat.parent_id)

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

  // Elegir una categoría arranca una búsqueda nueva enfocada en esa categoría —
  // un término de búsqueda de texto libre que haya quedado tipeado ya no aplica.
  const selectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId)
    setSearchTerm('')
    setDebouncedSearchTerm('')
  }

  const sortedProducts = useMemo(
    () => sortByStockFirst(allProducts, allStock),
    [allProducts, allStock]
  )

  const hasActiveFilters = !!(selectedCategory || priceRange.min || priceRange.max || searchTerm)
  const isLoadingMore = isFetching && currentPage > 1
  const isFiltering = isFetching && currentPage === 1
  const hasMore = pageData?.hasMore ?? false

  const seo = (
    <Helmet>
      <title>Todos los productos | Mates Ajedrez</title>
      <meta name="description" content={META_DESCRIPTION} />
      <meta property="og:title" content="Todos los productos | Mates Ajedrez" />
      <meta property="og:description" content={META_DESCRIPTION} />
      <meta property="og:url" content={absoluteUrl('/products')} />
      <link rel="canonical" href={absoluteUrl('/products')} />
    </Helmet>
  )

  if (isLoading && allProducts.length === 0) {
    return (
      <div className="container-custom py-8">
        {seo}
        <Skeleton className="h-10 w-72 mb-6 rounded-lg" />
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
      {seo}
      <div className="mb-8 pb-6 border-b border-brand-line">
        <p className="brand-eyebrow mb-2">Nuestros mates</p>
        <h1
          className="brand-title text-2xl md:text-3xl mb-1"
        >
          Todos los productos
        </h1>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          {isFiltering ? (
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-brand-muted"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted pointer-events-none" />
          )}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full h-10 pl-9 pr-8 border border-brand-line rounded-full text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-cuero focus:border-brand-cuero transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => selectCategory('')}
              className={`h-10 px-4 rounded-full font-heading text-xs font-semibold uppercase tracking-[0.14em] transition-colors border ${
                !selectedCategory
                  ? 'bg-brand-cuero border-brand-cuero text-brand-crema'
                  : 'bg-transparent border-brand-line text-brand-tinta hover:border-brand-cuero'
              }`}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                className={`h-10 px-4 rounded-full font-heading text-xs font-semibold uppercase tracking-[0.14em] transition-colors border ${
                  selectedCategory === cat.id
                    ? 'bg-brand-cuero border-brand-cuero text-brand-crema'
                    : 'bg-transparent border-brand-line text-brand-tinta hover:border-brand-cuero'
                }`}
              >
                {cat.name}
              </button>
            ))}
            {/* Subcategorías — mismo pill, borde más sutil cuando no están
                seleccionadas para diferenciarlas visualmente de las categorías padre */}
            {subcategories.map((subcat) => (
              <button
                key={subcat.id}
                onClick={() => selectCategory(subcat.id)}
                className={`h-10 px-4 rounded-full font-heading text-xs font-semibold uppercase tracking-[0.14em] transition-colors border ${
                  selectedCategory === subcat.id
                    ? 'bg-brand-cuero border-brand-cuero text-brand-crema'
                    : 'bg-transparent border-brand-line text-brand-tinta hover:border-brand-cuero'
                }`}
              >
                {subcat.name}
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
            className="w-28 h-10 px-3 border border-brand-line rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-cuero focus:border-brand-cuero bg-white"
          />
          <span className="text-brand-muted text-sm">—</span>
          <input
            type="number"
            placeholder="Precio máx."
            value={priceRange.max}
            onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
            className="w-28 h-10 px-3 border border-brand-line rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-cuero focus:border-brand-cuero bg-white"
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
      {allProducts.length === 0 && !isFiltering ? (
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
        <div className={isFiltering ? 'opacity-50 transition-opacity duration-200' : 'transition-opacity duration-200'}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {sortedProducts.map((product, index) => (
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
                className="px-8"
              >
                {isLoadingMore ? 'Cargando...' : 'Cargar más'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
