import { trackAuditAction } from '@/lib/audit'
import { descargarPDFBlob } from '@/lib/biller'
import { emitirCFEDesdeOrden } from '@/lib/billerSaleService'
import { supabase } from '@/lib/supabase'
import type { BillerConfig } from '@/types/biller'
import type { CheckoutBillerState } from '@/types/biller'
import type { OrderPaymentInsert } from '@/types/database.types'

export interface POSCartItem {
  id: string
  type: 'product' | 'manual'
  product_id?: string
  variant_id?: string | null
  product_name: string
  variant_name?: string | null
  image_url?: string | null
  sku?: string | null
  price: number
  quantity: number
  available_stock?: number
}

export interface POSCustomer {
  id: string
  full_name: string
  email: string | null
  phone: string
  rut?: string | null
}

export interface POSPaymentMethod {
  key: string
  label: string
  requires_cash_session: boolean
}

interface CreateSaleInput {
  organizationId: string
  branchId: string
  items: POSCartItem[]
  paymentMethod: string | null
  isCreditSale: boolean
  cashSessionId?: string | null
  discountKind?: 'percentage' | 'fixed' | null
  discountValue?: number | null
  customer?: POSCustomer | null
  billerState?: CheckoutBillerState | null
  billerConfig?: BillerConfig | null
  paymentMethods?: POSPaymentMethod[]
  allowNegativeStock?: boolean
}

export async function getAvailableStock(
  productId: string,
  branchId: string,
  variantId?: string | null
): Promise<number> {
  try {
    if (variantId) {
      const { data } = await supabase
        .from('branch_inventory')
        .select('stock')
        .eq('branch_id', branchId)
        .eq('variant_id', variantId)
        .maybeSingle()
      return (data as { stock: number } | null)?.stock ?? 0
    }

    const { data: defaultVariant } = await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', productId)
      .like('sku', '%-DEFAULT')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (defaultVariant && (defaultVariant as { id: string }).id) {
      const { data } = await supabase
        .from('branch_inventory')
        .select('stock')
        .eq('branch_id', branchId)
        .eq('variant_id', (defaultVariant as { id: string }).id)
        .maybeSingle()
      return (data as { stock: number } | null)?.stock ?? 0
    }

    const { data } = await supabase
      .from('branch_inventory')
      .select('stock')
      .eq('branch_id', branchId)
      .eq('product_id', productId)
      .is('variant_id', null)
      .maybeSingle()
    return (data as { stock: number } | null)?.stock ?? 0
  } catch {
    return 0
  }
}

function calcDiscount(
  kind: 'percentage' | 'fixed',
  value: number,
  subtotal: number
): number {
  if (!Number.isFinite(value) || value <= 0 || subtotal <= 0) return 0
  if (kind === 'percentage') return Math.max(0, Math.min(subtotal, (subtotal * value) / 100))
  return Math.max(0, Math.min(subtotal, value))
}

export interface CreateSaleResult {
  orderId: string
}

