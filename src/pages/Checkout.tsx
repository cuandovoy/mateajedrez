import { BillerCheckoutPanel } from '@/components/features/BillerCheckoutPanel'
import { CheckoutSteps } from '@/components/features/CheckoutSteps'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { buildCouponDiscountMetadata, calculateCouponDiscountAmount, normalizeCouponCode } from '@/lib/coupons'
import { useOrgPaymentMethods } from '@/hooks/useOrgPaymentMethods'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { BillerApiError, descargarPDFBlob } from '@/lib/biller'
import { emitirCFEDesdeOrden } from '@/lib/billerSaleService'
import { checkoutSchema, URUGUAY_DEPARTMENTS, type CheckoutFormData } from '@/lib/schemas'
import { supabase } from '@/lib/supabase'
import { capitalizeFirst, cn, formatPrice, getEffectivePrice, getProductImageUrl, hasActiveDiscount } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { useToastStore } from '@/store/toastStore'
import type { CartItemWithProduct, Order, ProductImage } from '@/types'
import type { BillerConfig, CheckoutBillerState } from '@/types/biller'
import { BranchInventory, Customer } from '@/types/database.types'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, Landmark, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import type { StoreCoupon } from '@/types'

// Icon map for known payment method keys
const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-5 w-5" />,
  transfer: <Landmark className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  paypal: <CreditCard className="h-5 w-5" />,
}

interface FulfillmentBranchCandidate {
  id: string
  name: string | null
  code: string | null
}

