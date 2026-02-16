import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useOrganizationStore } from '@/store/organizationStore'
import { formatPrice } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import type { CashSession, Product } from '@/types'
import type { OrderInsert, OrderPaymentInsert } from '@/types/database.types'
import { zodResolver } from '@hookform/resolvers/zod'
import { DollarSign, Edit2, Minus, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
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
}

const manualSaleSchema = z.object({
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  payment_method: z.enum(['cash', 'transfer', 'mercadopago']),
  notes: z.string().optional(),
})

type ManualSaleForm = z.infer<typeof manualSaleSchema>

export function ManualSaleForm({
  branchId: initialBranchId,
  openCashSession: initialOpenCashSession,
  openCashSessions,
  branches,
  onClose,
  onSaleCreated,
  onBranchChange,
}: ManualSaleFormProps) {
  const { show } = useToastStore()
  const [branchId, setBranchId] = useState(initialBranchId)
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [saleLines, setSaleLines] = useState<SaleLine[]>([])
  const [loading, setLoading] = useState(false)
  const [newLineDescription, setNewLineDescription] = useState('')
  const [newLinePrice, setNewLinePrice] = useState('')
  const [newLineQuantity, setNewLineQuantity] = useState('1')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchResultsRef = useRef<HTMLDivElement>(null)

  // Get current cash session for the selected branch
  const currentCashSession = openCashSessions?.find((s) => s.branch_id === branchId) || null

  // Update branchId when it changes from parent
  useEffect(() => {
    setBranchId(initialBranchId)
  }, [initialBranchId])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ManualSaleForm>({
    resolver: zodResolver(manualSaleSchema),
    defaultValues: {
      payment_method: initialOpenCashSession ? 'cash' : 'transfer',
    },
  })

  // Update payment method default when cash session changes
  useEffect(() => {
    if (currentCashSession) {
      setValue('payment_method', 'cash')
    }
  }, [currentCashSession, setValue])

  const organizationId = useOrganizationStore((s) => s.currentOrganization?.id)

  useEffect(() => {
    if (organizationId) fetchProducts()
  }, [organizationId])

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

  const onSubmit = async (data: ManualSaleForm) => {
    if (saleLines.length === 0) {
      show('Agrega al menos una línea a la venta', 'error')
      return
    }

    if (data.payment_method === 'cash' && !currentCashSession) {
      show('No hay una sesión de caja abierta para esta sucursal', 'error')
      return
    }

    setLoading(true)

    try {
      const total = saleLines.reduce((sum, line) => sum + line.price * line.quantity, 0)

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
        const proceed = window.confirm(
          `Stock insuficiente:\n${msg}\n\n¿Registrar la venta igual? (El inventario quedará en negativo)`
        )
        if (!proceed) {
          setLoading(false)
          return
        }
      }

      // Create order (organization_id from current org)
      const { useOrganizationStore } = await import('@/store/organizationStore')
      const organizationId = useOrganizationStore.getState().currentOrganization?.id
      if (!organizationId) throw new Error('No hay organización seleccionada')

      const orderData: OrderInsert = {
        organization_id: organizationId,
        user_id: null,
        total,
        status: 'pending',
        shipping_address: {
          fullName: data.customer_name || 'Cliente en tienda',
          phone: data.customer_phone || '',
          address: 'Venta en tienda física',
          city: '',
          state: '',
          zipCode: '',
          country: '',
        },
        payment_method: data.payment_method,
        branch_id: branchId,
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData as any)
        .select()
        .single()

      if (orderError || !order) throw orderError || new Error('Failed to create order')

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
            return
          }
          throw itemsError
        }
      }

      // Create order_payment
      const cashSessionId = data.payment_method === 'cash' && currentCashSession ? currentCashSession.id : null

      const paymentData: OrderPaymentInsert = {
        order_id: (order as { id: string }).id,
        payment_method: data.payment_method,
        amount: total,
        cash_session_id: cashSessionId,
        notes: data.notes || null,
      }

      const { error: paymentError } = await supabase.from('order_payments').insert(paymentData as any)

      if (paymentError) {
        console.error('Error creating order payment:', paymentError)
      } else if (cashSessionId) {
        // Update expected_amount for the cash session
        const { data: sessionData } = await supabase
          .from('cash_sessions')
          .select('opening_amount')
          .eq('id', cashSessionId)
          .single()

        const { data: paymentsData } = await supabase
          .from('order_payments')
          .select('amount')
          .eq('cash_session_id', cashSessionId)
          .eq('payment_method', 'cash')

        if (sessionData && (sessionData as { opening_amount: number }).opening_amount !== undefined) {
          const cashPaymentsTotal = (paymentsData || []).reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
          const newExpectedAmount = ((sessionData as { opening_amount: number }).opening_amount || 0) + cashPaymentsTotal

          await supabase
            .from('cash_sessions')
            .update({ expected_amount: newExpectedAmount } as never)
            .eq('id', cashSessionId)
        }
      }

      show('Venta registrada exitosamente', 'success')
      reset()
      setSaleLines([])
      setSearchTerm('')
      setNewLineDescription('')
      setNewLinePrice('')
      setNewLineQuantity('1')
      onSaleCreated()
      onClose()
    } catch (error) {
      console.error('Error creating manual sale:', error)
      show('Error al registrar la venta. Por favor, intenta nuevamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const total = saleLines.reduce((sum, line) => sum + line.price * line.quantity, 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="w-full max-w-6xl h-[98vh] sm:h-[95vh] flex flex-col shadow-2xl">
        <CardHeader className="pb-3 border-b flex-shrink-0 px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl sm:text-2xl flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-admin-600" />
              <span>Nueva Venta</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col px-3 sm:px-6 py-4">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
            {/* Branch Selection */}
            {branches && branches.length > 1 && onBranchChange && (
              <div className="mb-3">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sucursal *</label>
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
                        return
                      }
                    }
                  }}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cash Session Info */}
            {currentCashSession && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-blue-900">
                    Sesión de caja abierta - Las ventas en efectivo se vincularán automáticamente
                  </p>
                </div>
              </div>
            )}

            {/* Product Search */}
            <div className="mb-3 flex-shrink-0">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Buscar Producto
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) {
                      setShowSearchResults(true)
                    }
                  }}
                  placeholder="Escribe para buscar productos..."
                  className="pl-9 text-sm py-2"
                />
                {showSearchResults && searchResults.length > 0 && (
                  <div
                    ref={searchResultsRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  >
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleAddProduct(product)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                            <p className="text-xs text-gray-600">{formatPrice(product.price)}</p>
                          </div>
                          <Plus className="h-4 w-4 text-admin-600 flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Manual Line Form */}
            <div className="mb-3 p-3 bg-gray-50 rounded-lg flex-shrink-0">
              <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Agregar Línea Manual</h3>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <Input
                    type="text"
                    value={newLineDescription}
                    onChange={(e) => setNewLineDescription(e.target.value)}
                    placeholder="Descripción"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddManualLine()
                      }
                    }}
                    className="text-sm py-1.5"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newLinePrice}
                    onChange={(e) => setNewLinePrice(e.target.value)}
                    placeholder="Precio"
                    className="text-sm py-1.5"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={newLineQuantity}
                    onChange={(e) => setNewLineQuantity(e.target.value)}
                    placeholder="Cant."
                    className="text-sm py-1.5"
                  />
                </div>
                <div className="col-span-12 sm:col-span-2">
                  <Button type="button" onClick={handleAddManualLine} className="w-full text-sm py-1.5 h-auto">
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>

            {/* Sale Lines Table */}
            <div className="flex-1 min-h-0 overflow-y-auto mb-3">
              {saleLines.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <tr>
                          <th className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Descripción
                          </th>
                          <th className="px-2 sm:px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase w-20 sm:w-24">
                            Cantidad
                          </th>
                          <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase w-24 sm:w-32">
                            Precio Unit.
                          </th>
                          <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase w-24 sm:w-32">
                            Subtotal
                          </th>
                          <th className="px-2 sm:px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase w-16 sm:w-20">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {saleLines.map((line) => {
                          const hasNoStock =
                            line.type === 'product' &&
                            line.available_stock !== undefined &&
                            (line.available_stock === 0 || line.quantity > line.available_stock)
                          return (
                          <tr
                            key={line.id}
                            className={hasNoStock ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-400' : 'hover:bg-gray-50'}
                          >
                            <td className="px-2 sm:px-3 py-2">
                              <div>
                                <p className="font-medium text-gray-900 text-xs sm:text-sm">{line.product_name}</p>
                                {line.variant_name && (
                                  <p className="text-xs text-gray-500">Variante: {line.variant_name}</p>
                                )}
                                {line.type === 'product' && line.available_stock !== undefined && (
                                  <p
                                    className={
                                      line.available_stock === 0 || line.quantity > line.available_stock
                                        ? 'text-xs font-medium text-red-600'
                                        : 'text-xs text-gray-400'
                                    }
                                  >
                                    Stock: {line.available_stock}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-2 sm:px-3 py-2 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateQuantity(line.id, line.quantity - 1)}
                                  disabled={line.quantity <= 1}
                                  className="h-6 w-6 p-0"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 sm:w-10 text-center font-medium text-xs sm:text-sm">{line.quantity}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateQuantity(line.id, line.quantity + 1)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-2 sm:px-3 py-2 text-right">
                              {line.is_editing_price ? (
                                <div className="flex items-center justify-end space-x-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={line.price}
                                    onBlur={(e) => {
                                      const newPrice = parseFloat(e.target.value) || line.price
                                      handleEditPrice(line.id, newPrice)
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const newPrice = parseFloat((e.target as HTMLInputElement).value) || line.price
                                        handleEditPrice(line.id, newPrice)
                                      } else if (e.key === 'Escape') {
                                        handleCancelEditPrice(line.id)
                                      }
                                    }}
                                    className="w-20 sm:w-24 text-right text-xs sm:text-sm py-1"
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center justify-end space-x-1">
                                  <span className="font-medium text-xs sm:text-sm">{formatPrice(line.price)}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditPrice(line.id)}
                                    className="text-gray-400 hover:text-admin-600 transition-colors"
                                    title="Editar precio"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-2 sm:px-3 py-2 text-right">
                              <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                                {formatPrice(line.price * line.quantity)}
                              </span>
                            </td>
                            <td className="px-2 sm:px-3 py-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveLine(line.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12 text-gray-500">
                  <ShoppingCart className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-gray-300" />
                  <p className="text-xs sm:text-sm">No hay líneas de venta. Busca productos o agrega líneas manuales.</p>
                </div>
              )}
            </div>

            {/* Total and Payment Info */}
            <div className="flex-shrink-0 border-t pt-3 space-y-3">
              <div className="flex items-center justify-between text-lg sm:text-xl font-bold text-gray-900">
                <span>Total:</span>
                <span className="text-xl sm:text-2xl text-admin-600">{formatPrice(total)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Método de Pago *
                  </label>
                  <select
                    {...register('payment_method')}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  >
                    <option value="cash" disabled={!currentCashSession}>
                      Efectivo {!currentCashSession && '(Requiere sesión de caja abierta)'}
                    </option>
                    <option value="transfer">Transferencia Bancaria</option>
                    <option value="mercadopago">Mercado Pago</option>
                  </select>
                  {errors.payment_method && (
                    <p className="text-xs text-red-500 mt-1">{errors.payment_method.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Cliente (opcional)
                  </label>
                  <Input {...register('customer_name')} placeholder="Nombre del cliente" className="text-sm py-1.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Teléfono (opcional)
                  </label>
                  <Input {...register('customer_phone')} placeholder="Teléfono" className="text-sm py-1.5" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional)
                  </label>
                  <Input {...register('notes')} placeholder="Notas adicionales..." className="text-sm py-1.5" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-2">
                <Button type="submit" className="flex-1 text-sm py-2" disabled={loading || saleLines.length === 0}>
                  {loading ? 'Registrando...' : 'Registrar Venta'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose} className="flex-1 text-sm py-2" disabled={loading}>
                  Cancelar
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
