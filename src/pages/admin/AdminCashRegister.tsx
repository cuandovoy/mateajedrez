import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useAdminBranches } from '@/hooks/useAdminBranches'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { CashSessionTable } from '@/components/admin/CashSessionTable'
import { CashSessionPayments } from '@/components/admin/CashSessionPayments'
import { ManualSaleForm } from '@/components/admin/ManualSaleForm'
import { SearchFilter } from '@/components/filters'
import {
  DollarSign,
  Plus,
  X,
  Building2,
  Calendar,
  ShoppingCart,
  Clock,
} from 'lucide-react'
import { PlanGate } from '@/components/features/PlanGate'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { usePermission } from '@/hooks/usePermission'
import { trackAuditAction } from '@/lib/audit'
import { formatDateShort, formatPrice } from '@/lib/utils'
import { PAGE_SIZE_ADMIN } from '@/lib/constants'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import type { CashSession, CashSessionInsert, CashSessionUpdate } from '@/types'


const cashSessionSchema = z.object({
  branch_id: z.string().min(1, 'La sucursal es requerida'),
  opening_amount: z.number().min(0, 'El monto de apertura debe ser mayor o igual a 0'),
  notes: z.string().optional(),
})

type CashSessionForm = z.infer<typeof cashSessionSchema>

const closeSessionSchema = z.object({
  closing_amount: z.number().min(0, 'El monto de cierre debe ser mayor o igual a 0'),
  notes: z.string().optional(),
})

type CloseSessionForm = z.infer<typeof closeSessionSchema>

