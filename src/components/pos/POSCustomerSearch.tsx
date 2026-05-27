import { useOrganization } from '@/hooks/useOrganization'
import { findCustomerByQuery, type POSCustomer } from '@/lib/posService'
import { cn } from '@/lib/utils'
import { Search, User, UserCheck, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface POSCustomerSearchProps {
  selected: POSCustomer | null
  onSelect: (customer: POSCustomer | null) => void
  onClose: () => void
}

export function POSCustomerSearch({ selected, onSelect, onClose }: POSCustomerSearchProps) {
  const { organizationId } = useOrganization()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<POSCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const search = useCallback(
    async (q: string) => {
      if (!organizationId || !q.trim()) { setResults([]); return }
      setLoading(true)
      try {
        const data = await findCustomerByQuery(organizationId, q)
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [organizationId]
  )

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-200 flex-shrink-0">
        <UserCheck className="h-5 w-5 text-admin-600" />
        <span className="font-semibold text-gray-800 text-sm flex-1">Buscar cliente</span>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Buscador */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Nombre, teléfono, email o RUT..."
            className="w-full h-10 pl-9 pr-8 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-admin-500 focus:bg-white"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Selected badge */}
      {selected && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">{selected.full_name}</span>
            {selected.phone && (
              <span className="text-xs text-green-600">{selected.phone}</span>
            )}
          </div>
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Quitar
          </button>
        </div>
      )}

      {/* Resultados */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-admin-600" />
          </div>
        )}

        {!loading && query.trim() && results.length === 0 && (
          <div className="flex flex-col items-center py-12 px-6">
            <User className="h-10 w-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">No se encontraron clientes</p>
          </div>
        )}

        {!loading && !query.trim() && !selected && (
          <div className="flex flex-col items-center py-12 px-6">
            <p className="text-sm text-gray-400">
              Escribí para buscar por nombre, teléfono, email o RUT
            </p>
          </div>
        )}

        {results.map((customer) => (
          <button
            key={customer.id}
            onClick={() => { onSelect(customer); onClose() }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors',
              selected?.id === customer.id && 'bg-admin-50'
            )}
          >
            <div className="h-9 w-9 rounded-full bg-admin-100 flex items-center justify-center flex-shrink-0">
              <span className="text-admin-700 text-sm font-semibold">
                {customer.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{customer.full_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {customer.phone && (
                  <span className="text-xs text-gray-500 truncate">{customer.phone}</span>
                )}
                {customer.rut && (
                  <span className="text-xs text-gray-400 truncate">RUT: {customer.rut}</span>
                )}
              </div>
            </div>
            {selected?.id === customer.id && (
              <UserCheck className="h-4 w-4 text-admin-600 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Continuar sin cliente */}
      <div className="px-4 py-4 border-t border-gray-200 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-full h-10 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 font-medium"
        >
          Continuar sin cliente
        </button>
      </div>
    </div>
  )
}
