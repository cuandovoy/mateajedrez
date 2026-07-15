import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, cn, formatPrice, getProductImageUrl, hasActiveDiscount, getEffectivePrice } from '@/lib/utils'
import { getProductStock } from '@/lib/stock'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { Product, ProductImage } from '@/types'
import { BranchInventory, ProductVariant } from '@/types/database.types'
import { AlertTriangle, Minus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

function CartContent() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug?: string }>()
  const { organization } = usePublicStore()
  const settings = useOrgSettings()
  const { items, loading, fetchCart, updateQuantity, removeFromCart, getTotal } = useCartStore()
  const { user } = useAuthStore()
  const organizationId = organization.id
  const [stockWarnings, setStockWarnings] = useState<Record<string, { available: number; requested: number }>>({})
  const [mainBranchId, setMainBranchId] = useState<string | null>(null)
  const [itemStocks, setItemStocks] = useState<Record<string, number>>({}) // item.id -> stock

  useEffect(() => {
    fetchCart(organizationId)
  }, [user, fetchCart, organizationId])

  // Fetch operational branch for this cart organization (excluding isolated warehouses)
  useEffect(() => {
    const fetchMainBranch = async () => {
      if (!organizationId) {
        setMainBranchId(null)
        return
      }

      try {
        const { data: mainData } = await supabase
          .from('branches')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('code', 'MAIN')
          .eq('is_active', true)
          .eq('is_isolated_warehouse', false)
          .maybeSingle()

        if (mainData) {
          setMainBranchId(mainData.id)
          return
        }

        // Fallback: first active non-isolated branch
        const { data: fallbackData } = await supabase
          .from('branches')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .eq('is_isolated_warehouse', false)
          .limit(1)
          .maybeSingle()

        if (fallbackData) {
          setMainBranchId(fallbackData.id)
        }
      } catch (error) {
        console.error('Error fetching main branch:', error)
      }
    }

    fetchMainBranch()
  }, [organizationId])

  useEffect(() => {
    // Validate stock when items change and branch is loaded
    if (items.length > 0 && mainBranchId) {
      validateStock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, mainBranchId])

  const validateStock = async () => {
    if (!mainBranchId) return

    try {
      const warnings: Record<string, { available: number; requested: number }> = {}
      
      for (const item of items) {
        if (item.variant_id) {
          // Validate variant stock from branch_inventory
          const { data: inventory, error: inventoryError }: { data: BranchInventory | null, error: Error | null } = await supabase
            .from('branch_inventory')
            .select('stock, variant_id, product_variants(id, is_active)')
            .eq('branch_id', mainBranchId)
            .eq('variant_id', item.variant_id)
            .maybeSingle()
          
          if (!inventoryError && inventory) {
            const variant = (inventory as BranchInventory & { product_variants?: { id: string; is_active: boolean } | null }).product_variants
            if (inventory.stock < item.quantity || !variant?.is_active) {
              warnings[item.id] = {
                available: inventory.stock,
                requested: item.quantity,
              }
            }
          }
        } else {
          // For products without variants, try to find default variant
          const { data: defaultVariant }: { data: ProductVariant | null, error: Error | null } = await supabase
            .from('product_variants')
            .select('id')
            .eq('product_id', item.product_id)
            .like('sku', '%-DEFAULT')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()

          if (defaultVariant) {
            // Check inventory for default variant
            const { data: inventory, error: inventoryError }: { data: BranchInventory | null, error: Error | null } = await supabase
              .from('branch_inventory')
              .select('stock, variant_id, product_variants(id, is_active)')
              .eq('branch_id', mainBranchId)
              .eq('variant_id', defaultVariant.id)
              .maybeSingle()

            if (!inventoryError && inventory) {
              const variant = (inventory as BranchInventory & { product_variants?: { id: string; is_active: boolean } | null }).product_variants
              if (inventory.stock < item.quantity || !variant?.is_active) {
                warnings[item.id] = {
                  available: inventory.stock,
                  requested: item.quantity,
                }
              }
            }
          } else {
            // Fallback: check product-level inventory (edge case)
            const { data: inventory, error: inventoryError }: { data: BranchInventory | null, error: Error | null } = await supabase
              .from('branch_inventory')
              .select('stock, product_id, products(id, is_active)')
              .eq('branch_id', mainBranchId)
              .eq('product_id', item.product_id)
              .maybeSingle()

            if (!inventoryError && inventory) {
              const product = (inventory as BranchInventory & { products?: { id: string; is_active: boolean } | null }).products
              if (inventory.stock < item.quantity || !product?.is_active) {
                warnings[item.id] = {
                  available: inventory.stock,
                  requested: item.quantity,
                }
              }
            }
          }
        }
      }

      setStockWarnings(warnings)
      
      // Also fetch and store actual stock for display
      const stockMap: Record<string, number> = {}
      for (const item of items) {
        try {
          const stock = await getProductStock(item.product_id, item.variant_id || null, mainBranchId)
          stockMap[item.id] = stock
        } catch (error) {
          console.error('Error fetching stock for cart item:', item.id, error)
          stockMap[item.id] = 0
        }
      }
      setItemStocks(stockMap)
    } catch (error) {
      console.error('Error validating stock:', error)
    }
  }

  const handleCheckout = () => {
    navigate(slug ? `/${slug}/checkout` : '/checkout')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: 'var(--org-primary-color, #6366f1)' }}
        ></div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container-custom py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 text-lg mb-4">Tu carrito está vacío</p>
            <Button onClick={() => navigate(slug ? `/${slug}` : '/')}>
              Continuar Comprando
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container-custom py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Carrito de Compras</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const stockWarning = stockWarnings[item.id]
            const hasStockIssue = stockWarning && stockWarning.available < stockWarning.requested
            
            return (
              <Card key={item.id} className={cn(hasStockIssue && 'border-yellow-300 border-2')}>
                <CardContent className="p-6">
                  {hasStockIssue && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">
                          Stock insuficiente
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Disponible: {stockWarning.available}, Solicitado: {stockWarning.requested}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Image and Product Info */}
                    <div className="flex items-start space-x-4 flex-1 min-w-0">
                      {(() => {
                        // Get product image URL with priority: variant image > product images > legacy image_url
                        const productWithImages = item.product as Product & { product_images?: ProductImage[] }
                        const imageUrl = getProductImageUrl(
                          productWithImages,
                          item.variant?.image_url || null
                        )
                        
                        return (
                          <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={capitalizeFirst(item.product.name)}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to placeholder if image fails
                                  const target = e.target as HTMLImageElement
                                  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-family="Arial" font-size="12"%3ESin imagen%3C/text%3E%3C/svg%3E'
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs text-center p-2">
                                Sin imagen
                              </div>
                            )}
                          </div>
                        )
                      })()}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                          {capitalizeFirst(item.product.name)}
                        </h3>
                        {item.variant && (
                          <div className="mt-1 space-y-1">
                            {item.variant.name && (
                              <p className="text-sm text-gray-600 font-medium">
                                {capitalizeFirst(item.variant.name)}
                              </p>
                            )}
                            {item.variant.attributes && typeof item.variant.attributes === 'object' && (
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(item.variant.attributes as Record<string, string>).map(([key, value]) => (
                                  <span key={key} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                    {key}: {value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {item.quantity > 1 && (
                          <div className="mt-2">
                            {!item.variant && hasActiveDiscount(item.product) && (
                              <p className="text-xs text-gray-400 line-through leading-none">
                                {formatPrice(item.product.price, settings)}
                              </p>
                            )}
                            <p className="text-sm" style={{ color: 'var(--org-primary-color, #6366f1)' }}>
                              {formatPrice(item.variant?.price ?? getEffectivePrice(item.product), settings)} c/u
                            </p>
                          </div>
                        )}
                        {itemStocks[item.id] !== undefined && itemStocks[item.id] > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Stock disponible: {itemStocks[item.id]} {item.variant?.unit || item.product.unit || 'unidad'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quantity Controls and Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= (itemStocks[item.id] ?? 0)}
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-col items-end sm:items-end gap-2">
                        <p className="text-base sm:text-lg font-bold text-gray-900">
                          {formatPrice((item.variant?.price ?? getEffectivePrice(item.product)) * item.quantity, settings)}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          aria-label="Eliminar producto del carrito"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatPrice(getTotal(), settings)}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatPrice(getTotal(), settings)}</span>
                </div>
              </div>
              {Object.keys(stockWarnings).length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Algunos productos tienen problemas de stock. Por favor, actualiza las cantidades.
                  </p>
                </div>
              )}
              <Button
                className="w-full"
                onClick={handleCheckout}
                disabled={Object.keys(stockWarnings).length > 0}
              >
                Proceder al Pago
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function Cart() {
  return <CartContent />
}