export async function createSaleFromCart(input: CreateSaleInput): Promise<CreateSaleResult> {
  const {
    organizationId,
    branchId,
    items,
    paymentMethod,
    isCreditSale,
    cashSessionId,
    discountKind,
    discountValue,
    customer,
    billerState,
    billerConfig,
    paymentMethods = [],
    allowNegativeStock = false,
  } = input

  if (items.length === 0) throw new Error('Agrega al menos un producto a la venta')

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  let discountTotal = 0
  let discountMetadata: Record<string, unknown> | null = null
  if (discountKind && discountValue && discountValue > 0) {
    discountTotal = calcDiscount(discountKind, discountValue, subtotal)
    discountMetadata = { source: 'manual', kind: discountKind, value: discountValue }
  }

  const total = Math.max(subtotal - discountTotal, 0)

  // Stock check
  const insufficientLines: string[] = []
  for (const item of items) {
    if (item.type === 'product' && item.product_id) {
      const available = await getAvailableStock(item.product_id, branchId, item.variant_id)
      if (available < item.quantity) {
        insufficientLines.push(`"${item.product_name}": disponible ${available}, pedido ${item.quantity}`)
      }
    }
  }
  if (insufficientLines.length > 0 && !allowNegativeStock) {
    throw new Error(`Stock insuficiente: ${insufficientLines.join('. ')}`)
  }

  const shippingFullName = customer?.full_name ?? 'Cliente en tienda'
  const shippingEmail = customer?.email ?? undefined
  const shippingPhone = customer?.phone ?? ''
  const shippingRut = customer?.rut ?? undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderData: any = {
    organization_id: organizationId,
    user_id: null,
    customer_id: customer?.id ?? null,
    total,
    subtotal_before_discount: subtotal,
    discount_total: discountTotal,
    tax_total: 0,
    discount_metadata: discountMetadata,
    status: 'delivered',
    source: 'manual',
    created_at: new Date().toISOString(),
    shipping_address: {
      fullName: shippingFullName,
      email: shippingEmail,
      phone: shippingPhone,
      rut: shippingRut,
      taxId: shippingRut,
      address: 'Venta en tienda física',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    },
    payment_method: paymentMethod ?? null,
    branch_id: branchId,
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single()

  if (orderError || !order) throw orderError ?? new Error('Error al crear la orden')
  const orderId = (order as { id: string }).id

  await trackAuditAction({
    organizationId,
    tableName: 'orders',
    recordId: orderId,
    action: 'INSERT',
    notes: 'Venta creada desde POS móvil.',
    newData: {
      branch_id: branchId,
      customer_id: customer?.id ?? null,
      total,
      subtotal_before_discount: subtotal,
      discount_total: discountTotal,
      discount_metadata: discountMetadata,
      payment_method: paymentMethod ?? null,
      order_status: 'delivered',
      lines_count: items.length,
    },
  })

  // order_items (productos reales)
  const productItems = items.filter((i) => i.type === 'product' && i.product_id)
  if (productItems.length > 0) {
    const { error: itemsError } = await supabase.from('order_items').insert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productItems.map((i) => ({
        order_id: orderId,
        product_id: i.product_id!,
        variant_id: i.variant_id ?? null,
        quantity: i.quantity,
        price: i.price,
      })) as any
    )
    if (itemsError) {
      if (
        itemsError.message?.includes('Insufficient stock') ||
        itemsError.message?.includes('Inventory entry not found')
      ) {
        throw new Error('Algunos productos ya no tienen stock disponible')
      }
      throw itemsError
    }
  }

  // order_manual_items (líneas libres)
  const manualItems = items.filter((i) => i.type === 'manual')
  if (manualItems.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('order_manual_items').insert(
      manualItems.map((i) => ({
        organization_id: organizationId,
        order_id: orderId,
        description: i.product_name,
        quantity: i.quantity,
        price: i.price,
      }))
    )
  }

  // Pago + sesión de caja
  if (!isCreditSale && paymentMethod) {
    const selectedMethod = paymentMethods.find((m) => m.key === paymentMethod)
    const effectiveCashSessionId = selectedMethod?.requires_cash_session ? cashSessionId ?? null : null

    const paymentData: OrderPaymentInsert = {
      order_id: orderId,
      payment_method: paymentMethod,
      amount: total,
      cash_session_id: effectiveCashSessionId,
      notes: null,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('order_payments').insert(paymentData as any)

    if (effectiveCashSessionId) {
      const cashMethodKeys = paymentMethods.filter((m) => m.requires_cash_session).map((m) => m.key)
      const { data: sessionData } = await supabase
        .from('cash_sessions')
        .select('opening_amount')
        .eq('id', effectiveCashSessionId)
        .single()

      const { data: paymentsData } =
        cashMethodKeys.length > 0
          ? await supabase
              .from('order_payments')
              .select('amount')
              .eq('cash_session_id', effectiveCashSessionId)
              .in('payment_method', cashMethodKeys)
          : await supabase
              .from('order_payments')
              .select('amount')
              .eq('cash_session_id', effectiveCashSessionId)
              .eq('payment_method', paymentMethod)

      if (sessionData && (sessionData as { opening_amount: number }).opening_amount !== undefined) {
        const cashTotal = (paymentsData ?? []).reduce(
          (sum: number, p: { amount: number }) => sum + p.amount,
          0
        )
        const newExpected = ((sessionData as { opening_amount: number }).opening_amount ?? 0) + cashTotal
        await supabase
          .from('cash_sessions')
          .update({ expected_amount: newExpected } as never)
          .eq('id', effectiveCashSessionId)
      }
    }
  }

  // CFE opcional
  if (billerState?.emitirCFE && billerConfig) {
    try {
      const { pdfBlob } = await emitirCFEDesdeOrden(billerConfig, {
        id: orderId,
        organization_id: organizationId,
        payment_method: paymentMethod ?? null,
        items: items.map((i) => ({
          product_id: i.product_id ?? i.id,
          variant_id: i.variant_id ?? null,
          quantity: i.quantity,
          price: i.price,
          name: i.product_name,
        })),
      }, billerState)
      descargarPDFBlob(pdfBlob, `cfe-${orderId}.pdf`)
    } catch {
      // no-op: el caller muestra el toast de error CFE
    }
  }

  return { orderId }
}

export async function findCustomerByQuery(
  organizationId: string,
  query: string
): Promise<POSCustomer[]> {
  const q = query.trim()
  if (!q) return []

  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, email, phone, rut')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,rut.ilike.%${q}%`)
    .order('full_name')
    .limit(20)

  if (error) throw error
  return (data ?? []) as POSCustomer[]
}

export async function findProductByBarcode(
  organizationId: string,
  barcode: string
): Promise<{ product_id: string | null; variant_id: string | null } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('product_barcodes')
    .select('product_id, variant_id')
    .eq('barcode', barcode)
    .maybeSingle()

  if (error || !data) {
    // Fallback: buscar por SKU exacto en products o product_variants
    const { data: byProductSku } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('sku', barcode)
      .eq('is_active', true)
      .maybeSingle()

    if (byProductSku) return { product_id: (byProductSku as { id: string }).id, variant_id: null }

    const { data: byVariantSku } = await supabase
      .from('product_variants')
      .select('id, product_id')
      .eq('sku', barcode)
      .eq('is_active', true)
      .maybeSingle()

    if (byVariantSku) {
      return {
        product_id: (byVariantSku as { product_id: string }).product_id,
        variant_id: (byVariantSku as { id: string }).id,
      }
    }

    return null
  }

  return data as { product_id: string | null; variant_id: string | null }
}