function CheckoutInner() {
  const navigate = useNavigate()
  const settings = useOrgSettings()
  const { items, loading: cartLoading, getTotal, clearCart } = useCartStore()
  const { user } = useAuthStore()
  // const { executeRecaptcha } = useGoogleReCaptcha()
  const { organization } = usePublicStore()
  const organizationId = organization.id
  const { methods: paymentMethods, loading: paymentMethodsLoading } = useOrgPaymentMethods(organizationId)
  const { show } = useToastStore()
  const checkoutFulfillmentMode = settings.checkout_fulfillment_mode === 'main' ? 'main' : 'auto'
  const checkoutExcludeIsolatedWarehouses = settings.checkout_exclude_isolated_warehouses !== false
  const checkoutStockAllocationMode = settings.checkout_stock_allocation_mode === 'manual' ? 'manual' : 'immediate'
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<StoreCoupon | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null)
  const [billerConfig, setBillerConfig] = useState<BillerConfig | null>(null)
  const [billerState, setBillerState] = useState<CheckoutBillerState>({
    emitirCFE: false,
    tipoComprobante: 'ticket',
  })
  const [mainBranchId, setMainBranchId] = useState<string | null>(null)
  const [paymentMethodError, setPaymentMethodError] = useState<string | null>(null)

  const {
    register,
    handleSubmit: handleFormSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
    },
  })

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  // Si se llega a /checkout con el carrito vacío (refresh, back, sesión de
  // invitado expirada), redirige a /cart en vez de mostrar el formulario
  // completo con un resumen en $0. `cartLoading` evita el falso positivo
  // mientras PublicStoreHeader todavía está trayendo el carrito.
  useEffect(() => {
    if (!cartLoading && items.length === 0) {
      navigate('/cart')
    }
  }, [cartLoading, items.length, navigate])

  // Cargar configuración de Biller si la org la tiene activa
  useEffect(() => {
    if (!organizationId) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('biller_config')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()
      .then(({ data }: { data: BillerConfig | null }) => setBillerConfig(data))
  }, [organizationId])

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

        const { data: mainData } = await mainQuery.maybeSingle()

        if (mainData) {
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

        const { data: fallbackData } = await fallbackQuery.maybeSingle()

        if (fallbackData) {
          setMainBranchId(fallbackData.id)
        }
      } catch (error) {
        console.error('Error fetching main branch:', error)
      }
    }

    fetchMainBranch()
  }, [organizationId, checkoutExcludeIsolatedWarehouses])

  // Pre-fill email from user when logged in
  useEffect(() => {
    if (user?.email && !getValues('email')) {
      setValue('email', user.email)
    }
  }, [user?.email, getValues, setValue])

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

  const subtotal = getTotal()
  const discountTotal = appliedCoupon
    ? calculateCouponDiscountAmount(appliedCoupon.kind, appliedCoupon.amount, subtotal)
    : 0
  const finalTotal = Math.max(0, subtotal - discountTotal)
  const paymentMethodRequired = finalTotal > 0

  const fetchValidatedCoupon = async (normalizedCode: string): Promise<StoreCoupon | null> => {
    const rpcAttempts = [
      { p_organization_id: organizationId, p_code: normalizedCode },
      { organization_id: organizationId, code: normalizedCode },
    ]

    for (const [index, rpcArgs] of rpcAttempts.entries()) {
      const { data, error } = await supabase.rpc('validate_store_coupon' as never, rpcArgs as never)

      if (error) {
        if (index < rpcAttempts.length - 1) {
          continue
        }
        throw error
      }

      const coupon = Array.isArray(data) ? data[0] : data
      return (coupon ?? null) as StoreCoupon | null
    }

    return null
  }

  const handleApplyCoupon = async () => {
    const normalizedCode = normalizeCouponCode(couponCode)
    if (!normalizedCode) {
      setCouponError('Ingresá un código de cupón')
      setCouponSuccess(null)
      return
    }

    if (!organizationId) {
      setCouponError('No se pudo determinar la organización')
      setCouponSuccess(null)
      return
    }

    setCouponLoading(true)
    setCouponError(null)
    setCouponSuccess(null)

    try {
      const coupon = await fetchValidatedCoupon(normalizedCode)
      if (!coupon) {
        setCouponError('El cupón no es válido o ya venció')
        return
      }

      setAppliedCoupon(coupon)
      setCouponCode(coupon.code)
      setCouponSuccess(`Cupón ${coupon.code} aplicado`)
    } catch (error) {
      console.error('Error validating coupon:', error)
      setCouponError('No se pudo validar el cupón. Intentá nuevamente.')
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError(null)
    setCouponSuccess(null)
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
          .maybeSingle()

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

  const onSubmit = async (formValues: CheckoutFormData) => {
    if (items.length === 0) {
      show('Tu carrito está vacío', 'error')
      navigate('/cart')
      return
    }

    const availableMethods = paymentMethods.filter((m) => !m.requires_cash_session || mainBranchId)
    const isPaymentMethodValid = !paymentMethodRequired || (
      availableMethods.length > 0 && !!paymentMethod && availableMethods.some((m) => m.key === paymentMethod)
    )
    if (!isPaymentMethodValid) {
      setPaymentMethodError('Seleccioná un método de pago')
      show('Selecciona un método de pago válido', 'error')
      return
    }
    setPaymentMethodError(null)

    // reCAPTCHA v3 validation
    // if (executeRecaptcha) {
    //   try {
    //     const token = await executeRecaptcha('checkout')
    //     const { data: captchaResult, error: captchaError } = await supabase.functions.invoke('validate-recaptcha', {
    //       body: { token },
    //     })
    //     if (captchaError || !captchaResult?.success || (captchaResult.score !== null && captchaResult.score < 0.5)) {
    //       show('Verificación de seguridad fallida. Por favor intentá de nuevo.', 'error')
    //       return
    //     }
    //   } catch (error) {
    //     console.error('Error during reCAPTCHA validation:', error)
    //     // Si falla la verificación por error de red/config, se bloquea la orden
    //     show('No se pudo completar la verificación de seguridad. Revisá tu conexión.', 'error')
    //     return
    //   }
    // }

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

      const pricingSubtotal = getTotal()
      const pricingDiscountTotal = appliedCoupon
        ? calculateCouponDiscountAmount(appliedCoupon.kind, appliedCoupon.amount, pricingSubtotal)
        : 0
      const pricingTotal = Math.max(0, pricingSubtotal - pricingDiscountTotal)
      const orderPaymentMethod = paymentMethod || null
      const contactInfo = {
        fullName: formValues.fullName,
        email: formValues.email,
        phone: formValues.phone,
        address: formValues.address,
        city: formValues.city,
        department: formValues.department,
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
        subtotal_before_discount: pricingSubtotal,
        discount_total: pricingDiscountTotal,
        discount_metadata: appliedCoupon
          ? buildCouponDiscountMetadata(appliedCoupon, pricingDiscountTotal)
          : null,
        total: pricingTotal,
        status: (checkoutStockAllocationMode === 'manual' ? 'pending_allocation' : 'pending') as Order['status'],
        shipping_address: contactInfo,
        payment_method: orderPaymentMethod,
        branch_id: fulfillmentBranchId, // Auto-assigned to a branch that can fulfill this order
      } as any

      // Create or get customer (scoped by org) — matcheado por email, que es
      // ahora obligatorio y única clave de identidad del cliente (antes era
      // por teléfono, ver migración 142_customers_unique_email.sql: dos
      // clientes distintos pueden compartir teléfono, no email).
      let customer: Customer | null = null

      const lookupCustomerByEmail = async (): Promise<Customer | null> => {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('email', formValues.email)
          .maybeSingle()
        return data as Customer | null
      }

      const existingCustomer = await lookupCustomerByEmail()

      if (existingCustomer) {
        customer = existingCustomer
        const needsUpdate =
          (user?.id && !existingCustomer.user_id) ||
          formValues.fullName !== existingCustomer.full_name ||
          formValues.phone !== existingCustomer.phone
        if (needsUpdate) {
          const { data: updatedCustomer } = await supabase
            .from('customers')
            .update({
              ...(user?.id && !existingCustomer.user_id ? { user_id: user.id } : {}),
              full_name: formValues.fullName,
              phone: formValues.phone,
              address: contactInfo,
            } as never)
            .eq('id', existingCustomer.id)
            .select()
            .single()
          if (updatedCustomer) customer = updatedCustomer as Customer
        }
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            organization_id: organizationId,
            user_id: user?.id || null,
            email: formValues.email,
            full_name: formValues.fullName,
            phone: formValues.phone,
            address: contactInfo,
            is_active: true,
          } as never)
          .select()
          .single()

        if (customerError) {
          // Duplicate key: customer exists but RLS blocked the initial SELECT
          // (guest can't see customers with user_id IS NOT NULL, or migration not applied)
          // Re-query to get the existing customer ID and proceed
          if ((customerError as any).code === '23505') {
            const retryCustomer = await lookupCustomerByEmail()
            if (retryCustomer) {
              customer = retryCustomer
            } else {
              throw new Error('Ya existe un cliente con ese email para esta organización.')
            }
          } else {
            throw customerError
          }
        } else {
          customer = newCustomer
        }
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
        const price = item.variant?.price ?? getEffectivePrice(item.product)
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

      // -----------------------------------------------------------------------
      // Mercado Pago: create preference and redirect — skip remaining steps
      // -----------------------------------------------------------------------
      if (paymentMethod === 'mercadopago' && pricingTotal > 0) {
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mp-preference`
        const { data: { session } } = await supabase.auth.getSession()
        const mpRes = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            order_id:        (order as { id: string }).id,
            organization_id: organizationId,
          }),
        })

        if (!mpRes.ok) {
          const err = await mpRes.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error ?? 'Error al iniciar el pago con Mercado Pago')
        }

        const { init_point } = await mpRes.json() as { init_point: string }

        await clearCart()
        // Redirect to MP checkout — MP will redirect back to order-confirmation
        window.location.href = init_point
        return
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
          .maybeSingle()

        if (openSession) {
          cashSessionId = (openSession as { id: string }).id
        }
      }

      if (orderPaymentMethod) {
        const { error: paymentError } = await supabase
          .from('order_payments')
          .insert({
            order_id: (order as { id: string }).id,
            payment_method: orderPaymentMethod,
            amount: pricingTotal,
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
            .maybeSingle()

          const { data: paymentsData } = await supabase
            .from('order_payments')
            .select('amount')
            .eq('cash_session_id', cashSessionId)
            .eq('payment_method', orderPaymentMethod)

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
      }

      // Emitir CFE si el operador lo activó y la org tiene Biller configurado
      if (billerState.emitirCFE && billerConfig) {
        try {
          const orderItemsForBiller = items.map((item) => ({
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            quantity: item.quantity,
            price: item.variant?.price ?? getEffectivePrice(item.product),
            name: item.product.name,
          }))

          const { pdfBlob } = await emitirCFEDesdeOrden(
            billerConfig,
            {
              id: (order as { id: string }).id,
              organization_id: organizationId!,
              payment_method: orderPaymentMethod,
              items: orderItemsForBiller,
            },
            billerState,
          )

          descargarPDFBlob(pdfBlob, `cfe-${(order as { id: string }).id}.pdf`)
          show('Comprobante electrónico emitido correctamente', 'success')
        } catch (billerErr) {
          // La orden ya se guardó — no se revierte.
          // El operador puede reintentar desde el historial.
          const msg = billerErr instanceof BillerApiError
            ? `Biller error ${billerErr.status}: el comprobante no pudo emitirse.`
            : 'El comprobante electrónico no pudo emitirse.'
          console.error('Error emitiendo CFE:', billerErr)
          show(`Orden confirmada. ${msg} Podés reintentarlo desde el historial.`, 'error')
        }
      }

      // Clear cart
      await clearCart()

      show('¡Orden creada exitosamente!', 'success')

      // Navigate to order confirmation
      navigate(`/order-confirmation/${(order as { id: string }).id}`)
    } catch (error) {
      console.error('Error creating order:', error)
      show('Error al crear la orden. Por favor, intenta nuevamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-custom py-8">
      <CheckoutSteps currentStep="checkout" />
      <Button
        variant="ghost"
        onClick={() => navigate('/cart')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver al carrito
      </Button>

      <h1 className="text-3xl font-bold text-gray-900 mb-4">Finalizar Compra</h1>

      <div className="mb-8 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Truck className="h-5 w-5 shrink-0 mt-0.5" />
        <p>Los productos tienen una demora de entrega de 3 a 5 días hábiles.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Resumen de la Orden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {items.map((item) => {
                  const unitPrice = item.variant?.price ?? getEffectivePrice(item.product)
                  const imgUrl = getProductImageUrl(
                    item.product as typeof item.product & { product_images?: ProductImage[] },
                    item.variant?.image_url ?? null
                  )
                  return (
                    <div key={item.id} className="flex items-start gap-3">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={capitalizeFirst(item.product.name)}
                          className="w-16 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded bg-gray-100 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {capitalizeFirst(item.product.name)}
                        </p>
                        {item.variant && (
                          <p className="text-xs text-gray-500">{item.variant.name}</p>
                        )}
                        <p className="text-xs text-gray-600">
                          Cantidad: {item.quantity}
                        </p>
                        <div className="mt-0.5">
                          {!item.variant && hasActiveDiscount(item.product) && (
                            <p className="text-xs text-gray-400 line-through leading-none">
                              {formatPrice(item.product.price * item.quantity, settings)}
                            </p>
                          )}
                          <p
                            className="text-sm font-semibold"
                            style={{ color: 'var(--org-primary-color, #46362B)' }}
                          >
                            {formatPrice(unitPrice * item.quantity, settings)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal, settings)}</span>
                  </div>
                  {appliedCoupon && discountTotal > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span className="flex items-center gap-2">
                        Cupón {appliedCoupon.code}
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="text-xs font-medium underline underline-offset-2 hover:text-emerald-900"
                        >
                          Quitar
                        </button>
                      </span>
                      <span>-{formatPrice(discountTotal, settings)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-dashed border-gray-200">
                    <span>Total</span>
                    <span>{formatPrice(finalTotal, settings)}</span>
                  </div>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleApplyCoupon()
                  }}
                  className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                      Cupón de descuento
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={couponCode}
                        onChange={(event) => {
                          setCouponCode(event.target.value)
                          setCouponError(null)
                          setCouponSuccess(null)
                        }}
                        placeholder="INGRESÁ TU CÓDIGO"
                        autoComplete="off"
                        spellCheck={false}
                        className="uppercase"
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={couponLoading}
                        className="shrink-0"
                      >
                        {couponLoading ? 'Validando...' : 'Aplicar'}
                      </Button>
                    </div>
                  </div>
                  {couponError && (
                    <p className="text-xs text-red-500">{couponError}</p>
                  )}
                  {couponSuccess && (
                    <p className="text-xs text-emerald-700">{couponSuccess}</p>
                  )}
                  {finalTotal === 0 && discountTotal > 0 && (
                    <p className="text-xs text-emerald-700">
                      El cupón cubre el total de la orden. No necesitás pagar con Mercado Pago.
                    </p>
                  )}
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact & Payment Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Datos de Contacto</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre Completo <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      {...register('fullName')}
                      className={errors.fullName ? 'border-red-500' : ''}
                    />
                    {errors.fullName && (
                      <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      {...register('email')}
                      placeholder="tu@email.com"
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Te identifica como cliente y te avisamos el estado de tu orden
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    {...register('phone')}
                    placeholder="099 123 456"
                    className={errors.phone ? 'border-red-500' : ''}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>
                  )}
                </div>

                {/* Shipping address */}
                <div className="pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Dirección de Envío <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-4">
                    <div>
                      <Input
                        type="text"
                        placeholder="Calle y número, apto/casa"
                        {...register('address')}
                        className={errors.address ? 'border-red-500' : ''}
                      />
                      {errors.address && (
                        <p className="text-xs text-red-500 mt-1">{errors.address.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Input
                          type="text"
                          placeholder="Ciudad"
                          {...register('city')}
                          className={errors.city ? 'border-red-500' : ''}
                        />
                        {errors.city && (
                          <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>
                        )}
                      </div>

                      <div>
                        <select
                          defaultValue=""
                          {...register('department')}
                          className={cn(
                            'w-full min-h-[44px] px-4 py-2 border rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent transition-colors',
                            errors.department ? 'border-red-500 focus-visible:ring-red-500' : 'border-gray-300'
                          )}
                        >
                          <option value="" disabled>Departamento</option>
                          {URUGUAY_DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                        {errors.department && (
                          <p className="text-xs text-red-500 mt-1">{errors.department.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div className="pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Método de Pago {paymentMethodRequired && <span className="text-red-500">*</span>}
                  </label>
                  {!paymentMethodRequired && discountTotal > 0 && (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      El cupón cubre el total de la orden. Elegir un método de pago es opcional.
                    </div>
                  )}
                  <div className="space-y-3">
                    {paymentMethodsLoading ? (
                      <>
                        <Skeleton className="h-[72px] w-full rounded-lg" />
                        <Skeleton className="h-[72px] w-full rounded-lg" />
                      </>
                    ) : paymentMethods.filter((m) => !m.requires_cash_session || mainBranchId).length === 0 ? (
                      <p className="text-sm text-gray-500 rounded-lg border border-gray-200 p-4">
                        Esta tienda no configuró ningún método de pago disponible. Contactanos para coordinar tu compra.
                      </p>
                    ) : paymentMethods
                      .filter((m) => !m.requires_cash_session || mainBranchId)
                      .map((m) => {
                        const iconUrl = (m.config as any)?.icon_url as string | undefined
                        const icon = iconUrl
                          ? <img src={iconUrl} alt={m.name} className="h-5 w-auto object-contain" />
                          : (PAYMENT_METHOD_ICONS[m.key] ?? <CreditCard className="h-5 w-5" />)

                        return (
                          <label
                            key={m.id}
                            className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                              paymentMethod === m.key ? '' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                            style={
                              paymentMethod === m.key
                                ? {
                                    borderColor: 'var(--org-primary-color, #46362B)',
                                    backgroundColor: 'color-mix(in srgb, var(--org-primary-color, #46362B) 15%, white)',
                                    color: 'var(--org-primary-color, #46362B)',
                                  }
                                : undefined
                            }
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={m.key}
                              checked={paymentMethod === m.key}
                              onChange={(e) => { setPaymentMethod(e.target.value); setPaymentMethodError(null) }}
                              className="w-4 h-4 focus:ring-[var(--org-primary-color,#46362B)] shrink-0"
                              style={{ accentColor: 'var(--org-primary-color, #46362B)' }}
                            />
                            <span className={`shrink-0 ${paymentMethod === m.key ? '' : 'text-gray-400'}`}>
                              {icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">{m.name}</p>
                              <p className="text-sm text-gray-500">
                                {m.requires_cash_session && mainBranchId
                                  ? 'Disponible solo en tienda física'
                                  : 'Realizá el pago según las instrucciones'}
                              </p>
                            </div>
                          </label>
                        )
                      })}
                  </div>
                  {paymentMethodError && (
                    <p className="text-xs text-red-500 mt-2">{paymentMethodError}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-gray-600">
                    Tus datos serán guardados para futuras compras
                  </p>
                </div>

                {/* Panel CFE — solo visible si la org tiene Biller configurado */}
                {billerConfig && (
                  <BillerCheckoutPanel
                    config={billerConfig}
                    onChange={setBillerState}
                  />
                )}

                <Button
                  type="submit"
                  className="w-full mt-6"
                  disabled={loading}
                  isLoading={loading}
                >
                  {loading ? 'Procesando...' : 'Confirmar Orden'}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Al realizar tu pedido aceptás nuestros{' '}
                  <Link to="/legal/terminos" target="_blank" className="underline hover:text-gray-700">
                    Términos y Condiciones
                  </Link>{' '}
                  y nuestra{' '}
                  <Link to="/legal/privacidad" target="_blank" className="underline hover:text-gray-700">
                    Política de Privacidad
                  </Link>
                  .
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function Checkout() {
  // const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? ''
  return (
    // <GoogleReCaptchaProvider reCaptchaKey={siteKey}>
    // </GoogleReCaptchaProvider>
      <CheckoutInner />
  )
}
