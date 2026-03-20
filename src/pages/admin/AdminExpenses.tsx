import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { trackAuditAction } from '@/lib/audit'
import { supabase } from '@/lib/supabase'
import { formatDateShort, formatPrice } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type SupplierLite = { id: string; name: string }
type BranchLite = { id: string; name: string }
type ProductLite = { id: string; name: string }
type VariantLite = { id: string; name: string | null; sku: string }

type PurchaseOrderLite = {
  id: string
  po_number: number | null
  supplier_id: string
  branch_id: string
  status: string
  notes: string | null
  total: number
  created_at: string
}

type PurchaseOrderItemLite = {
  id: string
  line_number: number
  product_id: string
  variant_id: string | null
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  tax_amount: number
  discount_amount: number
  description: string | null
}

type SupplierInvoiceLite = {
  id: string
  invoice_number: string
  supplier_id: string
  purchase_order_id: string | null
  status: string
  total_amount: number
  outstanding_amount: number
}

type ExpenseLedgerEntry = {
  id: string
  entry_kind: 'accrual' | 'cash'
  event_type: string
  occurred_at: string
  net_amount: number
  supplier_id: string | null
  source_table: string
}

type ExpenseView = 'purchase_orders' | 'supplier_invoices' | 'expense_ledger' | 'direct_expenses'
type ExpenseLedgerFilters = {
  dateFrom: string
  dateTo: string
  supplierId: string
  entryKind: '' | 'accrual' | 'cash'
  eventType: '' | 'invoice' | 'payment' | 'payment_reversal' | 'manual_adjustment' | 'direct_expense'
}

type DirectExpense = {
  id: string
  occurred_at: string
  category: string
  description: string | null
  amount: number
  payment_method: string
  branch_id: string | null
  notes: string | null
  created_at: string
}

const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'combustible', label: 'Combustible / Nafta' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'alimentacion', label: 'Alimentación' },
  { value: 'papeleria', label: 'Papelería / Oficina' },
  { value: 'servicios', label: 'Servicios (luz, agua, internet)' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'marketing', label: 'Marketing / Publicidad' },
  { value: 'varios', label: 'Varios / Otros' },
]

const EXPENSE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
)

const PAGE_SIZE = 20

function formatPurchaseOrderStatus(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    submitted: 'Enviada',
    partially_received: 'Recepcion parcial',
    received: 'Recibida',
    cancelled: 'Cancelada',
  }
  return labels[status] || status
}

function formatInvoiceStatus(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    issued: 'Emitida',
    partially_paid: 'Pago parcial',
    paid: 'Pagada',
    cancelled: 'Cancelada',
  }
  return labels[status] || status
}

function formatLedgerEventType(eventType: string): string {
  const labels: Record<string, string> = {
    invoice: 'Factura',
    payment: 'Pago',
    payment_reversal: 'Reversion de pago',
    manual_adjustment: 'Ajuste manual',
    direct_expense: 'Gasto directo',
  }
  return labels[eventType] || eventType
}

function formatLedgerEntryKind(entryKind: 'accrual' | 'cash'): string {
  return entryKind === 'accrual' ? 'Devengado' : 'Caja'
}

function formatLedgerSource(sourceTable: string): string {
  const labels: Record<string, string> = {
    supplier_invoices: 'Facturas de proveedor',
    supplier_payments: 'Pagos a proveedor',
    manual_adjustments: 'Ajustes manuales',
    direct_expenses: 'Gastos directos',
  }
  return labels[sourceTable] || sourceTable
}

