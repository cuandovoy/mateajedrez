import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Upload, Package, ArrowUp, ArrowDown, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatPrice } from '@/lib/utils'
import { uploadProductImage, deleteImage } from '@/lib/storage'
import { VariantManager } from '@/components/admin/VariantManager'
import type { Product, Category, ProductInsert, ProductUpdate, ProductImage } from '@/types'

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
}

function AdminProductsContent() {
  const [products, setProducts] = useState<ProductWithImages[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithImages | null>(null)
  const [productImages, setProductImages] = useState<ProductImageItem[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [variantManagerProduct, setVariantManagerProduct] = useState<Product | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  })

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

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
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts((data || []) as ProductWithImages[])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    files.forEach((file) => {
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
        const newImage: ProductImageItem = {
          image_url: '',
          display_order: productImages.length,
          is_primary: productImages.length === 0,
          file,
          preview: reader.result as string,
        }
        setProductImages([...productImages, newImage])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    e.target.value = ''
  }

  const handleImageUrlAdd = (url: string) => {
    if (!url.trim()) return

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
    try {
      setUploadingImage(true)

      const productData: ProductInsert | ProductUpdate = {
        ...data,
        image_url: null, // We'll use product_images table instead
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
            imageUrl = await uploadProductImage(image.file, productId)
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
    setEditingProduct(null)
    setProductImages([])
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600 mt-2">Gestiona todos los productos de tu tienda</p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const primaryImage = getPrimaryImage(product)
          return (
            <Card key={product.id}>
              <CardContent className="p-6">
                {primaryImage && (
                  <img
                    src={primaryImage}
                    alt={product.name}
                    className="w-full h-48 object-cover rounded mb-4"
                  />
                )}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {product.name}
              </h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {product.description || 'Sin descripción'}
              </p>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xl font-bold text-admin-600">
                  {formatPrice(product.price)}
                </span>
                <span className={`text-sm ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Stock: {product.stock}
                </span>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVariantManagerProduct(product)}
                  className="w-full"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Gestionar Variantes
                </Button>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(product)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(product.id)}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          )
        })}
      </div>

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
                <Input
                  label="SKU"
                  {...register('sku')}
                  error={errors.sku?.message}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Imágenes del Producto
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

                  {/* Add Image Buttons */}
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
                      Puedes agregar múltiples imágenes. La primera será la imagen principal por defecto.
                    </p>
                  </div>
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
    </div>
  )
}

export function AdminProducts() {
  return <AdminProductsContent />
}
