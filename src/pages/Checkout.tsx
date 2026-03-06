import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useOrgPaymentMethods } from '@/hooks/useOrgPaymentMethods'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, formatPrice } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useOrganizationStore } from '@/store/organizationStore'
import { useToastStore } from '@/store/toastStore'
import type { Branch, CartItemWithProduct, Order } from '@/types'
import { BranchInventory, Customer } from '@/types/database.types'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

interface ShippingForm {
  fullName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface FulfillmentBranchCandidate {
  id: string
  name: string | null
  code: string | null
}

export function Checkout() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug?: string }>()
  const settings = useOrgSettings()
  const { items, getTotal, clearCart } = useCartStore()
  const { user } = useAuthStore()
  const orgFromStore = useOrganizationStore((s) => s.currentOrganization?.id)
  const orgFromCart = items[0] && 'product' in items[0] ? (items[0] as CartItemWithProduct).product?.organization_id : null
  const organizationId = orgFromStore ?? orgFromCart
  const { methods: paymentMethods } = useOrgPaymentMethods(organizationId)
  const { show } = useToastStore()
  const checkoutFulfillmentMode = settings.checkout_fulfillment_mode === 'main' ? 'main' : 'auto'
  const checkoutExcludeIsolatedWarehouses = settings.checkout_exclude_isolated_warehouses !== false
  const checkoutStockAllocationMode = settings.checkout_stock_allocation_mode === 'manual' ? 'manual' : 'immediate'
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [mainBranchId, setMainBranchId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ShippingForm>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Uruguay',
  })
  const [errors, setErrors] = useState<Partial<ShippingForm>>({})

  // Fetch main branch on mount (filter by org when available)
  useEffect(() => {
    const fetchMainBranch = async () => {
      if (!organizationId) return
      try {
        let mainQuery = supabase
          .from('branches')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('code', 'MAIN')
          .eq('is_active', true)
        if (checkoutExcludeIsolatedWarehouses) {
          mainQuery = mainQuery.eq('is_isolated_warehouse', false)
        }

        const { data: mainData, error }: { data: Branch | null, error: Error | null } = await mainQuery.single()

        if (!error && mainData) {
          setMainBranchId(mainData.id)
          return
        }

        // Fallback: first active branch of org
        let fallbackQuery = supabase
          .from('branches')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .limit(1)
        if (checkoutExcludeIsolatedWarehouses) {
          fallbackQuery = fallbackQuery.eq('is_isolated_warehouse', false)
        }

        const { data }: { data: Branch | null } = await fallbackQuery.single()

        if (data) {
          setMainBranchId(data.id)
        }
      } catch (error) {
        console.error('Error fetching main branch:', error)
      }
    }

    fetchMainBranch()
  }, [organizationId, checkoutExcludeIsolatedWarehouses])

  // Pre-fill email from user when logged in
  useEffect(() => {
    if (user?.email && !formData.email) {
      setFormData((prev) => ({ ...prev, email: user.email ?? '' }))
    }
  }, [user?.email])

  // Sync payment method when enabled methods change
  useEffect(() => {
    const availableKeys = paymentMethods
      .filter((m) => !m.requires_cash_session || mainBranchId)
      .map((m) => m.key)
    const firstEnabled = paymentMethods.find((m) => !m.requires_cash_session)?.key ?? paymentMethods.find((m) => m.requires_cash_session && mainBranchId)?.key ?? paymentMethods[0]?.key ?? ''
    if (availableKeys.length > 0 && (!paymentMethod || !availableKeys.includes(paymentMethod))) {
      setPaymentMethod(firstEnabled)
    }
  }, [paymentMethods, mainBranchId, paymentMethod])

  const validateForm = (): boolean => {
    const newErrors: Partial<ShippingForm> = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'El nombre completo es obligatorio'
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido'
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

  const validateStockForBranch = async (branchId: string): Promise<string[]> => {
    const stockIssues: string[] = []

    for (const item of items) {
      const cartItem = item as CartItemWithProduct & { product_id: string; quantity: number; variant_id?: string | null }

      if (cartItem.variant_id) {
        const { data: inventory, error: inventoryError }: { data: BranchInventory | null, error: Error | null } = await supabase
          .from('branch_inventory')
          .select('stock, variant_id, product_variants(id, name, is_active, product:products(id, name, is_active))')
          .eq('branch_id', branchId)
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

        if (!settings.allow_negative_stock && inventory.stock < cartItem.quantity) {
          stockIssues.push(
            `Variante "${variant.name || item.product.name}": Stock disponible ${inventory.stock}, solicitado ${cartItem.quantity}`
          )
        }
      } else {
        const { data: hasVariants } = await supabase
          .from('product_variants')
          .select('id')
          .eq('product_id', cartItem.product_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()

        if (hasVariants) {
          stockIssues.push(`El producto "${item.product.name}" tiene variantes. Por favor, selecciona una variante específica.`)
          continue
        }

        const { data: inventory, error: inventoryError }: { data: BranchInventory | null, error: Error | null } = await supabase
          .from('branch_inventory')
          .select('stock, product_id, products(id, name, is_active)')
          .eq('branch_id', branchId)
          .eq('product_id', cartItem.product_id)
          .is('variant_id', null)
          .maybeSingle()

        if (inventoryError || !inventory) {
          stockIssues.push(`Inventario no encontrado para "${item.product.name}". Por favor, asegúrate de que el inventario esté configurado.`)
          continue
        }

        const product = (inventory as any).products
        if (!product?.is_active) {
          stockIssues.push(`Producto "${item.product.name}" no está disponible`)
          continue
        }

        if (!settings.allow_negative_stock && inventory.stock < cartItem.quantity) {
          stockIssues.push(
            `Producto "${item.product.name}": Stock disponible ${inventory.stock}, solicitado ${cartItem.quantity}`
          )
        }
      }
    }

    return stockIssues
  }

  const resolveFulfillmentBranch = async (): Promise<{
    branchId: string | null
    stockIssues: string[]
  }> => {
    if (!organizationId) {
      return { branchId: null, stockIssues: ['No se pudo determinar la organización.'] }
    }

    let branchesQuery = supabase
      .from('branches')
      .select('id, name, code')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (checkoutExcludeIsolatedWarehouses) {
      branchesQuery = branchesQuery.eq('is_isolated_warehouse', false)
    }

    const { data: branchesData, error: branchesError }: {
      data: FulfillmentBranchCandidate[] | null
      error: Error | null
    } = await branchesQuery

    if (branchesError) {
      console.error('Error fetching fulfillment branches:', branchesError)
      return { branchId: null, stockIssues: ['No se pudieron obtener las sucursales operativas.'] }
    }

    const branches = branchesData || []
    if (branches.length === 0) {
      return { branchId: null, stockIssues: ['No hay sucursales operativas habilitadas para esta organización.'] }
    }

    const orderedBranchIds: string[] = []
    const pushBranchId = (id: string | null) => {
      if (id && branches.some((branch) => branch.id === id) && !orderedBranchIds.includes(id)) {
        orderedBranchIds.push(id)
      }
    }

    pushBranchId(mainBranchId)
    branches
      .filter((branch) => branch.code === 'MAIN')
      .forEach((branch) => pushBranchId(branch.id))
    branches.forEach((branch) => pushBranchId(branch.id))

    let fallbackIssues: string[] = []
    let fallbackBranchName: string | null = null

    for (const branchId of orderedBranchIds) {
      const stockIssues = await validateStockForBranch(branchId)
      if (stockIssues.length === 0) {
        return { branchId, stockIssues: [] }
      }

      if (fallbackIssues.length === 0) {
        fallbackIssues = stockIssues
        fallbackBranchName = branches.find((branch) => branch.id === branchId)?.name || null
      }
    }

    if (fallbackIssues.length > 0 && fallbackBranchName) {
      return {
        branchId: null,
        stockIssues: [`No se encontró una sucursal con stock suficiente. Ejemplo (${fallbackBranchName}):`, ...fallbackIssues],
      }
    }

    return { branchId: null, stockIssues: fallbackIssues }
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

    const availableMethods = paymentMethods.filter((m) => !m.requires_cash_session || mainBranchId)
    if (availableMethods.length === 0 || !paymentMethod || !availableMethods.some((m) => m.key === paymentMethod)) {
      show('Selecciona un método de pago válido', 'error')
      return
    }

    setLoading(true)

    try {
      let fulfillmentBranchId: string | null = null
      let stockIssues: string[] = []

      if (checkoutFulfillmentMode === 'main') {
        if (!mainBranchId) {
          stockIssues = ['No se pudo determinar la sucursal principal configurada para checkout.']
        } else {
          stockIssues = await validateStockForBranch(mainBranchId)
          if (stockIssues.length === 0) {
            fulfillmentBranchId = mainBranchId
          }
        }
      } else {
        const resolved = await resolveFulfillmentBranch()
        fulfillmentBranchId = resolved.branchId
        stockIssues = resolved.stockIssues
      }

      if (!fulfillmentBranchId) {
        show(
          `Problemas de stock:\n${stockIssues.join('\n')}\n\nPor favor, actualiza tu carrito.`,
          'error'
        )
        return
      }

      const total = getTotal()
      const customerEmail = (formData.email.trim() || user?.email) ?? null
      const shippingAddress = {
        fullName: formData.fullName,
        email: customerEmail || undefined,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        country: formData.country,
      }

      if (!organizationId) {
        show('No se pudo determinar la organización. Por favor, inicia sesión o recarga la página.', 'error')
        setLoading(false)
        return
      }

      // Create order - user_id can be null for guest orders
      // branch_id is required for multi-branch support
      const orderData = {
        organization_id: organizationId,
        user_id: user?.id || null,
        customer_id: null, // Will be set after creating customer
        total,
        status: (checkoutStockAllocationMode === 'manual' ? 'pending_allocation' : 'pending') as Order['status'],
        shipping_address: shippingAddress,
        payment_method: paymentMethod,
        branch_id: fulfillmentBranchId, // Auto-assigned to a branch that can fulfill this order
      } as any

      // Create or get customer (scoped by org)
      let customer: Customer | null = null
      
      // Check if customer exists by phone within this org
      const { data: existingCustomer }: { data: Customer | null, error: Error | null } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('phone', formData.phone)
        .maybeSingle()

      if (existingCustomer) {
        customer = existingCustomer
        const needsUpdate =
          (user?.id && !existingCustomer.user_id) ||
          customerEmail !== (existingCustomer.email ?? '') ||
          formData.fullName !== existingCustomer.full_name
        if (needsUpdate) {
          const { data: updatedCustomer } = await supabase
            .from('customers')
            .update({
              ...(user?.id && !existingCustomer.user_id ? { user_id: user.id } : {}),
              email: customerEmail ?? user?.email ?? existingCustomer.email,
              full_name: formData.fullName,
              address: shippingAddress,
            } as never)
            .eq('id', existingCustomer.id)
            .select()
            .single()
          if (updatedCustomer) customer = updatedCustomer as Customer
        }
      } else {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            organization_id: organizationId,
            user_id: user?.id || null,
            email: customerEmail,
            full_name: formData.fullName,
            phone: formData.phone,
            address: shippingAddress,
            is_active: true,
          } as never)
          .select()
          .single()

        if (customerError || !newCustomer) {
          throw customerError || new Error('Failed to create customer')
        }
        
        customer = newCustomer
      }

      // Update orderData with customer_id
      orderData.customer_id = customer.id

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
      // If payment is cash, link it to the open cash session for this branch
      const selectedMethod = paymentMethods.find((m) => m.key === paymentMethod)
      let cashSessionId: string | null = null
      if (selectedMethod?.requires_cash_session) {
        // Find open cash session for this branch
        const { data: openSession } = await supabase
          .from('cash_sessions')
          .select('id')
          .eq('branch_id', fulfillmentBranchId)
          .is('closed_at', null)
          .single()

        if (openSession) {
          cashSessionId = (openSession as { id: string }).id
        }
      }

      const { error: paymentError } = await supabase
        .from('order_payments')
        .insert({
          order_id: (order as { id: string }).id,
          payment_method: paymentMethod,
          amount: total,
          cash_session_id: cashSessionId,
        } as any)

      if (paymentError) {
        console.error('Error creating order payment:', paymentError)
        // Don't fail the order if payment record fails, but log it
      } else if (cashSessionId) {
        // Update expected_amount for the cash session
        // Calculate: opening_amount + sum of cash payments
        const { data: sessionData } = await supabase
          .from('cash_sessions')
          .select('opening_amount')
          .eq('id', cashSessionId)
          .single()

        const { data: paymentsData } = await supabase
          .from('order_payments')
          .select('amount')
          .eq('cash_session_id', cashSessionId)
          .eq('payment_method', paymentMethod)

        if (sessionData) {
          const session = sessionData as { opening_amount: number }
          const payments = (paymentsData || []) as Array<{ amount: number }>
          const cashPaymentsTotal = payments.reduce(
            (sum, p) => sum + p.amount,
            0
          )
          const newExpectedAmount = (session.opening_amount || 0) + cashPaymentsTotal

          await supabase
            .from('cash_sessions')
            .update({ expected_amount: newExpectedAmount } as never)
            .eq('id', cashSessionId)
        }
      }

      // Clear cart
      await clearCart()

      show('¡Orden creada exitosamente!', 'success')
      
      // Navigate to order confirmation
      navigate(
        slug
          ? `/${slug}/order-confirmation/${(order as { id: string }).id}`
          : `/orders/${(order as { id: string }).id}`
      )
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
        onClick={() => navigate(slug ? `/${slug}/cart` : '/cart')}
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
                        alt={capitalizeFirst(item.product.name)}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {capitalizeFirst(item.product.name)}
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
                  <span className="font-semibold">{formatPrice(subtotal, settings)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Envío</span>
                  <span className="font-semibold">A calcular</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatPrice(subtotal, settings)}</span>
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
                      Email
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="tu@email.com"
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Para recibir actualizaciones del estado de tu orden
                    </p>
                  </div>
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
                    {paymentMethods
                      .filter((m) => !m.requires_cash_session || mainBranchId)
                      .map((m) => (
                        <label
                          key={m.id}
                          className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${paymentMethod === m.key ? 'border-primary-200 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={m.key}
                            checked={paymentMethod === m.key}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-4 h-4 text-primary-200 focus:ring-primary-200"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{m.name}</p>
                            <p className="text-sm text-gray-600">
                              {m.requires_cash_session && mainBranchId
                                ? 'Disponible solo en tienda física'
                                : 'Realiza el pago según las instrucciones'}
                            </p>
                          </div>
                        </label>
                      ))}
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
