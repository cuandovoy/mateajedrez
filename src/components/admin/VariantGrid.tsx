import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageOff, Layers, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useProductVariantGrid } from '@/hooks/useProductVariantGrid'
import { deleteImage, uploadProductImage } from '@/lib/storage'
import { useToastStore } from '@/store/toastStore'
import {
  buildVariantBatch,
  formatAttributesValue,
  normalizeOptionalText,
  parseAttributesInput,
  parseNonNegativeNumber,
  parseOptionalPrice,
  validateVariantSkus,
  type VariantRowInput,
} from '@/lib/variantGrid'
import type { Product, ProductVariant } from '@/types'

interface VariantGridProps {
  product: Product
}

interface GridRowState {
  key: string
  id: string | null
  sku: string
  name: string
  attributesText: string
  price: string
  stock: string
  unit: string
  min_stock: string
  low_stock_threshold: string
  is_active: boolean
  imageUrl: string | null
  /** Archivo elegido pero todavía no subido — se sube recién al presionar "Guardar cambios". */
  pendingImageFile: File | null
  /** Preview local (`URL.createObjectURL`) del `pendingImageFile`, para no subir nada hasta guardar. */
  pendingImagePreview: string | null
}

const MAX_VARIANT_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB, igual que AdminProducts.tsx
const ALLOWED_VARIANT_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

function variantToRow(variant: ProductVariant, fallbackUnit: string, fallbackThreshold: number): GridRowState {
  return {
    key: variant.id,
    id: variant.id,
    sku: variant.sku,
    name: variant.name ?? '',
    attributesText: formatAttributesValue(variant.attributes),
    price: variant.price !== null && variant.price !== undefined ? String(variant.price) : '',
    stock: String(variant.stock ?? 0),
    unit: variant.unit ?? fallbackUnit,
    min_stock: String(variant.min_stock ?? 0),
    low_stock_threshold: String(variant.low_stock_threshold ?? fallbackThreshold),
    is_active: variant.is_active ?? true,
    imageUrl: variant.image_url ?? null,
    pendingImageFile: null,
    pendingImagePreview: null,
  }
}

