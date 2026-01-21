import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useToastStore } from '@/store/toastStore'
import type { Branch, CartItemWithProduct, ProductVariant } from '@/types'
import { BranchInventory } from '@/types/database.types'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface ShippingForm {
  fullName: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
}

type PaymentMethod = 'transfer' | 'mercadopago' | 'cash'

export function Checkout() {
  const navigate = useNavigate()
  const { items, getTotal, clearCart } = useCartStore()
  const { user } = useAuthStore()
  const { show } = useToastStore()
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer')
  const [mainBranchId, setMainBranchId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ShippingForm>({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Argentina',
  })
  const [errors, setErrors] = useState<Partial<ShippingForm>>({})

  // Fetch main branch on mount
  useEffect(() => {
    const fetchMainBranch = async () => {
      try {
        const { data, error }: { data: Branch | null, error: Error | null } = await supabase
          .from('branches')
          .select('id')
          .eq('code', 'MAIN')
          .eq('is_active', true)
          .single()

        if (error) throw error
        if (data) {
          setMainBranchId(data.id)
        }
      } catch (error) {
        console.error('Error fetching main branch:', error)
        // Fallback: try to get first active branch
        const { data }: { data: Branch | null, error: Error | null } = await supabase
          .from('branches')
          .select('id')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (data) {
          setMainBranchId(data.id)
        }
      }
    }

    fetchMainBranch()
  }, [])

  const validateForm = (): boolean => {
    const newErrors: Partial<ShippingForm> = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'El nombre completo es obligatorio'
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'El teléfono es obligatorio'
    }
    if (!formData.address.trim()) {
      newErrors.address = 'La dirección es obligatoria'
    }
    if (!formData.city.trim()) {
      newErrors.city = 'La ciudad es obligatoria'
    }
    if (!formData.state.trim()) {
      newErrors.state = 'La provincia es obligatoria'
    }
    if (!formData.zipCode.trim()) {
      newErrors.zipCode = 'El código postal es obligatorio'
    }
    if (!formData.country.trim()) {
      newErrors.country = 'El país es obligatorio'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      show('Por favor, completa todos los campos obligatorios', 'error')
      return
    }

    if (items.length === 0) {
      show('Tu carrito está vacío', 'error')
      navigate('/cart')
      return
    }

    setLoading(true)

    try {
      // Ensure we have a branch_id
      if (!mainBranchId) {
        show('Error: No se pudo determinar la sucursal. Por favor, contacta al administrador.', 'error')
        setLoading(false)
        return
      }

      // Validate stock from branch_inventory before creating order
      const stockIssues: string[] = []
      
      for (const item of items) {
        const cartItem = item as CartItemWithProduct & { product_id: string; quantity: number; variant_id?: string | null }
        
        if (cartItem.variant_id) {
          // Validate variant stock from branch_inventory
          const { data: inventory, error: inventoryError }: { data: BranchInventory | null, error: Error | null } = await supabase
            .from('branch_inventory')
            .select('stock, variant_id, product_variants(id, name, is_active, product:products(id, name, is_active))')
            .eq('branch_id', mainBranchId)
            .eq('variant_id', cartItem.variant_id)
            .single()
          
          if (inventoryError || !inventory) {
            stockIssues.push(`Inventario no encontrado para "${item.product.name}"`)
            continue
          }

          const variant = (inventory as any).product_variants
          const product = variant?.product
          
          if (!product?.is_active || !variant?.is_active) {
            stockIssues.push(`Variante de "${item.product.name}" no está disponible`)
            continue
          }
          
          if (inventory.stock < cartItem.quantity) {
            stockIssues.push(
              `Variante "${variant.name || item.product.name}": Stock disponible ${inventory.stock}, solicitado ${cartItem.quantity}`
            )
          }
        } else {
          // For products without variants, check if there's a default variant
          // First, try to find default variant
          const { data: defaultVariant }: { data: ProductVariant | null, error: Error | null } = await supabase
            .from('product_variants')
            .select('id')
            .eq('product_id', cartItem.product_id)
            .like('sku', '%-DEFAULT')
            .eq('is_active', true)
            .limit(1)
            .single()

          if (defaultVariant) {
            // Check inventory for default variant
            const { data: inventory, error: inventoryError }: { data: BranchInventory | null, error: Error | null } = await supabase
              .from('branch_inventory')
              .select('stock, variant_id, product_variants(id, name, is_active, product:products(id, name, is_active))')
              .eq('branch_id', mainBranchId)
              .eq('variant_id', defaultVariant.id)
              .single()

            if (inventoryError || !inventory) {
              stockIssues.push(`Inventario no encontrado para "${item.product.name}"`)
              continue
            }

            const variant = (inventory as any).product_variants
            const product = variant?.product

            if (!product?.is_active || !variant?.is_active) {
              stockIssues.push(`Producto "${item.product.name}" no está disponible`)
              continue
            }

            if (inventory.stock < cartItem.quantity) {
              stockIssues.push(
                `Producto "${item.product.name}": Stock disponible ${inventory.stock}, solicitado ${cartItem.quantity}`
              )
            }
          } else {
            // Fallback: check product-level inventory (edge case)
            const { data: inventory, error: inventoryError }: { data: BranchInventory | null, error: Error | null } = await supabase
              .from('branch_inventory')
              .select('stock, product_id, products(id, name, is_active)')
              .eq('branch_id', mainBranchId)
              .eq('product_id', cartItem.product_id)
              .single()

            if (inventoryError || !inventory) {
              stockIssues.push(`Inventario no encontrado para "${item.product.name}"`)
              continue
            }

            const product = (inventory as any).products
            if (!product?.is_active) {
              stockIssues.push(`Producto "${item.product.name}" no está disponible`)
              continue
            }

            if (inventory.stock < cartItem.quantity) {
              stockIssues.push(
                `Producto "${item.product.name}": Stock disponible ${inventory.stock}, solicitado ${cartItem.quantity}`
              )
            }
          }
        }
      }

      if (stockIssues.length > 0) {
        show(
          `Problemas de stock:\n${stockIssues.join('\n')}\n\nPor favor, actualiza tu carrito.`,
          'error'
        )
        // Refresh cart to get updated stock
        window.location.reload()
        return
      }

      const total = getTotal()
      const shippingAddress = {
        fullName: formData.fullName,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        country: formData.country,
      }

      // Create order - user_id can be null for guest orders
      // branch_id is required for multi-branch support
      const orderData = {
        user_id: user?.id || null,
        total,
        status: 'pending' as const,
        shipping_address: shippingAddress,
        payment_method: paymentMethod,
        branch_id: mainBranchId, // Assign to main branch
      } as any

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single()

      if (orderError || !order) throw orderError || new Error('Failed to create order')

      // Create order items (include variant_id if available)
      const orderItems = items.map((item) => {
        const cartItem = item as CartItemWithProduct & { product_id: string; quantity: number; variant_id?: string | null }
        // Use variant price if available, otherwise product price
        const price = item.variant?.price ?? item.product.price
        return {
          order_id: (order as { id: string }).id,
          product_id: cartItem.product_id,
          variant_id: cartItem.variant_id || null,
          quantity: cartItem.quantity,
          price,
        }
      })

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems as any)

      if (itemsError) {
        // Check if it's a stock error
        if (itemsError.message?.includes('Insufficient stock') || itemsError.message?.includes('Inventory entry not found')) {
          show(
            'Algunos productos ya no tienen stock disponible. Por favor, actualiza tu carrito.',
            'error'
          )
          // Refresh cart
          window.location.reload()
          return
        }
        throw itemsError
      }

      // Create order_payment record
      // This links the payment to the order and optionally to a cash session
      const { error: paymentError } = await supabase
        .from('order_payments')
        .insert({
          order_id: (order as { id: string }).id,
          payment_method: paymentMethod,
          amount: total,
          cash_session_id: null, // Will be set later if cash payment and session exists
        } as any)

      if (paymentError) {
        console.error('Error creating order payment:', paymentError)
        // Don't fail the order if payment record fails, but log it
      }

      // Clear cart
      await clearCart()

      // Create or update user profile
      if (user) {
        // Update existing profile for logged in user
        await (supabase
          .from('user_profiles') as any)
          .update({
            full_name: formData.fullName,
            phone: formData.phone,
            address: shippingAddress,
          })
          .eq('user_id', user.id)
      } else {
        // Create guest profile (without authentication)
        // Check if a profile with this phone already exists
        const { data: existingProfile } = await (supabase
          .from('user_profiles') as any)
          .select('id')
          .eq('phone', formData.phone)
          .is('user_id', null)
          .maybeSingle()

        if (!existingProfile) {
          // Create new guest profile
          await (supabase
            .from('user_profiles') as any)
            .insert({
              user_id: null, // Guest profile without authentication
              full_name: formData.fullName,
              phone: formData.phone,
              address: shippingAddress,
              role: 'user',
            })
        } else {
          // Update existing guest profile
          await (supabase
            .from('user_profiles') as any)
            .update({
              full_name: formData.fullName,
              address: shippingAddress,
            })
            .eq('id', existingProfile.id)
        }
      }

      show('¡Orden creada exitosamente!', 'success')
      
      // Navigate to order confirmation
      navigate(`/orders/${(order as { id: string }).id}`)
    } catch (error) {
      console.error('Error creating order:', error)
      show('Error al crear la orden. Por favor, intenta nuevamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof ShippingForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const subtotal = getTotal()

  return (
    <div className="container-custom py-8">
      <Button
        variant="ghost"
        onClick={() => navigate('/cart')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver al carrito
      </Button>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Finalizar Compra</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Resumen de la Orden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    {item.product.image_url && (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        Cantidad: {item.quantity}
                      </p>
                      <p className="text-sm font-semibold text-primary-200">
                        {formatPrice(item.product.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Envío</span>
                  <span className="font-semibold">A calcular</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shipping Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Datos de Envío</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre Completo <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => handleChange('fullName', e.target.value)}
                      required
                      className={errors.fullName ? 'border-red-500' : ''}
                    />
                    {errors.fullName && (
                      <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      required
                      className={errors.phone ? 'border-red-500' : ''}
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    required
                    className={errors.address ? 'border-red-500' : ''}
                  />
                  {errors.address && (
                    <p className="text-xs text-red-500 mt-1">{errors.address}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ciudad <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      required
                      className={errors.city ? 'border-red-500' : ''}
                    />
                    {errors.city && (
                      <p className="text-xs text-red-500 mt-1">{errors.city}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provincia <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      required
                      className={errors.state ? 'border-red-500' : ''}
                    />
                    {errors.state && (
                      <p className="text-xs text-red-500 mt-1">{errors.state}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código Postal <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => handleChange('zipCode', e.target.value)}
                      required
                      className={errors.zipCode ? 'border-red-500' : ''}
                    />
                    {errors.zipCode && (
                      <p className="text-xs text-red-500 mt-1">{errors.zipCode}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    País <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    required
                    className={errors.country ? 'border-red-500' : ''}
                  />
                  {errors.country && (
                    <p className="text-xs text-red-500 mt-1">{errors.country}</p>
                  )}
                </div>

                {/* Payment Method Selection */}
                <div className="pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Método de Pago <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 p-4 border-2 border-primary-200 rounded-lg cursor-pointer hover:bg-primary-50 transition-colors">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="transfer"
                        checked={paymentMethod === 'transfer'}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-4 h-4 text-primary-200 focus:ring-primary-200"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Transferencia Bancaria</p>
                        <p className="text-sm text-gray-600">
                          Realiza la transferencia y envía el comprobante
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg cursor-not-allowed opacity-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="mercadopago"
                        disabled
                        className="w-4 h-4 text-primary-200 focus:ring-primary-200"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Mercado Pago</p>
                        <p className="text-sm text-gray-600">
                          Próximamente disponible
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg cursor-not-allowed opacity-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cash"
                        disabled
                        className="w-4 h-4 text-primary-200 focus:ring-primary-200"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Efectivo</p>
                        <p className="text-sm text-gray-600">
                          Disponible solo en tienda física
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-gray-600">
                    Tus datos serán guardados para futuras compras
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full mt-6"
                  disabled={loading}
                  isLoading={loading}
                >
                  {loading ? 'Procesando...' : 'Confirmar Orden'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
