import { useState, useEffect } from 'react'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useProductVariants } from '@/hooks/useProductVariants'
import { capitalizeFirst, cn, formatPrice } from '@/lib/utils'
import { getProductStock } from '@/lib/stock'
import type { ProductVariant, Product } from '@/types'

function isValidImageUrl(url: unknown): url is string {
  if (!url || typeof url !== 'string') return false
  if (!url.trim()) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

interface VariantSelectorProps {
  product: Product
  selectedVariantId: string | null
  onVariantChange: (variantId: string) => void
}

export function VariantSelector({ product, selectedVariantId, onVariantChange }: VariantSelectorProps) {
  const settings = useOrgSettings()
  const { data: variants = [], isPending: loading } = useProductVariants(product.id)
  const [attributes, setAttributes] = useState<Record<string, string[]>>({})
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>({})
  const [productStock, setProductStock] = useState<number | null>(null)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)

  // Reset selector state when product changes
  useEffect(() => {
    setSelectedAttributes({})
    onVariantChange('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  // Extract unique attributes from variants
  useEffect(() => {
    if (variants.length === 0) return
    const attrs: Record<string, Set<string>> = {}
    variants.forEach((variant) => {
      if (variant.attributes && typeof variant.attributes === 'object') {
        Object.entries(variant.attributes as Record<string, string>).forEach(([key, value]) => {
          if (!attrs[key]) attrs[key] = new Set()
          attrs[key].add(value)
        })
      }
    })
    setAttributes(
      Object.fromEntries(Object.entries(attrs).map(([key, values]) => [key, Array.from(values)]))
    )
  }, [variants])

  // Auto-select single variant
  useEffect(() => {
    if (variants.length === 1 && !selectedVariantId) {
      const onlyVariant = variants[0]
      const stock = variantStocks[onlyVariant.id] ?? 0
      if (onlyVariant.is_active && stock > 0) onVariantChange(onlyVariant.id)
    }
  }, [variants, selectedVariantId, variantStocks, onVariantChange])

  // Fetch stock for all variants when list changes
  useEffect(() => {
    if (variants.length === 0) return
    Promise.all(
      variants.map(async (variant: ProductVariant) => {
        try {
          const stock = await getProductStock(product.id, variant.id, null, product.organization_id || null)
          return { variantId: variant.id, stock }
        } catch {
          return { variantId: variant.id, stock: 0 }
        }
      })
    ).then((results) => {
      const stockMap: Record<string, number> = {}
      results.forEach(({ variantId, stock }) => { stockMap[variantId] = stock })
      setVariantStocks(stockMap)
    })

    getProductStock(product.id, null, null, product.organization_id || null)
      .then((stock) => setProductStock(stock))
      .catch(() => setProductStock(0))
  }, [variants, product.id, product.organization_id])

  useEffect(() => {
    setImageLoadFailed(false)
  }, [selectedVariantId, product.id])

  const handleAttributeChange = (attributeKey: string, value: string) => {
    if (selectedAttributes[attributeKey] === value) {
      const newSelected = { ...selectedAttributes }
      delete newSelected[attributeKey]
      setSelectedAttributes(newSelected)
      onVariantChange('')
      return
    }

    const newSelected = { ...selectedAttributes, [attributeKey]: value }
    setSelectedAttributes(newSelected)

    const matchingVariant = variants.find((variant) => {
      if (!variant.attributes || typeof variant.attributes !== 'object') return false
      const variantAttrs = variant.attributes as Record<string, string>
      return Object.entries(newSelected).every(([key, val]) => variantAttrs[key] === val)
    })

    if (matchingVariant && matchingVariant.is_active) {
      onVariantChange(matchingVariant.id)
    } else {
      onVariantChange('')
    }
  }

  const selectedVariant = variants.find((v) => v.id === selectedVariantId)
  const displayPrice = selectedVariant?.price ?? product.price
  const displayStock = selectedVariantId ? (variantStocks[selectedVariantId] ?? null) : (productStock ?? null)
  const variantImage = isValidImageUrl(selectedVariant?.image_url) ? selectedVariant.image_url : null
  const showImage = Boolean(variantImage && !imageLoadFailed)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (variants.length === 0) return null

  const hasAttributeOptions = Object.keys(attributes).length > 0

  if (variants.length === 1) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        Variante única: <span className="font-medium">{variants[0].name || variants[0].sku}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {hasAttributeOptions ? (
        <>
          {Object.entries(attributes).map(([key, values]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                {key}
              </label>
              <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                  const isSelected = selectedAttributes[key] === value
                  const variantWithThisValue = variants.find((v) => {
                    if (!v.attributes || typeof v.attributes !== 'object') return false
                    const attrs = v.attributes as Record<string, string>
                    return attrs[key] === value
                  })
                  const variantStock = variantWithThisValue ? (variantStocks[variantWithThisValue.id] ?? 0) : 0
                  const isAvailable = variantWithThisValue?.is_active && variantStock > 0

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleAttributeChange(key, value)}
                      disabled={!isAvailable}
                      className={cn(
                        'px-4 py-2 rounded-lg border-2 transition-colors',
                        isSelected
                          ? 'border-primary-600 bg-primary-50 text-primary-700 font-medium'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-primary-300',
                        !isAvailable && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Variantes
          </label>
          <div className="space-y-2">
            {variants.map((variant) => {
              const variantStock = variantStocks[variant.id] ?? 0
              const isAvailable = variant.is_active && variantStock > 0
              const isSelected = selectedVariantId === variant.id
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => onVariantChange(isSelected ? '' : variant.id)}
                  disabled={!isAvailable}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                    isSelected
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-300 bg-white hover:border-primary-300',
                    !isAvailable && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{variant.name || variant.sku}</span>
                    <span className={cn('text-xs', isAvailable ? 'text-green-600' : 'text-red-600')}>
                      {isAvailable ? `${variantStock} en stock` : 'Sin stock'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selectedVariant && (
        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Precio:</span>
            <span className="text-lg font-bold text-primary-600">
              {formatPrice(displayPrice, settings)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Stock disponible:</span>
            <span
              className={cn(
                'text-sm font-semibold',
                displayStock !== null && displayStock > 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {displayStock !== null ? displayStock : 'Cargando...'} {selectedVariant.unit || product.unit || 'unidad'}
            </span>
          </div>
          {selectedVariant.name && (
            <div className="text-sm text-gray-600">
              Variante: {selectedVariant.name}
            </div>
          )}
        </div>
      )}

      {selectedVariant && (
        <div className="mt-4">
          {showImage && (
            <img
              src={variantImage as string}
              alt={capitalizeFirst(selectedVariant?.name || product.name)}
              className="w-full h-64 object-cover rounded-lg"
              onError={() => setImageLoadFailed(true)}
            />
          )}
        </div>
      )}
    </div>
  )
}
