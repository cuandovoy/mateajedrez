import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { supabase } from '@/lib/supabase'
import { useOrgPaymentMethods } from '@/hooks/useOrgPaymentMethods'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { usePermission } from '@/hooks/usePermission'
import { trackAuditAction } from '@/lib/audit'
import { capitalizeFirst, formatDateTime, formatPrice } from '@/lib/utils'
import { useOrganizationStore } from '@/store/organizationStore'
import { useToastStore } from '@/store/toastStore'
import type { Order, OrderItem } from '@/types'
import type { OrderPayment } from '@/types/database.types'
import { obtenerPDF, anularComprobante, BillerApiError, descargarPDFBlob } from '@/lib/biller'
import type { BillerConfig } from '@/types/biller'
import { ArrowLeft, Calendar, DollarSign, Edit2, FileText, MapPin, Minus, Package, Phone, Plus, Receipt, Save, Trash2, User, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useAdminBranches } from '@/hooks/useAdminBranches'
import { Link, useParams } from 'react-router-dom'

const getStatusLabel = (status: string | null): string => {
  const statusMap: Record<string, string> = {
    pending_allocation: 'Pendiente de asignación',
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
    pending_allocation: 'bg-orange-100 text-orange-800',
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return (status && colorMap[status]) || 'bg-gray-100 text-gray-800'
}

const formatOrderDisplayNumber = (orderId: string, orderNumber?: number | null): string => {
  if (orderNumber && orderNumber > 0) return `#${String(orderNumber).padStart(6, '0')}`
  return `#${orderId.slice(0, 8).toUpperCase()}`
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

type DiscountKind = 'percentage' | 'fixed_amount' | 'price_override'
type SalesDiscountRule = {
  id: string
  name: string
  scope: 'order' | 'item'
  kind: DiscountKind
  value: number
  min_order_total: number | null
  max_discount_amount: number | null
}

export function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const settings = useOrgSettings()
  const { show } = useToastStore()
  const organizationId = useOrganizationStore((s) => s.currentOrganization?.id)
  const { methods: paymentMethods } = useOrgPaymentMethods(organizationId)
  const [updating, setUpdating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingBranch, setSavingBranch] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false)
  const [collectAmount, setCollectAmount] = useState('')
  const [collectMethod, setCollectMethod] = useState('')
  const [collectNotes, setCollectNotes] = useState('')
  const [paymentToDelete, setPaymentToDelete] = useState<OrderPayment | null>(null)
  const [returningItemId, setReturningItemId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')

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
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [annullingCFE, setAnnullingCFE] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isPartialReturnModalOpen, setIsPartialReturnModalOpen] = useState(false)
  const [partialReturnItem, setPartialReturnItem] = useState<OrderItemWithProduct | null>(null)
  const [partialReturnQuantity, setPartialReturnQuantity] = useState('')
  const [partialReturnReason, setPartialReturnReason] = useState('')
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)
  const [discountTarget, setDiscountTarget] = useState<'order' | 'item'>('order')
  const [discountTargetItem, setDiscountTargetItem] = useState<OrderItemWithProduct | null>(null)
  const [discountRuleId, setDiscountRuleId] = useState('')
  const [discountKind, setDiscountKind] = useState<DiscountKind>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [isManualDiscount, setIsManualDiscount] = useState(false)
  const [isAnnulCFEConfirmOpen, setIsAnnulCFEConfirmOpen] = useState(false)

  const { can, loading: permLoading } = usePermission()
  const canManage = can('ventas:gestionar')
  const queryClient = useQueryClient()
  const { data: branches = [] } = useAdminBranches(organizationId)

  const orderKey = queryKeys.orders.detail(organizationId!, id!)
  const { data: orderData, isPending: loading } = useQuery({
    queryKey: orderKey,
    queryFn: async () => {
      const { data: orderRaw, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (name, image_url, sku, price),
            variant:product_variants (id, name, sku, attributes, image_url, price)
          )
        `)
        .eq('id', id!)
        .single()
      if (orderError) throw orderError
      if (!orderRaw) throw new Error('Orden no encontrada')

      const ord = orderRaw as OrderWithItems
      const [
        paymentsResult,
        userProfileResult,
        customerResult,
        manualItemsResult,
        cfeResult,
        billerConfigResult,
      ] = await Promise.all([
        supabase.from('order_payments').select('*').eq('order_id', id!),
        ord.user_id
          ? supabase.from('user_profiles').select('full_name').eq('user_id', ord.user_id).single()
          : Promise.resolve({ data: null, error: null }),
        ord.customer_id
          ? supabase.from('customers').select('email, full_name').eq('id', ord.customer_id).single()
          : Promise.resolve({ data: null, error: null }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('order_manual_items')
          .select('id, description, quantity, price, created_at')
          .eq('order_id', id!)
          .order('created_at', { ascending: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('biller_comprobantes')
          .select('id, biller_id, tipo_comprobante, serie, numero, estado')
          .eq('order_id', id!)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        ord.organization_id
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (supabase as any)
              .from('biller_config')
              .select('*')
              .eq('organization_id', ord.organization_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      const payments = (paymentsResult.data ?? []) as OrderPayment[]
      let userProfile: { full_name: string | null; email: string } | null = null
      if (userProfileResult.data) {
        userProfile = { full_name: (userProfileResult.data as { full_name: string }).full_name, email: 'N/A' }
      }
      const customer = customerResult.data as { email: string | null; full_name: string } | null

      return {
        order: { ...ord, order_items: ord.order_items ?? [], user_profile: userProfile, customer } as OrderWithItems,
        payments,
        manualItems: (manualItemsResult.data ?? []) as { id: string; description: string; quantity: number; price: number; created_at: string }[],
        cfe: (cfeResult.data ?? null) as { id: string; biller_id: number; tipo_comprobante: number; serie: string | null; numero: number | null; estado: string } | null,
        billerConfig: (billerConfigResult.data ?? null) as BillerConfig | null,
      }
    },
    enabled: !!id && !!organizationId,
  })

  const order = orderData?.order ?? null
  const orderPayments = orderData?.payments ?? []
  const orderManualItems = orderData?.manualItems ?? []
  const billerComprobante = orderData?.cfe ?? null
  const billerConfig = orderData?.billerConfig ?? null
  const invalidateOrder = () => {
    queryClient.invalidateQueries({ queryKey: orderKey })
    queryClient.invalidateQueries({ queryKey: ['admin', organizationId!, 'debtors'] })
  }

  const { data: products = [] } = useQuery({
    queryKey: ['admin', organizationId!, 'products', 'with-default-variants'],
    queryFn: async () => {
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, price, sku')
        .eq('organization_id', organizationId!)
        .eq('is_active', true)
        .order('name')
      const prods = (productsData ?? []) as Array<{ id: string; name: string; price: number; sku: string }>
      if (prods.length === 0) return []
      const { data: allVariants } = await supabase
        .from('product_variants')
        .select('id, product_id, price, sku')
        .in('product_id', prods.map((p) => p.id))
        .eq('is_active', true)
      const variantMap: Record<string, { id: string; price: number | null }> = {}
      for (const v of (allVariants ?? []) as Array<{ id: string; product_id: string; price: number | null; sku: string }>) {
        if (!variantMap[v.product_id]) variantMap[v.product_id] = { id: v.id, price: v.price }
      }
      for (const v of (allVariants ?? []) as Array<{ id: string; product_id: string; price: number | null; sku: string }>) {
        if (v.sku.endsWith('-DEFAULT')) variantMap[v.product_id] = { id: v.id, price: v.price }
      }
      return prods.map((p) => ({ ...p, defaultVariant: variantMap[p.id] }))
    },
    enabled: !!organizationId && isEditing,
    staleTime: 5 * 60 * 1000,
  })

  const { data: discountRulesData } = useQuery({
    queryKey: ['admin', organizationId!, 'discount-rules'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: orderRules }, { data: itemRules }] = await Promise.all([
        (supabase.rpc as any)('list_active_sales_discount_rules', { p_organization_id: organizationId, p_scope: 'order' }),
        (supabase.rpc as any)('list_active_sales_discount_rules', { p_organization_id: organizationId, p_scope: 'item' }),
      ])
      return {
        orderRules: (Array.isArray(orderRules) ? orderRules : []) as SalesDiscountRule[],
        itemRules: (Array.isArray(itemRules) ? itemRules : []) as SalesDiscountRule[],
      }
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })
  const orderDiscountRules = discountRulesData?.orderRules ?? []
  const itemDiscountRules = discountRulesData?.itemRules ?? []

  // Initialize edit state when order data loads or refreshes (only when not actively editing)
  useEffect(() => {
    if (!orderData || isEditing) return
    const { order: ord, payments } = orderData
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
    setSelectedBranchId(ord.branch_id ?? '')
    const mainPayment = payments.find((p) => p.payment_method === ord.payment_method) ?? payments[0]
    setEditPaymentAmount(mainPayment ? String(mainPayment.amount) : String(ord.total))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderData])

  const openOrderDiscountModal = () => {
    setDiscountTarget('order')
    setDiscountTargetItem(null)
    setDiscountRuleId(orderDiscountRules[0]?.id ?? '')
    setIsManualDiscount(orderDiscountRules.length === 0)
    setDiscountKind('percentage')
    setDiscountValue('')
    setDiscountReason('')
    setIsDiscountModalOpen(true)
  }

  const handleConfirmDiscount = async () => {
    if (!id) return

    let payload: Record<string, unknown>
    if (isManualDiscount) {
      const value = Number(discountValue)
      if (!Number.isFinite(value) || value <= 0) {
        show('Valor inválido.', 'error')
        return
      }
      payload = { kind: discountKind, value, reason: discountReason || null }
    } else {
      if (!discountRuleId) {
        show('Seleccioná una regla.', 'error')
        return
      }
      payload = { rule_id: discountRuleId }
    }

    try {
      if (discountTarget === 'order') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.rpc as any)('apply_order_discount', {
          p_order_id: id,
          p_discount: payload,
        })
        if (error) throw error
        show('Descuento de orden aplicado.', 'success')
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.rpc as any)('apply_order_item_discount', {
          p_order_id: id,
          p_order_item_id: discountTargetItem!.id,
          p_discount: payload,
        })
        if (error) throw error
        show('Descuento de ítem aplicado.', 'success')
      }
      setIsDiscountModalOpen(false)
      invalidateOrder()
    } catch (error: unknown) {
      console.error('Error applying discount:', error)
      show(error instanceof Error ? error.message : 'No se pudo aplicar el descuento.', 'error')
    }
  }

  const handleRemoveOrderDiscount = async () => {
    if (!id) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('remove_order_discount', {
        p_order_id: id,
        p_reason: 'Removido desde detalle de orden',
      })
      if (error) throw error
      show('Descuento de orden removido.', 'success')
      invalidateOrder()
    } catch (error: unknown) {
      console.error('Error removing order discount:', error)
      show(error instanceof Error ? error.message : 'No se pudo remover el descuento.', 'error')
    }
  }

  const openItemDiscountModal = (item: OrderItemWithProduct) => {
    setDiscountTarget('item')
    setDiscountTargetItem(item)
    setDiscountRuleId(itemDiscountRules[0]?.id ?? '')
    setIsManualDiscount(itemDiscountRules.length === 0)
    setDiscountKind('percentage')
    setDiscountValue('')
    setDiscountReason('')
    setIsDiscountModalOpen(true)
  }

  const handleRemoveItemDiscount = async (item: OrderItemWithProduct) => {
    if (!id) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('remove_order_item_discount', {
        p_order_id: id,
        p_order_item_id: item.id,
        p_reason: 'Removido desde detalle de orden',
      })
      if (error) throw error
      show('Descuento de ítem removido.', 'success')
      invalidateOrder()
    } catch (error: unknown) {
      console.error('Error removing item discount:', error)
      show(error instanceof Error ? error.message : 'No se pudo remover el descuento de ítem.', 'error')
    }
  }

  const handleStatusUpdate = async (newStatus: Order['status']) => {
    if (!order || !id) return
    if (
      order.status === 'pending_allocation'
      && newStatus !== 'pending_allocation'
      && newStatus !== 'cancelled'
    ) {
      if (!order.branch_id) {
        show('Debes asignar una sucursal antes de confirmar la orden.', 'error')
        return
      }
      if (selectedBranchId && selectedBranchId !== order.branch_id) {
        show('Guardá primero la sucursal seleccionada antes de cambiar el estado.', 'error')
        return
      }
    }

    if (newStatus === 'cancelled') {
      setCancelReason('')
      setIsCancelModalOpen(true)
      return
    }

    const previousStatus = order.status
    setUpdating(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus } as never)
        .eq('id', id)
      if (error) throw error

      await trackAuditAction({
        organizationId,
        tableName: 'orders',
        recordId: id,
        action: 'UPDATE',
        notes: 'Cambio de estado de orden desde detalle de orden.',
        oldData: { status: previousStatus },
        newData: { status: newStatus },
      })
      invalidateOrder()
      show('Estado actualizado', 'success')
    } catch (error) {
      console.error('Error updating order status:', error)
      show('Error al actualizar el estado', 'error')
    } finally {
      setUpdating(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (!order || !id || !cancelReason.trim()) return
    const previousStatus = order.status
    setUpdating(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: returnId, error } = await (supabase.rpc as any)('create_full_order_cancellation', {
        p_order_id: id,
        p_reason: cancelReason.trim(),
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
          reason: cancelReason.trim(),
        },
      })
      await trackAuditAction({
        organizationId,
        tableName: 'orders',
        recordId: id,
        action: 'UPDATE',
        notes: 'Cambio de estado de orden desde detalle de orden.',
        oldData: { status: previousStatus },
        newData: { status: 'cancelled' },
      })

      invalidateOrder()
      setIsCancelModalOpen(false)
      setCancelReason('')
      show('Orden anulada correctamente. Se restauró stock y se registró la devolución total.', 'success')
    } catch (error) {
      console.error('Error cancelling order:', error)
      show('Error al anular la orden', 'error')
    } finally {
      setUpdating(false)
    }
  }

  const handleBranchAssignmentSave = async () => {
    if (!order || !id || !selectedBranchId || selectedBranchId === order.branch_id) return

    setSavingBranch(true)
    try {
      const previousBranchId = order.branch_id
      const { error } = await supabase
        .from('orders')
        .update({ branch_id: selectedBranchId } as never)
        .eq('id', id)

      if (error) throw error

      await trackAuditAction({
        organizationId,
        tableName: 'orders',
        recordId: id,
        action: 'UPDATE',
        notes: 'Reasignación de sucursal de orden desde detalle.',
        oldData: { branch_id: previousBranchId },
        newData: { branch_id: selectedBranchId },
      })

      invalidateOrder()
      show('Sucursal de la orden actualizada.', 'success')
    } catch (error) {
      console.error('Error updating order branch:', error)
      show('No se pudo actualizar la sucursal de la orden.', 'error')
    } finally {
      setSavingBranch(false)
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
      invalidateOrder()
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

  const handleOpenCollectModal = () => {
    const defaultMethod = paymentMethods[0]?.key ?? ''
    setCollectAmount('')
    setCollectMethod(defaultMethod)
    setCollectNotes('')
    setIsCollectModalOpen(true)
  }

  const handleRegisterCollection = async () => {
    if (!id || !order) return

    const amount = Number(collectAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      show('Ingresa un monto válido', 'error')
      return
    }

    const totalPaid = orderPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const pendingAmount = Math.max(Number(order.total || 0) - totalPaid, 0)
    if (amount > pendingAmount) {
      show(`El cobro no puede superar el saldo pendiente (${formatPrice(pendingAmount, settings)})`, 'error')
      return
    }

    if (!collectMethod) {
      show('Selecciona un método de cobro', 'error')
      return
    }

    setCollecting(true)
    try {
      const selectedMethod = paymentMethods.find((m) => m.key === collectMethod)
      let cashSessionId: string | null = null

      if (selectedMethod?.requires_cash_session) {
        if (!order.branch_id) {
          show('La orden no tiene sucursal asignada, no se puede asociar una sesión de caja.', 'error')
          return
        }
        const { data: openSession } = await supabase
          .from('cash_sessions')
          .select('id')
          .eq('branch_id', order.branch_id)
          .is('closed_at', null)
          .maybeSingle()

        cashSessionId = (openSession as { id: string } | null)?.id ?? null
        if (!cashSessionId) {
          show('Para registrar este cobro debes tener una sesión de caja abierta en la sucursal de la orden.', 'error')
          return
        }
      }

      const { data: insertedPayment, error: paymentError } = await supabase
        .from('order_payments')
        .insert({
          order_id: id,
          payment_method: collectMethod,
          amount,
          cash_session_id: cashSessionId,
          notes: collectNotes || 'Cobro registrado desde detalle de orden',
        } as never)
        .select('id')
        .single()

      if (paymentError) throw paymentError

      if (cashSessionId) {
        const cashMethodKeys = paymentMethods.filter((m) => m.requires_cash_session).map((m) => m.key)
        const { data: sessionData } = await supabase
          .from('cash_sessions')
          .select('opening_amount')
          .eq('id', cashSessionId)
          .single()

        const { data: paymentsData } =
          cashMethodKeys.length > 0
            ? await supabase
                .from('order_payments')
                .select('amount')
                .eq('cash_session_id', cashSessionId)
                .in('payment_method', cashMethodKeys)
            : await supabase
                .from('order_payments')
                .select('amount')
                .eq('cash_session_id', cashSessionId)
                .eq('payment_method', collectMethod)

        if (sessionData && (sessionData as { opening_amount: number }).opening_amount !== undefined) {
          const cashPaymentsTotal = (paymentsData || []).reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
          const newExpectedAmount = ((sessionData as { opening_amount: number }).opening_amount || 0) + cashPaymentsTotal
          await supabase
            .from('cash_sessions')
            .update({ expected_amount: newExpectedAmount } as never)
            .eq('id', cashSessionId)
        }
      }

      if (!order.payment_method) {
        await supabase
          .from('orders')
          .update({ payment_method: collectMethod } as never)
          .eq('id', id)
      }

      await trackAuditAction({
        organizationId,
        tableName: 'order_payments',
        recordId: insertedPayment?.id || id,
        action: 'INSERT',
        actionCode: 'ORDER_COLLECTION_REGISTERED',
        module: 'ventas',
        notes: 'Registro de cobro parcial/total desde detalle de orden.',
        newData: {
          order_id: id,
          amount,
          payment_method: collectMethod,
          cash_session_id: cashSessionId,
          notes: collectNotes || null,
        },
      })

      setIsCollectModalOpen(false)
      show('Cobro registrado correctamente', 'success')
      invalidateOrder()
    } catch (error) {
      console.error('Error registering collection:', error)
      show('No se pudo registrar el cobro', 'error')
    } finally {
      setCollecting(false)
    }
  }

  const handleDeletePayment = async () => {
    if (!paymentToDelete || !id) return

    setCollecting(true)
    try {
      const paymentId = paymentToDelete.id
      const cashSessionId = paymentToDelete.cash_session_id
      const paymentMethod = paymentToDelete.payment_method

      const { error } = await supabase
        .from('order_payments')
        .delete()
        .eq('id', paymentId)
      if (error) throw error

      if (cashSessionId) {
        const cashMethodKeys = paymentMethods.filter((m) => m.requires_cash_session).map((m) => m.key)
        const { data: sessionData } = await supabase
          .from('cash_sessions')
          .select('opening_amount')
          .eq('id', cashSessionId)
          .single()

        const { data: paymentsData } =
          cashMethodKeys.length > 0
            ? await supabase
                .from('order_payments')
                .select('amount')
                .eq('cash_session_id', cashSessionId)
                .in('payment_method', cashMethodKeys)
            : await supabase
                .from('order_payments')
                .select('amount')
                .eq('cash_session_id', cashSessionId)
                .eq('payment_method', paymentMethod)

        if (sessionData && (sessionData as { opening_amount: number }).opening_amount !== undefined) {
          const cashPaymentsTotal = (paymentsData || []).reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
          const newExpectedAmount = ((sessionData as { opening_amount: number }).opening_amount || 0) + cashPaymentsTotal
          await supabase
            .from('cash_sessions')
            .update({ expected_amount: newExpectedAmount } as never)
            .eq('id', cashSessionId)
        }
      }

      await trackAuditAction({
        organizationId,
        tableName: 'order_payments',
        recordId: paymentId,
        action: 'DELETE',
        actionCode: 'ORDER_PAYMENT_DELETED',
        module: 'ventas',
        notes: 'Eliminación de cobro desde detalle de orden.',
        oldData: paymentToDelete,
      })

      setPaymentToDelete(null)
      show('Cobro eliminado correctamente', 'success')
      invalidateOrder()
    } catch (error) {
      console.error('Error deleting payment:', error)
      const rawMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : ''
      const message = rawMessage.toLowerCase().includes('row-level security')
        ? 'No tienes permisos para eliminar este cobro en la organización actual.'
        : rawMessage || 'No se pudo eliminar el cobro'
      show(message, 'error')
    } finally {
      setCollecting(false)
    }
  }

  const getReturnedQuantity = (item: OrderItemWithProduct): number => {
    const value = Number(item.returned_quantity ?? 0)
    return Number.isFinite(value) ? value : 0
  }

  const openPartialReturnModal = (item: OrderItemWithProduct) => {
    if (!id || !organizationId) return
    const returnedQty = getReturnedQuantity(item)
    const remainingQty = item.quantity - returnedQty
    if (remainingQty <= 0) {
      show('Este item ya fue devuelto completamente.', 'info')
      return
    }
    setPartialReturnItem(item)
    setPartialReturnQuantity(String(remainingQty))
    setPartialReturnReason('')
    setIsPartialReturnModalOpen(true)
  }

  const handleConfirmPartialReturn = async () => {
    if (!id || !organizationId || !partialReturnItem) return
    const returnedQty = getReturnedQuantity(partialReturnItem)
    const remainingQty = partialReturnItem.quantity - returnedQty
    const quantity = Number(partialReturnQuantity)

    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > remainingQty) {
      show('Cantidad de devolución inválida.', 'error')
      return
    }
    if (!partialReturnReason.trim()) {
      show('Debes indicar un motivo para la devolución.', 'error')
      return
    }

    setReturningItemId(partialReturnItem.id)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: returnId, error } = await (supabase.rpc as any)('process_partial_order_return', {
        p_order_id: id,
        p_reason: partialReturnReason.trim(),
        p_items: [{ order_item_id: partialReturnItem.id, quantity }],
        p_refund_method: order?.payment_method || null,
        p_notes: 'Devolución parcial desde detalle de orden',
      })
      if (error) throw error

      await trackAuditAction({
        organizationId,
        tableName: 'order_returns',
        recordId: String(returnId || partialReturnItem.id),
        action: 'INSERT',
        notes: 'Devolución parcial de item desde detalle de orden.',
        newData: {
          order_id: id,
          order_item_id: partialReturnItem.id,
          quantity,
          reason: partialReturnReason.trim(),
        },
      })

      setIsPartialReturnModalOpen(false)
      setPartialReturnItem(null)
      show('Devolución parcial registrada correctamente.', 'success')
      invalidateOrder()
    } catch (error) {
      console.error('Error processing partial return:', error)
      show('No se pudo registrar la devolución parcial.', 'error')
    } finally {
      setReturningItemId(null)
    }
  }

  const handleDownloadCFEPDF = async () => {
    if (!billerComprobante || !billerConfig) return
    setDownloadingPDF(true)
    try {
      const blob = await obtenerPDF(billerConfig, billerComprobante.biller_id)
      descargarPDFBlob(blob, `cfe-${billerComprobante.numero ?? billerComprobante.biller_id}.pdf`)
    } catch (e) {
      show(e instanceof BillerApiError ? e.message : 'Error al descargar el PDF del CFE', 'error')
    } finally {
      setDownloadingPDF(false)
    }
  }

  const handleAnnulCFE = async () => {
    if (!billerComprobante || !billerConfig || !id) return
    setAnnullingCFE(true)
    try {
      await anularComprobante(billerConfig, billerComprobante.biller_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('biller_comprobantes')
        .update({ estado: 'anulado' })
        .eq('id', billerComprobante.id)
      setIsAnnulCFEConfirmOpen(false)
      show('Comprobante anulado correctamente', 'success')
      invalidateOrder()
    } catch (e) {
      show(e instanceof BillerApiError ? e.message : 'Error al anular el comprobante', 'error')
    } finally {
      setAnnullingCFE(false)
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

  if (permLoading) return <SkeletonTable rows={10} />
  if (!can('ventas:ver')) return null

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
  const totalPaid = orderPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const pendingAmount = Math.max(Number(order.total || 0) - totalPaid, 0)
  const collectionStatus =
    order.status === 'cancelled'
      ? { label: 'Sin cobro (orden anulada)', color: 'bg-gray-100 text-gray-700' }
      : totalPaid <= 0
      ? { label: 'Pendiente de cobro', color: 'bg-amber-100 text-amber-800' }
      : pendingAmount > 0
      ? { label: 'Cobro parcial', color: 'bg-blue-100 text-blue-800' }
      : { label: 'Cobrada', color: 'bg-green-100 text-green-800' }
  const hasDiscount = Number(order.discount_total ?? 0) > 0
  const assignableBranches = (settings.checkout_exclude_isolated_warehouses !== false
    ? branches.filter((branch) => !branch.is_isolated_warehouse)
    : branches)
    .filter((branch) => branch.is_active !== false)
  const statusOptions =
    order.status === 'pending_allocation'
      ? (['pending_allocation', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const)
      : (['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const)
  const discountStatusMessage =
    order.status === 'cancelled'
      ? 'Orden cancelada: no se permiten cambios de descuento.'
      : hasDiscount
      ? pendingAmount < 0.01
        ? 'Descuento aplicado. La orden está totalmente cobrada.'
        : `Descuento aplicado. Saldo pendiente: ${formatPrice(pendingAmount, settings)}.`
      : 'No hay descuentos aplicados en esta orden.'

  const handleExportInternalReceipt = () => {
    const companyName = useOrganizationStore.getState().currentOrganization?.name || 'Mi negocio'
    const openedAt = formatDateTime(order.created_at, settings)
    const customerName = displayShipping.fullName || 'Cliente en tienda'
    const safeRows = order.order_items.map((item) => {
      const lineTotal = item.quantity * item.price
      const variantName = item.variant?.name ? ` (${item.variant.name})` : ''
      return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${capitalizeFirst(item.product.name)}${variantName}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatPrice(item.price, settings)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatPrice(lineTotal, settings)}</td>
        </tr>
      `
    }).join('')

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      show('No se pudo abrir la ventana de impresión. Habilitá popups para este sitio.', 'error')
      return
    }

    const orderDisplayNumber = formatOrderDisplayNumber(order.id, order.order_number)
    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Comprobante interno - ${orderDisplayNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 24px; color:#111827;">
        <h2 style="margin:0 0 8px 0;">${companyName}</h2>
        <p style="margin:0 0 14px 0; font-size:12px; color:#4b5563;">Comprobante interno (no fiscal)</p>
        <hr style="border:none;border-top:1px solid #e5e7eb; margin:10px 0 16px;" />

        <p style="margin:0 0 6px 0;"><strong>Orden:</strong> ${orderDisplayNumber}</p>
        <p style="margin:0 0 6px 0;"><strong>Referencia interna:</strong> ${order.id}</p>
        <p style="margin:0 0 6px 0;"><strong>Fecha:</strong> ${openedAt}</p>
        <p style="margin:0 0 6px 0;"><strong>Cliente:</strong> ${customerName}</p>
        <p style="margin:0 0 6px 0;"><strong>Estado:</strong> ${getStatusLabel(order.status)}</p>
        <p style="margin:0 0 6px 0;"><strong>Estado de cobro:</strong> ${collectionStatus.label}</p>
        <p style="margin:0 0 16px 0;"><strong>Método:</strong> ${paymentMethods.find((m) => m.key === order.payment_method)?.name ?? order.payment_method ?? 'Sin método'}</p>

        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px; text-align:left; border-bottom:1px solid #d1d5db;">Producto</th>
              <th style="padding:8px; text-align:center; border-bottom:1px solid #d1d5db;">Cant.</th>
              <th style="padding:8px; text-align:right; border-bottom:1px solid #d1d5db;">Precio</th>
              <th style="padding:8px; text-align:right; border-bottom:1px solid #d1d5db;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${safeRows}
          </tbody>
        </table>

        <div style="margin-top:16px; text-align:right;">
          <p style="margin:0 0 6px 0;"><strong>Subtotal:</strong> ${formatPrice(Number(order.subtotal_before_discount ?? order.total), settings)}</p>
          <p style="margin:0 0 6px 0;"><strong>Descuento:</strong> -${formatPrice(Number(order.discount_total ?? 0), settings)}</p>
          <p style="margin:0 0 6px 0;"><strong>Impuestos:</strong> ${formatPrice(Number(order.tax_total ?? 0), settings)}</p>
          <p style="margin:0 0 6px 0;"><strong>Total:</strong> ${formatPrice(order.total, settings)}</p>
          <p style="margin:0 0 6px 0;"><strong>Cobrado:</strong> ${formatPrice(totalPaid, settings)}</p>
          <p style="margin:0;"><strong>Saldo pendiente:</strong> ${formatPrice(pendingAmount, settings)}</p>
        </div>
      </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/orders">
          <Button variant="outline" className="mb-4" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Órdenes
          </Button>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Detalle de Orden</h1>
            <p className="text-gray-600 mt-1">
              Orden {formatOrderDisplayNumber(order.id, order.order_number)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 break-all">Ref. interna: {order.id}</p>
          </div>
          {!isEditing ? (
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={handleExportInternalReceipt}>
                <FileText className="h-4 w-4 mr-2" />
                Comprobante
              </Button>
              {canManage && (
                <Button onClick={() => setIsEditing(true)} size="sm">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          ) : (
            <div className="flex gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} size="sm" disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          )}
        </div>
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
                <div>
                  <p className="text-sm text-gray-600">Estado de cobro</p>
                  <div className="mt-1 space-y-1">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${collectionStatus.color}`}>
                      {collectionStatus.label}
                    </span>
                    <p className="text-xs text-gray-600">Cobrado: {formatPrice(totalPaid, settings)}</p>
                    <p className="text-xs text-gray-600">Pendiente: {formatPrice(pendingAmount, settings)}</p>
                  </div>
                </div>
              </div>

              {canManage && !isEditing && order.status !== 'cancelled' && pendingAmount > 0 && (
                <div className="pt-2">
                  <Button onClick={handleOpenCollectModal} size="sm" variant="secondary">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Registrar cobro
                  </Button>
                </div>
              )}

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

              {canManage && (
                <div>
                  {order.status === 'pending_allocation' && (
                    <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
                      <p className="text-sm font-medium text-orange-900 mb-2">Asignar sucursal para reservar stock</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={selectedBranchId}
                          onChange={(e) => setSelectedBranchId(e.target.value)}
                          className="min-w-[240px] px-3 py-2 border border-orange-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          disabled={savingBranch}
                        >
                          <option value="">Seleccionar sucursal...</option>
                          {assignableBranches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                              {branch.code ? ` (${branch.code})` : ''}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          onClick={handleBranchAssignmentSave}
                          disabled={savingBranch || !selectedBranchId || selectedBranchId === (order.branch_id ?? '')}
                        >
                          {savingBranch ? 'Guardando...' : 'Guardar sucursal'}
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-orange-800">
                        Al pasar de "Pendiente de asignación" a un estado operativo, se descontará stock de esta sucursal.
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-gray-600 mb-2">Actualizar Estado</p>
                  <select
                    value={order.status ?? ''}
                    onChange={(e) => handleStatusUpdate(e.target.value as Order['status'])}
                    disabled={updating}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-admin-500 text-sm"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!isEditing && orderPayments.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Cobros registrados</p>
                  <div className="space-y-1">
                    {orderPayments.map((payment) => {
                      const mpStatusLabel: Record<string, { label: string; color: string }> = {
                        approved:     { label: 'Aprobado',    color: 'bg-green-100 text-green-700' },
                        pending:      { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700' },
                        in_process:   { label: 'En proceso',  color: 'bg-blue-100 text-blue-700' },
                        rejected:     { label: 'Rechazado',   color: 'bg-red-100 text-red-700' },
                        cancelled:    { label: 'Cancelado',   color: 'bg-gray-100 text-gray-600' },
                        refunded:     { label: 'Reembolsado', color: 'bg-purple-100 text-purple-700' },
                        charged_back: { label: 'Contracargo', color: 'bg-orange-100 text-orange-700' },
                      }
                      const mpInfo = payment.mp_status ? mpStatusLabel[payment.mp_status] : null
                      return (
                        <div key={payment.id} className="rounded border px-2 py-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">
                              {paymentMethods.find((m) => m.key === (payment.payment_method ?? ''))?.name ?? payment.payment_method ?? 'Sin método'}
                              {' · '}
                              {formatDateTime(payment.created_at, settings)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{formatPrice(payment.amount, settings)}</span>
                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setPaymentToDelete(payment)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {payment.mp_payment_id && (
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500">ID MP: {payment.mp_payment_id}</span>
                              {mpInfo && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${mpInfo.color}`}>
                                  {mpInfo.label}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
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
                            {Number(item.discount_amount ?? 0) > 0 && (
                              <p className="text-xs text-red-700">
                                Descuento aplicado: {formatPrice(Number(item.discount_amount), settings)}
                              </p>
                            )}
                            {getReturnedQuantity(item) > 0 && (
                              <p className="text-xs text-amber-700">
                                Devuelto: {getReturnedQuantity(item)} / {item.quantity}
                              </p>
                            )}
                            {canManage && order.status !== 'cancelled' && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openPartialReturnModal(item)}
                                  disabled={Boolean(returningItemId) || getReturnedQuantity(item) >= item.quantity}
                                >
                                  <Package className="h-4 w-4 mr-2" />
                                  {returningItemId === item.id ? 'Procesando...' : 'Registrar devolución parcial'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openItemDiscountModal(item)}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Aplicar descuento item
                                </Button>
                                {Number(item.discount_amount ?? 0) > 0 && (
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleRemoveItemDiscount(item)}
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Quitar descuento item
                                  </Button>
                                )}
                              </div>
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
                {orderManualItems.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Líneas manuales</p>
                    {orderManualItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{item.description}</p>
                          <p className="text-xs text-gray-500">
                            {item.quantity} × {formatPrice(item.price, settings)}
                          </p>
                        </div>
                        <p className="font-semibold text-gray-900 shrink-0">
                          {formatPrice(item.price * item.quantity, settings)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t mt-4 pt-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-gray-700">
                    <span>Subtotal</span>
                    <span>{formatPrice(Number(order.subtotal_before_discount ?? displayTotal), settings)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-700">
                    <span>Descuento</span>
                    <span>-{formatPrice(Number(order.discount_total ?? 0), settings)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700">
                    <span>Impuestos</span>
                    <span>{formatPrice(Number(order.tax_total ?? 0), settings)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                    <span>Total</span>
                    <span>{formatPrice(displayTotal, settings)}</span>
                  </div>
                </div>
                {canManage && !isEditing && order.status !== 'cancelled' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={openOrderDiscountModal}>
                      <Plus className="h-4 w-4 mr-2" />
                      Aplicar descuento orden
                    </Button>
                    {hasDiscount && (
                      <Button variant="danger" size="sm" onClick={handleRemoveOrderDiscount}>
                        <X className="h-4 w-4 mr-2" />
                        Quitar descuento orden
                      </Button>
                    )}
                  </div>
                )}
                {order.discount_metadata && (
                  <p className="mt-2 text-xs text-gray-500">
                    Descuento activo:{' '}
                    {String((order.discount_metadata as Record<string, unknown>)?.source ?? 'manual')} ·{' '}
                    {String((order.discount_metadata as Record<string, unknown>)?.kind ?? '')}
                  </p>
                )}
                {!isEditing && (
                  <>
                    <p className="mt-1 text-xs text-gray-500">
                      Total cobrado: {formatPrice(totalPaid, settings)} · Saldo pendiente:{' '}
                      {formatPrice(pendingAmount, settings)}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        order.status === 'cancelled'
                          ? 'text-gray-500'
                          : pendingAmount < 0.01
                          ? 'text-green-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {discountStatusMessage}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* CFE Biller card */}
          {billerComprobante && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <Receipt className="h-5 w-5" />
                    <span>Comprobante Fiscal Electrónico</span>
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    billerComprobante.estado === 'emitido'
                      ? 'bg-teal-100 text-teal-700'
                      : billerComprobante.estado === 'anulado'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {billerComprobante.estado === 'emitido' ? 'Emitido' : billerComprobante.estado === 'anulado' ? 'Anulado' : billerComprobante.estado}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Tipo</p>
                    <p className="font-medium">{billerComprobante.tipo_comprobante === 101 ? 'e-Ticket' : billerComprobante.tipo_comprobante === 111 ? 'e-Factura' : `Tipo ${billerComprobante.tipo_comprobante}`}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Número</p>
                    <p className="font-medium font-mono">{billerComprobante.serie ?? ''}{billerComprobante.numero ? ` ${billerComprobante.numero}` : '—'}</p>
                  </div>
                </div>
                {billerComprobante.estado === 'emitido' && billerConfig && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleDownloadCFEPDF}
                      disabled={downloadingPDF}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {downloadingPDF ? 'Descargando...' : 'Descargar PDF'}
                    </Button>
                    {canManage && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setIsAnnulCFEConfirmOpen(true)}
                        disabled={annullingCFE}
                      >
                        <X className="h-4 w-4 mr-2" />
                        {annullingCFE ? 'Anulando...' : 'Anular CFE'}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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

      {canManage && isCollectModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Registrar cobro</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsCollectModalOpen(false)} disabled={collecting}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <p>Saldo pendiente: <span className="font-semibold">{formatPrice(pendingAmount, settings)}</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a cobrar *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={collecting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de cobro *</label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 bg-white"
                  disabled={collecting}
                >
                  <option value="">Seleccionar método</option>
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.key}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <Input
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="Ej: Cobro parcial cuota 1"
                  disabled={collecting}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsCollectModalOpen(false)} disabled={collecting}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleRegisterCollection} disabled={collecting}>
                  {collecting ? 'Registrando...' : 'Registrar cobro'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(paymentToDelete)}
        title="Eliminar cobro"
        message="Esta acción eliminará el cobro de la orden y ajustará la caja asociada si corresponde. ¿Deseas continuar?"
        confirmLabel={collecting ? 'Eliminando...' : 'Eliminar cobro'}
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeletePayment}
        onCancel={() => {
          if (!collecting) setPaymentToDelete(null)
        }}
      />

      <ConfirmDialog
        open={isAnnulCFEConfirmOpen}
        title="Anular comprobante fiscal"
        message="¿Anular el comprobante fiscal electrónico? Esta acción no se puede deshacer."
        confirmLabel={annullingCFE ? 'Anulando...' : 'Anular CFE'}
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleAnnulCFE}
        onCancel={() => { if (!annullingCFE) setIsAnnulCFEConfirmOpen(false) }}
      />

      {canManage && isCancelModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Anular orden</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsCancelModalOpen(false)} disabled={updating}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                Esta acción restaurará el stock y registrará una devolución total. No se puede deshacer.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de anulación *</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Indicá el motivo por el que se anula la venta..."
                  rows={3}
                  disabled={updating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsCancelModalOpen(false)} disabled={updating}>
                  Cancelar
                </Button>
                <Button variant="danger" className="flex-1" onClick={handleConfirmCancel} disabled={updating || !cancelReason.trim()}>
                  {updating ? 'Anulando...' : 'Confirmar anulación'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {canManage && isPartialReturnModalOpen && partialReturnItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Registrar devolución parcial</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsPartialReturnModalOpen(false)} disabled={Boolean(returningItemId)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-medium">{capitalizeFirst(partialReturnItem.product.name)}</p>
                <p className="text-gray-500">Cantidad original: {partialReturnItem.quantity} · Devuelto: {getReturnedQuantity(partialReturnItem)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad a devolver (máximo {partialReturnItem.quantity - getReturnedQuantity(partialReturnItem)}) *
                </label>
                <Input
                  type="number"
                  min="1"
                  max={partialReturnItem.quantity - getReturnedQuantity(partialReturnItem)}
                  value={partialReturnQuantity}
                  onChange={(e) => setPartialReturnQuantity(e.target.value)}
                  disabled={Boolean(returningItemId)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de la devolución *</label>
                <textarea
                  value={partialReturnReason}
                  onChange={(e) => setPartialReturnReason(e.target.value)}
                  placeholder="Indicá el motivo de la devolución..."
                  rows={3}
                  disabled={Boolean(returningItemId)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsPartialReturnModalOpen(false)} disabled={Boolean(returningItemId)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleConfirmPartialReturn} disabled={Boolean(returningItemId) || !partialReturnReason.trim()}>
                  {returningItemId ? 'Procesando...' : 'Confirmar devolución'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isDiscountModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  {discountTarget === 'order' ? 'Aplicar descuento a la orden' : `Descuento en ítem`}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsDiscountModalOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {discountTarget === 'item' && discountTargetItem && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  <p className="font-medium">{capitalizeFirst(discountTargetItem.product.name)}</p>
                </div>
              )}

              {(discountTarget === 'order' ? orderDiscountRules : itemDiscountRules).length > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={!isManualDiscount ? 'primary' : 'outline'}
                    onClick={() => setIsManualDiscount(false)}
                    className="flex-1"
                  >
                    Regla existente
                  </Button>
                  <Button
                    size="sm"
                    variant={isManualDiscount ? 'primary' : 'outline'}
                    onClick={() => setIsManualDiscount(true)}
                    className="flex-1"
                  >
                    Manual
                  </Button>
                </div>
              )}

              {!isManualDiscount && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Regla de descuento *</label>
                  <select
                    value={discountRuleId}
                    onChange={(e) => setDiscountRuleId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                  >
                    <option value="">Seleccionar regla...</option>
                    {(discountTarget === 'order' ? orderDiscountRules : itemDiscountRules).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.kind === 'percentage' ? `${r.value}%` : r.kind === 'fixed_amount' ? formatPrice(r.value, settings) : `Precio fijo ${formatPrice(r.value, settings)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isManualDiscount && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de descuento *</label>
                    <select
                      value={discountKind}
                      onChange={(e) => setDiscountKind(e.target.value as DiscountKind)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                    >
                      <option value="percentage">Porcentaje (%)</option>
                      <option value="fixed_amount">Monto fijo</option>
                      <option value="price_override">Precio nuevo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor {discountKind === 'percentage' ? '(%)' : '($)'} *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountKind === 'percentage' ? 'Ej: 10' : 'Ej: 50.00'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                    <Input
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Ej: Descuento por fidelidad"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsDiscountModalOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleConfirmDiscount}>
                  Aplicar descuento
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
