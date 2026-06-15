import { useOrganization } from '@/hooks/useOrganization'
import { findCustomerByQuery, type POSCustomer } from '@/lib/posService'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Clock, Search, User, UserCheck, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const RECENT_KEY = (orgId: string) => `pos_recent_${orgId}`
const MAX_RECENT = 5

function saveRecent(orgId: string, customer: POSCustomer) {
  const key = RECENT_KEY(orgId)
  const prev: string[] = JSON.parse(localStorage.getItem(key) ?? '[]')
  const next = [customer.id, ...prev.filter((id) => id !== customer.id)].slice(0, MAX_RECENT)
  localStorage.setItem(key, JSON.stringify(next))
}

function loadRecentIds(orgId: string): string[] {
  return JSON.parse(localStorage.getItem(RECENT_KEY(orgId)) ?? '[]')
}

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
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [recentCustomers, setRecentCustomers] = useState<POSCustomer[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultButtonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [createMode, setCreateMode] = useState(false)
  const [createForm, setCreateForm] = useState({ full_name: '', phone: '', email: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [searchError, setSearchError] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Load recently selected customers from localStorage
  useEffect(() => {
    if (!organizationId) return
    const ids = loadRecentIds(organizationId)
    if (ids.length === 0) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('customers')
      .select('id, full_name, phone, email, rut')
      .eq('organization_id', organizationId)
      .in('id', ids)
      .then(({ data }: { data: POSCustomer[] | null }) => {
        if (!data) return
        const ordered = ids.map((id) => data.find((c) => c.id === id)).filter(Boolean) as POSCustomer[]
        setRecentCustomers(ordered)
      })
  }, [organizationId])

  // Reset keyboard focus when results change
  useEffect(() => { setFocusedIndex(-1) }, [results])

  // Scroll focused result into view
  useEffect(() => {
    if (focusedIndex >= 0) resultButtonRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex])

  const search = useCallback(
    async (q: string) => {
      if (!organizationId || !q.trim()) { setResults([]); return }
      setSearchError(false)
      setLoading(true)
      try {
        const data = await findCustomerByQuery(organizationId, q)
        setResults(data)
      } catch {
        setResults([])
        setSearchError(true)
      } finally {
        setLoading(false)
      }
    },
    [organizationId]
  )

  const handleChange = (value: string) => {
    setQuery(value)
    setCreateMode(false)
    setSearchError(false)
    setResults([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  const handleSelect = (customer: POSCustomer) => {
    if (organizationId) saveRecent(organizationId, customer)
    onSelect(customer)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { onClose(); return }
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault()
      handleSelect(results[focusedIndex])
    }
  }

  const handleCreate = async () => {
    if (!organizationId || !createForm.full_name.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('customers')
        .insert({
          organization_id: organizationId,
          full_name: createForm.full_name.trim(),
          phone: createForm.phone.trim() || null,
          email: createForm.email.trim() || null,
          is_active: true,
        })
        .select('id, full_name, phone, email, rut')
        .single()
      if (error) throw error
      onSelect(data as POSCustomer)
      onClose()
    } catch {
      setCreateError('No se pudo crear el cliente.')
    } finally {
      setCreating(false)
    }
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
            onKeyDown={handleKeyDown}
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

        {!loading && query.trim() && results.length === 0 && !createMode && (
          searchError ? (
            <div className="flex flex-col items-center py-10 px-6 gap-2">
              <p className="text-sm text-red-500">Error al buscar. Intentá de nuevo.</p>
              <button
                onClick={() => search(query)}
                className="text-xs text-admin-600 hover:text-admin-700 underline"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-10 px-6 gap-3">
              <User className="h-10 w-10 text-gray-200" />
              <p className="text-sm text-gray-500">No se encontraron clientes</p>
              <button
                onClick={() => { setCreateMode(true); setCreateForm(f => ({ ...f, full_name: query })) }}
                className="text-sm font-medium text-admin-600 hover:text-admin-700 underline underline-offset-2"
              >
                Crear "{query}"
              </button>
            </div>
          )
        )}

        {!loading && query.trim() && results.length === 0 && createMode && (
          <div className="px-4 py-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-800">Nuevo cliente</p>
              <button onClick={() => setCreateMode(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre *"
                value={createForm.full_name}
                onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                autoFocus
              />
              <input
                type="tel"
                placeholder="Teléfono"
                value={createForm.phone}
                onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
              />
              {createError && <p className="text-xs text-red-500">{createError}</p>}
              <button
                onClick={handleCreate}
                disabled={creating || !createForm.full_name.trim()}
                className="w-full h-10 bg-admin-600 text-white rounded-lg text-sm font-medium hover:bg-admin-700 disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear cliente'}
              </button>
            </div>
          </div>
        )}

        {!loading && !query.trim() && !selected && (
          recentCustomers.length > 0 ? (
            <div>
              <p className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                Recientes
              </p>
              {recentCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelect(customer)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-admin-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-admin-700 text-sm font-semibold">
                      {customer.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{customer.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {customer.phone && <span className="text-xs text-gray-500 truncate">{customer.phone}</span>}
                      {customer.rut && <span className="text-xs text-gray-400 truncate">RUT: {customer.rut}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 px-6">
              <p className="text-sm text-gray-400">
                Escribí para buscar por nombre, teléfono, email o RUT
              </p>
            </div>
          )
        )}

        {results.map((customer, index) => (
          <button
            key={customer.id}
            ref={(el) => { resultButtonRefs.current[index] = el }}
            onClick={() => handleSelect(customer)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors',
              selected?.id === customer.id && 'bg-admin-50',
              focusedIndex === index && 'bg-admin-50 ring-1 ring-inset ring-admin-300'
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
