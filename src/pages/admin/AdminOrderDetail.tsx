import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useOrgPaymentMethods } from '@/hooks/useOrgPaymentMethods'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { trackAuditAction } from '@/lib/audit'
import { capitalizeFirst, formatDateTime, formatPrice } from '@/lib/utils'
import { useOrganizationStore } from '@/store/organizationStore'
import { useToastStore } from '@/store/toastStore'
import type { Order, OrderItem } from '@/types'
import type { OrderPayment } from '@/types/database.types'
import { ArrowLeft, Calendar, Edit2, MapPin, Minus, Package, Phone, Plus, Save, Trash2, User, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const getStatusLabel = (status: string | null): string => {
  const statusMap: Record<string, string> = {
    pending: 'Pendiente',
    processing: 'En Proceso',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  }
  return (status && statusMap[status]) || status || 'Sin estado'
}

const getStatusColor = (status: string | null): string => {
  const colorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return (status && colorMap[status]) || 'bg-gray-100 text-gray-800'
}

type ShippingAddress = {
  fullName: string
  email?: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface OrderItemWithProduct extends OrderItem {
  returned_quantity: number
  product: { name: string; image_url: string | null; sku: string; price?: number }
  variant?: {
    id: string
    name: string | null
    sku: string
    attributes: Record<string, string>
    image_url: string | null
    price?: number | null
  } | null
}

interface OrderWithItems extends Order {
  payment_method: string
  order_items: OrderItemWithProduct[]
  user_profile?: { full_name: string | null; email: string } | null
  customer?: { email: string | null; full_name: string } | null
}

export function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const settings = useOrgSettings()
  const { show } = useToastStore()
  const organizationId = useOrganizationStore((s) => s.currentOrganization?.id)
  const { methods: paymentMethods } = useOrgPaymentMethods(organizationId)
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [orderPayments, setOrderPayments] = useState<OrderPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [returningItemId, setReturningItemId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [products, setProducts] = useState<
    Array<{
      id: string
      name: string
      price: number
      sku: string
      defaultVariant?: { id: string; price: number | null }
    }>
  >([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)

  const [editShipping, setEditShipping] = useState<ShippingAddress>({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
  })
  const [editPaymentMethod, setEditPaymentMethod] = useState('')
  const [editPaymentAmount, setEditPaymentAmount] = useState('')
  const [editItems, setEditItems] = useState<OrderItemWithProduct[]>([])

  const fetchOrder = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (name, image_url, sku, price),
            variant:product_variants (id, name, sku, attributes, image_url, price)
          )
        `)
        .eq('id', id)
        .single()

      if (orderError) throw orderError
      if (!orderData) return

      const ord = orderData as OrderWithItems
      const shipping = (ord.shipping_address as ShippingAddress) ?? {}
      setEditShipping({
        fullName: shipping.fullName ?? '',
        email: shipping.email ?? '',
        phone: shipping.phone ?? '',
        address: shipping.address ?? '',
        city: shipping.city ?? '',
        state: shipping.state ?? '',
        zipCode: shipping.zipCode ?? '',
        country: shipping.country ?? '',
      })
      setEditPaymentMethod(ord.payment_method ?? '')
      setEditItems(ord.order_items ?? [])

      const { data: paymentsData } = await supabase
        .from('order_payments')
        .select('*')
        .eq('order_id', id)
      const payments = (paymentsData ?? []) as OrderPayment[]
      setOrderPayments(payments)
      const mainPayment = payments.find((p) => p.payment_method === ord.payment_method) ?? payments[0]
      setEditPaymentAmount(mainPayment ? String(mainPayment.amount) : String(ord.total))

      let userProfile: { full_name: string | null; email: string } | null = null
      if (ord.user_id) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('user_id', ord.user_id)
          .single()
        if (profileData) {
          userProfile = {
            full_name: (profileData as { full_name: string }).full_name,
            email: 'N/A',
          }
        }
      }

      let customer: { email: string | null; full_name: string } | null = null
      if (ord.customer_id) {
        const { data: custData } = await supabase
          .from('customers')
          .select('email, full_name')
          .eq('id', ord.customer_id)
          .single()
        if (custData) {
          customer = custData as { email: string | null; full_name: string }
        }
      }

      setOrder({
        ...ord,
        order_items: ord.order_items ?? [],
        user_profile: userProfile,
        customer,
      })
    } catch (error) {
      console.error('Error fetching order:', error)
      show('Error al cargar la orden', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, show])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  useEffect(() => {
    if (organizationId && isEditing) {
      supabase
        .from('products')
        .select('id, name, price, sku')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')
        .then(async ({ data: productsData }) => {
          const prods = (productsData ?? []) as Array<{ id: string; name: string; price: number; sku: string }>
          const withVariants = await Promise.all(
            prods.map(async (p) => {
              const { data: defaultVar } = await supabase
                .from('product_variants')
                .select('id, price')
                .eq('product_id', p.id)
                .eq('is_active', true)
                .like('sku', '%-DEFAULT')
                .limit(1)
                .maybeSingle()
              const { data: anyVar } = defaultVar
                ? { data: [defaultVar] }
                : await supabase
                    .from('product_variants')
                    .select('id, price')
                    .eq('product_id', p.id)
                    .eq('is_active', true)
                    .limit(1)
              const variantList = defaultVar ? [defaultVar] : (anyVar ?? [])
              const v = variantList[0] as { id: string; price: number | null } | undefined
              return {
                ...p,
                defaultVariant: v ? { id: v.id, price: v.price } : undefined,
              }
            })
          )
          setProducts(withVariants)
        })
    }
  }, [organizationId, isEditing])

  const handleStatusUpdate = async (newStatus: Order['status']) => {
    if (!order || !id) return
    const previousStatus = order.status
    setUpdating(true)
    try {
      if (newStatus === 'cancelled') {
        const reason = window.prompt('Ingresa el motivo de la anulación de la venta:')
        if (!reason || reason.trim().length === 0) {
          show('Debes indicar un motivo para anular la venta.', 'error')
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: returnId, error } = await (supabase.rpc as any)('create_full_order_cancellation', {
          p_order_id: id,
          p_reason: reason.trim(),
          p_refund_method: order.payment_method || null,
          p_notes: 'Anulación ejecutada desde detalle de orden',
        })
        if (error) throw error

        await trackAuditAction({
          organizationId,
          tableName: 'order_returns',
          recordId: String(returnId || id),
          action: 'INSERT',
          notes: 'Anulación completa de orden desde detalle de orden.',
          newData: {
            order_id: id,
            previous_status: previousStatus,
            new_status: 'cancelled',
            reason: reason.trim(),
          },
        })
      } else {
        const { error } = await supabase
          .from('orders')
          .update({ status: newStatus } as never)
          .eq('id', id)
        if (error) throw error
      }

      await trackAuditAction({
        organizationId,
        tableName: 'orders',
        recordId: id,
        action: 'UPDATE',
        notes: 'Cambio de estado de orden desde detalle de orden.',
        oldData: { status: previousStatus },
        newData: { status: newStatus },
      })
      setOrder({ ...order, status: newStatus })
      show(
        newStatus === 'cancelled'
          ? 'Orden anulada correctamente. Se restauró stock y se registró la devolución total.'
          : 'Estado actualizado',
        'success'
      )
    } catch (error) {
      console.error('Error updating order status:', error)
      show('Error al actualizar el estado', 'error')
    } finally {
      setUpdating(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!order || !id) return
    setSaving(true)
    try {
      const total = editItems.reduce((sum, it) => sum + it.price * it.quantity, 0)
      const amount = parseFloat(editPaymentAmount) || total
      const previousOrderSnapshot = {
        shipping_address: order.shipping_address,
        payment_method: order.payment_method,
        total: order.total,
      }

      await supabase
        .from('orders')
        .update({
          shipping_address: editShipping,
          payment_method: editPaymentMethod,
          total,
        } as never)
        .eq('id', id)

      await trackAuditAction({
        organizationId,
        tableName: 'orders',
        recordId: id,
        action: 'UPDATE',
        notes: 'Edición de datos principales de la orden.',
        oldData: previousOrderSnapshot,
        newData: {
          shipping_address: editShipping,
          payment_method: editPaymentMethod,
          total,
        },
      })

      for (const item of editItems) {
        if (item.id && !item.id.startsWith('new-')) {
          await supabase
            .from('order_items')
            .update({ quantity: item.quantity, price: item.price } as never)
            .eq('id', item.id)
          await trackAuditAction({
            organizationId,
            tableName: 'order_items',
            recordId: item.id,
            action: 'UPDATE',
            notes: 'Edición de item de orden.',
            newData: {
              order_id: id,
              quantity: item.quantity,
              price: item.price,
            },
          })
        } else {
          const { data: insertedItem } = await supabase.from('order_items').insert({
            order_id: id,
            product_id: item.product_id,
            variant_id: item.variant_id ?? null,
            quantity: item.quantity,
            price: item.price,
          } as never).select('id').single()
          if (insertedItem?.id) {
            await trackAuditAction({
              organizationId,
              tableName: 'order_items',
              recordId: insertedItem.id,
              action: 'INSERT',
              notes: 'Item agregado a orden en edición.',
              newData: {
                order_id: id,
                product_id: item.product_id,
                variant_id: item.variant_id ?? null,
                quantity: item.quantity,
                price: item.price,
              },
            })
          }
        }
      }

      for (const item of order.order_items) {
        if (!editItems.some((e) => e.id === item.id)) {
          await supabase.from('order_items').delete().eq('id', item.id)
          await trackAuditAction({
            organizationId,
            tableName: 'order_items',
            recordId: item.id,
            action: 'DELETE',
            notes: 'Item eliminado de orden en edición.',
            oldData: {
              order_id: id,
              product_id: item.product_id,
              variant_id: item.variant_id ?? null,
              quantity: item.quantity,
              price: item.price,
            },
          })
        }
      }

      const mainPayment = orderPayments.find((p) => p.payment_method === editPaymentMethod) ?? orderPayments[0]
      if (mainPayment) {
        await supabase
          .from('order_payments')
          .update({ payment_method: editPaymentMethod, amount } as never)
          .eq('id', mainPayment.id)
        await trackAuditAction({
          organizationId,
          tableName: 'order_payments',
          recordId: mainPayment.id,
          action: 'UPDATE',
          notes: 'Actualización de pago principal de la orden.',
          oldData: {
            payment_method: mainPayment.payment_method,
            amount: mainPayment.amount,
          },
          newData: {
            payment_method: editPaymentMethod,
            amount,
          },
        })
      } else {
        const { data: insertedPayment } = await supabase.from('order_payments').insert({
          order_id: id,
          payment_method: editPaymentMethod,
          amount,
        } as never).select('id').single()
        if (insertedPayment?.id) {
          await trackAuditAction({
            organizationId,
            tableName: 'order_payments',
            recordId: insertedPayment.id,
            action: 'INSERT',
            notes: 'Alta de pago principal de la orden.',
            newData: {
              order_id: id,
              payment_method: editPaymentMethod,
              amount,
            },
          })
        }
      }

      show('Orden actualizada correctamente', 'success')
      setIsEditing(false)
      fetchOrder()
    } catch (error) {
      console.error('Error saving order:', error)
      show('Error al guardar los cambios', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAddProduct = (product: {
    id: string
    name: string
    price: number
    sku: string
    defaultVariant?: { id: string; price: number | null }
  }) => {
    const variantId = product.defaultVariant?.id ?? null
    const price = product.defaultVariant?.price ?? product.price
    const existing = editItems.find(
      (i) => i.product_id === product.id && (i.variant_id ?? null) === variantId
    )
    if (existing) {
      setEditItems((prev) =>
        prev.map((it) =>
          it.id === existing.id ? { ...it, quantity: it.quantity + 1 } : it
        )
      )
    } else {
      setEditItems((prev) => [
        ...prev,
        {
          id: `new-${Date.now()}`,
          order_id: id!,
          product_id: product.id,
          variant_id: variantId,
          quantity: 1,
          price,
          created_at: new Date().toISOString(),
          product: { name: product.name, image_url: null, sku: product.sku, price },
          variant: product.defaultVariant
            ? { id: product.defaultVariant.id, name: null, sku: product.sku, attributes: {}, image_url: null, price }
            : null,
        } as OrderItemWithProduct,
      ])
    }
    setProductSearch('')
    setShowProductSearch(false)
  }

  const handleRemoveItem = (itemId: string) => {
    setEditItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  const handleItemQuantityChange = (itemId: string, delta: number) => {
    setEditItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it
        const q = Math.max(1, it.quantity + delta)
        return { ...it, quantity: q }
      })
    )
  }

  const handleItemPriceChange = (itemId: string, price: number) => {
    setEditItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, price } : it))
    )
  }

  const getReturnedQuantity = (item: OrderItemWithProduct): number => {
    const value = Number(item.returned_quantity ?? 0)
    return Number.isFinite(value) ? value : 0
  }

  const handlePartialReturn = async (item: OrderItemWithProduct) => {
    if (!id || !organizationId) return

    const returnedQty = getReturnedQuantity(item)
    const remainingQty = item.quantity - returnedQty

    if (remainingQty <= 0) {
      show('Este item ya fue devuelto completamente.', 'info')
      return
    }

    const quantityInput = window.prompt(
      `Cantidad a devolver (máximo ${remainingQty})`,
      String(remainingQty)
    )
    if (!quantityInput) return

    const quantity = Number(quantityInput)
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > remainingQty) {
      show('Cantidad de devolución inválida.', 'error')
      return
    }

    const reason = window.prompt('Motivo de la devolución parcial:')
    if (!reason || reason.trim().length === 0) {
      show('Debes indicar un motivo para la devolución.', 'error')
      return
    }

    setReturningItemId(item.id)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: returnId, error } = await (supabase.rpc as any)('process_partial_order_return', {
        p_order_id: id,
        p_reason: reason.trim(),
        p_items: [{ order_item_id: item.id, quantity }],
        p_refund_method: order?.payment_method || null,
        p_notes: 'Devolución parcial desde detalle de orden',
      })

      if (error) throw error

      await trackAuditAction({
        organizationId,
        tableName: 'order_returns',
        recordId: String(returnId || item.id),
        action: 'INSERT',
        notes: 'Devolución parcial de item desde detalle de orden.',
        newData: {
          order_id: id,
          order_item_id: item.id,
          quantity,
          reason: reason.trim(),
        },
      })

      show('Devolución parcial registrada correctamente.', 'success')
      await fetchOrder()
    } catch (error) {
      console.error('Error processing partial return:', error)
      show('No se pudo registrar la devolución parcial.', 'error')
    } finally {
      setReturningItemId(null)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      productSearch.trim().length > 0 ||
      !editItems.some(
        (i) =>
          i.product_id === p.id &&
          (i.variant_id ?? null) === (p.defaultVariant?.id ?? null)
      )
  ).filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 8)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-600" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg mb-4">Orden no encontrada</p>
        <Link to="/orders">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Órdenes
          </Button>
        </Link>
      </div>
    )
  }

  const shippingAddress = (order.shipping_address as ShippingAddress) ?? {}
  const displayShipping = isEditing ? editShipping : shippingAddress
  const displayItems = isEditing ? editItems : order.order_items
  const displayTotal = isEditing
    ? editItems.reduce((sum, it) => sum + it.price * it.quantity, 0)
    : order.total

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/orders">
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Órdenes
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Detalle de Orden</h1>
          <p className="text-gray-600 mt-2">ID: {order.id}</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline">
            <Edit2 className="h-4 w-4 mr-2" />
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Información de la Orden</span>
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Fecha de Creación</p>
                  <p className="font-medium flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDateTime(order.created_at, settings)}</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="font-semibold text-lg text-admin-600">
                    {formatPrice(displayTotal, settings)}
                  </p>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                    <select
                      value={editPaymentMethod}
                      onChange={(e) => setEditPaymentMethod(e.target.value)}
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 bg-white"
                    >
                      {paymentMethods.map((m) => (
                        <option key={m.id} value={m.key}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editPaymentAmount}
                      onChange={(e) => setEditPaymentAmount(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                order.payment_method && (
                  <div>
                    <p className="text-sm text-gray-600">Método de Pago</p>
                    <p className="font-medium capitalize">
                      {paymentMethods.find((m) => m.key === order.payment_method)?.name ?? order.payment_method}
                    </p>
                  </div>
                )
              )}

              <div>
                <p className="text-sm text-gray-600 mb-2">Actualizar Estado</p>
                <div className="flex flex-wrap gap-2">
                  {(['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const).map((status) => (
                    <Button
                      key={status}
                      variant={order.status === status ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusUpdate(status)}
                      disabled={updating || order.status === status}
                    >
                      {getStatusLabel(status)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Productos</CardTitle>
              {isEditing && (
                <div className="relative">
                  <Input
                    placeholder="Buscar producto..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      setShowProductSearch(true)
                    }}
                    onFocus={() => setShowProductSearch(true)}
                    className="w-48"
                  />
                  {showProductSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-auto">
                      {filteredProducts.length === 0 ? (
                        <p className="p-3 text-sm text-gray-500">Sin resultados</p>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between items-center"
                            onClick={() => handleAddProduct(p)}
                          >
                            <span>{p.name}</span>
                            <span className="text-sm text-gray-600">{formatPrice(p.price, settings)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {displayItems.map((item) => {
                  const variant = item.variant
                  const displayImage = variant?.image_url || item.product.image_url
                  const displaySku = variant?.sku || item.product.sku
                  return (
                    <div
                      key={item.id}
                      className="flex items-center space-x-4 border-b pb-4 last:border-b-0 last:pb-0"
                    >
                      {displayImage && (
                        <img
                          src={displayImage}
                          alt={capitalizeFirst(item.product.name)}
                          className="w-16 h-16 object-cover rounded shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{capitalizeFirst(item.product.name)}</p>
                        {variant?.name && (
                          <p className="text-sm text-gray-700">Variante: {capitalizeFirst(variant.name)}</p>
                        )}
                        <p className="text-sm text-gray-600">SKU: {displaySku}</p>
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center border rounded">
                              <button
                                type="button"
                                onClick={() => handleItemQuantityChange(item.id, -1)}
                                className="p-1 hover:bg-gray-100"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="px-2 min-w-[2rem] text-center">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleItemQuantityChange(item.id, 1)}
                                className="p-1 hover:bg-gray-100"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price}
                              onChange={(e) => handleItemPriceChange(item.id, parseFloat(e.target.value) || 0)}
                              className="w-24"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-gray-600">
                              Cantidad: {item.quantity} × {formatPrice(item.price, settings)}
                            </p>
                            {getReturnedQuantity(item) > 0 && (
                              <p className="text-xs text-amber-700">
                                Devuelto: {getReturnedQuantity(item)} / {item.quantity}
                              </p>
                            )}
                            {order.status !== 'cancelled' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePartialReturn(item)}
                                disabled={Boolean(returningItemId) || getReturnedQuantity(item) >= item.quantity}
                                className="mt-2"
                              >
                                {returningItemId === item.id ? 'Procesando...' : 'Registrar devolución parcial'}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 shrink-0">
                        {formatPrice(item.price * item.quantity, settings)}
                      </p>
                    </div>
                  )
                })}
              </div>
              <div className="border-t mt-4 pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatPrice(displayTotal, settings)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Cliente</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.customer ? (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Nombre</p>
                    <p className="font-medium">{order.customer.full_name || 'N/A'}</p>
                  </div>
                  {order.customer.email && (
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{order.customer.email}</p>
                    </div>
                  )}
                </>
              ) : order.user_profile ? (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Nombre</p>
                    <p className="font-medium">{order.user_profile.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{order.user_profile.email}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600">Cliente Invitado</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Dirección de Envío</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditing ? (
                <>
                  <Input
                    label="Nombre"
                    value={editShipping.fullName}
                    onChange={(e) => setEditShipping((s) => ({ ...s, fullName: e.target.value }))}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={editShipping.email ?? ''}
                    onChange={(e) => setEditShipping((s) => ({ ...s, email: e.target.value }))}
                    placeholder="cliente@email.com"
                  />
                  <Input
                    label="Teléfono"
                    value={editShipping.phone}
                    onChange={(e) => setEditShipping((s) => ({ ...s, phone: e.target.value }))}
                  />
                  <Input
                    label="Dirección"
                    value={editShipping.address}
                    onChange={(e) => setEditShipping((s) => ({ ...s, address: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Ciudad"
                      value={editShipping.city}
                      onChange={(e) => setEditShipping((s) => ({ ...s, city: e.target.value }))}
                    />
                    <Input
                      label="Provincia"
                      value={editShipping.state}
                      onChange={(e) => setEditShipping((s) => ({ ...s, state: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Código Postal"
                      value={editShipping.zipCode}
                      onChange={(e) => setEditShipping((s) => ({ ...s, zipCode: e.target.value }))}
                    />
                    <Input
                      label="País"
                      value={editShipping.country}
                      onChange={(e) => setEditShipping((s) => ({ ...s, country: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-gray-600 flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>Nombre</span>
                    </p>
                    <p className="font-medium">{displayShipping.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{displayShipping.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>Teléfono</span>
                    </p>
                    <p className="font-medium">{displayShipping.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Dirección</p>
                    <p className="font-medium">{displayShipping.address}</p>
                    <p className="font-medium">
                      {displayShipping.city}, {displayShipping.state} {displayShipping.zipCode}
                    </p>
                    <p className="font-medium">{displayShipping.country}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
