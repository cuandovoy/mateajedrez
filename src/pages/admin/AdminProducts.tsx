import { BarcodeManager } from '@/components/admin/BarcodeManager'
import { ProductSupplierManager } from '@/components/admin/ProductSupplierManager'
import { ProductTable } from '@/components/admin/ProductTable'
import { VariantManager } from '@/components/admin/VariantManager'
import {
  CategoryFilter,
  PriceRangeFilter,
  SearchFilter,
  StatusFilter,
  StockFilter,
  SupplierFilter,
} from '@/components/filters'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton'
import { Input } from '@/components/ui/Input'
import { deleteImage, uploadProductImage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, formatPrice } from '@/lib/utils'
import type { Branch, Category, Product, ProductImage, ProductInsert, ProductUpdate, Supplier } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, Edit, Filter, Grid3x3, List, Package, Plus, ScanLine, Star, Trash2, Truck, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { getMaxProductImages } from '@/lib/planLimits'
import { useOrganization } from '@/hooks/useOrganization'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { useToastStore } from '@/store/toastStore'
import { z } from 'zod'

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  price: z.number().min(0, 'El precio debe ser mayor a 0'),
  stock: z.number().min(0, 'El stock debe ser mayor o igual a 0'),
  category_id: z.string().min(1, 'La categoría es requerida'),
  sku: z.string().min(1, 'El SKU es requerido'),
  is_active: z.boolean().default(true),
})

interface ProductImageItem {
  id?: string
  image_url: string
  display_order: number
  is_primary: boolean
  file?: File
  preview?: string
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

type ProductForm = z.infer<typeof productSchema>

interface ProductWithImages extends Product {
  product_images?: ProductImage[]
  category?: Category | null
}

type ViewMode = 'grid' | 'list'
type StatusFilterValue = 'all' | 'active' | 'inactive'
type StockFilterValue = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'

interface ProductFilters {
  search: string
  categoryId: string
  supplierId: string
  priceMin: string
  priceMax: string
  status: StatusFilterValue
  stock: StockFilterValue
}

function AdminProductsContent() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { show } = useToastStore()
  const { isAtLimit, productCount, limits, tier } = usePlanLimits()
  const maxProductImages = getMaxProductImages(tier)
  const [products, setProducts] = useState<ProductWithImages[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithImages | null>(null)
  const [productImages, setProductImages] = useState<ProductImageItem[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [variantManagerProduct, setVariantManagerProduct] = useState<Product | null>(null)
  const [barcodeManagerProduct, setBarcodeManagerProduct] = useState<Product | null>(null)
  const [barcodeManagerVariant, setBarcodeManagerVariant] = useState<{ productId: string; variantId: string } | null>(null)
  const [supplierManagerProduct, setSupplierManagerProduct] = useState<Product | null>(null)
  const [initialBranchId, setInitialBranchId] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    categoryId: '',
    supplierId: '',
    priceMin: '',
    priceMax: '',
    status: 'all',
    stock: 'all',
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  })

