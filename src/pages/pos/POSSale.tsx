import { POSBarcodeScanner } from '@/components/pos/POSBarcodeScanner'
import { POSCart } from '@/components/pos/POSCart'
import { POSCheckout } from '@/components/pos/POSCheckout'
import { POSCustomerSearch } from '@/components/pos/POSCustomerSearch'
import { POSHeader } from '@/components/pos/POSHeader'
import { POSProductSearch } from '@/components/pos/POSProductSearch'
import { useOrganization } from '@/hooks/useOrganization'
import { usePOSCart } from '@/hooks/usePOSCart'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import {
  createSaleFromCart,
  findProductByBarcode,
  getAvailableStock,
  type POSCustomer,
  type POSPaymentMethod,
} from '@/lib/posService'
import { formatPrice, getProductImageUrl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/store/toastStore'
import type { Branch, CashSession, Product } from '@/types'
import type { CheckoutBillerState } from '@/types/biller'
import { BillerApiError } from '@/lib/biller'
import { cn } from '@/lib/utils'
import { ShoppingCart } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export function POSSale() {
  const { branchId } = useParams<{ branchId: string }>()
  const { organizationId } = useOrganization()
  const { show } = useToastStore()
  const settings = useOrgSettings()
  const navigate = useNavigate()

  const { items, addItem, removeItem, updateQuantity, clearCart, subtotal, itemCount } = usePOSCart()

  const [branch, setBranch] = useState<Branch | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [openSession, setOpenSession] = useState<CashSession | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  const [activeTab, setActiveTab] = useState<'search' | 'cart'>('search')
  const [showScanner, setShowScanner] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!organizationId || !branchId) return
    setLoadingData(true)
    try {
      const [{ data: branchData }, { data: productsData }, { data: sessionData }] = await Promise.all([
        supabase.from('branches').select('*').eq('id', branchId).single(),
        supabase
          .from('products')
          .select('*, product_images(id, image_url, display_order, is_primary)')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('cash_sessions')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('branch_id', branchId)
          .is('closed_at', null)
          .maybeSingle(),
      ])
      setBranch(branchData as Branch)
      setProducts((productsData ?? []) as Product[])
      setOpenSession((sessionData ?? null) as CashSession | null)
    } catch (err) {
      console.error('Error loading POS sale data:', err)
      show('Error al cargar los datos de la sucursal', 'error')
    } finally {
      setLoadingData(false)
    }
  }, [organizationId, branchId, show])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Cambiar a tab carrito cuando se agrega un item
  const handleAddProduct = useCallback(
    ({
      product,
      variantId,
      variantName,
      price,
      stock,
    }: {
      product: Product
      variantId: string | null
      variantName: string | null
      price: number
      stock: number
    }) => {
      addItem({
        type: 'product',
        product_id: product.id,
        variant_id: variantId,
        product_name: product.name,
        variant_name: variantName,
        image_url: getProductImageUrl(product),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sku: (product as any).sku ?? null,
        price,
        quantity: 1,
        available_stock: stock,
      })
      show(`${product.name} agregado al carrito`, 'success')
    },
    [addItem, show]
  )

  const handleBarcodeDetected = useCallback(
    async (barcode: string) => {
      setShowScanner(false)
      if (!organizationId || !branchId) return
      try {
        const result = await findProductByBarcode(organizationId, barcode)
        if (!result) {
          show(`No se encontró ningún producto con el código "${barcode}"`, 'error')
          return
        }
        const product = products.find(
          (p) => p.id === result.product_id
        )
        if (!product) {
          show('Producto encontrado pero no disponible', 'error')
          return
        }
        const stock = await getAvailableStock(product.id, branchId, result.variant_id)
        handleAddProduct({ product, variantId: result.variant_id, variantName: null, price: product.price, stock })
        setActiveTab('cart')
      } catch {
        show('Error al buscar el código escaneado', 'error')
      }
    },
    [organizationId, branchId, products, handleAddProduct, show]
  )

  const handleConfirmSale = useCallback(
    async (params: {
      paymentMethod: string | null
      isCreditSale: boolean
      discountKind: 'percentage' | 'fixed' | null
      discountValue: number | null
      customer: POSCustomer | null
      billerState: CheckoutBillerState | null
      paymentMethods: POSPaymentMethod[]
    }) => {
      if (!organizationId || !branchId) return
      setCheckoutLoading(true)
      try {
        await createSaleFromCart({
          organizationId,
          branchId,
          items,
          paymentMethod: params.paymentMethod,
          isCreditSale: params.isCreditSale,
          cashSessionId: openSession?.id ?? null,
          discountKind: params.discountKind,
          discountValue: params.discountValue,
          customer: params.customer,
          billerState: params.billerState,
          billerConfig: null, // billerConfig se pasa desde POSCheckout internamente a emitirCFEDesdeOrden
          paymentMethods: params.paymentMethods,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          allowNegativeStock: (settings as any).allow_negative_stock !== false,
        })
        show(
          params.isCreditSale
            ? 'Venta a crédito registrada correctamente'
            : 'Venta registrada correctamente',
          'success'
        )
        clearCart()
        setShowCheckout(false)
        setSelectedCustomer(null)
        setActiveTab('search')
      } catch (err) {
        if (err instanceof BillerApiError) {
          show(`CFE: ${err.message} (la venta fue registrada)`, 'error')
          clearCart()
          setShowCheckout(false)
          setSelectedCustomer(null)
          setActiveTab('search')
        } else if (err instanceof Error) {
          show(err.message, 'error')
        } else {
          show('Error al registrar la venta', 'error')
        }
      } finally {
        setCheckoutLoading(false)
      }
    },
    [organizationId, branchId, items, openSession, settings.allow_negative_stock, show, clearCart]
  )

  if (!branchId) {
    navigate('/pos')
    return null
  }

  if (loadingData) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-admin-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <POSHeader
        branchName={branch?.name ?? '...'}
        hasOpenSession={Boolean(openSession)}
        itemCount={itemCount}
      />

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200 flex-shrink-0">
        {(['search', 'cart'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 h-10 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors',
              activeTab === tab
                ? 'border-admin-600 text-admin-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab === 'search' ? (
              'Productos'
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Carrito
                {itemCount > 0 && (
                  <span className="h-5 min-w-[20px] px-1 rounded-full bg-admin-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'search' ? (
          <div>
            <POSProductSearch
              products={products}
              branchId={branchId}
              onAdd={handleAddProduct}
              onOpenScanner={() => setShowScanner(true)}
            />
            {/* Indicador cuando hay items en el carrito */}
            {itemCount > 0 && (
              <div className="px-4 py-2 bg-admin-50 border-b border-admin-100">
                <button
                  onClick={() => setActiveTab('cart')}
                  className="text-xs font-medium text-admin-700"
                >
                  {itemCount} {itemCount === 1 ? 'producto' : 'productos'} en el carrito · Ver carrito →
                </button>
              </div>
            )}
          </div>
        ) : (
          <POSCart
            items={items}
            onRemove={removeItem}
            onUpdateQuantity={updateQuantity}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {itemCount > 0 ? (
            <>
              <p className="text-xs text-gray-500">
                {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
              </p>
              <p className="text-base font-bold text-gray-900">{formatPrice(subtotal, settings)}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Carrito vacío</p>
          )}
        </div>
        <button
          disabled={itemCount === 0}
          onClick={() => setShowCheckout(true)}
          className={cn(
            'h-11 px-6 rounded-xl text-sm font-semibold transition-all flex-shrink-0',
            itemCount > 0
              ? 'bg-admin-600 text-white hover:bg-admin-700 active:scale-[0.98]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          Cobrar
        </button>
      </div>

      {/* Overlays */}
      {showScanner && (
        <POSBarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showCheckout && (
        <POSCheckout
          items={items}
          subtotal={subtotal}
          onConfirm={handleConfirmSale}
          onClose={() => setShowCheckout(false)}
          onOpenCustomerSearch={() => setShowCustomerSearch(true)}
          selectedCustomer={selectedCustomer}
          loading={checkoutLoading}
        />
      )}

      {showCustomerSearch && (
        <POSCustomerSearch
          selected={selectedCustomer}
          onSelect={setSelectedCustomer}
          onClose={() => setShowCustomerSearch(false)}
        />
      )}
    </div>
  )
}
