import { useOrganization } from '@/hooks/useOrganization'
import { supabase } from '@/lib/supabase'
import { useOrganizationStore } from '@/store/organizationStore'
import type { Branch, CashSession } from '@/types'
import { ArrowLeft, Building2, ShoppingCart, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function POSHome() {
  const { organizationId } = useOrganization()
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization)
  const navigate = useNavigate()
  const [branches, setBranches] = useState<Branch[]>([])
  const [openSessions, setOpenSessions] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const [{ data: branchData }, { data: sessionData }] = await Promise.all([
        supabase
          .from('branches')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .eq('can_sell', true)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('cash_sessions')
          .select('*')
          .eq('organization_id', organizationId)
          .is('closed_at', null),
      ])
      setBranches((branchData ?? []) as Branch[])
      setOpenSessions((sessionData ?? []) as CashSession[])
    } catch (err) {
      console.error('Error loading POS home data:', err)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getSessionForBranch = (branchId: string) =>
    openSessions.find((s) => s.branch_id === branchId) ?? null

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-admin-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1c1d33] sticky top-0 z-20 px-4 h-14 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Admin
        </Link>
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-admin-400" />
          <span className="text-white font-semibold text-sm">Punto de Venta</span>
        </div>
        <div className="w-16" />
      </header>

      {/* Body */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full">
        {/* Org name */}
        <div className="mt-4 mb-6 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Organización</p>
          <p className="text-base font-semibold text-gray-800">{currentOrganization?.name}</p>
        </div>

        <p className="text-sm font-medium text-gray-600 mb-3">Seleccioná una sucursal para empezar</p>

        {branches.length === 0 ? (
          <div className="rounded-xl bg-white border border-gray-200 p-8 text-center">
            <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Sin sucursales activas</p>
            <p className="text-xs text-gray-500 mt-1">
              Activá al menos una sucursal con permiso de venta en Administración → Sucursales.
            </p>
            <Link
              to="/branches"
              className="inline-block mt-4 text-sm text-admin-600 font-medium hover:underline"
            >
              Ir a Sucursales
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {branches.map((branch) => {
              const session = getSessionForBranch(branch.id)
              return (
                <button
                  key={branch.id}
                  onClick={() => navigate(`/pos/sale/${branch.id}`)}
                  className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left flex items-center justify-between hover:border-admin-400 hover:shadow-sm transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-admin-50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-admin-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{branch.name}</p>
                      {session ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 mt-0.5">
                          <Zap className="h-3 w-3" />
                          Caja abierta
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sin caja abierta</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-admin-600 flex-shrink-0 ml-2">
                    <span className="text-xs font-medium hidden sm:inline">Vender</span>
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