function getStatusBadgeClass(status: string): string {
  if (status === 'received' || status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (status === 'partially_received' || status === 'partially_paid') return 'bg-amber-50 text-amber-700 ring-amber-200'
  if (status === 'submitted' || status === 'issued') return 'bg-blue-50 text-blue-700 ring-blue-200'
  if (status === 'cancelled') return 'bg-red-50 text-red-700 ring-red-200'
  return 'bg-gray-100 text-gray-700 ring-gray-200'
}

function getStatusDotClass(status: string): string {
  if (status === 'received' || status === 'paid') return 'bg-emerald-600'
  if (status === 'partially_received' || status === 'partially_paid') return 'bg-amber-500'
  if (status === 'submitted' || status === 'issued') return 'bg-blue-600'
  if (status === 'cancelled') return 'bg-red-600'
  return 'bg-gray-500'
}

export function AdminExpenses() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { show } = useToastStore()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [suppliers, setSuppliers] = useState<SupplierLite[]>([])
  const [branches, setBranches] = useState<BranchLite[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])
  const [variantsByProduct, setVariantsByProduct] = useState<Map<string, VariantLite[]>>(new Map())
  const [loadingVariants, setLoadingVariants] = useState(false)

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderLite[]>([])
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string>('')
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<PurchaseOrderItemLite[]>([])

  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoiceLite[]>([])
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<SupplierInvoiceLite | null>(null)
  const [activeView, setActiveView] = useState<ExpenseView>('purchase_orders')

  const [directExpenses, setDirectExpenses] = useState<DirectExpense[]>([])
  const [directExpenseForm, setDirectExpenseForm] = useState({
    occurred_at: new Date().toISOString().slice(0, 10),
    category: 'varios',
    description: '',
    amount: '',
    payment_method: 'cash',
    branch_id: '',
    notes: '',
  })
  const [loadingDirectExpenses, setLoadingDirectExpenses] = useState(false)
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false)
  const [editOrderModalOpen, setEditOrderModalOpen] = useState(false)
  const [ledgerDetailEntry, setLedgerDetailEntry] = useState<ExpenseLedgerEntry | null>(null)
  const [expenseLedgerEntries, setExpenseLedgerEntries] = useState<ExpenseLedgerEntry[]>([])
  const [expenseLedgerPage, setExpenseLedgerPage] = useState(1)
  const [expenseLedgerTotalCount, setExpenseLedgerTotalCount] = useState(0)
  const [ledgerDraftFilters, setLedgerDraftFilters] = useState<ExpenseLedgerFilters>({
    dateFrom: '',
    dateTo: '',
    supplierId: '',
    entryKind: '',
    eventType: '',
  })
  const [ledgerAppliedFilters, setLedgerAppliedFilters] = useState<ExpenseLedgerFilters>({
    dateFrom: '',
    dateTo: '',
    supplierId: '',
    entryKind: '',
    eventType: '',
  })

  const [searchOrder, setSearchOrder] = useState('')

  const [createOrderForm, setCreateOrderForm] = useState({
    supplier_id: '',
    branch_id: '',
    status: 'submitted',
    notes: '',
  })

  const [editOrderForm, setEditOrderForm] = useState({
    supplier_id: '',
    branch_id: '',
    status: 'submitted',
    notes: '',
  })

  const [newOrderItemForm, setNewOrderItemForm] = useState({
    product_id: '',
    variant_id: '',
    quantity_ordered: '1',
    unit_cost: '0',
    tax_amount: '0',
    discount_amount: '0',
    description: '',
  })

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemForm, setEditItemForm] = useState({
    product_id: '',
    variant_id: '',
    quantity_ordered: '1',
    unit_cost: '0',
    tax_amount: '0',
    discount_amount: '0',
    description: '',
  })

  const [invoiceFromOrderForm, setInvoiceFromOrderForm] = useState({
    invoice_number: '',
    due_date: '',
    issue_immediately: true,
  })

  const [paymentForm, setPaymentForm] = useState({
    supplier_invoice_id: '',
    payment_method: 'transfer',
    amount: '0',
    reference_number: '',
    notes: '',
  })

  const fromAny = (table: string) => (supabase.from as any)(table)

  const loadVariantsForProduct = async (productId: string) => {
    if (!productId || variantsByProduct.has(productId)) return
    setLoadingVariants(true)
    try {
      const { data, error } = await fromAny('product_variants')
        .select('id, name, sku')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('name')
      if (!error && data) {
        setVariantsByProduct((prev) => new Map(prev).set(productId, data as VariantLite[]))
      }
    } finally {
      setLoadingVariants(false)
    }
  }

  const handleNewItemProductChange = (productId: string) => {
    setNewOrderItemForm((prev) => ({ ...prev, product_id: productId, variant_id: '' }))
    if (productId) loadVariantsForProduct(productId)
  }

  const supplierNameById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers])
  const branchNameById = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches])
  const productNameById = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products])

  const selectedPurchaseOrder = useMemo(
    () => purchaseOrders.find((purchaseOrder) => purchaseOrder.id === selectedPurchaseOrderId) || null,
    [purchaseOrders, selectedPurchaseOrderId]
  )

  const filteredPurchaseOrders = useMemo(() => {
    if (!searchOrder.trim()) return purchaseOrders
    const query = searchOrder.trim().toLowerCase()
    return purchaseOrders.filter((purchaseOrder) => {
      const supplierName = supplierNameById.get(purchaseOrder.supplier_id)?.toLowerCase() || ''
      const branchName = branchNameById.get(purchaseOrder.branch_id)?.toLowerCase() || ''
      const orderNumber = String(purchaseOrder.po_number ?? '')
      return supplierName.includes(query) || branchName.includes(query) || orderNumber.includes(query)
    })
  }, [purchaseOrders, searchOrder, supplierNameById, branchNameById])

  const totalExpenseLedgerPages = Math.max(1, Math.ceil(expenseLedgerTotalCount / PAGE_SIZE))

  useEffect(() => {
    if (organizationId) {
      fetchPageData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  useEffect(() => {
    if (organizationId) {
      fetchExpenseLedger()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, expenseLedgerPage, ledgerAppliedFilters])

  useEffect(() => {
    if (!selectedPurchaseOrder) return
    setEditOrderForm({
      supplier_id: selectedPurchaseOrder.supplier_id,
      branch_id: selectedPurchaseOrder.branch_id,
      status: selectedPurchaseOrder.status,
      notes: selectedPurchaseOrder.notes || '',
    })
    setInvoiceFromOrderForm((previous) => ({
      ...previous,
      invoice_number: previous.invoice_number || `FAC-${selectedPurchaseOrder.po_number ?? selectedPurchaseOrder.id.slice(0, 6)}`,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPurchaseOrderId])

  useEffect(() => {
    if (selectedPurchaseOrderId) {
      fetchPurchaseOrderItems(selectedPurchaseOrderId)
    } else {
      setPurchaseOrderItems([])
    }
  }, [selectedPurchaseOrderId])

  useEffect(() => {
    if (organizationId && activeView === 'direct_expenses') {
      fetchDirectExpenses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, activeView])

  const fetchPageData = async (options?: { silent?: boolean }) => {
    if (!organizationId) return
    const silent = options?.silent ?? false
    if (!silent) setLoading(true)
    try {
      const [suppliersResult, branchesResult, productsResult, purchaseOrdersResult, supplierInvoicesResult] = await Promise.all([
        fromAny('suppliers').select('id, name').eq('organization_id', organizationId).order('name'),
        fromAny('branches').select('id, name').eq('organization_id', organizationId).eq('is_active', true).order('name'),
        fromAny('products').select('id, name').eq('organization_id', organizationId).eq('is_active', true).order('name'),
        fromAny('purchase_orders')
          .select('id, po_number, supplier_id, branch_id, status, notes, total, created_at')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(100),
        fromAny('supplier_invoices')
          .select('id, invoice_number, supplier_id, purchase_order_id, status, total_amount, outstanding_amount')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      if (suppliersResult.error) throw suppliersResult.error
      if (branchesResult.error) throw branchesResult.error
      if (productsResult.error) throw productsResult.error
      if (purchaseOrdersResult.error) throw purchaseOrdersResult.error
      if (supplierInvoicesResult.error) throw supplierInvoicesResult.error

      const purchaseOrdersData = (purchaseOrdersResult.data || []) as PurchaseOrderLite[]
      setSuppliers(suppliersResult.data || [])
      setBranches(branchesResult.data || [])
      setProducts(productsResult.data || [])
      setPurchaseOrders(purchaseOrdersData)
      setSupplierInvoices((supplierInvoicesResult.data || []) as SupplierInvoiceLite[])

      if (!selectedPurchaseOrderId && purchaseOrdersData.length > 0) {
        setSelectedPurchaseOrderId(purchaseOrdersData[0].id)
      }
    } catch (error) {
      console.error('Error loading purchases and expenses page:', error)
      show('No se pudieron cargar los datos de compras y egresos.', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const fetchExpenseLedger = async () => {
    if (!organizationId) return
    try {
      const from = (expenseLedgerPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      let query = fromAny('expense_ledger')
        .select('id, entry_kind, event_type, occurred_at, net_amount, supplier_id, source_table', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('occurred_at', { ascending: false })
        .range(from, to)

      if (ledgerAppliedFilters.dateFrom) {
        query = query.gte('occurred_at', `${ledgerAppliedFilters.dateFrom}T00:00:00`)
      }
      if (ledgerAppliedFilters.dateTo) {
        query = query.lte('occurred_at', `${ledgerAppliedFilters.dateTo}T23:59:59`)
      }
      if (ledgerAppliedFilters.supplierId) {
        query = query.eq('supplier_id', ledgerAppliedFilters.supplierId)
      }
      if (ledgerAppliedFilters.entryKind) {
        query = query.eq('entry_kind', ledgerAppliedFilters.entryKind)
      }
      if (ledgerAppliedFilters.eventType) {
        query = query.eq('event_type', ledgerAppliedFilters.eventType)
      }

      const { data, error, count } = await query

      if (error) throw error
      setExpenseLedgerEntries((data || []) as ExpenseLedgerEntry[])
      setExpenseLedgerTotalCount(count || 0)
    } catch (error) {
      console.error('Error loading expense ledger:', error)
      show('No se pudo cargar el libro de egresos.', 'error')
    }
  }

  const fetchPurchaseOrderItems = async (purchaseOrderId: string) => {
    try {
      const { data, error } = await fromAny('purchase_order_items')
        .select('id, line_number, product_id, variant_id, quantity_ordered, quantity_received, unit_cost, tax_amount, discount_amount, description')
        .eq('purchase_order_id', purchaseOrderId)
        .order('line_number', { ascending: true })

      if (error) throw error
      const items = (data || []) as PurchaseOrderItemLite[]
      setPurchaseOrderItems(items)
      // Pre-cargar variantes de los productos que aparecen en los items
      const uniqueProductIds = [...new Set(items.map((i) => i.product_id))]
      uniqueProductIds.forEach((pid) => loadVariantsForProduct(pid))
    } catch (error) {
      console.error('Error loading purchase order items:', error)
      show('No se pudieron cargar los productos de la orden de compra.', 'error')
    }
  }

  const createPurchaseOrder = async () => {
    if (!organizationId) return
    if (!createOrderForm.supplier_id || !createOrderForm.branch_id) {
      show('Selecciona proveedor y sucursal para crear la orden de compra.', 'error')
      return
    }

    try {
      setSaving(true)
      const { data: authData } = await supabase.auth.getUser()
      const { data, error } = await fromAny('purchase_orders')
        .insert({
          organization_id: organizationId,
          supplier_id: createOrderForm.supplier_id,
          branch_id: createOrderForm.branch_id,
          status: createOrderForm.status,
          notes: createOrderForm.notes || null,
          created_by: authData.user?.id || null,
        })
        .select('id')
        .single()

      if (error) throw error

      await trackAuditAction({
        organizationId,
        tableName: 'purchase_orders',
        recordId: data.id,
        action: 'INSERT',
        notes: 'Orden de compra creada desde Compras y Egresos.',
        newData: {
          supplier_id: createOrderForm.supplier_id,
          branch_id: createOrderForm.branch_id,
          status: createOrderForm.status,
          notes: createOrderForm.notes || null,
        },
      })

      setCreateOrderForm({ supplier_id: '', branch_id: '', status: 'submitted', notes: '' })
      setCreateOrderModalOpen(false)
      await fetchPageData({ silent: true })
      if (data?.id) {
        setSelectedPurchaseOrderId(data.id)
        setEditOrderModalOpen(true)
      }
      show('Orden de compra creada correctamente.', 'success')
    } catch (error) {
      console.error('Error creating purchase order:', error)
      show('No se pudo crear la orden de compra.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateSelectedPurchaseOrder = async () => {
    if (!selectedPurchaseOrder) return
    if (!editOrderForm.supplier_id || !editOrderForm.branch_id) {
      show('Proveedor y sucursal son obligatorios.', 'error')
      return
    }

    try {
      setSaving(true)
      const { error } = await fromAny('purchase_orders')
        .update({
          supplier_id: editOrderForm.supplier_id,
          branch_id: editOrderForm.branch_id,
          status: editOrderForm.status,
          notes: editOrderForm.notes || null,
        })
        .eq('id', selectedPurchaseOrder.id)

      if (error) throw error
      await trackAuditAction({
        organizationId,
        tableName: 'purchase_orders',
        recordId: selectedPurchaseOrder.id,
        action: 'UPDATE',
        notes: 'Orden de compra actualizada desde Compras y Egresos.',
        oldData: {
          supplier_id: selectedPurchaseOrder.supplier_id,
          branch_id: selectedPurchaseOrder.branch_id,
          status: selectedPurchaseOrder.status,
          notes: selectedPurchaseOrder.notes,
        },
        newData: {
          supplier_id: editOrderForm.supplier_id,
          branch_id: editOrderForm.branch_id,
          status: editOrderForm.status,
          notes: editOrderForm.notes || null,
        },
      })
      await fetchPageData({ silent: true })
      show('Orden de compra actualizada correctamente.', 'success')
    } catch (error) {
      console.error('Error updating purchase order:', error)
      show('No se pudo actualizar la orden de compra.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addItemToSelectedPurchaseOrder = async () => {
    if (!organizationId || !selectedPurchaseOrder) return
    if (!newOrderItemForm.product_id) {
      show('Selecciona un producto.', 'error')
      return
    }

    const quantityOrdered = Number(newOrderItemForm.quantity_ordered)
    const unitCost = Number(newOrderItemForm.unit_cost)
    const taxAmount = Number(newOrderItemForm.tax_amount)
    const discountAmount = Number(newOrderItemForm.discount_amount)

    if (!Number.isFinite(quantityOrdered) || quantityOrdered <= 0) {
      show('La cantidad debe ser mayor que cero.', 'error')
      return
    }
    if (
      !Number.isFinite(unitCost) ||
      unitCost < 0 ||
      !Number.isFinite(taxAmount) ||
      taxAmount < 0 ||
      !Number.isFinite(discountAmount) ||
      discountAmount < 0
    ) {
      show('Los montos de costo, impuestos y descuentos deben ser validos.', 'error')
      return
    }

    try {
      setSaving(true)
      const lineNumber = purchaseOrderItems.length + 1
      const { data, error } = await fromAny('purchase_order_items')
        .insert({
        organization_id: organizationId,
        purchase_order_id: selectedPurchaseOrder.id,
        line_number: lineNumber,
        product_id: newOrderItemForm.product_id,
        variant_id: newOrderItemForm.variant_id || null,
        quantity_ordered: quantityOrdered,
        unit_cost: unitCost,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        description: newOrderItemForm.description || null,
      })
        .select('id')
        .single()

      if (error) throw error
      if (data?.id) {
        await trackAuditAction({
          organizationId,
          tableName: 'purchase_order_items',
          recordId: data.id,
          action: 'INSERT',
          notes: 'Producto agregado a una orden de compra.',
          newData: {
            purchase_order_id: selectedPurchaseOrder.id,
            product_id: newOrderItemForm.product_id,
            quantity_ordered: quantityOrdered,
            unit_cost: unitCost,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            description: newOrderItemForm.description || null,
          },
        })
      }

      setNewOrderItemForm({
        product_id: '',
        variant_id: '',
        quantity_ordered: '1',
        unit_cost: '0',
        tax_amount: '0',
        discount_amount: '0',
        description: '',
      })

      await fetchPageData({ silent: true })
      await fetchPurchaseOrderItems(selectedPurchaseOrder.id)
      show('Producto agregado a la orden de compra.', 'success')
    } catch (error) {
      console.error('Error adding item to purchase order:', error)
      show('No se pudo agregar el producto a la orden de compra.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeItemFromSelectedPurchaseOrder = async (purchaseOrderItemId: string) => {
    if (!selectedPurchaseOrder) return
    if (!confirm('¿Eliminar este producto de la orden de compra?')) return
    const existingItem = purchaseOrderItems.find((item) => item.id === purchaseOrderItemId)

    try {
      setSaving(true)
      const { error } = await fromAny('purchase_order_items').delete().eq('id', purchaseOrderItemId)
      if (error) throw error
      await trackAuditAction({
        organizationId,
        tableName: 'purchase_order_items',
        recordId: purchaseOrderItemId,
        action: 'DELETE',
        notes: 'Producto eliminado de una orden de compra.',
        oldData: existingItem || null,
      })
      await fetchPageData({ silent: true })
      await fetchPurchaseOrderItems(selectedPurchaseOrder.id)
      show('Producto eliminado de la orden de compra.', 'success')
    } catch (error) {
      console.error('Error removing purchase order item:', error)
      show('No se pudo eliminar el producto de la orden de compra.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const startEditingItem = (item: PurchaseOrderItemLite) => {
    if (!selectedPurchaseOrder) return

    const status = selectedPurchaseOrder.status

    if (status === 'received' || status === 'cancelled') {
      show(
        status === 'cancelled'
          ? 'No se pueden editar ítems de una orden cancelada.'
          : 'No se pueden editar ítems de una orden ya recibida. El inventario ya fue actualizado.',
        'error'
      )
      return
    }

    if (status === 'partially_received' && item.quantity_received > 0) {
      show(
        `Este ítem ya tiene ${item.quantity_received} unidades recibidas. Podés editar solo el costo y la descripción — el producto, variante y cantidad están bloqueados por movimientos de inventario existentes.`,
        'error'
      )
      return
    }

    setEditingItemId(item.id)
    setEditItemForm({
      product_id: item.product_id,
      variant_id: item.variant_id ?? '',
      quantity_ordered: String(item.quantity_ordered),
      unit_cost: String(item.unit_cost),
      tax_amount: String(item.tax_amount),
      discount_amount: String(item.discount_amount),
      description: item.description ?? '',
    })
    loadVariantsForProduct(item.product_id)
  }

  const cancelEditingItem = () => setEditingItemId(null)

  const saveEditingItem = async () => {
    if (!selectedPurchaseOrder || !editingItemId) return

    const quantityOrdered = Number(editItemForm.quantity_ordered)
    const unitCost = Number(editItemForm.unit_cost)
    const taxAmount = Number(editItemForm.tax_amount)
    const discountAmount = Number(editItemForm.discount_amount)

    if (!editItemForm.product_id) {
      show('Selecciona un producto.', 'error')
      return
    }
    if (!Number.isFinite(quantityOrdered) || quantityOrdered <= 0) {
      show('La cantidad debe ser mayor que cero.', 'error')
      return
    }
    if (
      !Number.isFinite(unitCost) || unitCost < 0 ||
      !Number.isFinite(taxAmount) || taxAmount < 0 ||
      !Number.isFinite(discountAmount) || discountAmount < 0
    ) {
      show('Los montos deben ser valores válidos.', 'error')
      return
    }

    const existingItem = purchaseOrderItems.find((i) => i.id === editingItemId)

    try {
      setSaving(true)
      const { error } = await fromAny('purchase_order_items')
        .update({
          product_id: editItemForm.product_id,
          variant_id: editItemForm.variant_id || null,
          quantity_ordered: quantityOrdered,
          unit_cost: unitCost,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          description: editItemForm.description || null,
        })
        .eq('id', editingItemId)

      if (error) throw error

      await trackAuditAction({
        organizationId,
        tableName: 'purchase_order_items',
        recordId: editingItemId,
        action: 'UPDATE',
        notes: 'Ítem de orden de compra editado manualmente.',
        oldData: existingItem ?? null,
        newData: {
          product_id: editItemForm.product_id,
          variant_id: editItemForm.variant_id || null,
          quantity_ordered: quantityOrdered,
          unit_cost: unitCost,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          description: editItemForm.description || null,
        },
      })

      setEditingItemId(null)
      await fetchPageData({ silent: true })
      await fetchPurchaseOrderItems(selectedPurchaseOrder.id)
      show('Ítem actualizado correctamente.', 'success')
    } catch (error) {
      console.error('Error updating purchase order item:', error)
      show('No se pudo actualizar el ítem.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const createAndPostReceiptFromSelectedPurchaseOrder = async () => {
    if (!organizationId || !selectedPurchaseOrder) return

    try {
      setSaving(true)
      const { data: authData } = await supabase.auth.getUser()

      const pendingItems = purchaseOrderItems.filter((item) => item.quantity_ordered > item.quantity_received)
      if (pendingItems.length === 0) {
        show('Esta orden de compra no tiene cantidades pendientes para recibir.', 'info')
        return
      }

      const { data: receiptData, error: receiptError } = await fromAny('goods_receipts')
        .insert({
          organization_id: organizationId,
          purchase_order_id: selectedPurchaseOrder.id,
          supplier_id: selectedPurchaseOrder.supplier_id,
          branch_id: selectedPurchaseOrder.branch_id,
          notes: `Recepcion generada desde orden de compra #${selectedPurchaseOrder.po_number ?? '-'}`,
          created_by: authData.user?.id || null,
        })
        .select('id')
        .single()

      if (receiptError) throw receiptError
      if (!receiptData?.id) throw new Error('No se pudo obtener la recepcion creada')

      const receiptItemsPayload = pendingItems.map((item) => ({
        organization_id: organizationId,
        goods_receipt_id: receiptData.id,
        purchase_order_item_id: item.id,
        product_id: item.product_id,
        quantity_received: item.quantity_ordered - item.quantity_received,
        unit_cost: item.unit_cost,
        tax_amount: 0,
        discount_amount: 0,
      }))

      const { error: itemsError } = await fromAny('goods_receipt_items').insert(receiptItemsPayload)
      if (itemsError) throw itemsError

      const { error: postError } = await (supabase.rpc as any)('post_goods_receipt', {
        p_goods_receipt_id: receiptData.id,
      })
      if (postError) throw postError

      await trackAuditAction({
        organizationId,
        tableName: 'goods_receipts',
        recordId: receiptData.id,
        action: 'UPDATE',
        notes: 'Recepción creada y confirmada desde orden de compra.',
        newData: {
          purchase_order_id: selectedPurchaseOrder.id,
          pending_items_received: pendingItems.length,
          status: 'posted',
        },
      })

      await fetchPageData({ silent: true })
      await fetchPurchaseOrderItems(selectedPurchaseOrder.id)
      await fetchExpenseLedger()
      show('Recepcion creada y confirmada correctamente.', 'success')
    } catch (error) {
      console.error('Error creating receipt from purchase order:', error)
      show('No se pudo crear la recepcion desde la orden de compra.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const createInvoiceFromSelectedPurchaseOrder = async () => {
    if (!organizationId || !selectedPurchaseOrder) return
    if (!invoiceFromOrderForm.invoice_number.trim()) {
      show('Ingresa un numero de factura para crearla.', 'error')
      return
    }

    try {
      setSaving(true)
      const { data: authData } = await supabase.auth.getUser()
      const totalAmount = Number(selectedPurchaseOrder.total || 0)

      const { data, error } = await fromAny('supplier_invoices')
        .insert({
          organization_id: organizationId,
          supplier_id: selectedPurchaseOrder.supplier_id,
          branch_id: selectedPurchaseOrder.branch_id,
          purchase_order_id: selectedPurchaseOrder.id,
          invoice_number: invoiceFromOrderForm.invoice_number.trim(),
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: invoiceFromOrderForm.due_date || null,
          subtotal: totalAmount,
          tax_total: 0,
          discount_total: 0,
          total_amount: totalAmount,
          notes: `Factura generada desde orden de compra #${selectedPurchaseOrder.po_number ?? '-'}`,
          created_by: authData.user?.id || null,
        })
        .select('id')
        .single()

      if (error) throw error
      if (!data?.id) throw new Error('No se pudo obtener la factura creada')

      if (invoiceFromOrderForm.issue_immediately) {
        const { error: issueError } = await (supabase.rpc as any)('post_supplier_invoice', {
          p_supplier_invoice_id: data.id,
        })
        if (issueError) throw issueError
      }

      await trackAuditAction({
        organizationId,
        tableName: 'supplier_invoices',
        recordId: data.id,
        action: 'INSERT',
        notes: invoiceFromOrderForm.issue_immediately
          ? 'Factura de proveedor creada y emitida desde orden de compra.'
          : 'Factura de proveedor creada en borrador desde orden de compra.',
        newData: {
          purchase_order_id: selectedPurchaseOrder.id,
          invoice_number: invoiceFromOrderForm.invoice_number.trim(),
          due_date: invoiceFromOrderForm.due_date || null,
          status: invoiceFromOrderForm.issue_immediately ? 'issued' : 'draft',
          total_amount: totalAmount,
        },
      })

      setInvoiceFromOrderForm({
        invoice_number: '',
        due_date: '',
        issue_immediately: true,
      })

      await fetchPageData({ silent: true })
      await fetchExpenseLedger()
      show('Factura creada correctamente.', 'success')
    } catch (error) {
      console.error('Error creating invoice from purchase order:', error)
      show('No se pudo crear la factura desde la orden de compra.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const registerSupplierPayment = async () => {
    if (!paymentForm.supplier_invoice_id) {
      show('Selecciona una factura para registrar el pago.', 'error')
      return
    }

    const amount = Number(paymentForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      show('El monto del pago debe ser mayor que cero.', 'error')
      return
    }

    try {
      setSaving(true)
      const { data: paymentId, error } = await (supabase.rpc as any)('register_supplier_payment', {
        p_supplier_invoice_id: paymentForm.supplier_invoice_id,
        p_amount: amount,
        p_payment_method: paymentForm.payment_method,
        p_reference_number: paymentForm.reference_number || null,
        p_notes: paymentForm.notes || null,
      })

      if (error) throw error
      if (paymentId) {
        await trackAuditAction({
          organizationId,
          tableName: 'supplier_payments',
          recordId: String(paymentId),
          action: 'INSERT',
          notes: 'Pago de factura de proveedor registrado.',
          newData: {
            supplier_invoice_id: paymentForm.supplier_invoice_id,
            payment_method: paymentForm.payment_method,
            amount,
            reference_number: paymentForm.reference_number || null,
          },
        })
      }

      setPaymentForm({
        supplier_invoice_id: '',
        payment_method: 'transfer',
        amount: '0',
        reference_number: '',
        notes: '',
      })

      await fetchPageData({ silent: true })
      await fetchExpenseLedger()
      setPaymentModalInvoice(null)
      show('Pago registrado correctamente.', 'success')
    } catch (error) {
      console.error('Error registering supplier payment:', error)
      show('No se pudo registrar el pago.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const reverseLatestSupplierPayment = async (invoice: SupplierInvoiceLite) => {
    if (!organizationId) return
    if (!confirm(`¿Revertir el ultimo pago registrado para la factura ${invoice.invoice_number}?`)) return

    try {
      setSaving(true)
      const { data: paymentData, error: paymentError } = await fromAny('supplier_payments')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('supplier_invoice_id', invoice.id)
        .eq('status', 'posted')
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (paymentError) throw paymentError
      if (!paymentData?.id) {
        show('La factura no tiene pagos activos para revertir.', 'info')
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      const { error: reverseError } = await fromAny('supplier_payments')
        .update({
          status: 'reversed',
          reversed_at: new Date().toISOString(),
          reversed_by: authData.user?.id || null,
        })
        .eq('id', paymentData.id)

      if (reverseError) throw reverseError

      await trackAuditAction({
        organizationId,
        tableName: 'supplier_payments',
        recordId: paymentData.id,
        action: 'UPDATE',
        notes: `Pago revertido para factura ${invoice.invoice_number}.`,
        newData: {
          status: 'reversed',
          supplier_invoice_id: invoice.id,
        },
      })

      await fetchPageData({ silent: true })
      await fetchExpenseLedger()
      show(`Pago revertido correctamente para la factura ${invoice.invoice_number}.`, 'success')
    } catch (error) {
      console.error('Error reversing supplier payment:', error)
      show('No se pudo revertir el pago de la factura.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const fetchDirectExpenses = async () => {
    if (!organizationId) return
    setLoadingDirectExpenses(true)
    try {
      const { data, error } = await fromAny('direct_expenses')
        .select('id, occurred_at, category, description, amount, payment_method, branch_id, notes, created_at')
        .eq('organization_id', organizationId)
        .order('occurred_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setDirectExpenses((data || []) as DirectExpense[])
    } catch (error) {
      console.error('Error loading direct expenses:', error)
      show('No se pudieron cargar los gastos directos.', 'error')
    } finally {
      setLoadingDirectExpenses(false)
    }
  }

  const createDirectExpense = async () => {
    if (!organizationId) return
    const amount = Number(directExpenseForm.amount)
    if (!amount || amount <= 0) {
      show('El monto debe ser mayor a cero.', 'error')
      return
    }
    if (!directExpenseForm.occurred_at) {
      show('Seleccioná una fecha.', 'error')
      return
    }
    try {
      setSaving(true)
      const { data: authData } = await supabase.auth.getUser()
      const { data, error } = await fromAny('direct_expenses')
        .insert({
          organization_id: organizationId,
          branch_id: directExpenseForm.branch_id || null,
          occurred_at: directExpenseForm.occurred_at,
          category: directExpenseForm.category,
          description: directExpenseForm.description || null,
          amount,
          payment_method: directExpenseForm.payment_method,
          notes: directExpenseForm.notes || null,
          created_by: authData.user?.id || null,
        })
        .select('id')
        .single()
      if (error) throw error
      await trackAuditAction({
        organizationId,
        tableName: 'direct_expenses',
        recordId: data.id,
        action: 'INSERT',
        notes: 'Gasto directo registrado.',
        newData: {
          category: directExpenseForm.category,
          description: directExpenseForm.description || null,
          amount,
          payment_method: directExpenseForm.payment_method,
          occurred_at: directExpenseForm.occurred_at,
        },
      })
      setDirectExpenseForm({
        occurred_at: new Date().toISOString().slice(0, 10),
        category: 'varios',
        description: '',
        amount: '',
        payment_method: 'cash',
        branch_id: '',
        notes: '',
      })
      await fetchDirectExpenses()
      show('Gasto registrado correctamente.', 'success')
    } catch (error) {
      console.error('Error creating direct expense:', error)
      show('No se pudo registrar el gasto.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteDirectExpense = async (id: string) => {
    if (!confirm('¿Eliminar este gasto? Se cancelará también su entrada en el libro de egresos.')) return
    const existing = directExpenses.find((e) => e.id === id)
    try {
      setSaving(true)
      const { error } = await fromAny('direct_expenses').delete().eq('id', id)
      if (error) throw error
      await trackAuditAction({
        organizationId,
        tableName: 'direct_expenses',
        recordId: id,
        action: 'DELETE',
        notes: 'Gasto directo eliminado.',
        oldData: existing || null,
      })
      await fetchDirectExpenses()
      show('Gasto eliminado correctamente.', 'success')
    } catch (error) {
      console.error('Error deleting direct expense:', error)
      show('No se pudo eliminar el gasto.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openPurchaseOrderEditor = (purchaseOrderId: string) => {
    setSelectedPurchaseOrderId(purchaseOrderId)
    setEditOrderModalOpen(true)
  }

  const closePaymentModal = () => {
    setPaymentModalInvoice(null)
    setPaymentForm({
      supplier_invoice_id: '',
      payment_method: 'transfer',
      amount: '0',
      reference_number: '',
      notes: '',
    })
  }

  const applyLedgerFilters = () => {
    setExpenseLedgerPage(1)
    setLedgerAppliedFilters(ledgerDraftFilters)
  }

  const clearLedgerFilters = () => {
    const emptyFilters: ExpenseLedgerFilters = {
      dateFrom: '',
      dateTo: '',
      supplierId: '',
      entryKind: '',
      eventType: '',
    }
    setLedgerDraftFilters(emptyFilters)
    setLedgerAppliedFilters(emptyFilters)
    setExpenseLedgerPage(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-admin-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Compras y egresos</h1>
        <p className="mt-1 text-gray-600">Separa el trabajo por vista: ordenes, facturas y libro de egresos.</p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-2">
        <Button variant={activeView === 'purchase_orders' ? 'primary' : 'outline'} onClick={() => setActiveView('purchase_orders')}>
          Ordenes de compra
        </Button>
        <Button variant={activeView === 'supplier_invoices' ? 'primary' : 'outline'} onClick={() => setActiveView('supplier_invoices')}>
          Facturas de proveedores
        </Button>
        <Button variant={activeView === 'expense_ledger' ? 'primary' : 'outline'} onClick={() => setActiveView('expense_ledger')}>
          Libro de egresos
        </Button>
        <Button variant={activeView === 'direct_expenses' ? 'primary' : 'outline'} onClick={() => setActiveView('direct_expenses')}>
          Gastos directos
        </Button>
      </div>

      {activeView === 'purchase_orders' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Ordenes de compra</CardTitle>
              <Button onClick={() => setCreateOrderModalOpen(true)}>
                Nueva orden de compra
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Buscar por numero de orden, proveedor o sucursal"
              value={searchOrder}
              onChange={(event) => setSearchOrder(event.target.value)}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Orden</th>
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Proveedor</th>
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Sucursal</th>
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Estado</th>
                    <th className="px-2 py-2 text-right text-xs uppercase text-gray-500">Total</th>
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Fecha</th>
                    <th className="px-2 py-2 text-right text-xs uppercase text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchaseOrders.map((purchaseOrder) => (
                    <tr key={purchaseOrder.id} className="border-b border-gray-100">
                      <td className="px-2 py-2 text-sm text-gray-800">#{purchaseOrder.po_number ?? '-'}</td>
                      <td className="px-2 py-2 text-sm text-gray-700">{supplierNameById.get(purchaseOrder.supplier_id) || 'Proveedor'}</td>
                      <td className="px-2 py-2 text-sm text-gray-700">{branchNameById.get(purchaseOrder.branch_id) || 'Sucursal'}</td>
                      <td className="px-2 py-2 text-sm">
                        <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusBadgeClass(purchaseOrder.status)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(purchaseOrder.status)}`} />
                          {formatPurchaseOrderStatus(purchaseOrder.status)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-semibold text-gray-900">{formatPrice(Number(purchaseOrder.total || 0), settings)}</td>
                      <td className="px-2 py-2 text-sm text-gray-700">{formatDateShort(purchaseOrder.created_at, settings)}</td>
                      <td className="px-2 py-2 text-right">
                        <ActionsMenu
                          actions={[
                            {
                              label: 'Editar orden',
                              onClick: () => openPurchaseOrderEditor(purchaseOrder.id),
                            },
                          ]}
                          className="inline-flex"
                        />
                      </td>
                    </tr>
                  ))}
                  {filteredPurchaseOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-gray-500">
                        No se encontraron ordenes de compra.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'supplier_invoices' && (
        <Card>
          <CardHeader>
            <CardTitle>Facturas de proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Factura</th>
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Proveedor</th>
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Estado</th>
                    <th className="px-2 py-2 text-right text-xs uppercase text-gray-500">Total</th>
                    <th className="px-2 py-2 text-right text-xs uppercase text-gray-500">Pendiente</th>
                    <th className="px-2 py-2 text-right text-xs uppercase text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-100">
                      <td className="px-2 py-2 text-sm text-gray-800">{invoice.invoice_number}</td>
                      <td className="px-2 py-2 text-sm text-gray-700">{supplierNameById.get(invoice.supplier_id) || 'Proveedor'}</td>
                      <td className="px-2 py-2 text-sm">
                        <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusBadgeClass(invoice.status)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(invoice.status)}`} />
                          {formatInvoiceStatus(invoice.status)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-sm text-gray-900">{formatPrice(Number(invoice.total_amount), settings)}</td>
                      <td className="px-2 py-2 text-right text-sm font-semibold text-gray-900">{formatPrice(Number(invoice.outstanding_amount), settings)}</td>
                      <td className="px-2 py-2 text-right">
                        {invoice.status !== 'cancelled' ? (
                          <ActionsMenu
                            actions={[
                              ...(Number(invoice.outstanding_amount) > 0
                                ? [
                                    {
                                      label: 'Pagar factura',
                                      onClick: () => {
                                        setPaymentModalInvoice(invoice)
                                        setPaymentForm((previous) => ({
                                          ...previous,
                                          supplier_invoice_id: invoice.id,
                                          amount: String(invoice.outstanding_amount),
                                        }))
                                      },
                                    },
                                  ]
                                : []),
                              ...(invoice.status === 'partially_paid' || invoice.status === 'paid'
                                ? [
                                    {
                                      label: 'Revertir ultimo pago',
                                      onClick: () => reverseLatestSupplierPayment(invoice),
                                    },
                                  ]
                                : []),
                            ]}
                            className="inline-flex"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">Sin acciones</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {supplierInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                        No hay facturas cargadas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'expense_ledger' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Libro de egresos</CardTitle>
              <span className="text-xs text-gray-600">Pagina {expenseLedgerPage} de {totalExpenseLedgerPages}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Desde</label>
                <Input
                  type="date"
                  value={ledgerDraftFilters.dateFrom}
                  onChange={(event) => setLedgerDraftFilters((previous) => ({ ...previous, dateFrom: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Hasta</label>
                <Input
                  type="date"
                  value={ledgerDraftFilters.dateTo}
                  onChange={(event) => setLedgerDraftFilters((previous) => ({ ...previous, dateTo: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Proveedor</label>
                <select
                  className="min-h-[40px] w-full rounded-lg border border-gray-300 px-3"
                  value={ledgerDraftFilters.supplierId}
                  onChange={(event) => setLedgerDraftFilters((previous) => ({ ...previous, supplierId: event.target.value }))}
                >
                  <option value="">Todos</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Tipo de registro</label>
                <select
                  className="min-h-[40px] w-full rounded-lg border border-gray-300 px-3"
                  value={ledgerDraftFilters.entryKind}
                  onChange={(event) =>
                    setLedgerDraftFilters((previous) => ({
                      ...previous,
                      entryKind: event.target.value as ExpenseLedgerFilters['entryKind'],
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="accrual">Devengado</option>
                  <option value="cash">Caja</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Evento</label>
                <select
                  className="min-h-[40px] w-full rounded-lg border border-gray-300 px-3"
                  value={ledgerDraftFilters.eventType}
                  onChange={(event) =>
                    setLedgerDraftFilters((previous) => ({
                      ...previous,
                      eventType: event.target.value as ExpenseLedgerFilters['eventType'],
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="invoice">Factura</option>
                  <option value="payment">Pago</option>
                  <option value="payment_reversal">Reversion de pago</option>
                  <option value="manual_adjustment">Ajuste manual</option>
                  <option value="direct_expense">Gasto directo</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" className="w-full" onClick={clearLedgerFilters}>
                  Limpiar
                </Button>
                <Button className="w-full" onClick={applyLedgerFilters}>
                  Aplicar
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Fecha</th>
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Tipo de registro</th>
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Tipo de evento</th>
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Proveedor</th>
                    <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Origen</th>
                    <th className="px-2 py-2 text-right text-xs uppercase text-gray-500">Monto</th>
                    <th className="px-2 py-2 text-right text-xs uppercase text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseLedgerEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100">
                      <td className="px-2 py-2 text-sm text-gray-700">{formatDateShort(entry.occurred_at, settings)}</td>
                      <td className="px-2 py-2 text-sm text-gray-700">{formatLedgerEntryKind(entry.entry_kind)}</td>
                      <td className="px-2 py-2 text-sm text-gray-700">{formatLedgerEventType(entry.event_type)}</td>
                      <td className="px-2 py-2 text-sm text-gray-700">{entry.supplier_id ? supplierNameById.get(entry.supplier_id) || 'Proveedor' : 'Sin proveedor'}</td>
                      <td className="px-2 py-2 text-sm text-gray-700">{formatLedgerSource(entry.source_table)}</td>
                      <td className="px-2 py-2 text-right text-sm font-semibold text-gray-900">{formatPrice(Number(entry.net_amount), settings)}</td>
                      <td className="px-2 py-2 text-right">
                        <ActionsMenu
                          actions={[
                            {
                              label: 'Ver detalle',
                              onClick: () => setLedgerDetailEntry(entry),
                            },
                          ]}
                          className="inline-flex"
                        />
                      </td>
                    </tr>
                  ))}
                  {expenseLedgerEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-gray-500">
                        No hay movimientos de egresos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" disabled={expenseLedgerPage <= 1} onClick={() => setExpenseLedgerPage((page) => page - 1)}>
                Pagina anterior
              </Button>
              <Button
                variant="outline"
                disabled={expenseLedgerPage >= totalExpenseLedgerPages}
                onClick={() => setExpenseLedgerPage((page) => page + 1)}
              >
                Pagina siguiente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'direct_expenses' && (
        <div className="space-y-6">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle>Registrar gasto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
                  <Input
                    type="date"
                    value={directExpenseForm.occurred_at}
                    onChange={(e) => setDirectExpenseForm((prev) => ({ ...prev, occurred_at: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Categoría</label>
                  <select
                    className="min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-3"
                    value={directExpenseForm.category}
                    onChange={(e) => setDirectExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Monto</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={directExpenseForm.amount}
                    onChange={(e) => setDirectExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Descripción (opcional)</label>
                  <Input
                    placeholder="Ej: Nafta viaje a Montevideo"
                    value={directExpenseForm.description}
                    onChange={(e) => setDirectExpenseForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Método de pago</label>
                  <select
                    className="min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-3"
                    value={directExpenseForm.payment_method}
                    onChange={(e) => setDirectExpenseForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="mercadopago">Mercado Pago</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Sucursal (opcional)</label>
                  <select
                    className="min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-3"
                    value={directExpenseForm.branch_id}
                    onChange={(e) => setDirectExpenseForm((prev) => ({ ...prev, branch_id: e.target.value }))}
                  >
                    <option value="">Sin sucursal</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Notas (opcional)</label>
                  <Input
                    placeholder="Notas adicionales"
                    value={directExpenseForm.notes}
                    onChange={(e) => setDirectExpenseForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-4">
                <Button onClick={createDirectExpense} disabled={saving}>
                  {saving ? 'Guardando…' : 'Registrar gasto'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de gastos</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDirectExpenses ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600" />
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Fecha</th>
                          <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Categoría</th>
                          <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Descripción</th>
                          <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Método</th>
                          <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Sucursal</th>
                          <th className="px-2 py-2 text-right text-xs uppercase text-gray-500">Monto</th>
                          <th className="px-2 py-2 text-right text-xs uppercase text-gray-500">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {directExpenses.map((expense) => (
                          <tr key={expense.id} className="border-b border-gray-100">
                            <td className="px-2 py-2 text-sm text-gray-700">{formatDateShort(expense.occurred_at, settings)}</td>
                            <td className="px-2 py-2 text-sm text-gray-700">{EXPENSE_CATEGORY_LABEL[expense.category] ?? expense.category}</td>
                            <td className="px-2 py-2 text-sm text-gray-600">{expense.description ?? '—'}</td>
                            <td className="px-2 py-2 text-sm text-gray-600 capitalize">{expense.payment_method}</td>
                            <td className="px-2 py-2 text-sm text-gray-600">{expense.branch_id ? (branchNameById.get(expense.branch_id) ?? '—') : '—'}</td>
                            <td className="px-2 py-2 text-right text-sm font-semibold text-gray-900">{formatPrice(Number(expense.amount), settings)}</td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => deleteDirectExpense(expense.id)}
                                className="rounded p-1 text-red-500 hover:bg-red-50 transition-colors"
                                aria-label="Eliminar"
                                disabled={saving}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {directExpenses.length === 0 && (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-sm text-gray-500">
                              No hay gastos registrados todavía.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {directExpenses.length === 0 && (
                      <p className="py-6 text-center text-sm text-gray-500">No hay gastos registrados todavía.</p>
                    )}
                    {directExpenses.map((expense) => (
                      <div key={expense.id} className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-gray-900">{EXPENSE_CATEGORY_LABEL[expense.category] ?? expense.category}</p>
                            {expense.description && <p className="text-xs text-gray-600">{expense.description}</p>}
                            <p className="text-xs text-gray-500">{formatDateShort(expense.occurred_at, settings)} · {expense.payment_method}</p>
                            {expense.branch_id && <p className="text-xs text-gray-500">{branchNameById.get(expense.branch_id)}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-bold text-gray-900">{formatPrice(Number(expense.amount), settings)}</span>
                            <button
                              type="button"
                              onClick={() => deleteDirectExpense(expense.id)}
                              className="rounded p-1 text-red-500 hover:bg-red-50 transition-colors"
                              aria-label="Eliminar"
                              disabled={saving}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {createOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Nueva orden de compra</CardTitle>
                <button
                  type="button"
                  onClick={() => setCreateOrderModalOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Proveedor</label>
              <select
                className="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3"
                value={createOrderForm.supplier_id}
                onChange={(event) => setCreateOrderForm((previous) => ({ ...previous, supplier_id: event.target.value }))}
              >
                <option value="">Seleccionar proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-gray-700">Sucursal</label>
              <select
                className="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3"
                value={createOrderForm.branch_id}
                onChange={(event) => setCreateOrderForm((previous) => ({ ...previous, branch_id: event.target.value }))}
              >
                <option value="">Seleccionar sucursal</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-gray-700">Estado inicial</label>
              <select
                className="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3"
                value={createOrderForm.status}
                onChange={(event) => setCreateOrderForm((previous) => ({ ...previous, status: event.target.value }))}
              >
                <option value="draft">Borrador</option>
                <option value="submitted">Enviada</option>
              </select>

              <label className="block text-sm font-medium text-gray-700">Notas (opcional)</label>
              <Input
                placeholder="Notas para la orden"
                value={createOrderForm.notes}
                onChange={(event) => setCreateOrderForm((previous) => ({ ...previous, notes: event.target.value }))}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOrderModalOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={createPurchaseOrder} disabled={saving}>
                  Crear orden
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editOrderModalOpen && selectedPurchaseOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Editar orden de compra #{selectedPurchaseOrder.po_number ?? '-'}</CardTitle>
                <button
                  type="button"
                  onClick={() => setEditOrderModalOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Banners de estado */}
              {selectedPurchaseOrder.status === 'received' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <strong>Orden recibida.</strong> El inventario ya fue actualizado con esta orden. No se pueden editar los ítems para evitar inconsistencias contables.
                </div>
              )}
              {selectedPurchaseOrder.status === 'cancelled' && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <strong>Orden cancelada.</strong> No se pueden modificar los ítems de una orden cancelada.
                </div>
              )}
              {selectedPurchaseOrder.status === 'partially_received' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <strong>Recepción parcial.</strong> Los ítems con unidades ya recibidas no pueden editarse. Solo podés editar ítems que aún no tienen recepciones registradas.
                </div>
              )}
              {supplierInvoices.some(
                (inv) => inv.purchase_order_id === selectedPurchaseOrder.id && inv.status !== 'cancelled'
              ) && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  <strong>Factura emitida asociada.</strong> Esta orden tiene una factura de proveedor activa. Si editás costos, el total de la orden cambiará pero la factura ya emitida <strong>no se actualizará automáticamente</strong> — revisá la factura manualmente.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select
                    className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg"
                    value={editOrderForm.supplier_id}
                    onChange={(event) => setEditOrderForm((previous) => ({ ...previous, supplier_id: event.target.value }))}
                  >
                    <option value="">Seleccionar proveedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                  <select
                    className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg"
                    value={editOrderForm.branch_id}
                    onChange={(event) => setEditOrderForm((previous) => ({ ...previous, branch_id: event.target.value }))}
                  >
                    <option value="">Seleccionar sucursal</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg"
                    value={editOrderForm.status}
                    onChange={(event) => setEditOrderForm((previous) => ({ ...previous, status: event.target.value }))}
                  >
                    <option value="draft">Borrador</option>
                    <option value="submitted">Enviada</option>
                    <option value="partially_received">Recepcion parcial</option>
                    <option value="received">Recibida</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                  <Input
                    placeholder="Notas"
                    value={editOrderForm.notes}
                    onChange={(event) => setEditOrderForm((previous) => ({ ...previous, notes: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={updateSelectedPurchaseOrder} disabled={saving}>Guardar cambios de la orden</Button>
                <span className="text-sm text-gray-600">Total actual: {formatPrice(Number(selectedPurchaseOrder.total || 0), settings)}</span>
              </div>

              <div className="border-t pt-5">
                <h3 className="text-base font-semibold text-gray-900 mb-3">Productos de la orden de compra</h3>

                <div className="overflow-x-auto mb-4">
                  <table className="w-full min-w-[760px]">
                    <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-xs uppercase text-gray-500">Linea</th>
                      <th className="text-left py-2 px-2 text-xs uppercase text-gray-500">Producto</th>
                      <th className="text-left py-2 px-2 text-xs uppercase text-gray-500">Variante</th>
                        <th className="text-right py-2 px-2 text-xs uppercase text-gray-500">Cantidad</th>
                        <th className="text-right py-2 px-2 text-xs uppercase text-gray-500">Recibida</th>
                        <th className="text-right py-2 px-2 text-xs uppercase text-gray-500">Costo unitario</th>
                        <th className="text-right py-2 px-2 text-xs uppercase text-gray-500">Subtotal linea</th>
                        <th className="text-right py-2 px-2 text-xs uppercase text-gray-500">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseOrderItems.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-sm text-gray-500">Esta orden no tiene productos cargados.</td>
                        </tr>
                      )}

                      {purchaseOrderItems.map((item) => {
                        const isEditing = editingItemId === item.id
                        const lineSubtotal = Number(item.quantity_ordered) * Number(item.unit_cost)

                        if (isEditing) {
                          const editVariants = variantsByProduct.get(editItemForm.product_id) ?? []
                          return (
                            <tr key={item.id} className="border-b border-blue-100 bg-blue-50">
                              <td colSpan={8} className="px-3 py-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">Editando línea {item.line_number}</p>
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Producto</label>
                                    <select
                                      className="w-full min-h-[36px] rounded-md border border-gray-300 px-2 text-sm"
                                      value={editItemForm.product_id}
                                      onChange={(e) => {
                                        const pid = e.target.value
                                        setEditItemForm((p) => ({ ...p, product_id: pid, variant_id: '' }))
                                        if (pid) loadVariantsForProduct(pid)
                                      }}
                                    >
                                      <option value="">Seleccionar</option>
                                      {products.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Variante</label>
                                    <select
                                      className="w-full min-h-[36px] rounded-md border border-gray-300 px-2 text-sm"
                                      value={editItemForm.variant_id}
                                      onChange={(e) => setEditItemForm((p) => ({ ...p, variant_id: e.target.value }))}
                                      disabled={!editItemForm.product_id}
                                    >
                                      <option value="">Sin variante</option>
                                      {editVariants.map((v) => (
                                        <option key={v.id} value={v.id}>{v.name ?? v.sku} — {v.sku}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Cantidad</label>
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      className="w-full min-h-[36px] rounded-md border border-gray-300 px-2 text-sm"
                                      value={editItemForm.quantity_ordered}
                                      onChange={(e) => setEditItemForm((p) => ({ ...p, quantity_ordered: e.target.value }))}
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Costo unitario</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.0001"
                                      className="w-full min-h-[36px] rounded-md border border-gray-300 px-2 text-sm"
                                      value={editItemForm.unit_cost}
                                      onChange={(e) => setEditItemForm((p) => ({ ...p, unit_cost: e.target.value }))}
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Impuestos</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="w-full min-h-[36px] rounded-md border border-gray-300 px-2 text-sm"
                                      value={editItemForm.tax_amount}
                                      onChange={(e) => setEditItemForm((p) => ({ ...p, tax_amount: e.target.value }))}
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Descuentos</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="w-full min-h-[36px] rounded-md border border-gray-300 px-2 text-sm"
                                      value={editItemForm.discount_amount}
                                      onChange={(e) => setEditItemForm((p) => ({ ...p, discount_amount: e.target.value }))}
                                    />
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Descripción (opcional)</label>
                                    <input
                                      type="text"
                                      className="w-full min-h-[36px] rounded-md border border-gray-300 px-2 text-sm"
                                      value={editItemForm.description}
                                      onChange={(e) => setEditItemForm((p) => ({ ...p, description: e.target.value }))}
                                    />
                                  </div>
                                </div>

                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    onClick={saveEditingItem}
                                    disabled={saving}
                                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                                  >
                                    Guardar cambios
                                  </button>
                                  <button
                                    onClick={cancelEditingItem}
                                    disabled={saving}
                                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                  {item.quantity_received > 0 && (
                                    <span className="text-xs text-amber-600">⚠ Este ítem ya tiene {item.quantity_received} unidades recibidas</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        }

                        return (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-2 text-sm text-gray-700">{item.line_number}</td>
                            <td className="py-2 px-2 text-sm text-gray-700">{productNameById.get(item.product_id) || 'Producto'}</td>
                            <td className="py-2 px-2 text-sm text-gray-500">
                              {item.variant_id
                                ? (variantsByProduct.get(item.product_id)?.find((v) => v.id === item.variant_id)?.name ?? item.variant_id.slice(0, 8) + '…')
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-2 px-2 text-sm text-gray-700 text-right">{item.quantity_ordered}</td>
                            <td className="py-2 px-2 text-sm text-gray-700 text-right">{item.quantity_received}</td>
                            <td className="py-2 px-2 text-sm text-gray-700 text-right">{formatPrice(Number(item.unit_cost), settings)}</td>
                            <td className="py-2 px-2 text-sm text-gray-700 text-right">{formatPrice(lineSubtotal, settings)}</td>
                            <td className="py-2 px-2 text-right">
                              <ActionsMenu
                                actions={[
                                  {
                                    label: 'Editar ítem',
                                    onClick: () => startEditingItem(item),
                                  },
                                  {
                                    label: 'Eliminar producto',
                                    onClick: () => removeItemFromSelectedPurchaseOrder(item.id),
                                  },
                                ]}
                                className="inline-flex"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
                    <select
                      className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg"
                      value={newOrderItemForm.product_id}
                      onChange={(event) => handleNewItemProductChange(event.target.value)}
                    >
                      <option value="">Seleccionar producto</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                  </div>

                  {newOrderItemForm.product_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Variante {loadingVariants && <span className="text-xs text-gray-400">(cargando...)</span>}
                      </label>
                      <select
                        className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg"
                        value={newOrderItemForm.variant_id}
                        onChange={(event) => setNewOrderItemForm((previous) => ({ ...previous, variant_id: event.target.value }))}
                      >
                        <option value="">Sin variante específica</option>
                        {(variantsByProduct.get(newOrderItemForm.product_id) ?? []).map((v) => (
                          <option key={v.id} value={v.id}>{v.name ?? v.sku} — {v.sku}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={newOrderItemForm.quantity_ordered}
                      onChange={(event) => setNewOrderItemForm((previous) => ({ ...previous, quantity_ordered: event.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo unitario</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={newOrderItemForm.unit_cost}
                      onChange={(event) => setNewOrderItemForm((previous) => ({ ...previous, unit_cost: event.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Impuestos</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newOrderItemForm.tax_amount}
                      onChange={(event) => setNewOrderItemForm((previous) => ({ ...previous, tax_amount: event.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descuentos</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newOrderItemForm.discount_amount}
                      onChange={(event) => setNewOrderItemForm((previous) => ({ ...previous, discount_amount: event.target.value }))}
                    />
                  </div>

                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion (opcional)</label>
                    <Input
                      value={newOrderItemForm.description}
                      onChange={(event) => setNewOrderItemForm((previous) => ({ ...previous, description: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <Button onClick={addItemToSelectedPurchaseOrder} disabled={saving}>Agregar producto a la orden</Button>
                </div>
              </div>

              <div className="border-t pt-5 space-y-4">
                <h3 className="text-base font-semibold text-gray-900">Acciones desde esta orden de compra</h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3 space-y-3">
                    <h4 className="text-sm font-semibold text-gray-800">Recepcion de mercaderia</h4>
                    <p className="text-xs text-gray-600">Crea una recepcion con los productos pendientes y la confirma automaticamente.</p>
                    <Button onClick={createAndPostReceiptFromSelectedPurchaseOrder} disabled={saving}>Crear y confirmar recepcion</Button>
                  </div>

                  <div className="border rounded-lg p-3 space-y-3">
                    <h4 className="text-sm font-semibold text-gray-800">Factura de proveedor</h4>
                    <label className="block text-sm font-medium text-gray-700">Numero de factura</label>
                    <Input
                      value={invoiceFromOrderForm.invoice_number}
                      onChange={(event) => setInvoiceFromOrderForm((previous) => ({ ...previous, invoice_number: event.target.value }))}
                    />

                    <label className="block text-sm font-medium text-gray-700">Fecha de vencimiento (opcional)</label>
                    <Input
                      type="date"
                      value={invoiceFromOrderForm.due_date}
                      onChange={(event) => setInvoiceFromOrderForm((previous) => ({ ...previous, due_date: event.target.value }))}
                    />

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={invoiceFromOrderForm.issue_immediately}
                        onChange={(event) => setInvoiceFromOrderForm((previous) => ({ ...previous, issue_immediately: event.target.checked }))}
                      />
                      Emitir factura inmediatamente
                    </label>

                    <Button onClick={createInvoiceFromSelectedPurchaseOrder} disabled={saving}>Crear factura desde la orden</Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setEditOrderModalOpen(false)} disabled={saving}>
                  Cerrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-xl">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Registrar pago de factura</CardTitle>
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <p>
                  <span className="font-medium">Factura:</span> {paymentModalInvoice.invoice_number}
                </p>
                <p>
                  <span className="font-medium">Proveedor:</span> {supplierNameById.get(paymentModalInvoice.supplier_id) || 'Proveedor'}
                </p>
                <p>
                  <span className="font-medium">Pendiente:</span> {formatPrice(Number(paymentModalInvoice.outstanding_amount), settings)}
                </p>
              </div>

              <label className="block text-sm font-medium text-gray-700">Metodo de pago</label>
              <select
                className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3"
                value={paymentForm.payment_method}
                onChange={(event) => setPaymentForm((previous) => ({ ...previous, payment_method: event.target.value }))}
              >
                <option value="transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>

              <label className="block text-sm font-medium text-gray-700">Monto a pagar</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(event) => setPaymentForm((previous) => ({ ...previous, amount: event.target.value }))}
              />

              <label className="block text-sm font-medium text-gray-700">Numero de referencia (opcional)</label>
              <Input
                value={paymentForm.reference_number}
                onChange={(event) => setPaymentForm((previous) => ({ ...previous, reference_number: event.target.value }))}
              />

              <label className="block text-sm font-medium text-gray-700">Notas (opcional)</label>
              <Input value={paymentForm.notes} onChange={(event) => setPaymentForm((previous) => ({ ...previous, notes: event.target.value }))} />

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closePaymentModal} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={registerSupplierPayment} disabled={saving}>
                  Registrar pago
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {ledgerDetailEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Detalle del registro de egreso</CardTitle>
                <button
                  type="button"
                  onClick={() => setLedgerDetailEntry(null)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-700">
              <p><span className="font-medium">Fecha:</span> {formatDateShort(ledgerDetailEntry.occurred_at, settings)}</p>
              <p><span className="font-medium">Tipo de registro:</span> {formatLedgerEntryKind(ledgerDetailEntry.entry_kind)}</p>
              <p><span className="font-medium">Tipo de evento:</span> {formatLedgerEventType(ledgerDetailEntry.event_type)}</p>
              <p><span className="font-medium">Proveedor:</span> {ledgerDetailEntry.supplier_id ? supplierNameById.get(ledgerDetailEntry.supplier_id) || 'Proveedor' : 'Sin proveedor'}</p>
              <p><span className="font-medium">Origen:</span> {formatLedgerSource(ledgerDetailEntry.source_table)}</p>
              <p><span className="font-medium">Monto:</span> {formatPrice(Number(ledgerDetailEntry.net_amount), settings)}</p>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setLedgerDetailEntry(null)}>
                  Cerrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
