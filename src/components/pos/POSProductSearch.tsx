import { useOrgSettings } from '@/hooks/useOrgSettings'
import { getAvailableStock } from '@/lib/posService'
import { cn, formatPrice, getProductImageUrl } from '@/lib/utils'
import type { Product } from '@/types'
import { Camera, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface POSProductSearchProps {
  products: Product[]
  branchId: string
  onAdd: (params: {
    product: Product
    variantId: string | null
    variantName: string | null
    price: number
    stock: number
  }) => void
  onOpenScanner: () => void
}

export function POSProductSearch({ products, branchId, onAdd, onOpenScanner }: POSProductSearchProps) {
  const settings = useOrgSettings()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!term.trim()) {
      setResults([])
      return
    }
    const lower = term.toLowerCase()
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((p as any).sku && (p as any).sku.toLowerCase().includes(lower))
    )
    setResults(filtered.slice(0, 10))
  }, [term, products])

  const handleSelect = async (product: Product) => {
    setLoading(true)
    try {
      const stock = await getAvailableStock(product.id, branchId)
      onAdd({
        product,
        variantId: null,
        variantName: null,
        price: product.price,
        stock,
      })
      setTerm('')
      setResults([])
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nombre o SKU..."
            className="w-full h-10 pl-9 pr-8 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-admin-500 focus:bg-white"
          />
          {term && (
            <button
              onClick={() => { setTerm(''); setResults([]) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={onOpenScanner}
          className="h-10 w-10 flex items-center justify-center bg-admin-50 border border-admin-200 rounded-lg text-admin-600 hover:bg-admin-100 flex-shrink-0 active:scale-95 transition-transform"
          title="Escanear código"
        >
          <Camera className="h-5 w-5" />
        </button>
      </div>

      {/* Resultados */}
      {results.length > 0 && (
        <div className="absolute left-0 right-0 z-10 bg-white border-b border-gray-200 shadow-md max-h-72 overflow-y-auto">
          {results.map((product) => {
            const imgUrl = getProductImageUrl(product)
            return (
              <button
                key={product.id}
                disabled={loading}
                onClick={() => handleSelect(product)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100 last:border-0 transition-colors',
                  loading && 'opacity-50 pointer-events-none'
                )}
              >
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={product.name}
                    className="h-10 w-10 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-gray-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(product as any).sku && (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    <p className="text-xs text-gray-400 truncate">{(product as any).sku}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-800 flex-shrink-0">
                  {formatPrice(product.price, settings)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
