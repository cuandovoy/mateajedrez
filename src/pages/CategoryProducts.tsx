import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useCategoryProducts } from '@/hooks/usePublicProducts'
import { ProductCard } from '@/components/features/ProductCard'
import { Skeleton, SkeletonProductCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Search, X, PackageSearch } from 'lucide-react'
import type { Product } from '@/types'
import { sortByStockFirst } from '@/lib/stock'
import { absoluteUrl } from '@/lib/siteUrl'
import { buildBreadcrumbJsonLd } from '@/lib/jsonLd'

export function CategoryProducts() {
  const { categorySlug } = useParams<{ categorySlug: string }>()
  const { organization } = usePublicStore()
  const orgId = organization.id

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[] | null>(null)
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [products, setProducts] = useState<Product[]>([])
  const [stockByProduct, setStockByProduct] = useState<Record<string, number>>({})

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    // Acá sí limpiamos productos: es un cambio de categoría real (otro listado
    // completo), a diferencia de tocar un filtro dentro de la misma categoría
    // (ver el otro efecto de reset más abajo, que NO limpia para evitar el
    // flash de "Sin resultados").
    setProducts([])
  }, [categorySlug])

  // Al cambiar de categoría, descartamos la selección de subcategoría explícita
  // anterior — se recalcula el default a partir de la categoría resuelta.
  useEffect(() => {
    setSelectedSubcategories(null)
  }, [categorySlug])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const { data: categoriesData, isLoading: categoriesLoading } = usePublicCategories(orgId)

  // Resolución de categoría/padre/subcategorías a partir del listado ya
  // filtrado por organization_id (usePublicCategories) — evita repetir queries
  // sin ese filtro y reutiliza el cache ya usado por el menú de la tienda.
  const categoryResolution = useMemo(() => {
    if (!categoriesData || !categorySlug) return null

    const currentCategory = categoriesData.find((c) => c.slug === categorySlug)
    if (!currentCategory) return null

    const parentCategory = currentCategory.parent_id
      ? categoriesData.find((c) => c.id === currentCategory.parent_id)
      : currentCategory
    if (!parentCategory) return null

    const subcategories = categoriesData.filter((c) => c.parent_id === parentCategory.id)
    const defaultSelectedSubcategoryIds =
      subcategories.length > 0 && currentCategory.parent_id ? [currentCategory.id as string] : []

    return { currentCategory, parentCategory, subcategories, defaultSelectedSubcategoryIds }
  }, [categoriesData, categorySlug])

  // [] = sin filtro (ver todo); [id] = subcategoría específica seleccionada
  const effectiveSelectedSubcategories = useMemo(
    () => selectedSubcategories ?? categoryResolution?.defaultSelectedSubcategoryIds ?? [],
    [selectedSubcategories, categoryResolution]
  )

  const filterCategoryIds = useMemo(() => {
    if (!categoryResolution) return []
    const { parentCategory, subcategories } = categoryResolution
    if (subcategories.length === 0 || effectiveSelectedSubcategories.length === 0) {
      return [parentCategory.id as string, ...subcategories.map((c) => c.id as string)]
    }
    return effectiveSelectedSubcategories
  }, [categoryResolution, effectiveSelectedSubcategories])

  useEffect(() => {
    setCurrentPage(1)
    // No limpiamos `products` acá: TanStack Query mantiene la página anterior
    // visible (placeholderData) mientras carga la nueva — vaciar el estado a
    // mano generaba un flash de "Sin resultados" falso antes de que llegara
    // la respuesta real (mismo bug ya corregido en Products.tsx el 2026-07-23).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug, filterCategoryIds.join(','), priceRange.min, priceRange.max, debouncedSearchTerm])

  const {
    data: pageData,
    isLoading: productsLoading,
    isFetching: productsFetching,
  } = useCategoryProducts(orgId, categorySlug, filterCategoryIds, {
    minPrice: priceRange.min,
    maxPrice: priceRange.max,
    search: debouncedSearchTerm,
    page: currentPage,
  })

  useEffect(() => {
    if (!pageData) return
    if (currentPage === 1) {
      setProducts(pageData.products)
      setStockByProduct(pageData.stockByProduct)
    } else {
      setProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        return [...prev, ...pageData.products.filter((p) => !existingIds.has(p.id))]
      })
      setStockByProduct((prev) => ({ ...prev, ...pageData.stockByProduct }))
    }
  }, [pageData, currentPage])

  const handleLoadMore = () => {
    setCurrentPage((p) => p + 1)
  }

  const handleSubcategoryToggle = (subcategoryId: string) => {
    setSelectedSubcategories(
      effectiveSelectedSubcategories.includes(subcategoryId)
        ? effectiveSelectedSubcategories.filter((id) => id !== subcategoryId)
        : [...effectiveSelectedSubcategories, subcategoryId]
    )
  }

  const handleSelectAllSubcategories = () => {
    setSelectedSubcategories([])
  }

  const sortedProducts = useMemo(
    () => sortByStockFirst(products, stockByProduct),
    [products, stockByProduct]
  )

  const clearFilters = () => {
    setSelectedSubcategories([])
    setPriceRange({ min: '', max: '' })
    setSearchTerm('')
  }

  const hasActiveFilters =
    effectiveSelectedSubcategories.length > 0 ||
    !!(priceRange.min || priceRange.max || searchTerm)

  const loading =
    categoriesLoading || (!!categoryResolution && productsLoading && products.length === 0)
  const notFound = !categoriesLoading && !categoryResolution

  if (loading) {
    return (
      <div className="container-custom py-8">
        <Skeleton className="h-8 w-48 mb-6 rounded-xl" />
        <Skeleton className="h-10 w-72 mb-3 rounded-xl" />
        <div className="flex gap-3 flex-wrap mb-8 mt-6">
          <Skeleton className="h-10 flex-1 min-w-[200px] rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonProductCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (notFound || !categoryResolution) {
    return (
      <div className="container-custom py-8 text-center">
        <p className="text-gray-600 text-lg mb-4">Categoría no encontrada</p>
        <Link to="/products">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a productos
          </Button>
        </Link>
      </div>
    )
  }

  const { currentCategory, parentCategory, subcategories } = categoryResolution
  const displayCategory = currentCategory ?? parentCategory
  const isLoadingMore = productsFetching && currentPage > 1
  const isFiltering = productsFetching && currentPage === 1
  const hasMore = pageData?.hasMore ?? false
  const metaDescription = `Descubrí nuestra colección de ${displayCategory.name} — artículos artesanales de Ruemia.`
  const canonicalUrl = absoluteUrl(`/categories/${categorySlug}`)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Inicio', url: absoluteUrl('/') },
    { name: displayCategory.name, url: canonicalUrl },
  ])

  return (
    <div className="container-custom py-8">
      <Helmet>
        <title>{`${displayCategory.name} | Ruemia`}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={`${displayCategory.name} | Ruemia`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-700 transition-colors">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span className="text-gray-700 font-medium">{displayCategory.name}</span>
      </nav>

      <Link to="/products">
        <Button variant="ghost" className="mb-6 -ml-2 text-sm rounded-full" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Todos los productos
        </Button>
      </Link>

      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-gray-900 mb-1"
          style={{ fontFamily: 'var(--org-font-heading, var(--org-font-family, Cambria))', letterSpacing: '0.05em' }}
        >
          {displayCategory.name}
        </h1>
        {(currentCategory?.description || parentCategory?.description) && (
          <p className="text-gray-500 text-sm mt-1">
            {currentCategory?.description || parentCategory?.description}
          </p>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          {isFiltering ? (
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          )}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar en esta categoría..."
            className="w-full h-10 pl-9 pr-8 border border-gray-200 rounded-full text-sm bg-white focus:outline-none focus:ring-2 transition-shadow"
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

        {/* Subcategory chips */}
        {subcategories.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSelectAllSubcategories}
              className={`h-10 px-4 rounded-full text-sm font-medium transition-all border ${
                effectiveSelectedSubcategories.length === 0
                  ? 'border-transparent shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={effectiveSelectedSubcategories.length === 0 ? { backgroundColor: 'var(--org-primary-color, #46362B)', color: 'var(--org-primary-ink, white)' } : undefined}
            >
              Todas
            </button>
            {subcategories.map((subcat) => {
              const isActive = effectiveSelectedSubcategories.includes(subcat.id as string)
              return (
                <button
                  key={subcat.id as string}
                  onClick={() => handleSubcategoryToggle(subcat.id as string)}
                  className={`h-10 px-4 rounded-full text-sm font-medium transition-all border ${
                    isActive
                      ? 'border-transparent shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  style={isActive ? { backgroundColor: 'var(--org-primary-color, #46362B)', color: 'var(--org-primary-ink, white)' } : undefined}
                >
                  {subcat.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Price range */}
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="number"
            placeholder="Mín."
            value={priceRange.min}
            onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
            className="w-28 h-10 px-3 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 bg-white"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="number"
            placeholder="Máx."
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
      {products.length === 0 && !isFiltering ? (
        <EmptyState
          icon={PackageSearch}
          title={hasActiveFilters ? 'Sin resultados' : 'Sin productos'}
          description={
            hasActiveFilters
              ? 'No encontramos productos con esos filtros.'
              : 'No hay productos disponibles en esta categoría.'
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
                  stock={stockByProduct[product.id]}
                />
              </div>
            ))}
          </div>

          {(hasMore || isLoadingMore) && (
            <div className="mt-10 flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="rounded-full px-8"
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
