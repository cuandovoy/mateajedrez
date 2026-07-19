import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { ProductCard } from '@/components/features/ProductCard'
import { Skeleton, SkeletonProductCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Search, X, PackageSearch } from 'lucide-react'
import type { Product, Category } from '@/types'
import { PostgrestError } from '@supabase/supabase-js'
import { getProductsStock } from '@/lib/stock'

const PAGE_SIZE = 20

export function CategoryProducts() {
  const { categorySlug } = useParams<{ categorySlug: string }>()
  const { organization } = usePublicStore()
  const orgId = organization.id
  const [products, setProducts] = useState<Product[]>([])
  const [parentCategory, setParentCategory] = useState<Category | null>(null)
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null)
  const [subcategories, setSubcategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [stockByProduct, setStockByProduct] = useState<Record<string, number>>({})

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [categorySlug])

  useEffect(() => {
    if (categorySlug && orgId) {
      fetchCategoryAndProducts()
    } else if (categorySlug && !orgId) {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug, orgId])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage(1)
    setProducts([])
  }, [selectedSubcategories, priceRange.min, priceRange.max, debouncedSearchTerm])

  useEffect(() => {
    if (parentCategory || selectedSubcategories.length > 0 || priceRange.min || priceRange.max || debouncedSearchTerm) {
      fetchProducts(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentCategory, selectedSubcategories, priceRange.min, priceRange.max, debouncedSearchTerm])

  const fetchCategoryAndProducts = async () => {
    if (!categorySlug || !orgId) return

    try {
      const { data: categoryData = null, error: categoryError }: { data: Category | null, error: PostgrestError | null } = await supabase
        .from('categories')
        .select('*')
        .eq('organization_id', orgId)
        .eq('slug', categorySlug)
        .single()

      if (categoryError) throw categoryError

      if (categoryData) {
        let parentCat: Category
        let selectedSubcategoryId: string | null = null

        if (categoryData.parent_id) {
          const { data: parentData, error: parentError } = await supabase
            .from('categories')
            .select('*')
            .eq('id', categoryData.parent_id)
            .single()

          if (parentError) throw parentError
          if (!parentData) throw new Error('Parent category not found')

          parentCat = parentData
          selectedSubcategoryId = categoryData.id as string
        } else {
          parentCat = categoryData
        }

        const { data: subcats, error: subcatsError }: { data: Category[] | null, error: PostgrestError | null } = await supabase
          .from('categories')
          .select('*')
          .eq('parent_id', parentCat.id as string)
          .order('name')

        // Batch all state updates together so the useEffect fires once with correct values
        setCurrentCategory(categoryData)
        setParentCategory(parentCat)

        let initialSelectedIds: string[]
        if (!subcatsError && subcats && subcats.length > 0) {
          // [] = no filter (parent page); [id] = specific subcategory selected
          initialSelectedIds = selectedSubcategoryId ? [selectedSubcategoryId] : []
          setSubcategories(subcats)
          setSelectedSubcategories(initialSelectedIds)
        } else {
          initialSelectedIds = []
          setSubcategories([])
          setSelectedSubcategories([])
        }

        // Pass initialSelectedIds explicitly — avoids reading stale closure state
        await fetchProductsForCategory(parentCat.id as string, subcats || [], categoryData.organization_id, 1, false, initialSelectedIds)
      }
    } catch (error) {
      console.error('Error fetching category:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProductsForCategory = async (parentId: string, subcats: Category[], organizationId?: string, page = 1, append = false, overrideSelectedIds?: string[]) => {
    try {
      const effectiveSelected = overrideSelectedIds !== undefined ? overrideSelectedIds : selectedSubcategories

      // [] = no filter → show everything; [ids] = filter to those specific subcategories
      let filterCategoryIds: string[]
      if (subcats.length === 0 || effectiveSelected.length === 0) {
        filterCategoryIds = [parentId, ...subcats.map((c) => c.id as string)]
      } else {
        filterCategoryIds = effectiveSelected as string[]
      }

      // Look up product IDs via the product_categories junction table.
      // Products may have category_id pointing to the parent even when linked to a
      // subcategory only through product_categories — so we must check both.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data: pcLinks } = await sb
        .from('product_categories')
        .select('product_id')
        .in('category_id', filterCategoryIds)

      const junctionProductIds = ((pcLinks ?? []) as { product_id: string }[]).map((l) => l.product_id)

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE

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
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (organizationId) query = query.eq('organization_id', organizationId)

      if (junctionProductIds.length > 0) {
        // Union: products matched via junction OR via direct category_id (legacy)
        const catList = filterCategoryIds.join(',')
        const idList = junctionProductIds.join(',')
        query = query.or(`category_id.in.(${catList}),id.in.(${idList})`)
      } else {
        // No junction entries: fall back to direct category_id filter
        query = query.in('category_id', filterCategoryIds)
      }

      if (priceRange.min) query = query.gte('price', parseFloat(priceRange.min))
      if (priceRange.max) query = query.lte('price', parseFloat(priceRange.max))

      if (debouncedSearchTerm.trim()) {
        const term = `%${debouncedSearchTerm.trim()}%`
        query = query.or(`name.ilike.${term},description.ilike.${term},sku.ilike.${term}`)
      }

      const { data, error } = await query
      if (error) throw error

      const rows = data ?? []
      const more = rows.length > PAGE_SIZE
      const pageProducts = more ? rows.slice(0, PAGE_SIZE) : rows

      setProducts((prev) => append ? [...prev, ...pageProducts] : pageProducts)
      setHasMore(more)
      setCurrentPage(page)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const fetchProducts = async (page = 1, append = false) => {
    if (!parentCategory) return
    await fetchProductsForCategory(parentCategory.id, subcategories, parentCategory.organization_id, page, append)
  }

  const handleLoadMore = () => {
    setIsLoadingMore(true)
    fetchProducts(currentPage + 1, true)
  }

  const handleSubcategoryToggle = (subcategoryId: string) => {
    setSelectedSubcategories((prev) => {
      if (prev.includes(subcategoryId)) {
        return prev.filter((id) => id !== subcategoryId)
      } else {
        return [...prev, subcategoryId]
      }
    })
  }

  const handleSelectAllSubcategories = () => {
    setSelectedSubcategories([])
  }

  useEffect(() => {
    if (products.length === 0) { setStockByProduct({}); return }
    let cancelled = false
    const oid = parentCategory?.organization_id || organization.id
    getProductsStock(products.map((p) => p.id), null, oid)
      .then((stocks) => { if (!cancelled) setStockByProduct(stocks) })
      .catch(() => { if (!cancelled) setStockByProduct({}) })
    return () => { cancelled = true }
  }, [products])

  const clearFilters = () => {
    setSelectedSubcategories([])
    setPriceRange({ min: '', max: '' })
    setSearchTerm('')
  }

  const hasActiveFilters =
    selectedSubcategories.length > 0 ||
    !!(priceRange.min || priceRange.max || searchTerm)

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

  if (!parentCategory) {
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

  return (
    <div className="container-custom py-8">
      <Link to="/products">
        <Button variant="ghost" className="mb-6 -ml-2 text-sm rounded-full" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Todos los productos
        </Button>
      </Link>

      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-gray-900 mb-1"
          style={{ fontFamily: 'var(--org-font-heading, var(--org-font-family, Cambria))' }}
        >
          {currentCategory?.name || parentCategory?.name}
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
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
                selectedSubcategories.length === 0
                  ? 'border-transparent shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={selectedSubcategories.length === 0 ? { backgroundColor: 'var(--org-primary-color, #46362B)', color: 'var(--org-primary-ink, white)' } : undefined}
            >
              Todas
            </button>
            {subcategories.map((subcat) => {
              const isActive = selectedSubcategories.includes(subcat.id as string)
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
      {products.length === 0 ? (
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
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {products.map((product, index) => (
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
        </>
      )}
    </div>
  )
}
