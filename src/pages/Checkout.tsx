import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatPrice } from '@/lib/utils'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import type { CartItemWithProduct } from '@/types'

interface ShippingForm {
  fullName: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
}

type PaymentMethod = 'transfer' | 'mercadopago'

export function Checkout() {
  const navigate = useNavigate()
  const { items, getTotal, clearCart } = useCartStore()
  const { user } = useAuthStore()
  const { show } = useToastStore()
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer')
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
      // Validate stock before creating order
      const productIds = items.map(item => {
        const cartItem = item as CartItemWithProduct & { product_id: string; quantity: number }
        return cartItem.product_id
      })
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock, is_active')
        .in('id', productIds)

      if (productsError) throw productsError

      // Check stock availability for each item
      const stockIssues: string[] = []
      items.forEach((item) => {
        const cartItem = item as CartItemWithProduct & { product_id: string; quantity: number }
        const product = (products as Array<{ id: string; name: string; stock: number; is_active: boolean }> | null)?.find(p => p.id === cartItem.product_id)
        if (!product) {
          stockIssues.push(`Producto "${item.product.name}" no encontrado`)
          return
        }
        if (!product.is_active) {
          stockIssues.push(`Producto "${item.product.name}" no está disponible`)
          return
        }
        if (product.stock < cartItem.quantity) {
          stockIssues.push(
            `Producto "${item.product.name}": Stock disponible ${product.stock}, solicitado ${cartItem.quantity}`
          )
        }
      })

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
      const orderData = {
        user_id: user?.id || null,
        total,
        status: 'pending' as const,
        shipping_address: shippingAddress,
        payment_method: paymentMethod,
      } as any

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single()

      if (orderError || !order) throw orderError || new Error('Failed to create order')

      // Create order items
      const orderItems = items.map((item) => {
        const cartItem = item as CartItemWithProduct & { product_id: string; quantity: number }
        return {
          order_id: (order as { id: string }).id,
          product_id: cartItem.product_id,
          quantity: cartItem.quantity,
          price: item.product.price,
        }
      })

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems as any)

      if (itemsError) {
        // Check if it's a stock error
        if (itemsError.message?.includes('Insufficient stock')) {
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

      // Clear cart
      await clearCart()

      // Update user profile with shipping info if user is logged in
      if (user) {
        await supabase
          .from('user_profiles')
          .update({
            full_name: formData.fullName,
            phone: formData.phone,
            address: shippingAddress as any,
          } as any)
          .eq('user_id', user.id)
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
