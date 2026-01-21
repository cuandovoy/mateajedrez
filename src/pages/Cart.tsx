import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { cn, formatPrice, getProductImageUrl } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { Product, ProductVariant, ProductImage } from '@/types'
import { PostgrestError } from '@supabase/supabase-js'
import { AlertTriangle, Minus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function CartContent() {
  const navigate = useNavigate()
  const { items, loading, fetchCart, updateQuantity, removeFromCart, getTotal } = useCartStore()
  const { user } = useAuthStore()
  const [stockWarnings, setStockWarnings] = useState<Record<string, { available: number; requested: number }>>({})

  useEffect(() => {
    fetchCart()
  }, [user, fetchCart])

  useEffect(() => {
    // Validate stock when items change
    if (items.length > 0) {
      validateStock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const validateStock = async () => {
    try {
      const warnings: Record<string, { available: number; requested: number }> = {}
      
      for (const item of items) {
        if (item.variant_id) {
          // Validate variant stock
          const { data: variant }: { data: ProductVariant | null, error: PostgrestError | null } = await supabase
            .from('product_variants')
            .select('id, stock, is_active')
            .eq('id', item.variant_id)
            .single()
          
          if (variant && (variant.stock < item.quantity || !variant.is_active)) {
            warnings[item.id] = {
              available: variant.stock,
              requested: item.quantity,
            }
          }
        } else {
          // Validate product stock (backward compatibility)
          const { data: product }: { data: Product | null, error: PostgrestError | null } = await supabase
            .from('products')
            .select('id, stock, is_active')
            .eq('id', item.product_id)
            .single()
          
          if (product && (product.stock < item.quantity || !product.is_active)) {
            warnings[item.id] = {
              available: product.stock,
              requested: item.quantity,
            }
          }
        }
      }

      setStockWarnings(warnings)
    } catch (error) {
      console.error('Error validating stock:', error)
    }
  }

  const handleCheckout = () => {
    navigate('/checkout')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container-custom py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 text-lg mb-4">Tu carrito está vacío</p>
            <Button onClick={() => navigate('/')} className='bg-primary-400 text-white'>
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
                  <div className="flex items-center space-x-4">
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
                              alt={item.product.name}
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
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {item.product.name}
                      </h3>
                      {item.variant && (
                        <div className="mt-1 space-y-1">
                          {item.variant.name && (
                            <p className="text-sm text-gray-600 font-medium">
                              {item.variant.name}
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
                      <p className="text-primary-600 font-bold mt-2">
                        {formatPrice(item.variant?.price ?? item.product.price)}
                      </p>
                      {(item.variant?.stock ?? item.product.stock) > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Stock disponible: {item.variant?.stock ?? item.product.stock} {item.variant?.unit || item.product.unit || 'unidad'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
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
                        disabled={item.quantity >= (item.variant?.stock ?? item.product.stock)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {formatPrice((item.variant?.price ?? item.product.price) * item.quantity)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.id)}
                        className="mt-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                <span className="font-semibold">{formatPrice(getTotal())}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatPrice(getTotal())}</span>
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
                className="w-full text-white bg-primary-300 hover:bg-primary-400"
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