function AdminCashRegisterContent() {
  const { organizationId } = useOrganization()
  const { user } = useAuthStore()
  const settings = useOrgSettings()
  const queryClient = useQueryClient()
  const { can, loading: permLoading } = usePermission()
  const { show } = useToastStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<CashSession | null>(null)
  const [search, setSearch] = useState('')
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('')
  const [viewingPaymentsSessionId, setViewingPaymentsSessionId] = useState<string | null>(null)
  const [isManualSaleOpen, setIsManualSaleOpen] = useState(false)
  const [selectedBranchForSale, setSelectedBranchForSale] = useState<string>('')

  const {
    register: registerOpen,
    handleSubmit: handleSubmitOpen,
    reset: resetOpen,
    formState: { errors: errorsOpen },
  } = useForm<CashSessionForm>({
    resolver: zodResolver(cashSessionSchema),
  })

  const {
    register: registerClose,
    handleSubmit: handleSubmitClose,
    reset: resetClose,
    formState: { errors: errorsClose },
    setValue: setCloseValue,
  } = useForm<CloseSessionForm>({
    resolver: zodResolver(closeSessionSchema),
  })

  const canManage = can('caja:gestionar')

  const { data: branches = [] } = useAdminBranches(organizationId)

  const sessionsKey = queryKeys.cashRegister.sessions(organizationId!, {})

  const { data: sessions = [], isPending: loading } = useQuery({
    queryKey: sessionsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId!)
        .order('opened_at', { ascending: false })
      if (error) throw error

      const sessionsData = (data || []) as CashSession[]

      // expected_amount = apertura + ventas efectivo (excluyendo órdenes canceladas/devoluciones)
      return Promise.all(
        sessionsData.map(async (session) => {
          const { data: paymentsData } = await supabase
            .from('order_payments')
            .select('amount, order_id')
            .eq('cash_session_id', session.id)
            .eq('payment_method', 'cash')

          const payments = paymentsData || []
          const orderIds = [...new Set(payments.map((p: { order_id: string }) => p.order_id))]

          let validPaymentsTotal = 0
          if (orderIds.length > 0) {
            const { data: ordersData } = await supabase
              .from('orders')
              .select('id, status')
              .in('id', orderIds)
              .eq('organization_id', organizationId!)

            const validOrderIds = new Set(
              (ordersData || []).filter((o) => o.status !== 'cancelled').map((o) => o.id)
            )
            validPaymentsTotal = payments
              .filter((p: { order_id: string }) => validOrderIds.has(p.order_id))
              .reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
          }

          return { ...session, expected_amount: (session.opening_amount || 0) + validPaymentsTotal } as CashSession
        })
      )
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  })

  const invalidateSessions = () => queryClient.invalidateQueries({ queryKey: sessionsKey })

  // Open sessions: always all, no filters
  const openSessions = useMemo(() => sessions.filter((s) => !s.closed_at), [sessions])

  // Closed sessions: apply search + branch filter for the history section
  const closedSessions = useMemo(() => {
    let filtered = sessions.filter((s) => s.closed_at)

    if (selectedBranchFilter) {
      filtered = filtered.filter((s) => s.branch_id === selectedBranchFilter)
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter((s) => {
        const branch = branches.find((b) => b.id === s.branch_id)
        return (
          branch?.name.toLowerCase().includes(searchLower) ||
          branch?.code?.toLowerCase().includes(searchLower) ||
          s.notes?.toLowerCase().includes(searchLower)
        )
      })
    }

    return filtered
  }, [sessions, search, selectedBranchFilter, branches])

  const onSubmitOpen = async (data: CashSessionForm) => {
    try {
      // Check if there's already an open session for this branch
      const { data: existingSession } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('branch_id', data.branch_id)
        .is('closed_at', null)
        .single()

      if (existingSession) {
        show('Ya existe una sesión abierta para esta sucursal. Por favor, ciérrala primero.', 'error')
        return
      }

      const sessionData: CashSessionInsert = {
        ...data,
        organization_id: organizationId!,
        opened_by: user?.id || null,
        expected_amount: data.opening_amount, // Initially same as opening
        notes: data.notes || null,
      }

      const { data: insertedSession, error } = await supabase
        .from('cash_sessions')
        .insert(sessionData)
        .select('id')
        .single()

      if (error) throw error
      if (insertedSession?.id) {
        await trackAuditAction({
          organizationId,
          tableName: 'cash_sessions',
          recordId: insertedSession.id,
          action: 'INSERT',
          notes: 'Apertura de sesión de caja.',
          newData: {
            branch_id: data.branch_id,
            opening_amount: data.opening_amount,
            notes: data.notes || null,
          },
        })
      }

      setIsModalOpen(false)
      resetOpen()
      invalidateSessions()
    } catch (error) {
      console.error('Error opening cash session:', error)
      show('Error al abrir la sesión de caja', 'error')
    }
  }

  const handleCloseSession = (session: CashSession) => {
    setEditingSession(session)
    setCloseValue('closing_amount', session.expected_amount || session.opening_amount)
    setIsCloseModalOpen(true)
  }

  const onSubmitClose = async (data: CloseSessionForm) => {
    if (!editingSession) return

    try {
      const expectedAmount = editingSession.expected_amount || editingSession.opening_amount
      const difference = data.closing_amount - expectedAmount

      const updateData: CashSessionUpdate = {
        closing_amount: data.closing_amount,
        difference,
        closed_by: user?.id || null,
        closed_at: new Date().toISOString(),
        notes: data.notes || editingSession.notes || null,
      }

      const { error } = await supabase
        .from('cash_sessions')
        .update(updateData)
        .eq('id', editingSession.id)

      if (error) throw error
      await trackAuditAction({
        organizationId,
        tableName: 'cash_sessions',
        recordId: editingSession.id,
        action: 'UPDATE',
        notes: 'Cierre de sesión de caja.',
        oldData: {
          opening_amount: editingSession.opening_amount,
          expected_amount: editingSession.expected_amount,
        },
        newData: {
          closing_amount: data.closing_amount,
          difference,
          closed_at: updateData.closed_at,
          notes: data.notes || editingSession.notes || null,
        },
      })

      setIsCloseModalOpen(false)
      setEditingSession(null)
      resetClose()
      invalidateSessions()
    } catch (error) {
      console.error('Error closing cash session:', error)
      show('Error al cerrar la sesión de caja', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta sesión de caja? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const sessionToDelete = sessions.find((session) => session.id === id)
      const { error } = await supabase.from('cash_sessions').delete().eq('id', id)

      if (error) throw error
      await trackAuditAction({
        organizationId,
        tableName: 'cash_sessions',
        recordId: id,
        action: 'DELETE',
        notes: 'Eliminación de sesión de caja.',
        oldData: sessionToDelete || null,
      })
      invalidateSessions()
    } catch (error) {
      console.error('Error deleting cash session:', error)
      show('Error al eliminar la sesión de caja', 'error')
    }
  }

  const handleNew = () => {
    setEditingSession(null)
    resetOpen()
    setIsModalOpen(true)
  }

  if (permLoading) return <SkeletonTable rows={PAGE_SIZE_ADMIN} />
  if (!can('caja:ver')) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Punto de Venta</h1>
          <p className="text-gray-500 mt-1 text-sm">Gestiona las cajas abiertas y el historial de sesiones</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && branches.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const defaultBranch = openSessions[0]?.branch_id || branches[0]?.id || ''
                setSelectedBranchForSale(defaultBranch)
                setIsManualSaleOpen(true)
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Nueva Venta
            </Button>
          )}
          {canManage && (
            <Button onClick={handleNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Abrir Caja
            </Button>
          )}
        </div>
      </div>

      {/* ── Cajas abiertas ahora ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
          <h2 className="text-lg font-semibold text-gray-800">
            Cajas abiertas ahora
          </h2>
          {openSessions.length > 0 && (
            <span className="ml-1 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {openSessions.length}
            </span>
          )}
        </div>

        {openSessions.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center px-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-gray-700">No hay cajas abiertas</p>
            <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
              Una sesión de caja te permite registrar ventas, cobros y hacer el cierre diario con el resumen de movimientos. Abrí una caja para comenzar.
            </p>
            {canManage && (
              <Button className="mt-6" onClick={handleNew} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Abrir Caja
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {openSessions.map((session) => {
              const branch = branches.find((b) => b.id === session.branch_id)
              return (
                <div
                  key={session.id}
                  className="rounded-xl border-2 border-green-200 bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-green-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex-shrink-0 bg-green-100 p-2 rounded-lg">
                        <Building2 className="h-5 w-5 text-green-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {branch?.name || 'Sucursal'}
                        </p>
                        {branch?.code && (
                          <p className="text-xs text-gray-400">{branch.code}</p>
                        )}
                      </div>
                    </div>
                    <span className="flex-shrink-0 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                      Abierta
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span>Apertura: {formatDateShort(session.opened_at, settings)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Fondo inicial</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {formatPrice(session.opening_amount, settings)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-3">
                        <p className="text-xs text-blue-600 mb-0.5">Esperado en caja</p>
                        <p className="text-sm font-semibold text-blue-700">
                          {session.expected_amount !== null
                            ? formatPrice(session.expected_amount, settings)
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div className="px-5 pb-5 flex flex-col gap-2">
                    {canManage && (
                      <Button
                        className="w-full"
                        onClick={() => {
                          setSelectedBranchForSale(session.branch_id)
                          setIsManualSaleOpen(true)
                        }}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Nueva Venta
                      </Button>
                    )}
                    <div className="flex gap-2">
                      {canManage && (
                        <Button
                          variant="outline"
                          className="flex-1 text-sm"
                          onClick={() => handleCloseSession(session)}
                        >
                          Cerrar Caja
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewingPaymentsSessionId(session.id)}
                        className="flex-1 text-sm text-admin-600 hover:text-admin-700 font-medium hover:underline"
                      >
                        Ver ventas
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Historial de sesiones cerradas ── */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            Historial de sesiones
          </h2>
          {/* Inline filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Buscar sesiones..."
            />
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 bg-white"
            >
              <option value="">Todas las sucursales</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {(search || selectedBranchFilter) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSelectedBranchFilter('') }}
                className="text-sm text-gray-500 hover:text-gray-700 underline self-center"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {closedSessions.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 py-10 text-center text-gray-400 text-sm">
            {search || selectedBranchFilter
              ? 'No se encontraron sesiones con esos filtros'
              : 'Aún no hay sesiones cerradas'}
          </div>
        ) : (
          <>
            {/* Desktop: tabla */}
            <div className="hidden md:block">
              <Card>
                <CardContent className="p-0">
                  <CashSessionTable
                    sessions={closedSessions}
                    branches={branches}
                    onEdit={handleCloseSession}
                    onDelete={handleDelete}
                    onViewPayments={setViewingPaymentsSessionId}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Mobile: mini-cards */}
            <div className="md:hidden space-y-3">
              {closedSessions.map((session) => {
                const branch = branches.find((b) => b.id === session.branch_id)
                const difference = session.difference || 0
                return (
                  <div key={session.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900 text-sm">
                          {branch?.name || 'Sucursal'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{formatDateShort(session.opened_at, settings)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="text-gray-400">Apertura</p>
                        <p className="font-semibold text-gray-700">{formatPrice(session.opening_amount, settings)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Cierre</p>
                        <p className="font-semibold text-gray-700">
                          {session.closing_amount !== null ? formatPrice(session.closing_amount, settings) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Diferencia</p>
                        <p className={`font-semibold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {difference >= 0 ? '+' : ''}{formatPrice(difference, settings)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setViewingPaymentsSessionId(session.id)}
                        className="text-xs text-admin-600 hover:underline"
                      >
                        Ver ventas
                      </button>
                      {canManage && (
                        <>
                          <span className="text-gray-300">·</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(session.id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Open Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Abrir Sesión de Caja</CardTitle>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    resetOpen()
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-6 py-6">
              <form onSubmit={handleSubmitOpen(onSubmitOpen)} className="space-y-6">
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                    Información de Apertura
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sucursal *
                      </label>
                      <select
                        {...registerOpen('branch_id')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                      >
                        <option value="">Seleccionar sucursal</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name} {branch.code && `(${branch.code})`}
                          </option>
                        ))}
                      </select>
                      {errorsOpen.branch_id && (
                        <p className="text-xs text-red-500 mt-1">{errorsOpen.branch_id.message}</p>
                      )}
                    </div>
                    <Input
                      label="Monto de Apertura *"
                      type="number"
                      step="0.01"
                      min="0"
                      {...registerOpen('opening_amount', { valueAsNumber: true })}
                      error={errorsOpen.opening_amount?.message}
                      placeholder="0.00"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                      <textarea
                        {...registerOpen('notes')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                        rows={3}
                        placeholder="Notas sobre la apertura de caja..."
                      />
                    </div>
                  </div>
                </section>

                <div className="flex space-x-4 pt-4 border-t">
                  <Button type="submit" className="flex-1">
                    Abrir Caja
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false)
                      resetOpen()
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Close Session Modal */}
      {isCloseModalOpen && editingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Cerrar Sesión de Caja</CardTitle>
                <button
                  type="button"
                  onClick={() => {
                    setIsCloseModalOpen(false)
                    setEditingSession(null)
                    resetClose()
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-6 py-6">
              <form onSubmit={handleSubmitClose(onSubmitClose)} className="space-y-6">
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                    Información de Cierre
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Monto de Apertura:</span>
                        <span className="font-semibold">{formatPrice(editingSession.opening_amount, settings)}</span>
                      </div>
                      {editingSession.expected_amount !== null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Monto Esperado:</span>
                          <span className="font-semibold text-blue-600">
                            {formatPrice(editingSession.expected_amount, settings)}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 pt-1 border-t border-gray-200">
                        Esperado = Apertura + ventas en efectivo (sin contar órdenes canceladas/devoluciones)
                      </p>
                    </div>
                    <Input
                      label="Monto de Cierre (Efectivo Contado) *"
                      type="number"
                      step="0.01"
                      min="0"
                      {...registerClose('closing_amount', { valueAsNumber: true })}
                      error={errorsClose.closing_amount?.message}
                      placeholder="0.00"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                      <textarea
                        {...registerClose('notes')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                        rows={3}
                        placeholder="Notas sobre el cierre de caja..."
                        defaultValue={editingSession.notes || ''}
                      />
                    </div>
                  </div>
                </section>

                <div className="flex space-x-4 pt-4 border-t">
                  <Button type="submit" className="flex-1">
                    Cerrar Sesión
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCloseModalOpen(false)
                      setEditingSession(null)
                      resetClose()
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Session Payments Modal */}
      {viewingPaymentsSessionId && (
        <CashSessionPayments
          sessionId={viewingPaymentsSessionId}
          onClose={() => setViewingPaymentsSessionId(null)}
        />
      )}

      {/* Manual Sale Form Modal */}
      {isManualSaleOpen && selectedBranchForSale && (
        <ManualSaleForm
          branchId={selectedBranchForSale}
          openCashSession={openSessions.find((s) => s.branch_id === selectedBranchForSale) || null}
          openCashSessions={openSessions}
          branches={branches}
          onClose={() => {
            setIsManualSaleOpen(false)
            setSelectedBranchForSale('')
          }}
          onSaleCreated={() => {
            invalidateSessions()
          }}
          onBranchChange={(newBranchId) => {
            setSelectedBranchForSale(newBranchId)
          }}
        />
      )}
    </div>
  )
}

export function AdminCashRegister() {
  const { canUseFeature } = usePlanLimits()

  return (
    <PlanGate feature="cash_register" canUse={canUseFeature('cash_register')}>
      <AdminCashRegisterContent />
    </PlanGate>
  )
}
