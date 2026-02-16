import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { deleteImage, uploadProductImage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/store/toastStore'
import type { Product, ProductVariant, ProductVariantInsert, ProductVariantUpdate } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const variantSchema = z.object({
  sku: z.string().min(1, 'El SKU es requerido'),
  name: z.string().optional(),
  price: z.number().min(0).optional().nullable(),
  stock: z.number().min(0, 'El stock debe ser mayor o igual a 0'),
  unit: z.string().optional().nullable(),
  min_stock: z.number().min(0).optional(),
  low_stock_threshold: z.number().min(0).optional(),
  is_active: z.boolean().default(true),
  image_url: z.string().url().optional().or(z.literal('')),
})

type VariantFormData = z.infer<typeof variantSchema>

interface VariantFormProps {
  product: Product
  variant?: ProductVariant | null
  onClose: () => void
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export function VariantForm({ product, variant, onClose }: VariantFormProps) {
  const { show } = useToastStore()
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(variant?.image_url || null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [attributes, setAttributes] = useState<Record<string, string>>(() => {
    if (variant?.attributes && typeof variant.attributes === 'object') {
      return variant.attributes as Record<string, string>
    }
    return {}
  })
  const [newAttributeKey, setNewAttributeKey] = useState('')
  const [newAttributeValue, setNewAttributeValue] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VariantFormData>({
    resolver: zodResolver(variantSchema),
    defaultValues: variant
      ? {
          sku: variant.sku,
          name: variant.name || '',
          price: variant.price || null,
          stock: variant.stock,
          unit: variant.unit || product.unit || 'unidad',
          min_stock: variant.min_stock || 0,
          low_stock_threshold: variant.low_stock_threshold || 10,
          is_active: variant.is_active,
          image_url: variant.image_url || '',
        }
      : {
          sku: '',
          name: '',
          price: null,
          stock: 0,
          unit: product.unit || 'unidad',
          min_stock: 0,
          low_stock_threshold: 10,
          is_active: true,
          image_url: '',
        },
  })

  useEffect(() => {
    if (variant?.image_url) {
      setImagePreview(variant.image_url)
    }
  }, [variant])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      show('Tipo de archivo no permitido. Use JPG, PNG o WEBP', 'error')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      show('La imagen es demasiado grande. Máximo 5MB', 'error')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleAddAttribute = () => {
    if (!newAttributeKey.trim() || !newAttributeValue.trim()) {
      show('Por favor, completa ambos campos del atributo', 'error')
      return
    }
    setAttributes((prev) => ({
      ...prev,
      [newAttributeKey.trim()]: newAttributeValue.trim(),
    }))
    setNewAttributeKey('')
    setNewAttributeValue('')
  }

  const handleRemoveAttribute = (key: string) => {
    setAttributes((prev) => {
      const newAttrs = { ...prev }
      delete newAttrs[key]
      return newAttrs
    })
  }

  const onSubmit = async (data: VariantFormData) => {
    setLoading(true)
    try {
      let imageUrl = data.image_url || null

      // Upload image if new file selected
      if (imageFile) {
        setUploadingImage(true)
        try {
          // Delete old image if exists
          if (variant?.image_url) {
            await deleteImage(variant.image_url, 'product-images')
          }
          imageUrl = await uploadProductImage(imageFile, `variant-${Date.now()}`, product.organization_id ?? undefined)
        } catch (error) {
          console.error('Error uploading image:', error)
          show('Error al subir la imagen', 'error')
          setUploadingImage(false)
          return
        } finally {
          setUploadingImage(false)
        }
      }

      const variantData: ProductVariantInsert | ProductVariantUpdate = {
        product_id: product.id,
        sku: data.sku,
        name: data.name || null,
        attributes: Object.keys(attributes).length > 0 ? attributes : null,
        price: data.price || null,
        stock: data.stock,
        unit: data.unit || null,
        min_stock: data.min_stock || 0,
        low_stock_threshold: data.low_stock_threshold || 10,
        is_active: data.is_active,
        image_url: imageUrl,
      }

      if (variant) {
        // Update existing variant
        const { error } = await (supabase
          .from('product_variants') as any)
          .update(variantData)
          .eq('id', variant.id)

        if (error) throw error
        show('Variante actualizada exitosamente', 'success')
      } else {
        // Create new variant
        const { error } = await (supabase
          .from('product_variants') as any)
          .insert(variantData)

        if (error) throw error
        show('Variante creada exitosamente', 'success')
      }

      onClose()
    } catch (error: any) {
      console.error('Error saving variant:', error)
      if (error.code === '23505') {
        show('El SKU ya existe. Por favor, usa otro SKU', 'error')
      } else {
        show('Error al guardar la variante', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button variant="ghost" onClick={onClose} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver a Variantes
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>
            {variant ? 'Editar Variante' : 'Nueva Variante'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('sku')}
                  className={errors.sku ? 'border-red-500' : ''}
                />
                {errors.sku && (
                  <p className="text-xs text-red-500 mt-1">{errors.sku.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Variante
                </label>
                <Input {...register('name')} placeholder="Ej: Rojo - Talle M" />
              </div>
            </div>

            {/* Attributes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Atributos (Color, Talle, etc.)
              </label>
              <div className="space-y-2">
                {Object.entries(attributes).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2 bg-gray-50 p-2 rounded">
                    <span className="font-medium text-gray-700">{key}:</span>
                    <span className="text-gray-600">{value}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttribute(key)}
                      className="ml-auto text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex space-x-2">
                  <Input
                    placeholder="Atributo (ej: color)"
                    value={newAttributeKey}
                    onChange={(e) => setNewAttributeKey(e.target.value)}
                  />
                  <Input
                    placeholder="Valor (ej: Rojo)"
                    value={newAttributeValue}
                    onChange={(e) => setNewAttributeValue(e.target.value)}
                  />
                  <Button type="button" onClick={handleAddAttribute}>
                    Agregar
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio (opcional, hereda del producto si está vacío)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('price', { valueAsNumber: true })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  {...register('stock', { valueAsNumber: true })}
                  className={errors.stock ? 'border-red-500' : ''}
                />
                {errors.stock && (
                  <p className="text-xs text-red-500 mt-1">{errors.stock.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unidad de Medida
                </label>
                <Input
                  {...register('unit')}
                  placeholder="unidad, kg, pack, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Mínimo
                </label>
                <Input
                  type="number"
                  {...register('min_stock', { valueAsNumber: true })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Umbral Stock Bajo
                </label>
                <Input
                  type="number"
                  {...register('low_stock_threshold', { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Imagen de la Variante
              </label>
              {imagePreview && (
                <div className="mb-2 relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveImage}
                    className="absolute top-0 right-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleImageChange}
                disabled={uploadingImage}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                {...register('is_active')}
                className="w-4 h-4 text-admin-600 focus:ring-admin-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Variante activa
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || uploadingImage}>
                {loading || uploadingImage ? 'Guardando...' : variant ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