  const fetchProducts = useCallback(async () => {
    if (!organizationId) return
    try {
      setLoading(true)

      // If filtering by supplier, we need to get product IDs first
      let productIds: string[] | null = null
      if (filters.supplierId) {
        const { data: productSuppliersData, error: supplierError } = await supabase
          .from('product_suppliers')
          .select('product_id')
          .eq('supplier_id', filters.supplierId)

        if (supplierError) throw supplierError
        productIds = productSuppliersData?.map((ps: { product_id: string }) => ps.product_id) || []

        // If no products found for this supplier, return empty array
        if (productIds.length === 0) {
          setProducts([])
          setLoading(false)
          return
        }
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
          ),
          category:categories (
            id,
            name
          )
        `)
        .eq('organization_id', organizationId)

      // Apply filters
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId)
      }

      if (filters.supplierId && productIds) {
        query = query.in('id', productIds)
      }

      if (filters.status !== 'all') {
        query = query.eq('is_active', filters.status === 'active')
      }

      if (filters.priceMin) {
        query = query.gte('price', parseFloat(filters.priceMin))
      }

      if (filters.priceMax) {
        query = query.lte('price', parseFloat(filters.priceMax))
      }

      if (filters.stock !== 'all') {
        if (filters.stock === 'out_of_stock') {
          query = query.eq('stock', 0)
        } else if (filters.stock === 'low_stock') {
          query = query.lte('stock', 10) // Using default low stock threshold
        } else if (filters.stock === 'in_stock') {
          query = query.gt('stock', 0)
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      setProducts((data || []) as ProductWithImages[])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }, [organizationId, filters.categoryId, filters.supplierId, filters.status, filters.priceMin, filters.priceMax, filters.stock])

  useEffect(() => {
    if (organizationId) {
      fetchCategories()
      fetchSuppliers()
      fetchBranches()
    }
  }, [organizationId])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Filter products by search term (client-side for better UX)
  const filteredProducts = useMemo(() => {
    if (!filters.search.trim()) {
      return products
    }

    const searchLower = filters.search.toLowerCase()
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower)
    )
  }, [products, filters.search])

  const fetchCategories = async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchSuppliers = async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const fetchBranches = async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setBranches((data || []) as Branch[])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const slotsLeft = maxProductImages - productImages.length
    if (slotsLeft <= 0) {
      show(`Tu plan permite hasta ${maxProductImages} imagen${maxProductImages !== 1 ? 'es' : ''} por producto.`, 'error')
      e.target.value = ''
      return
    }

    const filesToAdd = files.slice(0, slotsLeft)
    if (files.length > slotsLeft) {
      show(`Solo se agregarán ${slotsLeft} imagen${slotsLeft !== 1 ? 'es' : ''} (máx. ${maxProductImages} por producto).`, 'info')
    }

    filesToAdd.forEach((file) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        alert(`Tipo de archivo no permitido para ${file.name}. Use JPG, PNG o WEBP`)
        return
      }

      if (file.size > MAX_IMAGE_SIZE) {
        alert(`La imagen ${file.name} es demasiado grande. Máximo 5MB`)
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setProductImages((prev) => {
          if (prev.length >= maxProductImages) return prev
          const newImage: ProductImageItem = {
            image_url: '',
            display_order: prev.length,
            is_primary: prev.length === 0,
            file,
            preview: reader.result as string,
          }
          return [...prev, newImage]
        })
      }
      reader.readAsDataURL(file)
    })

    e.target.value = ''
  }

  const handleImageUrlAdd = (url: string) => {
    if (!url.trim()) return
    if (productImages.length >= maxProductImages) {
      show(`Tu plan permite hasta ${maxProductImages} imagen${maxProductImages !== 1 ? 'es' : ''} por producto.`, 'error')
      return
    }
    const newImage: ProductImageItem = {
      image_url: url.trim(),
      display_order: productImages.length,
      is_primary: productImages.length === 0,
    }
    setProductImages([...productImages, newImage])
  }

  const removeImage = (index: number) => {
    const image = productImages[index]
    const newImages = productImages.filter((_, i) => i !== index)

    // If we removed the primary image, make the first one primary
    if (image.is_primary && newImages.length > 0) {
      newImages[0].is_primary = true
    }

    // Reorder display_order
    newImages.forEach((img, i) => {
      img.display_order = i
    })

    setProductImages(newImages)
  }

  const setPrimaryImage = (index: number) => {
    const newImages = productImages.map((img, i) => ({
      ...img,
      is_primary: i === index,
    }))
    setProductImages(newImages)
  }

  const moveImage = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === productImages.length - 1)
    ) {
      return
    }

    const newImages = [...productImages]
    const newIndex = direction === 'up' ? index - 1 : index + 1
      ;[newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]]

    // Update display_order
    newImages.forEach((img, i) => {
      img.display_order = i
    })

    setProductImages(newImages)
  }

  const onSubmit = async (data: ProductForm) => {
    if (!organizationId) return

    if (!editingProduct && isAtLimit('products')) {
      show('Límite alcanzado (200 productos). Actualizá tu plan.', 'error')
      return
    }

    // When creating with stock > 0, branch is required for inventory
    if (!editingProduct && data.stock > 0) {
      if (branches.length === 0) {
        alert('No hay sucursales disponibles. Crea una sucursal primero o deja el stock en 0.')
        return
      }
      if (!initialBranchId) {
        alert('Si indicas stock inicial, debes seleccionar la sucursal donde se cargará el inventario.')
        return
      }
    }

    if (productImages.length > maxProductImages) {
      show(
        `Tu plan permite hasta ${maxProductImages} imagen${maxProductImages !== 1 ? 'es' : ''} por producto. Eliminá las que sobran para guardar.`,
        'error'
      )
      return
    }

    try {
      setUploadingImage(true)

      const productData: ProductInsert | ProductUpdate = {
        ...data,
        image_url: null, // We'll use product_images table instead
        ...(editingProduct ? {} : { organization_id: organizationId }),
      }

      let productId: string

      if (editingProduct) {
        const { data: updatedProduct, error } = await supabase
          .from('products')
          // @ts-expect-error - Supabase types need to be regenerated after migration
          .update(productData)
          .eq('id', editingProduct.id)
          .select()
          .single()

        if (error) throw error
        // @ts-expect-error - Supabase types need to be regenerated after migration
        productId = updatedProduct.id
      } else {
        const { data: newProduct, error } = await supabase
          .from('products')
          // @ts-expect-error - Supabase types need to be regenerated after migration
          .insert(productData)
          .select()
          .single()

        if (error) throw error
        // @ts-expect-error - Supabase types need to be regenerated after migration
        productId = newProduct.id

        // Load initial stock into branch_inventory when creating with stock + branch
        if (data.stock > 0 && initialBranchId) {
          const { data: branchInventory, error: biError } = await supabase
            .from('branch_inventory')
            .select('id, stock')
            .eq('branch_id', initialBranchId)
            .eq('product_id', productId)
            .is('variant_id', null)
            .single()

          const bi = branchInventory as { id: string; stock: number } | null
          if (!biError && bi?.id) {
            const previousStock = bi.stock ?? 0
            const newStock = previousStock + data.stock

            const { error: updateError } = await supabase
              .from('branch_inventory')
              // @ts-expect-error - Supabase types may need regeneration
              .update({ stock: newStock })
              .eq('id', bi.id)

            if (!updateError) {
              await supabase
                .from('inventory_movements')
                // @ts-expect-error - Supabase types may need regeneration
                .insert({
                  branch_inventory_id: bi.id,
                  movement_type: 'receipt',
                  quantity: data.stock,
                  previous_stock: previousStock,
                  new_stock: newStock,
                  reference_type: 'receipt',
                  notes: 'Stock inicial al crear producto',
                })
            } else {
              console.error('Error loading initial inventory:', updateError)
              alert('Producto creado pero no se pudo cargar el stock inicial. Ajusta el inventario manualmente.')
            }
          }
        }
      }

      // Handle product images
      if (productImages.length > 0) {
        // Upload new files first
        const imagesToSave: Array<{
          id?: string
          image_url: string
          display_order: number
          is_primary: boolean
        }> = []

        for (const image of productImages) {
          let imageUrl = image.image_url

          // Upload file if it exists (new image)
          if (image.file) {
            imageUrl = await uploadProductImage(image.file, productId, organizationId ?? undefined)
          }

          imagesToSave.push({
            id: image.id, // Keep existing ID if it exists
            image_url: imageUrl,
            display_order: image.display_order,
            is_primary: image.is_primary,
          })
        }

        if (editingProduct?.product_images && editingProduct.product_images.length > 0) {
          // Find images that were removed (exist in DB but not in productImages)
          const currentImageIds = new Set(
            productImages.filter((img) => img.id).map((img) => img.id!)
          )

          const imagesToDelete = editingProduct.product_images.filter(
            (img) => !currentImageIds.has(img.id)
          )

          // Delete removed images from database
          if (imagesToDelete.length > 0) {
            const idsToDelete = imagesToDelete.map((img) => img.id)
            const { error: deleteError } = await supabase
              .from('product_images')
              .delete()
              .in('id', idsToDelete)

            if (deleteError) {
              console.error('Error deleting removed images:', deleteError)
            }

            // Delete removed image files from storage
            for (const deletedImage of imagesToDelete) {
              try {
                // Only delete if the image URL was replaced (not just reordered)
                const stillExists = imagesToSave.some(
                  (img) => img.image_url === deletedImage.image_url
                )
                if (!stillExists) {
                  await deleteImage(deletedImage.image_url, 'product-images')
                }
              } catch (error) {
                console.error('Error deleting image file:', error)
              }
            }
          }

          // Update existing images that changed (order, primary status, or were replaced)
          const imagesToUpdate = imagesToSave.filter((img) => {
            if (!img.id) return false // New images don't have ID

            const existingImage = editingProduct.product_images?.find(
              (ei) => ei.id === img.id
            )
            if (!existingImage) return false

            // Check if anything changed
            return (
              existingImage.display_order !== img.display_order ||
              existingImage.is_primary !== img.is_primary ||
              existingImage.image_url !== img.image_url
            )
          })

          for (const imageToUpdate of imagesToUpdate) {
            if (!imageToUpdate.id) continue // Skip if no ID

            const { error: updateError } = await supabase
              .from('product_images')
              // @ts-expect-error - Supabase types need to be regenerated after migration
              .update({
                image_url: imageToUpdate.image_url,
                display_order: imageToUpdate.display_order,
                is_primary: imageToUpdate.is_primary,
              })
              .eq('id', imageToUpdate.id)

            if (updateError) {
              console.error('Error updating image:', updateError)
            }

            // If image URL changed, delete old file from storage
            const oldImage = editingProduct.product_images?.find(
              (img) => img.id === imageToUpdate.id
            )
            if (oldImage && oldImage.image_url !== imageToUpdate.image_url) {
              try {
                await deleteImage(oldImage.image_url, 'product-images')
              } catch (error) {
                console.error('Error deleting old image file:', error)
              }
            }
          }

          // Insert only new images (without ID)
          const newImages = imagesToSave.filter((img) => !img.id)
          if (newImages.length > 0) {
            const { error: imagesError } = await supabase
              .from('product_images')
              .insert(
                // @ts-expect-error - Supabase types need to be regenerated after migration
                newImages.map((img) => ({
                  product_id: productId,
                  image_url: img.image_url,
                  display_order: img.display_order,
                  is_primary: img.is_primary,
                }))
              )

            if (imagesError) throw imagesError
          }
        } else {
          // New product - insert all images
          const { error: imagesError } = await supabase
            .from('product_images')
            .insert(
              // @ts-expect-error - Supabase types need to be regenerated after migration
              imagesToSave.map((img) => ({
                product_id: productId,
                image_url: img.image_url,
                display_order: img.display_order,
                is_primary: img.is_primary,
              }))
            )

          if (imagesError) throw imagesError
        }
      } else if (editingProduct?.product_images && editingProduct.product_images.length > 0) {
        // Delete all images if none are provided
        const { error: deleteError } = await supabase
          .from('product_images')
          .delete()
          .eq('product_id', productId)

        if (deleteError) {
          console.error('Error deleting images:', deleteError)
        }

        // Delete image files from storage
        for (const oldImage of editingProduct.product_images) {
          try {
            await deleteImage(oldImage.image_url, 'product-images')
          } catch (error) {
            console.error('Error deleting image file:', error)
          }
        }
      }

      setIsModalOpen(false)
      setEditingProduct(null)
      setProductImages([])
      reset()
      fetchProducts()
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Error al guardar el producto')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleEdit = (product: ProductWithImages) => {
    setEditingProduct(product)

    // Load existing images
    const existingImages: ProductImageItem[] = (product.product_images || [])
      .sort((a, b) => a.display_order - b.display_order)
      .map((img) => ({
        id: img.id,
        image_url: img.image_url,
        display_order: img.display_order,
        is_primary: img.is_primary,
      }))

    setProductImages(existingImages)

    reset({
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      category_id: product.category_id,
      sku: product.sku,
      is_active: product.is_active,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Error al eliminar el producto')
    }
  }

  const handleNew = () => {
    if (isAtLimit('products')) {
      show('Límite alcanzado (200 productos). Actualizá tu plan.', 'error')
      return
    }
    setEditingProduct(null)
    setProductImages([])
    setInitialBranchId('')
    reset()
    setIsModalOpen(true)
  }

  const getPrimaryImage = (product: ProductWithImages): string | null => {
    if (product.product_images && product.product_images.length > 0) {
      const primary = product.product_images.find((img) => img.is_primary)
      if (primary) return primary.image_url
      // If no primary, return first image
      return product.product_images.sort((a, b) => a.display_order - b.display_order)[0].image_url
    }
    return product.image_url || null
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      categoryId: '',
      supplierId: '',
      priceMin: '',
      priceMax: '',
      status: 'all',
      stock: 'all',
    })
  }

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.categoryId !== '' ||
      filters.supplierId !== '' ||
      filters.priceMin !== '' ||
      filters.priceMax !== '' ||
      filters.status !== 'all' ||
      filters.stock !== 'all'
    )
  }, [filters])

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="mb-8 flex gap-4">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <SkeletonTable rows={6} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
        <p className="text-gray-600 mt-2">
          Gestiona todos los productos de tu tienda
          {tier === 'starter' && limits.products != null && (
            <span className="ml-2 text-sm text-gray-500">
              ({productCount} / {limits.products})
            </span>
          )}
        </p>
      </div>

      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-admin-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            title="Vista de lista"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-admin-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            title="Vista de grilla"
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
        </div>
        <Button onClick={handleNew} disabled={isAtLimit('products')}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* Filters Panel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SearchFilter
              value={filters.search}
              onChange={(value) => setFilters({ ...filters, search: value })}
              placeholder="Buscar productos..."
            />
            <CategoryFilter
              categories={categories}
              selectedCategoryId={filters.categoryId}
              onCategoryChange={(categoryId) =>
                setFilters({ ...filters, categoryId })
              }
            />
            <SupplierFilter
              suppliers={suppliers}
              selectedSupplierId={filters.supplierId}
              onSupplierChange={(supplierId) =>
                setFilters({ ...filters, supplierId })
              }
            />
            <StatusFilter
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
            />
            <StockFilter
              value={filters.stock}
              onChange={(value) => setFilters({ ...filters, stock: value })}
            />
            <PriceRangeFilter
              min={filters.priceMin}
              max={filters.priceMax}
              onMinChange={(min) => setFilters({ ...filters, priceMin: min })}
              onMaxChange={(max) => setFilters({ ...filters, priceMax: max })}
            />
          </div>
          {hasActiveFilters && (
            <div className="mt-4">
              <Button variant="outline" onClick={clearFilters}>
                Limpiar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Mostrando {filteredProducts.length} de {products.length} productos
        </p>
      </div>

      {/* Products Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const primaryImage = getPrimaryImage(product)
            return (
              <Card key={product.id} className="relative">
                <CardContent className="p-6">
                  {/* Actions Menu */}
                  <div className="absolute top-4 right-4">
                    <ActionsMenu
                      actions={[
                        {
                          label: 'Gestionar variantes',
                          icon: <Package className="h-4 w-4" />,
                          onClick: () => setVariantManagerProduct(product),
                        },
                        {
                          label: 'Código de barras',
                          icon: <ScanLine className="h-4 w-4" />,
                          onClick: () => setBarcodeManagerProduct(product),
                        },
                        {
                          label: 'Proveedores',
                          icon: <Truck className="h-4 w-4" />,
                          onClick: () => setSupplierManagerProduct(product),
                        },
                        {
                          label: 'Editar',
                          icon: <Edit className="h-4 w-4" />,
                          onClick: () => handleEdit(product),
                        },
                        {
                          label: 'Eliminar',
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => handleDelete(product.id),
                          variant: 'danger',
                        },
                      ]}
                    />
                  </div>
                  {primaryImage && (
                    <img
                      src={primaryImage}
                      alt={capitalizeFirst(product.name)}
                      className="w-full h-48 object-cover rounded mb-4"
                    />
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 pr-8">
                    <span className="line-clamp-1">
                      {capitalizeFirst(product.name)}
                    </span>
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {capitalizeFirst(product.description) || 'Sin descripción'}
                  </p>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xl font-bold text-admin-600">
                      {formatPrice(product.price, settings)}
                    </span>
                    <span className={`text-sm ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Stock: {product.stock}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>SKU: {product.sku}</span>
                    {product.category && (
                      <>
                        <span>•</span>
                        <span>{product.category.name}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ProductTable
              products={filteredProducts}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onManageVariants={setVariantManagerProduct}
              onManageBarcodes={setBarcodeManagerProduct}
              onManageSuppliers={setSupplierManagerProduct}
              getPrimaryImage={getPrimaryImage}
            />
          </CardContent>
        </Card>
      )}

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg mb-4">
            {hasActiveFilters
              ? 'No se encontraron productos con los filtros seleccionados'
              : 'No hay productos disponibles'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Nombre"
                  {...register('name')}
                  error={errors.name?.message}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    {...register('description')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Precio"
                    type="number"
                    step="0.01"
                    {...register('price', { valueAsNumber: true })}
                    error={errors.price?.message}
                  />
                  <Input
                    label="Stock"
                    type="number"
                    {...register('stock', { valueAsNumber: true })}
                    error={errors.stock?.message}
                  />
                </div>
                {!editingProduct && branches.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sucursal para stock inicial
                    </label>
                    <select
                      value={initialBranchId}
                      onChange={(e) => setInitialBranchId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                    >
                      <option value="">Ninguna (sin cargar inventario)</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} {branch.code && `(${branch.code})`}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Si indicas stock, selecciona la sucursal donde se cargará. El inventario se
                      actualizará automáticamente.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    {...register('category_id')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {errors.category_id && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.category_id.message}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      SKU
                    </label>
                    {editingProduct && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setBarcodeManagerProduct(editingProduct)}
                        className="text-xs"
                      >
                        <Package className="h-3 w-3 mr-1" />
                        Códigos de Barras
                      </Button>
                    )}
                  </div>
                  <Input
                    {...register('sku')}
                    error={errors.sku?.message}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Imágenes del Producto ({productImages.length} / {maxProductImages})
                    {tier === 'starter' && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        Plan Starter: 1 imagen. Actualizá a Profesional para hasta 3.
                      </span>
                    )}
                  </label>

                  {/* Existing Images */}
                  {productImages.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {productImages.map((image, index) => (
                        <div
                          key={index}
                          className="relative border border-gray-300 rounded-lg p-3 bg-gray-50"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              <img
                                src={image.preview || image.image_url}
                                alt={`Imagen ${index + 1}`}
                                className="w-20 h-20 object-cover rounded border border-gray-300"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                {image.is_primary && (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    <Star className="h-3 w-3 mr-1" />
                                    Principal
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">
                                  Orden: {image.display_order + 1}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setPrimaryImage(index)}
                                  disabled={image.is_primary}
                                  className="p-1 text-xs text-gray-600 hover:text-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Marcar como principal"
                                >
                                  <Star className={`h-4 w-4 ${image.is_primary ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveImage(index, 'up')}
                                  disabled={index === 0}
                                  className="p-1 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Mover arriba"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveImage(index, 'down')}
                                  disabled={index === productImages.length - 1}
                                  className="p-1 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Mover abajo"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeImage(index)}
                                  className="p-1 text-xs text-red-600 hover:text-red-800"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Image Buttons - ocultos o deshabilitados cuando se alcanza el límite */}
                  {productImages.length < maxProductImages && (
                    <div className="space-y-2">
                      <label className="block cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleImageAdd}
                          multiple
                          className="hidden"
                        />
                        <div className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                          <Upload className="h-5 w-5 mr-2" />
                          <span className="text-sm text-gray-700">
                            Subir imágenes
                          </span>
                        </div>
                      </label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="url"
                          placeholder="https://ejemplo.com/imagen.jpg"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const input = e.target as HTMLInputElement
                              handleImageUrlAdd(input.value)
                              input.value = ''
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement
                            if (input) {
                              handleImageUrlAdd(input.value)
                              input.value = ''
                            }
                          }}
                        >
                          Agregar URL
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        {maxProductImages === 1
                          ? 'Una imagen por producto (Plan Starter).'
                          : `Hasta ${maxProductImages} imágenes. La primera será la principal.`}
                      </p>
                    </div>
                  )}
                  {productImages.length >= maxProductImages && (
                    <p className="text-sm text-gray-500 mt-1">
                      Límite alcanzado ({maxProductImages} imagen{maxProductImages !== 1 ? 'es' : ''}). Eliminá una para agregar otra.
                    </p>
                  )}
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('is_active')}
                    className="h-4 w-4 text-admin-600 focus:ring-admin-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Producto activo
                  </label>
                </div>
                <div className="flex space-x-4">
                  <Button type="submit" className="flex-1" isLoading={uploadingImage}>
                    {editingProduct ? 'Actualizar' : 'Crear'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingProduct(null)
                      setProductImages([])
                      setInitialBranchId('')
                      reset()
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {variantManagerProduct && (
        <VariantManager
          product={variantManagerProduct}
          onClose={() => setVariantManagerProduct(null)}
        />
      )}

      {barcodeManagerProduct && (
        <BarcodeManager
          productId={barcodeManagerProduct.id}
          onClose={() => setBarcodeManagerProduct(null)}
        />
      )}

      {barcodeManagerVariant && (
        <BarcodeManager
          productId={barcodeManagerVariant.productId}
          variantId={barcodeManagerVariant.variantId}
          onClose={() => setBarcodeManagerVariant(null)}
        />
      )}

      {supplierManagerProduct && (
        <ProductSupplierManager
          productId={supplierManagerProduct.id}
          onClose={() => setSupplierManagerProduct(null)}
        />
      )}
    </div>
  )
}

export function AdminProducts() {
  return <AdminProductsContent />
}
