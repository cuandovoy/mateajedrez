import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, cn, formatPrice } from '@/lib/utils'
import { getProductStock } from '@/lib/stock'
import type { ProductVariant, Product } from '@/types'
import { PostgrestError } from '@supabase/supabase-js'

interface VariantSelectorProps {
  product: Product
  selectedVariantId: string | null
  onVariantChange: (variantId: string) => void
}

export function VariantSelector({ product, selectedVariantId, onVariantChange }: VariantSelectorProps) {
  const settings = useOrgSettings()
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [attributes, setAttributes] = useState<Record<string, string[]>>({})
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>({}) // variant.id -> stock
  const [productStock, setProductStock] = useState<number | null>(null)

  useEffect(() => {
    fetchVariants()
  }, [product.id])

  useEffect(() => {
    if (variants.length > 0) {
      // Extract unique attributes from variants
      const attrs: Record<string, Set<string>> = {}
      variants.forEach((variant) => {
        if (variant.attributes && typeof variant.attributes === 'object') {
          Object.entries(variant.attributes as Record<string, string>).forEach(([key, value]) => {
            if (!attrs[key]) {
              attrs[key] = new Set()
            }
            attrs[key].add(value)
          })
        }
      })
      setAttributes(
        Object.fromEntries(
          Object.entries(attrs).map(([key, values]) => [key, Array.from(values)])
        )
      )
    }
  }, [variants])

  useEffect(() => {
    // Auto-select first available variant if none selected
    if (!selectedVariantId && variants.length > 0 && Object.keys(variantStocks).length > 0) {
      const firstAvailable = variants.find((v) => v.is_active && (variantStocks[v.id] ?? 0) > 0)
      if (firstAvailable) {
        onVariantChange(firstAvailable.id)
      }
    }
  }, [variants, selectedVariantId, onVariantChange, variantStocks])

  const fetchVariants = async () => {
    setLoading(true)
    try {
      const { data, error }: { data: ProductVariant[] | null, error: PostgrestError | null } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (error) throw error
      setVariants(data || [])
      
      // Fetch stock for all variants from branch_inventory
      if (data && data.length > 0) {
        const stockPromises = data.map(async (variant) => {
          try {
            const stock = await getProductStock(product.id, variant.id)
            return { variantId: variant.id, stock }
          } catch (error) {
            console.error('Error fetching stock for variant:', variant.id, error)
            return { variantId: variant.id, stock: 0 }
          }
        })
        
        const stockResults = await Promise.all(stockPromises)
        const stockMap: Record<string, number> = {}
        stockResults.forEach(({ variantId, stock }) => {
          stockMap[variantId] = stock
        })
        setVariantStocks(stockMap)
      }
      
      // Fetch product stock (for products without variants)
      getProductStock(product.id)
        .then((stock) => setProductStock(stock))
        .catch((error) => {
          console.error('Error fetching product stock:', error)
          setProductStock(0)
        })
      
      // If only one variant, auto-select it
      if (data && data.length === 1) {
        onVariantChange(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching variants:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAttributeChange = (attributeKey: string, value: string) => {
    // If clicking the same value, deselect it
    if (selectedAttributes[attributeKey] === value) {
      const newSelected = { ...selectedAttributes }
      delete newSelected[attributeKey]
      setSelectedAttributes(newSelected)
      // Clear variant selection if no complete match
      onVariantChange('')
      return
    }

    // Update selected attributes
    const newSelected = { ...selectedAttributes, [attributeKey]: value }
    setSelectedAttributes(newSelected)

    // Find variant matching all selected attributes (only one variant can be selected at a time)
    const matchingVariant = variants.find((variant) => {
      if (!variant.attributes || typeof variant.attributes !== 'object') return false
      const variantAttrs = variant.attributes as Record<string, string>
      return Object.entries(newSelected).every(([key, val]) => variantAttrs[key] === val)
    })

    // Only select variant if there's a complete match (all attributes selected)
    if (matchingVariant && matchingVariant.is_active) {
      onVariantChange(matchingVariant.id)
    } else {
      // Clear selection if no complete match
      onVariantChange('')
    }
  }

  const selectedVariant = variants.find((v) => v.id === selectedVariantId)
  const displayPrice = selectedVariant?.price ?? product.price
  const displayStock = selectedVariantId 
    ? (variantStocks[selectedVariantId] ?? null)
    : (productStock ?? null)
  const displayImage = selectedVariant?.image_url ?? product.image_url

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // If no variants or only one variant, don't show selector
  if (variants.length <= 1) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Attribute Selectors */}
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

      {/* Selected Variant Info */}
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

      {/* Variant Image Preview */}
      {displayImage && displayImage !== product.image_url && (
        <div className="mt-4">
          <img
            src={displayImage}
            alt={capitalizeFirst(selectedVariant?.name || product.name)}
            className="w-full h-64 object-cover rounded-lg"
          />
        </div>
      )}
    </div>
  )
}
