import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ProductCard } from '@/components/features/ProductCard'
import { ProductListItem } from '@/components/features/ProductListItem'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Filter, X } from 'lucide-react'
import type { Product, Category } from '@/types'
import { PostgrestError } from '@supabase/supabase-js'

export function CategoryProducts() {
  const { categorySlug } = useParams<{ categorySlug: string }>()
  const [products, setProducts] = useState<Product[]>([])
  const [parentCategory, setParentCategory] = useState<Category | null>(null)
  const [subcategories, setSubcategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (categorySlug) {
      fetchCategoryAndProducts()
    }
  }, [categorySlug])

  useEffect(() => {
    if (parentCategory || selectedSubcategories.length > 0 || priceRange.min || priceRange.max) {
      fetchProducts()
    }
  }, [parentCategory, selectedSubcategories, priceRange.min, priceRange.max])

  const fetchCategoryAndProducts = async () => {
    if (!categorySlug) return

    try {
      // Fetch parent category by slug
      const { data: categoryData = null, error: categoryError }: { data: Category | null, error: PostgrestError | null } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', categorySlug)
        .is('parent_id', null)
        .single()

      if (categoryError) throw categoryError

      if (categoryData) {
        setParentCategory(categoryData)

        // Fetch subcategories
        const { data: subcats, error: subcatsError }: { data: Category[] | null, error: PostgrestError | null } = await supabase
          .from('categories')
          .select('*')
          .eq('parent_id', categoryData?.id as string)
          .order('name')

        if (!subcatsError && subcats) {
          setSubcategories(subcats)
          // Por defecto, todas las subcategorías están seleccionadas
          setSelectedSubcategories(subcats?.map((cat) => cat.id as string) || [])
        }

        // Fetch products initially
        await fetchProductsForCategory(categoryData?.id as string, subcats?.map((cat) => cat) || [])
      }
    } catch (error) {
      console.error('Error fetching category:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProductsForCategory = async (parentId: string, subcats: Category[]) => {
    try {
      // Build category IDs array (parent + all subcategories)
      const allCategoryIds = [parentId]
      if (subcats.length > 0) {
        allCategoryIds.push(...subcats.map((cat) => cat.id as string))
      }

      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true)

      // Filter by selected subcategories
      if (subcats.length === 0) {
        // Si no hay subcategorías, mostrar solo productos de la categoría padre
        query = query.eq('category_id', parentId as string)
      } else if (
        selectedSubcategories.length === 0 ||
        selectedSubcategories.length === subcats.length
      ) {
        // Si todas están seleccionadas o ninguna, mostrar todas (parent + subcategories)
        query = query.in('category_id', allCategoryIds)
      } else {
        // Si hay algunas seleccionadas, filtrar solo por las seleccionadas
        query = query.in('category_id', selectedSubcategories as string[])
      }

      if (priceRange.min) {
        query = query.gte('price', parseFloat(priceRange.min))
      }

      if (priceRange.max) {
        query = query.lte('price', parseFloat(priceRange.max))
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchProducts = async () => {
    if (!parentCategory) return
    await fetchProductsForCategory(parentCategory.id, subcategories)
  }

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
        <Link to="/products">
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
      <Link to="/products">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a productos
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{parentCategory?.name}</h1>
        {parentCategory?.description && (
          <p className="text-gray-600">{parentCategory?.description}</p>
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
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Vista Lista para desktop */}
              <div className="hidden lg:block space-y-4">
                {filteredProducts.map((product) => (
                  <ProductListItem key={product.id} product={product} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