function emptyRow(fallbackUnit: string, fallbackThreshold: number): GridRowState {
  return {
    key: `draft-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    id: null,
    sku: '',
    name: '',
    attributesText: '',
    price: '',
    stock: '0',
    unit: fallbackUnit,
    min_stock: '0',
    low_stock_threshold: String(fallbackThreshold),
    is_active: true,
    imageUrl: null,
    pendingImageFile: null,
    pendingImagePreview: null,
  }
}

function rowToInput(row: GridRowState, productId: string): VariantRowInput {
  return {
    id: row.id,
    product_id: productId,
    sku: row.sku.trim(),
    name: normalizeOptionalText(row.name),
    attributes: parseAttributesInput(row.attributesText),
    price: parseOptionalPrice(row.price),
    stock: parseNonNegativeNumber(row.stock, 0),
    unit: normalizeOptionalText(row.unit),
    min_stock: parseNonNegativeNumber(row.min_stock, 0),
    low_stock_threshold: parseNonNegativeNumber(row.low_stock_threshold, 0),
    is_active: row.is_active,
    image_url: row.imageUrl,
  }
}

function variantToInput(variant: ProductVariant): VariantRowInput {
  const attrs = variant.attributes
  const normalizedAttrs =
    attrs && typeof attrs === 'object' && !Array.isArray(attrs) && Object.keys(attrs).length > 0
      ? (attrs as Record<string, string>)
      : null
  return {
    id: variant.id,
    product_id: variant.product_id,
    sku: variant.sku,
    name: normalizeOptionalText(variant.name),
    attributes: normalizedAttrs,
    price: variant.price,
    stock: variant.stock,
    unit: normalizeOptionalText(variant.unit),
    min_stock: variant.min_stock ?? 0,
    low_stock_threshold: variant.low_stock_threshold ?? 0,
    is_active: variant.is_active ?? true,
    image_url: variant.image_url ?? null,
  }
}

const inputClass =
  'h-8 px-2 text-sm border border-gray-200 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-admin-500'

export function VariantGrid({ product }: VariantGridProps) {
  const { show } = useToastStore()
  const settings = useOrgSettings()
  const defaultLowStockThreshold =
    typeof settings.default_low_stock_threshold === 'number'
      ? Math.max(0, Math.trunc(settings.default_low_stock_threshold))
      : 10
  const fallbackUnit = product.unit || 'unidad'

  const { variants, loading, saveBatch, isSaving, deleteVariant, refetch } = useProductVariantGrid(
    product.id,
    product.organization_id
  )

  const [rows, setRows] = useState<GridRowState[]>([])
  const [skuErrorByKey, setSkuErrorByKey] = useState<Map<string, string>>(new Map())
  const initializedRef = useRef(false)

  useEffect(() => {
    if (loading || initializedRef.current) return
    setRows(variants.map((v) => variantToRow(v, fallbackUnit, defaultLowStockThreshold)))
    initializedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const originalsById = useMemo(() => {
    const map = new Map<string, VariantRowInput>()
    variants.forEach((v) => map.set(v.id, variantToInput(v)))
    return map
  }, [variants])

  const currentBatch = useMemo(
    () => buildVariantBatch(rows.map((row) => rowToInput(row, product.id)), originalsById),
    [rows, originalsById, product.id]
  )
  const hasPendingImages = rows.some((row) => row.pendingImageFile !== null)
  const hasChanges = currentBatch.inserts.length > 0 || currentBatch.updates.length > 0 || hasPendingImages

  const updateRow = (key: string, patch: Partial<GridRowState>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
    if (patch.sku !== undefined && skuErrorByKey.size > 0) {
      setSkuErrorByKey(new Map())
    }
  }

  const handleAddRow = () => {
    setRows((prev) => [...prev, emptyRow(fallbackUnit, defaultLowStockThreshold)])
  }

  const handleImageSelect = (row: GridRowState, file: File | null) => {
    if (!file) return
    if (!ALLOWED_VARIANT_IMAGE_TYPES.includes(file.type)) {
      show('Formato de imagen no soportado. Usá JPG, PNG o WEBP', 'error')
      return
    }
    if (file.size > MAX_VARIANT_IMAGE_SIZE) {
      show('La imagen es demasiado grande. Máximo 5MB', 'error')
      return
    }
    if (row.pendingImagePreview) {
      URL.revokeObjectURL(row.pendingImagePreview)
    }
    updateRow(row.key, { pendingImageFile: file, pendingImagePreview: URL.createObjectURL(file) })
  }

  const handleRemoveImage = (row: GridRowState) => {
    if (row.pendingImagePreview) {
      URL.revokeObjectURL(row.pendingImagePreview)
    }
    updateRow(row.key, { pendingImageFile: null, pendingImagePreview: null, imageUrl: null })
  }

  const handleRemoveRow = async (row: GridRowState) => {
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r.key !== row.key))
      return
    }
    if (!confirm('¿Eliminar esta variante? Esta acción no se puede deshacer.')) return
    try {
      await deleteVariant(row.id)
      setRows((prev) => prev.filter((r) => r.key !== row.key))
      show('Variante eliminada exitosamente', 'success')
    } catch (error) {
      console.error('Error deleting variant:', error)
      show('No se pudo eliminar la variante', 'error')
    }
  }

  const [isUploadingImages, setIsUploadingImages] = useState(false)

  const handleSave = async () => {
    const skuErrors = validateVariantSkus(rows.map((row) => ({ key: row.key, sku: row.sku })))
    if (skuErrors.length > 0) {
      setSkuErrorByKey(new Map(skuErrors.map((e) => [e.key, e.message])))
      show(skuErrors[0].message, 'error')
      return
    }
    setSkuErrorByKey(new Map())

    if (!hasChanges) return

    // Subir primero las imágenes elegidas (todavía no persistidas) y resolver la
    // `imageUrl` real de cada fila antes de armar el batch — así una variante nueva
    // ya se inserta con su imagen, en vez de subirla en un paso separado.
    let resolvedRows = rows
    const oldUrlsToDeleteAfterSave: string[] = []
    if (hasPendingImages) {
      setIsUploadingImages(true)
      try {
        resolvedRows = await Promise.all(
          rows.map(async (row) => {
            if (!row.pendingImageFile) return row
            const uploadedUrl = await uploadProductImage(
              row.pendingImageFile,
              `variant-${row.id ?? 'new'}`,
              product.organization_id
            )
            if (row.imageUrl) oldUrlsToDeleteAfterSave.push(row.imageUrl)
            return { ...row, imageUrl: uploadedUrl, pendingImageFile: null }
          })
        )
      } catch (error) {
        console.error('Error uploading variant image:', error)
        show('No se pudo subir alguna imagen de variante', 'error')
        setIsUploadingImages(false)
        return
      }
      setIsUploadingImages(false)
    }

    // Filas donde se quitó la imagen sin reemplazarla (imageUrl pasó a null a mano).
    rows.forEach((row) => {
      if (row.pendingImageFile) return // ya contabilizada arriba
      const original = originalsById.get(row.id ?? '')
      if (original?.image_url && row.imageUrl === null) {
        oldUrlsToDeleteAfterSave.push(original.image_url)
      }
    })

    const resolvedBatch = buildVariantBatch(
      resolvedRows.map((row) => rowToInput(row, product.id)),
      originalsById
    )

    try {
      await saveBatch(resolvedBatch)
      for (const oldUrl of oldUrlsToDeleteAfterSave) {
        try {
          await deleteImage(oldUrl, 'product-images')
        } catch (error) {
          console.error('Error deleting old variant image file:', error)
        }
      }
      const { data: freshVariants } = await refetch()
      setRows((freshVariants ?? []).map((v) => variantToRow(v, fallbackUnit, defaultLowStockThreshold)))
      show('Cambios guardados exitosamente', 'success')
    } catch (error) {
      console.error('Error saving variant batch:', error)
      const code = (error as { code?: string } | null)?.code
      if (code === '23505') {
        show('Alguno de los SKU ya existe en otra variante. Revisá los SKU e intentá de nuevo', 'error')
      } else {
        show('No se pudieron guardar los cambios', 'error')
      }
    }
  }

  if (loading) {
    return <SkeletonTable rows={4} />
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No hay variantes"
        description="Agregá la primera fila para crear variantes de este producto (ej. por color o talle)."
        action={{ label: 'Agregar fila', onClick: handleAddRow }}
      />
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {rows.length} variante{rows.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={handleAddRow} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Agregar fila
        </Button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-center py-2 px-3 font-semibold text-gray-700 text-xs">Imagen</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs min-w-[120px]">SKU</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs min-w-[140px]">Nombre</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs min-w-[180px]">
                Atributos (ej: color: Rojo, talle: M)
              </th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs min-w-[100px]">Precio</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs min-w-[90px]">Stock inicial</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs min-w-[90px]">Unidad</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs min-w-[90px]">Stock mínimo</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs min-w-[90px]">Umbral bajo</th>
              <th className="text-center py-2 px-3 font-semibold text-gray-700 text-xs">Activo</th>
              <th className="text-center py-2 px-3 font-semibold text-gray-700 text-xs">Borrar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const skuError = skuErrorByKey.get(row.key)
              return (
                <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3">
                    <div className="flex flex-col items-center gap-1">
                      <label className="relative flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 hover:border-admin-400">
                        {row.pendingImagePreview || row.imageUrl ? (
                          <img
                            src={row.pendingImagePreview || row.imageUrl || undefined}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageOff className="h-4 w-4 text-gray-300" />
                        )}
                        <input
                          type="file"
                          accept={ALLOWED_VARIANT_IMAGE_TYPES.join(',')}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          onChange={(e) => handleImageSelect(row, e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {(row.pendingImagePreview || row.imageUrl) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(row)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      value={row.sku}
                      onChange={(e) => updateRow(row.key, { sku: e.target.value })}
                      placeholder="SKU"
                      className={`${inputClass} font-mono ${skuError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {skuError && <p className="mt-1 text-xs text-red-600">{skuError}</p>}
                  </td>
                  <td className="py-2 px-3">
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                      placeholder="Ej: Rojo - Talle M"
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      value={row.attributesText}
                      onChange={(e) => updateRow(row.key, { attributesText: e.target.value })}
                      placeholder="color: Rojo, talle: M"
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.price}
                      onChange={(e) => updateRow(row.key, { price: e.target.value })}
                      placeholder="Hereda"
                      className={`${inputClass} w-24`}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      value={row.stock}
                      onChange={(e) => updateRow(row.key, { stock: e.target.value })}
                      className={`${inputClass} w-20`}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      value={row.unit}
                      onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                      placeholder="unidad"
                      className={`${inputClass} w-24`}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      value={row.min_stock}
                      onChange={(e) => updateRow(row.key, { min_stock: e.target.value })}
                      className={`${inputClass} w-20`}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      value={row.low_stock_threshold}
                      onChange={(e) => updateRow(row.key, { low_stock_threshold: e.target.value })}
                      className={`${inputClass} w-20`}
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={row.is_active}
                      onChange={(e) => updateRow(row.key, { is_active: e.target.checked })}
                      className="w-4 h-4 text-admin-600 focus:ring-admin-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRow(row)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} disabled={!hasChanges || isSaving || isUploadingImages}>
          {isUploadingImages ? 'Subiendo imágenes...' : isSaving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  )
}
