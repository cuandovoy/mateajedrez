import { BillerCheckoutPanel } from '@/components/features/BillerCheckoutPanel'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useBillerConfig } from '@/hooks/useBillerConfig'
import { useOrgPaymentMethods } from '@/hooks/useOrgPaymentMethods'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { trackAuditAction } from '@/lib/audit'
import { BillerApiError, descargarPDFBlob } from '@/lib/biller'
import { emitirCFEDesdeOrden } from '@/lib/billerSaleService'
import { supabase } from '@/lib/supabase'
import { capitalizeFirst, formatPrice } from '@/lib/utils'
import { useOrganizationStore } from '@/store/organizationStore'
import { useToastStore } from '@/store/toastStore'
import type { CashSession, Product } from '@/types'
import type { CheckoutBillerState } from '@/types/biller'
import type { OrderInsert, OrderPaymentInsert } from '@/types/database.types'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, ChevronUp, DollarSign, Edit2, Plus, Search, ShoppingCart, Trash2, UserCheck, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

interface ManualSaleFormProps {
  branchId: string
  openCashSession: CashSession | null
  openCashSessions?: CashSession[]
  branches?: Array<{ id: string; name: string }>
  onClose: () => void
  onSaleCreated: () => void
  onBranchChange?: (branchId: string) => void
}

