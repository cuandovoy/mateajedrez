import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { ProductCard } from '@/components/features/ProductCard'
import { ProductListItem } from '@/components/features/ProductListItem'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Filter, X } from 'lucide-react'
import type { Product, Category } from '@/types'
import { PostgrestError } from '@supabase/supabase-js'

const PAGE_SIZE = 20

export function CategoryProducts() {
  const { slug, categorySlug } = useParams<{ slug?: string; categorySlug: string }>()
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
  const [showFilters, setShowFilters] = useState(false)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)


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

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Resetear página cuando cambian los filtros
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
      // Find category by slug within this org (slug is unique per org)
      const { data: categoryData = null, error: categoryError }: { data: Category | null, error: PostgrestError | null } = await supabase
        .from('categories')
        .select('*')
        .eq('organization_id', orgId)
        .eq('slug', categorySlug)
        .single()

      if (categoryError) throw categoryError

      if (categoryData) {
        let parentCategory: Category
        let selectedSubcategoryId: string | null = null

        // Check if it's a parent category or a subcategory
        if (categoryData.parent_id) {
          // It's a subcategory - fetch the parent category
          const { data: parentData, error: parentError } = await supabase
            .from('categories')
            .select('*')
            .eq('id', categoryData.parent_id)
            .single()

          if (parentError) throw parentError
          if (!parentData) {
            throw new Error('Parent category not found')
          }

          parentCategory = parentData
          selectedSubcategoryId = categoryData.id as string
          setCurrentCategory(categoryData) // Set the subcategory as current
        } else {
          // It's a parent category
          parentCategory = categoryData
          setCurrentCategory(categoryData) // Set the parent as current
        }

        setParentCategory(parentCategory)

        // Fetch all subcategories of the parent
        const { data: subcats, error: subcatsError }: { data: Category[] | null, error: PostgrestError | null } = await supabase
          .from('categories')
          .select('*')
          .eq('parent_id', parentCategory.id as string)
          .order('name')

        if (!subcatsError && subcats && subcats.length > 0) {
          setSubcategories(subcats)
          
          // If we navigated to a specific subcategory, select only that one
          // Otherwise, select all subcategories by default
          if (selectedSubcategoryId) {
            setSelectedSubcategories([selectedSubcategoryId])
          } else {
            setSelectedSubcategories(subcats.map((cat) => cat.id as string))
          }
        } else {
          // No subcategories, clear selection
          setSubcategories([])
          setSelectedSubcategories([])
        }

        // Fetch products initially (pass org from category)
        await fetchProductsForCategory(parentCategory.id as string, subcats || [], categoryData.organization_id)
      }
    } catch (error) {
      console.error('Error fetching category:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProductsForCategory = async (parentId: string, subcats: Category[], organizationId?: string, page = 1, append = false) => {
    try {
      const allCategoryIds = [parentId]
      if (subcats.length > 0) {
        allCategoryIds.push(...subcats.map((cat) => cat.id as string))
      }

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE // uno extra para detectar si hay más

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

      if (subcats.length === 0) {
        query = query.eq('category_id', parentId as string)
      } else if (selectedSubcategories.length === 0 || selectedSubcategories.length === subcats.length) {
        query = query.in('category_id', allCategoryIds)
      } else {
        query = query.in('category_id', selectedSubcategories as string[])
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

  const filteredProducts = products

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
    if (selectedSubcategories.length === subcategories.length) {
      // Si todas están seleccionadas, deseleccionar todas
      setSelectedSubcategories([])
    } else {
      // Seleccionar todas
      setSelectedSubcategories(subcategories.map((cat) => cat.id as string))
    }
  }

  const clearFilters = () => {
    setSelectedSubcategories(subcategories.map((cat) => cat.id as string))
    setPriceRange({ min: '', max: '' })
    setSearchTerm('')
  }

  const hasActiveFilters = 
    (selectedSubcategories.length > 0 && selectedSubcategories.length < subcategories.length) ||
    priceRange.min ||
    priceRange.max

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200"></div>
      </div>
    )
  }

  if (!parentCategory) {
    return (
      <div className="container-custom py-8 text-center">
        <p className="text-gray-600 text-lg mb-4">Categoría no encontrada</p>
        <Link to={slug ? `/${slug}/products` : '/products'}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a productos
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container-custom py-8">
      <Link to={slug ? `/${slug}/products` : '/products'}>
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a productos
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {currentCategory?.name || parentCategory?.name}
        </h1>
        {(currentCategory?.description || parentCategory?.description) && (
          <p className="text-gray-600">
            {currentCategory?.description || parentCategory?.description}
          </p>
        )}
        {currentCategory?.parent_id && parentCategory && (
          <p className="text-sm text-gray-500 mt-1">
            Categoría: {parentCategory.name}
          </p>
        )}
        <div className="flex flex-col md:flex-row gap-4 mt-4">
          <Input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
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
              {/* Filtro por subcategoría */}
              {subcategories.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Subcategorías
                    </label>
                    <button
                      onClick={handleSelectAllSubcategories}
                      className="text-xs text-primary-200 hover:text-primary-300"
                    >
                      {selectedSubcategories.length === subcategories.length
                        ? 'Deseleccionar todas'
                        : 'Seleccionar todas'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <label className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSubcategories.length === subcategories.length}
                        onChange={handleSelectAllSubcategories}
                        className="h-4 w-4 text-primary-200 focus:ring-primary-200 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700 font-medium">Todas</span>
                    </label>
                    {subcategories.map((subcat) => (
                      <label
                        key={subcat.id as string}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubcategories.includes(subcat.id as string as string)}
                          onChange={() => handleSubcategoryToggle(subcat.id as string)}
                          className="h-4 w-4 text-primary-200 focus:ring-primary-200 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{subcat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
                {subcategories.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Subcategorías
                      </label>
                      <button
                        onClick={handleSelectAllSubcategories}
                        className="text-xs text-primary-200 hover:text-primary-300"
                      >
                        {selectedSubcategories.length === subcategories.length
                          ? 'Deseleccionar todas'
                          : 'Seleccionar todas'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      <label className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSubcategories.length === subcategories.length}
                          onChange={handleSelectAllSubcategories}
                          className="h-4 w-4 text-primary-200 focus:ring-primary-200 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700 font-medium">Todas</span>
                      </label>
                      {subcategories.map((subcat) => (
                        <label
                          key={subcat.id as string}
                          className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSubcategories.includes(subcat.id as string)}
                            onChange={() => handleSubcategoryToggle(subcat.id as string)}
                            className="h-4 w-4 text-primary-200 focus:ring-primary-200 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{subcat.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
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
                  : 'No hay productos disponibles en esta categoría'}
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
                    stock={product.stock ?? 0}
                    basePath={slug ? `/${slug}` : ''}
                  />
                ))}
              </div>

              {/* Vista Lista para desktop */}
              <div className="hidden lg:block space-y-4">
                {filteredProducts.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    stock={product.stock ?? 0}
                    basePath={slug ? `/${slug}` : ''}
                  />
                ))}
              </div>

              {(hasMore || isLoadingMore) && (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
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