interface SaleLine {
  id: string
  type: 'product' | 'manual'
  product_id?: string
  variant_id?: string | null
  product_name: string
  variant_name?: string | null
  price: number
  quantity: number
  available_stock?: number
  is_editing_price?: boolean
  is_editing_quantity?: boolean
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

const manualSaleSchema = z.object({
  customer_name: z.string().optional(),
  customer_email: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_rut: z.string().optional(),
  sale_condition: z.enum(['contado', 'credito']),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
})

type ManualSaleForm = z.infer<typeof manualSaleSchema>

type CustomerLite = {
  id: string
  full_name: string
  email: string | null
  phone: string
  rut?: string | null
  notes?: string | null
}

const normalizeEmail = (value: string | undefined): string => (value || '').trim().toLowerCase()
const normalizePhone = (value: string | undefined): string => (value || '').trim().replace(/\s+/g, '')
const normalizeRut = (value: string | undefined): string =>
  (value || '').trim().toUpperCase().replace(/[.\-\s]/g, '')

export function ManualSaleForm({
  branchId: initialBranchId,
  openCashSession: _initialOpenCashSession,
  openCashSessions,
  branches,
  onClose,
  onSaleCreated,
  onBranchChange,
}: ManualSaleFormProps) {
  const { show } = useToastStore()
  const settings = useOrgSettings()
  const organizationId = useOrganizationStore((s) => s.currentOrganization?.id)
  const { methods: paymentMethods } = useOrgPaymentMethods(organizationId)
  const [branchId, setBranchId] = useState(initialBranchId)
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [saleLines, setSaleLines] = useState<SaleLine[]>([])
  const [discountRules, setDiscountRules] = useState<SalesDiscountRule[]>([])
  const [discountSource, setDiscountSource] = useState<'none' | 'manual' | 'rule'>('none')
  const [manualDiscountKind, setManualDiscountKind] = useState<DiscountKind>('percentage')
  const [manualDiscountValue, setManualDiscountValue] = useState('')
  const [manualDiscountReason, setManualDiscountReason] = useState('')
  const [selectedDiscountRuleId, setSelectedDiscountRuleId] = useState('')
  const [loading, setLoading] = useState(false)
  const [linkedCustomer, setLinkedCustomer] = useState<CustomerLite | null>(null)
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false)
  const [customerPickerSearch, setCustomerPickerSearch] = useState('')
  const [customerPickerLoading, setCustomerPickerLoading] = useState(false)
  const [customerPickerResults, setCustomerPickerResults] = useState<CustomerLite[]>([])
  const [showOptionalCustomerData, setShowOptionalCustomerData] = useState(false)
  const [saleDate, setSaleDate] = useState<string>(() => {
    const now = new Date()
    now.setSeconds(0, 0)
    return now.toISOString().slice(0, 16)
  })
  const [newLineDescription, setNewLineDescription] = useState('')
  const [newLinePrice, setNewLinePrice] = useState('')
  const [newLineQuantity, setNewLineQuantity] = useState('1')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchResultsRef = useRef<HTMLDivElement>(null)
  const organizations = useOrganizationStore((s) => s.organizations)
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization)
  const currentMemberRole = organizations.find((o) => o.id === currentOrganization?.id)?.member?.role
  const canApplyManualDiscount = currentMemberRole === 'admin' || currentMemberRole === 'manager'

  
  
  const { config: billerConfig } = useBillerConfig(organizationId ?? null)
  console.log("billerConfig: ", billerConfig);
  const [billerState, setBillerState] = useState<CheckoutBillerState>({
    emitirCFE: false,
    tipoComprobante: 'ticket',
  })

  // Get current cash session for the selected branch
  const currentCashSession = openCashSessions?.find((s) => s.branch_id === branchId) || null

  // Update branchId when it changes from parent
  useEffect(() => {
    setBranchId(initialBranchId)
  }, [initialBranchId])

  // Refresh stock for all product lines when branch changes
  useEffect(() => {
    const productLines = saleLines.filter((l) => l.type === 'product' && l.product_id)
    if (productLines.length === 0) return
    let cancelled = false
    ;(async () => {
      const updates = await Promise.all(
        productLines.map(async (line) => ({
          id: line.id,
          stock: await getAvailableStock(line.product_id!, line.variant_id, branchId),
        }))
      )
      if (cancelled) return
      setSaleLines((prev) =>
        prev.map((line) => {
          const update = updates.find((u) => u.id === line.id)
          return update ? { ...line, available_stock: update.stock } : line
        })
      )
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  const defaultPaymentMethod = (() => {
    const cashMethod = paymentMethods.find((m) => m.requires_cash_session && m.key === 'cash')
    const firstNonCash = paymentMethods.find((m) => !m.requires_cash_session)
    if (currentCashSession && cashMethod) return 'cash'
    if (firstNonCash) return firstNonCash.key
    return paymentMethods[0]?.key ?? ''
  })()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ManualSaleForm>({
    resolver: zodResolver(manualSaleSchema),
    defaultValues: {
      sale_condition: 'contado',
      payment_method: defaultPaymentMethod,
      customer_rut: '',
    },
  })

  const saleCondition = watch('sale_condition')

  // Update payment method default when cash session or payment methods change
  useEffect(() => {
    const cashMethod = paymentMethods.find((m) => m.requires_cash_session && m.key === 'cash')
    const firstNonCash = paymentMethods.find((m) => !m.requires_cash_session)
    if (currentCashSession && cashMethod) {
      setValue('payment_method', 'cash')
    } else if (firstNonCash) {
      setValue('payment_method', firstNonCash.key)
    } else if (paymentMethods[0]) {
      setValue('payment_method', paymentMethods[0].key)
    }
  }, [currentCashSession, paymentMethods, setValue])

  useEffect(() => {
    if (organizationId) fetchProducts()
  }, [organizationId])

  useEffect(() => {
    if (organizationId) fetchOrderDiscountRules()
  }, [organizationId])

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const fetchProducts = async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setProducts((data || []) as Product[])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchOrderDiscountRules = async () => {
    if (!organizationId) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('list_active_sales_discount_rules', {
        p_organization_id: organizationId,
        p_scope: 'order',
      })
      if (error) throw error
      setDiscountRules((Array.isArray(data) ? data : []) as SalesDiscountRule[])
    } catch (error) {
      console.error('Error fetching discount rules:', error)
      setDiscountRules([])
    }
  }

  const findExistingCustomer = async (
    normalizedRut: string,
    normalizedPhone: string,
    normalizedEmail: string
  ): Promise<CustomerLite | null> => {
    if (!organizationId || (!normalizedRut && !normalizedPhone && !normalizedEmail)) return null

    if (normalizedRut) {
      const { data: byRut, error: rutError } = await supabase
        .from('customers')
        .select('id, full_name, email, phone, rut, notes')
        .eq('organization_id', organizationId)
        .ilike('rut', normalizedRut)
        .limit(1)
        .maybeSingle()

      if (rutError) throw rutError
      if (byRut) return byRut as CustomerLite
    }

    if (normalizedPhone) {
      const { data: byPhone, error: phoneError } = await supabase
        .from('customers')
        .select('id, full_name, email, phone, rut, notes')
        .eq('organization_id', organizationId)
        .eq('phone', normalizedPhone)
        .limit(1)
        .maybeSingle()

      if (phoneError) throw phoneError
      if (byPhone) return byPhone as CustomerLite
    }

    if (normalizedEmail) {
      const { data: byEmail, error: emailError } = await supabase
        .from('customers')
        .select('id, full_name, email, phone, rut, notes')
        .eq('organization_id', organizationId)
        .ilike('email', normalizedEmail)
        .limit(1)
        .maybeSingle()

      if (emailError) throw emailError
      if (byEmail) return byEmail as CustomerLite
    }

    return null
  }

  const openCustomerPicker = async (resetSearch = true) => {
    if (!organizationId) return
    setIsCustomerPickerOpen(true)
    if (resetSearch) {
      setCustomerPickerSearch('')
    }
    setCustomerPickerLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, email, phone, rut, notes')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      setCustomerPickerResults((data || []) as CustomerLite[])
    } catch (error) {
      console.error('Error loading customers:', error)
      show('No se pudieron cargar clientes.', 'error')
    } finally {
      setCustomerPickerLoading(false)
    }
  }

  const searchCustomersForPicker = async (term: string) => {
    if (!organizationId) return
    const queryTerm = term.trim()
    if (!queryTerm) {
      await openCustomerPicker(false)
      return
    }

    setCustomerPickerLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, email, phone, rut, notes')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .or(
          `full_name.ilike.%${queryTerm}%,phone.ilike.%${queryTerm}%,email.ilike.%${queryTerm}%,rut.ilike.%${queryTerm}%,notes.ilike.%${queryTerm}%`
        )
        .order('full_name')
        .limit(50)
      if (error) throw error
      setCustomerPickerResults((data || []) as CustomerLite[])
    } catch (error) {
      console.error('Error searching customers:', error)
      show('No se pudo buscar clientes.', 'error')
    } finally {
      setCustomerPickerLoading(false)
    }
  }

  const handleSelectCustomer = (customer: CustomerLite) => {
    setLinkedCustomer(customer)
    setValue('customer_name', customer.full_name)
    setValue('customer_email', customer.email || '')
    setValue('customer_phone', customer.phone || '')
    setValue('customer_rut', customer.rut || '')
    setIsCustomerPickerOpen(false)
    show(`Cliente seleccionado: ${customer.full_name}.`, 'success')
  }

  // Real-time search
  useEffect(() => {
    if (searchTerm.trim().length > 0) {
      const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setSearchResults(filtered.slice(0, 8))
      setShowSearchResults(true)
    } else {
      setSearchResults([])
      setShowSearchResults(false)
    }
  }, [searchTerm, products])

  const getAvailableStock = async (
    productId: string,
    variantId?: string | null,
    currentBranchId?: string
  ): Promise<number> => {
    const targetBranchId = currentBranchId || branchId
    try {
      if (variantId) {
        const { data } = await supabase
          .from('branch_inventory')
          .select('stock')
          .eq('branch_id', targetBranchId)
          .eq('variant_id', variantId)
          .maybeSingle()

        return (data as { stock: number } | null)?.stock || 0
      } else {
        // Try to find default variant first (maybeSingle: 0 rows = null, 1 row = data)
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
            .eq('branch_id', targetBranchId)
            .eq('variant_id', (defaultVariant as { id: string }).id)
            .maybeSingle()

          return (data as { stock: number } | null)?.stock || 0
        } else {
          // Fallback: check product-level inventory
          const { data } = await supabase
            .from('branch_inventory')
            .select('stock')
            .eq('branch_id', targetBranchId)
            .eq('product_id', productId)
            .maybeSingle()

          return (data as { stock: number } | null)?.stock || 0
        }
      }
    } catch (error) {
      console.error('Error getting stock:', error)
      return 0
    }
  }

  const handleAddProduct = async (product: Product) => {
    const availableStock = await getAvailableStock(product.id)
    const price = product.price

    if (availableStock === 0) {
      show('Este producto tiene 0 stock. Se agregó igual. Podrás registrar la venta.', 'info')
    }

    // Check if product already exists in sale lines
    const existingIndex = saleLines.findIndex(
      (line) => line.type === 'product' && line.product_id === product.id && !line.variant_id
    )

    if (existingIndex >= 0) {
      // Update quantity (allow even if exceeds stock - user can register sale anyway)
      const newLines = [...saleLines]
      newLines[existingIndex].quantity += 1
      newLines[existingIndex].available_stock = availableStock
      setSaleLines(newLines)
    } else {
      // Add new line
      setSaleLines([
        ...saleLines,
        {
          id: `product-${Date.now()}`,
          type: 'product',
          product_id: product.id,
          variant_id: null,
          product_name: product.name,
          variant_name: null,
          price,
          quantity: 1,
          available_stock: availableStock,
        },
      ])
    }

    // Reset search
    setSearchTerm('')
    setShowSearchResults(false)
    searchInputRef.current?.focus()
  }

  const handleAddManualLine = () => {
    if (!newLineDescription.trim()) {
      show('Ingresa una descripción para la línea', 'error')
      return
    }

    const price = parseFloat(newLinePrice) || 0
    const quantity = parseFloat(newLineQuantity) || 1

    if (price <= 0) {
      show('El precio debe ser mayor a 0', 'error')
      return
    }

    if (quantity <= 0) {
      show('La cantidad debe ser mayor a 0', 'error')
      return
    }

    setSaleLines([
      ...saleLines,
      {
        id: `manual-${Date.now()}`,
        type: 'manual',
        product_name: newLineDescription.trim(),
        price,
        quantity,
      },
    ])

    // Reset manual line form
    setNewLineDescription('')
    setNewLinePrice('')
    setNewLineQuantity('1')
  }

  const handleRemoveLine = (id: string) => {
    setSaleLines(saleLines.filter((line) => line.id !== id))
  }

  const handleUpdateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return

    const line = saleLines.find((l) => l.id === id)
    if (line && line.available_stock !== undefined && newQuantity > line.available_stock) {
      show('Stock insuficiente. Puedes registrar la venta igual.', 'info')
    }

    setSaleLines(
      saleLines.map((line) => (line.id === id ? { ...line, quantity: newQuantity } : line))
    )
  }

  const handleEditPrice = (id: string, newPrice: number) => {
    if (newPrice < 0) return

    setSaleLines(
      saleLines.map((line) => {
        if (line.id === id) {
          return { ...line, price: newPrice, is_editing_price: false }
        }
        return line
      })
    )
  }

  const handleStartEditPrice = (id: string) => {
    setSaleLines(
      saleLines.map((line) => {
        if (line.id === id) {
          return { ...line, is_editing_price: true }
        }
        return line
      })
    )
  }

  const handleCancelEditPrice = (id: string) => {
    setSaleLines(
      saleLines.map((line) => {
        if (line.id === id) {
          return { ...line, is_editing_price: false }
        }
        return line
      })
    )
  }

  const handleStartEditQuantity = (id: string) => {
    setSaleLines(
      saleLines.map((line) =>
        line.id === id ? { ...line, is_editing_quantity: true } : line
      )
    )
  }

  const handleEditQuantity = (id: string, rawValue: string) => {
    const parsed = parseInt(rawValue, 10)
    const newQuantity = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
    const line = saleLines.find((l) => l.id === id)
    if (line && line.available_stock !== undefined && newQuantity > line.available_stock) {
      show('La cantidad supera el stock disponible. Podrás registrar la venta igual.', 'info')
    }
    setSaleLines(
      saleLines.map((l) =>
        l.id === id ? { ...l, quantity: newQuantity, is_editing_quantity: false } : l
      )
    )
  }

  const handleCancelEditQuantity = (id: string) => {
    setSaleLines(
      saleLines.map((line) =>
        line.id === id ? { ...line, is_editing_quantity: false } : line
      )
    )
  }

  const onSubmit = async (data: ManualSaleForm) => {
    if (saleLines.length === 0) {
      show('Agrega al menos una línea a la venta', 'error')
      return
    }
    if (!organizationId) {
      show('No hay organización seleccionada.', 'error')
      return
    }

    const isCreditSale = data.sale_condition === 'credito'
    if (!isCreditSale && !data.payment_method) {
      show('Selecciona un método de pago para venta al contado', 'error')
      return
    }

    const selectedMethod = paymentMethods.find((m) => m.key === data.payment_method)
    if (!isCreditSale && selectedMethod?.requires_cash_session && !currentCashSession) {
      show('No hay una sesión de caja abierta para esta sucursal', 'error')
      return
    }

    const subtotalBeforeDiscount = saleLines.reduce((sum, line) => sum + line.price * line.quantity, 0)
    const selectedRule = discountRules.find((rule) => rule.id === selectedDiscountRuleId)

    const calculateDiscountAmount = (
      kind: DiscountKind,
      value: number,
      baseAmount: number
    ): number => {
      if (!Number.isFinite(value) || value <= 0 || baseAmount <= 0) return 0
      if (kind === 'percentage') return Math.max(0, Math.min(baseAmount, (baseAmount * value) / 100))
      if (kind === 'fixed_amount') return Math.max(0, Math.min(baseAmount, value))
      // price_override: value = final desired total
      return Math.max(0, Math.min(baseAmount, baseAmount - value))
    }

    let discountTotal = 0
    let discountMetadata: Record<string, unknown> | null = null

    if (discountSource === 'manual') {
      if (!canApplyManualDiscount) {
        show('No tienes permisos para aplicar descuentos manuales.', 'error')
        return
      }
      const value = Number(manualDiscountValue)
      if (!Number.isFinite(value) || value <= 0) {
        show('Ingresa un valor válido para el descuento manual.', 'error')
        return
      }
      discountTotal = calculateDiscountAmount(manualDiscountKind, value, subtotalBeforeDiscount)
      discountMetadata = {
        source: 'manual',
        kind: manualDiscountKind,
        value,
        reason: manualDiscountReason || null,
      }
    } else if (discountSource === 'rule') {
      if (!selectedRule) {
        show('Selecciona una regla de descuento válida.', 'error')
        return
      }
      if (
        selectedRule.min_order_total !== null &&
        subtotalBeforeDiscount < Number(selectedRule.min_order_total)
      ) {
        show(
          `La regla requiere un mínimo de ${formatPrice(Number(selectedRule.min_order_total), settings)}.`,
          'error'
        )
        return
      }

      discountTotal = calculateDiscountAmount(selectedRule.kind, Number(selectedRule.value), subtotalBeforeDiscount)
      if (
        selectedRule.max_discount_amount !== null &&
        discountTotal > Number(selectedRule.max_discount_amount)
      ) {
        discountTotal = Number(selectedRule.max_discount_amount)
      }

      discountMetadata = {
        source: 'rule',
        rule_id: selectedRule.id,
        rule_name: selectedRule.name,
        kind: selectedRule.kind,
        value: selectedRule.value,
        min_order_total: selectedRule.min_order_total,
        max_discount_amount: selectedRule.max_discount_amount,
      }
    }

    const total = Math.max(subtotalBeforeDiscount - discountTotal, 0)
    setLoading(true)
    let orderId: string | undefined

    try {
      // Check if any product has insufficient stock - alert but allow
      const insufficientLines: { name: string; available: number; requested: number }[] = []
      for (const line of saleLines) {
        if (line.type === 'product' && line.product_id) {
          const availableStock = await getAvailableStock(line.product_id, line.variant_id)
          if (availableStock < line.quantity) {
            insufficientLines.push({
              name: line.product_name,
              available: availableStock,
              requested: line.quantity,
            })
          }
        }
      }
      if (insufficientLines.length > 0) {
        const msg = insufficientLines
          .map((l) => `"${l.name}": disponible ${l.available}, solicitado ${l.requested}`)
          .join('. ')
        if (!settings.allow_negative_stock) {
          show(`Stock insuficiente: ${msg}. No se permite vender con stock negativo.`, 'error')
          setLoading(false)
          return
        }
        const proceed = window.confirm(
          `Stock insuficiente:\n${msg}\n\n¿Registrar la venta igual? (El inventario quedará en negativo)`
        )
        if (!proceed) {
          setLoading(false)
          return
        }
      }

      // Resolve customer association for the order (customer_id + shipping snapshot)
      const normalizedRut = normalizeRut(data.customer_rut)
      const normalizedPhone = normalizePhone(data.customer_phone)
      const normalizedEmail = normalizeEmail(data.customer_email)
      const customerNameInput = (data.customer_name || '').trim()
      let resolvedCustomer: CustomerLite | null = linkedCustomer

      if (!resolvedCustomer) {
        resolvedCustomer = await findExistingCustomer(normalizedRut, normalizedPhone, normalizedEmail)
      }

      if (!resolvedCustomer && (normalizedPhone || normalizedEmail || customerNameInput)) {
        if (!normalizedPhone) {
          show('Sin teléfono no se puede crear un cliente nuevo. La venta quedará como cliente no vinculado.', 'info')
        } else {
          const createCustomerPayload = {
            organization_id: organizationId,
            full_name: customerNameInput || 'Cliente mostrador',
            email: normalizedEmail || null,
            phone: normalizedPhone,
            rut: normalizedRut || null,
            is_active: true,
          }

          const { data: createdCustomer, error: createCustomerError } = await supabase
            .from('customers')
            .insert(createCustomerPayload as any)
            .select('id, full_name, email, phone, rut')
            .single()

          if (createCustomerError) {
            const isDuplicatePhone = createCustomerError.message?.toLowerCase().includes('idx_customers_org_phone')
            const isDuplicateRut = createCustomerError.message?.toLowerCase().includes('idx_customers_org_rut')
            if (isDuplicatePhone || isDuplicateRut) {
              resolvedCustomer = await findExistingCustomer(normalizedRut, normalizedPhone, normalizedEmail)
            } else {
              throw createCustomerError
            }
          } else if (createdCustomer) {
            resolvedCustomer = createdCustomer as CustomerLite
            show(`Cliente creado y vinculado: ${resolvedCustomer.full_name}.`, 'success')
          }
        }
      } else if (resolvedCustomer) {
        show(`Cliente existente vinculado: ${resolvedCustomer.full_name}.`, 'info')
      }

      // Create order
      if (!organizationId) throw new Error('No hay organización seleccionada')

      const shippingFullName = customerNameInput || resolvedCustomer?.full_name || 'Cliente en tienda'
      const shippingEmail = normalizedEmail || resolvedCustomer?.email || undefined
      const shippingPhone = normalizedPhone || resolvedCustomer?.phone || ''
      const shippingRut = normalizedRut || resolvedCustomer?.rut || undefined

      const orderData: OrderInsert = {
        organization_id: organizationId,
        user_id: null,
        customer_id: resolvedCustomer?.id || null,
        total,
        subtotal_before_discount: subtotalBeforeDiscount,
        discount_total: discountTotal,
        tax_total: 0,
        discount_metadata: (discountMetadata as any) ?? null,
        status: 'delivered',
        created_at: new Date(saleDate).toISOString(),
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
        payment_method: data.payment_method ?? null,
        branch_id: branchId,
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData as any)
        .select()
        .single()

      if (orderError || !order) throw orderError || new Error('Failed to create order')
      orderId = (order as { id: string }).id

      await trackAuditAction({
        organizationId,
        tableName: 'orders',
        recordId: (order as { id: string }).id,
        action: 'INSERT',
        notes: 'Venta manual creada desde módulo de caja.',
        newData: {
          branch_id: branchId,
          customer_id: resolvedCustomer?.id || null,
          total,
          subtotal_before_discount: subtotalBeforeDiscount,
          discount_total: discountTotal,
          discount_metadata: discountMetadata,
          sale_condition: data.sale_condition,
          payment_method: data.payment_method ?? null,
          order_status: 'delivered',
          lines_count: saleLines.length,
          has_cash_session: Boolean(currentCashSession),
        },
      })

      // Create order items (only for product lines)
      const productLines = saleLines.filter((line) => line.type === 'product' && line.product_id)
      if (productLines.length > 0) {
        const orderItems = productLines.map((line) => ({
          order_id: (order as { id: string }).id,
          product_id: line.product_id!,
          variant_id: line.variant_id || null,
          quantity: line.quantity,
          price: line.price,
        }))

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems as any)

        if (itemsError) {
          if (
            itemsError.message?.includes('Insufficient stock') ||
            itemsError.message?.includes('Inventory entry not found')
          ) {
            show('Algunos productos ya no tienen stock disponible', 'error')
            setLoading(false)
            // La orden se creó aunque los items fallaron — refrescar la lista
            if (orderId) onSaleCreated()
            return
          }
          throw itemsError
        }
      }

      if (!isCreditSale) {
        const methodRequiresCash = paymentMethods.find((m) => m.key === data.payment_method)?.requires_cash_session
        const cashSessionId = methodRequiresCash && currentCashSession ? currentCashSession.id : null

        const paymentData: OrderPaymentInsert = {
          order_id: (order as { id: string }).id,
          payment_method: data.payment_method!,
          amount: total,
          cash_session_id: cashSessionId,
          notes: data.notes || null,
        }

        const { error: paymentError } = await supabase.from('order_payments').insert(paymentData as any)

        if (paymentError) {
          console.error('Error creating order payment:', paymentError)
        } else if (cashSessionId) {
          // Update expected_amount for the cash session (sum all payments with requires_cash_session)
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
                  .eq('payment_method', data.payment_method!)

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
          recordId: (order as { id: string }).id,
          action: 'INSERT',
          notes: 'Pago registrado para venta manual.',
          newData: {
            order_id: (order as { id: string }).id,
            payment_method: data.payment_method!,
            amount: total,
            cash_session_id: cashSessionId,
          },
        })
      }

      // Emitir CFE si está habilitado
      if (billerState.emitirCFE && billerConfig) {
        try {
          const { pdfBlob } = await emitirCFEDesdeOrden(billerConfig, {
            id: (order as { id: string }).id,
            organization_id: organizationId,
            payment_method: data.payment_method ?? null,
            items: saleLines.map((line) => ({
              product_id: line.product_id ?? line.id,
              variant_id: line.variant_id ?? null,
              quantity: line.quantity,
              price: line.price,
              name: line.product_name,
            })),
          }, billerState)
          descargarPDFBlob(pdfBlob, `cfe-${(order as { id: string }).id}.pdf`)
          show('CFE emitido correctamente', 'success')
        } catch (e) {
          show(e instanceof BillerApiError ? `CFE: ${e.message}` : 'Error al emitir el CFE (la venta fue registrada)', 'error')
        }
      }

      show(
        isCreditSale
          ? 'Venta a crédito registrada como completada (cobro pendiente).'
          : 'Venta al contado registrada exitosamente.',
        'success'
      )
      reset()
      setSaleLines([])
      setSearchTerm('')
      setNewLineDescription('')
      setNewLinePrice('')
      setNewLineQuantity('1')
      setDiscountSource('none')
      setManualDiscountKind('percentage')
      setManualDiscountValue('')
      setManualDiscountReason('')
      setSelectedDiscountRuleId('')
      setLinkedCustomer(null)
      setShowOptionalCustomerData(false)
      const nowReset = new Date(); nowReset.setSeconds(0, 0); setSaleDate(nowReset.toISOString().slice(0, 16))
      onSaleCreated()
      onClose()
    } catch (error) {
      console.error('Error creating manual sale:', error)
      show('Error al registrar la venta. Por favor, intenta nuevamente.', 'error')
      // Si la orden fue creada antes del error, igual refrescar la lista
      // La orden se creó antes del error — refrescar el listado
      if (orderId) {
        onSaleCreated()
      }
    } finally {
      setLoading(false)
    }
  }

  const subtotalBeforeDiscount = saleLines.reduce((sum, line) => sum + line.price * line.quantity, 0)
  const selectedRule = discountRules.find((rule) => rule.id === selectedDiscountRuleId)
  const effectiveDiscountTotal = (() => {
    if (discountSource === 'none') return 0
    if (discountSource === 'manual') {
      const value = Number(manualDiscountValue)
      if (!Number.isFinite(value) || value <= 0) return 0
      if (manualDiscountKind === 'percentage') return Math.max(0, Math.min(subtotalBeforeDiscount, (subtotalBeforeDiscount * value) / 100))
      if (manualDiscountKind === 'fixed_amount') return Math.max(0, Math.min(subtotalBeforeDiscount, value))
      return Math.max(0, Math.min(subtotalBeforeDiscount, subtotalBeforeDiscount - value))
    }
    if (!selectedRule) return 0
    if (selectedRule.min_order_total !== null && subtotalBeforeDiscount < Number(selectedRule.min_order_total)) return 0
    let amount = 0
    if (selectedRule.kind === 'percentage') amount = (subtotalBeforeDiscount * Number(selectedRule.value)) / 100
    else if (selectedRule.kind === 'fixed_amount') amount = Number(selectedRule.value)
    else amount = subtotalBeforeDiscount - Number(selectedRule.value)
    amount = Math.max(0, Math.min(subtotalBeforeDiscount, amount))
    if (selectedRule.max_discount_amount !== null && amount > Number(selectedRule.max_discount_amount)) {
      amount = Number(selectedRule.max_discount_amount)
    }
    return amount
  })()
  const total = Math.max(subtotalBeforeDiscount - effectiveDiscountTotal, 0)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white border-2 border-admin-300 ring-4 ring-admin-100">
      {/* ── Top bar ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 h-14 border-b border-admin-200 bg-admin-50 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <ShoppingCart className="h-5 w-5 text-admin-600 flex-shrink-0" />
          <span className="font-semibold text-gray-900 text-lg">Nueva Venta</span>
          {branches && branches.length > 1 && onBranchChange && (
            <select
              value={branchId}
              onChange={(e) => {
                const newBranchId = e.target.value
                setBranchId(newBranchId)
                onBranchChange(newBranchId)
                if (saleLines.length > 0) {
                  if (confirm('¿Cambiar de sucursal? Se limpiarán las líneas de venta.')) {
                    setSaleLines([])
                  } else {
                    setBranchId(branchId)
                  }
                }
              }}
              className="ml-2 text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-admin-500 hidden sm:block"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          {currentCashSession && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
              <DollarSign className="h-3 w-3" />
              Caja abierta
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-10 w-10 p-0 flex-shrink-0 hover:bg-admin-100 rounded-xl">
          <X className="h-6 w-6 text-gray-500" />
        </Button>
      </header>

      {/* ── Body ── */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0"
      >
        {/* ── LEFT: product area ── */}
        <div className="flex-shrink-0 md:flex-1 md:flex md:flex-col md:overflow-hidden md:min-h-0 p-4 space-y-3">

          {/* Branch selector on mobile */}
          {branches && branches.length > 1 && onBranchChange && (
            <div className="sm:hidden">
              <label className="block text-xs font-medium text-gray-700 mb-1">Sucursal</label>
              <select
                value={branchId}
                onChange={(e) => {
                  const newBranchId = e.target.value
                  setBranchId(newBranchId)
                  onBranchChange(newBranchId)
                  if (saleLines.length > 0) {
                    if (confirm('¿Cambiar de sucursal? Se limpiarán las líneas de venta.')) {
                      setSaleLines([])
                    } else {
                      setBranchId(branchId)
                    }
                  }
                }}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Product Search */}
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Buscar producto
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true) }}
                placeholder="Escribe para buscar productos..."
                className="pl-9"
              />
              {showSearchResults && searchResults.length > 0 && (
                <div
                  ref={searchResultsRef}
                  className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto"
                >
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleAddProduct(product)}
                      className="w-full px-4 py-2.5 text-left hover:bg-admin-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{capitalizeFirst(product.name)}</p>
                          <p className="text-xs text-gray-500">{formatPrice(product.price, settings)}</p>
                        </div>
                        <Plus className="h-4 w-4 text-admin-600 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Manual Line */}
          <div className="flex-shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Línea manual</p>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <Input
                type="text"
                value={newLineDescription}
                onChange={(e) => setNewLineDescription(e.target.value)}
                placeholder="Descripción del ítem"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddManualLine() } }}
                className="flex-1 min-w-0 text-sm py-1.5"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newLinePrice}
                onChange={(e) => setNewLinePrice(e.target.value)}
                placeholder="Precio"
                className="w-28 text-sm py-1.5"
              />
              <Input
                type="number"
                step="1"
                min="1"
                value={newLineQuantity}
                onChange={(e) => setNewLineQuantity(e.target.value)}
                placeholder="Cant."
                className="w-20 text-sm py-1.5"
              />
              <Button type="button" onClick={handleAddManualLine} size="sm" className="whitespace-nowrap">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar
              </Button>
            </div>
          </div>

          {/* Sale Lines Table */}
          <div className="flex-shrink-0 md:flex-1 md:overflow-y-auto min-h-[200px] max-h-[38vh] md:max-h-none rounded-xl border border-gray-200 overflow-hidden">
            {saleLines.length > 0 ? (
              <div className="overflow-x-auto h-full">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Producto
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                        Cantidad
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                        Precio
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                        Subtotal
                      </th>
                      <th className="px-3 py-2.5 w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {saleLines.map((line) => {
                      const hasNoStock =
                        line.type === 'product' &&
                        line.available_stock !== undefined &&
                        (line.available_stock === 0 || line.quantity > line.available_stock)
                      return (
                        <tr
                          key={line.id}
                          className={hasNoStock ? 'bg-red-50 border-l-4 border-l-red-400' : 'hover:bg-gray-50'}
                        >
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-gray-900">{line.product_name}</p>
                            {line.variant_name && (
                              <p className="text-xs text-gray-500">{line.variant_name}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {line.is_editing_quantity ? (
                              <div className="flex flex-col items-center gap-1">
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  defaultValue={line.quantity}
                                  autoFocus
                                  onBlur={(e) => handleEditQuantity(line.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEditQuantity(line.id, (e.target as HTMLInputElement).value)
                                    else if (e.key === 'Escape') handleCancelEditQuantity(line.id)
                                  }}
                                  className="w-20 text-center text-sm py-1"
                                />
                                {line.type === 'product' && line.available_stock !== undefined && (
                                  <span className="text-xs text-gray-400">
                                    Stock: {line.available_stock}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuantity(line.id, line.quantity - 1)}
                                    disabled={line.quantity <= 1}
                                    className="px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium leading-none"
                                  >
                                    −
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditQuantity(line.id)}
                                    className="px-3 py-1 text-sm font-semibold text-gray-900 border-x border-gray-200 hover:bg-admin-50 hover:text-admin-700 transition-colors min-w-[2rem]"
                                    title="Click para editar"
                                  >
                                    {line.quantity}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuantity(line.id, line.quantity + 1)}
                                    className="px-2 py-1 text-gray-500 hover:bg-gray-100 transition-colors text-sm font-medium leading-none"
                                  >
                                    +
                                  </button>
                                </div>
                                {line.type === 'product' && line.available_stock !== undefined && (() => {
                                  const remaining = line.available_stock - line.quantity
                                  if (line.available_stock === 0) {
                                    return <span className="text-xs font-medium text-red-500">Sin stock</span>
                                  }
                                  if (remaining < 0) {
                                    return <span className="text-xs font-medium text-red-500">Excede en {Math.abs(remaining)}</span>
                                  }
                                  if (remaining === 0) {
                                    return <span className="text-xs font-medium text-orange-500">Último</span>
                                  }
                                  return <span className="text-xs text-gray-400">Quedan {remaining}</span>
                                })()}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {line.is_editing_price ? (
                              <Input
                                type="number" step="0.01" min="0"
                                defaultValue={line.price}
                                onBlur={(e) => handleEditPrice(line.id, parseFloat(e.target.value) || line.price)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditPrice(line.id, parseFloat((e.target as HTMLInputElement).value) || line.price)
                                  else if (e.key === 'Escape') handleCancelEditPrice(line.id)
                                }}
                                className="w-24 text-right text-sm py-1 ml-auto"
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <span className="font-medium">{formatPrice(line.price, settings)}</span>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPrice(line.id)}
                                  className="text-gray-300 hover:text-admin-600 transition-colors"
                                  title="Editar precio"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="font-semibold text-gray-900">{formatPrice(line.price * line.quantity, settings)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(line.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-12 text-gray-400">
                <ShoppingCart className="h-12 w-12 mb-3 text-gray-200" />
                <p className="text-sm">Buscá un producto o agregá una línea manual</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: order panel ── */}
        <aside className="flex-shrink-0 md:w-80 xl:w-96 md:border-l md:flex md:flex-col md:overflow-hidden bg-gray-50">
          <div className="md:flex-1 md:overflow-y-auto p-4 space-y-4">

            {/* Cash session badge (mobile) */}
            {currentCashSession && (
              <div className="sm:hidden flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                <DollarSign className="h-3.5 w-3.5 flex-shrink-0" />
                Sesión de caja abierta — efectivo vinculado automáticamente
              </div>
            )}

            {/* Totals */}
            <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(subtotalBeforeDiscount, settings)}</span>
              </div>
              {effectiveDiscountTotal > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Descuento</span>
                  <span>−{formatPrice(effectiveDiscountTotal, settings)}</span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-gray-900 border-t pt-2 mt-1">
                <span className="text-base">Total</span>
                <span className="text-2xl text-admin-600">{formatPrice(total, settings)}</span>
              </div>
            </div>

            {/* Discount */}
            <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Descuento</p>
              <select
                value={discountSource}
                onChange={(e) => setDiscountSource(e.target.value as 'none' | 'manual' | 'rule')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
              >
                <option value="none">Sin descuento</option>
                <option value="manual" disabled={!canApplyManualDiscount}>
                  Manual {!canApplyManualDiscount ? '(solo admin/manager)' : ''}
                </option>
                <option value="rule">Regla de descuento</option>
              </select>

              {discountSource === 'manual' && (
                <div className="space-y-2">
                  <select
                    value={manualDiscountKind}
                    onChange={(e) => setManualDiscountKind(e.target.value as DiscountKind)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  >
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed_amount">Monto fijo</option>
                    <option value="price_override">Total final deseado</option>
                  </select>
                  <Input
                    type="number" step="0.01" min="0"
                    value={manualDiscountValue}
                    onChange={(e) => setManualDiscountValue(e.target.value)}
                    placeholder={manualDiscountKind === 'percentage' ? 'Ej: 10 (%)' : 'Ej: 500'}
                    className="text-sm"
                  />
                  <Input
                    value={manualDiscountReason}
                    onChange={(e) => setManualDiscountReason(e.target.value)}
                    placeholder="Motivo (opcional)"
                    className="text-sm"
                  />
                </div>
              )}

              {discountSource === 'rule' && (
                <select
                  value={selectedDiscountRuleId}
                  onChange={(e) => setSelectedDiscountRuleId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                >
                  <option value="">Seleccionar regla</option>
                  {discountRules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.name} · {rule.kind === 'percentage' ? `${rule.value}%` : formatPrice(rule.value, settings)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Sale Date */}
            <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha de la venta</p>
              <input
                type="datetime-local"
                value={saleDate}
                max={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
              />
              <p className="text-xs text-gray-400">Podés cargar ventas con fecha anterior.</p>
            </div>

            {/* Payment */}
            <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pago</p>
              <div className="space-y-2">
                <select
                  {...register('sale_condition')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                >
                  <option value="contado">Al contado</option>
                  <option value="credito">A crédito (cobro pendiente)</option>
                </select>
                <select
                  {...register('payment_method')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                >
                  {saleCondition === 'credito' && (
                    <option value="">Sin cobro inmediato</option>
                  )}
                  {paymentMethods.map((m) => (
                    <option
                      key={m.id} value={m.key}
                      disabled={saleCondition === 'contado' && m.requires_cash_session && !currentCashSession}
                    >
                      {m.name}
                      {saleCondition === 'contado' && m.requires_cash_session && !currentCashSession
                        ? ' (requiere caja abierta)' : ''}
                    </option>
                  ))}
                </select>
                {saleCondition === 'contado' && errors.payment_method && (
                  <p className="text-xs text-red-500">{errors.payment_method.message}</p>
                )}
              </div>
              {saleCondition === 'credito' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Se registrará como <span className="font-semibold">completada</span> con cobro pendiente.
                </div>
              )}
            </div>

            {/* Customer */}
            <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => void openCustomerPicker()} className="h-7 text-xs px-2">
                    <Users className="h-3.5 w-3.5 mr-1" />
                    Elegir
                  </Button>
                  {linkedCustomer && (
                    <Button
                      type="button" variant="outline"
                      onClick={() => {
                        setLinkedCustomer(null)
                        setValue('customer_name', '')
                        setValue('customer_email', '')
                        setValue('customer_phone', '')
                        setValue('customer_rut', '')
                      }}
                      className="h-7 text-xs px-2"
                    >
                      Quitar
                    </Button>
                  )}
                </div>
              </div>

              {linkedCustomer ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <p className="text-sm font-medium text-emerald-800">{linkedCustomer.full_name}</p>
                  <p className="text-xs text-emerald-600">
                    {[linkedCustomer.phone, linkedCustomer.rut ? `RUT ${linkedCustomer.rut}` : ''].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Venta mostrador (sin cliente asignado)</p>
              )}

              <Button
                type="button" variant="outline"
                onClick={() => setShowOptionalCustomerData((prev) => !prev)}
                className="h-7 text-xs w-full"
              >
                {showOptionalCustomerData ? (
                  <><ChevronUp className="h-3.5 w-3.5 mr-1" />Ocultar datos opcionales</>
                ) : (
                  <><ChevronDown className="h-3.5 w-3.5 mr-1" />Ingresar datos manualmente</>
                )}
              </Button>

              {showOptionalCustomerData && (
                <div className="space-y-2 pt-1">
                  <Input {...register('customer_name')} placeholder="Nombre" className="text-sm py-1.5" />
                  <Input {...register('customer_phone')} placeholder="Teléfono" className="text-sm py-1.5" />
                  <Input {...register('customer_email')} type="email" placeholder="Email" className="text-sm py-1.5" />
                  <Input {...register('customer_rut')} placeholder="RUT / documento fiscal" className="text-sm py-1.5" />
                  <Input {...register('notes')} placeholder="Notas" className="text-sm py-1.5" />
                </div>
              )}
            </div>
          </div>

          {/* CFE */}
          {billerConfig && (
            <div className="flex-shrink-0 px-4 pb-2">
              <BillerCheckoutPanel config={billerConfig} onChange={setBillerState} />
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex-shrink-0 border-t bg-white p-4 space-y-2">
            <Button
              type="submit"
              className="w-full"
              disabled={loading || saleLines.length === 0}
            >
              {loading ? 'Registrando...' : `Registrar Venta · ${formatPrice(total, settings)}`}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="w-full" disabled={loading}>
              Cancelar
            </Button>
          </div>
        </aside>
      </form>

      {/* Customer picker modal */}
      {isCustomerPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3">
          <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col">
            <CardHeader className="border-b pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserCheck className="h-5 w-5 text-admin-600" />
                  Elegir cliente
                </CardTitle>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                  onClick={() => setIsCustomerPickerOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">Buscar por nombre, teléfono, email o RUT.</p>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3 pt-4">
              <div className="flex gap-2">
                <Input
                  value={customerPickerSearch}
                  onChange={(e) => setCustomerPickerSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); void searchCustomersForPicker(customerPickerSearch) }
                  }}
                  placeholder="Ej: Juan, 099..., cliente@mail.com..."
                  className="text-sm"
                />
                <Button type="button" variant="outline" onClick={() => void searchCustomersForPicker(customerPickerSearch)}>
                  <Search className="h-4 w-4 mr-1" />
                  Buscar
                </Button>
              </div>
              {customerPickerLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">Cargando clientes...</div>
              ) : customerPickerResults.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">No se encontraron clientes.</div>
              ) : (
                <div className="space-y-2">
                  {customerPickerResults.map((customer) => (
                    <button
                      key={customer.id} type="button"
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-admin-300 hover:bg-admin-50 transition-colors"
                    >
                      <p className="text-sm font-semibold text-gray-900">{customer.full_name}</p>
                      <p className="text-xs text-gray-600">
                        {[customer.phone, customer.email, customer.rut ? `RUT ${customer.rut}` : ''].filter(Boolean).join(' · ') || 'Sin contacto'}
                      </p>
                      {customer.notes && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-1">{customer.notes}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
