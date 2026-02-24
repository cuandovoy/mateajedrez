import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { CashSessionTable } from '@/components/admin/CashSessionTable'
import { CashSessionPayments } from '@/components/admin/CashSessionPayments'
import { ManualSaleForm } from '@/components/admin/ManualSaleForm'
import { SearchFilter } from '@/components/filters'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import {
  DollarSign,
  Edit,
  Filter,
  Grid3x3,
  List,
  Plus,
  Trash2,
  X,
  Building2,
  Calendar,
  TrendingUp,
  TrendingDown,
  Receipt,
  ShoppingCart,
} from 'lucide-react'
import { PlanGate } from '@/components/features/PlanGate'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { formatDateShort, formatPrice } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { CashSession, CashSessionInsert, CashSessionUpdate, Branch } from '@/types'

type ViewMode = 'grid' | 'list'

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
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<CashSession | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
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

  useEffect(() => {
    if (organizationId) {
      fetchBranches()
      fetchSessions()
    }
  }, [organizationId])

  const fetchBranches = async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, code')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setBranches((data || []) as Branch[])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchSessions = async () => {
    try {
      setLoading(true)
      // Fetch sessions and calculate expected_amount
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .order('opened_at', { ascending: false })

      if (error) throw error

      const sessionsData = (data || []) as CashSession[]

      // expected_amount = apertura + ventas efectivo (excluyendo órdenes canceladas/devoluciones)
      const sessionsWithExpected = await Promise.all(
        sessionsData.map(async (session) => {
          try {
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

              const validOrderIds = new Set(
                (ordersData || []).filter((o) => o.status !== 'cancelled').map((o) => o.id)
              )
              validPaymentsTotal = payments
                .filter((p: { order_id: string }) => validOrderIds.has(p.order_id))
                .reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
            }

            const expectedAmount = (session.opening_amount || 0) + validPaymentsTotal

            return {
              ...session,
              expected_amount: expectedAmount,
            } as CashSession
          } catch (error) {
            console.error('Error calculating expected amount:', error)
            return session
          }
        })
      )

      setSessions(sessionsWithExpected)
    } catch (error) {
      console.error('Error fetching cash sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSessions = useMemo(() => {
    let filtered = sessions

    if (selectedBranchFilter) {
      filtered = filtered.filter((session) => session.branch_id === selectedBranchFilter)
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter((session) => {
        const branch = branches.find((b) => b.id === session.branch_id)
        return (
          branch?.name.toLowerCase().includes(searchLower) ||
          branch?.code?.toLowerCase().includes(searchLower) ||
          session.notes?.toLowerCase().includes(searchLower)
        )
      })
    }

    return filtered
  }, [sessions, search, selectedBranchFilter, branches])

  const openSessions = useMemo(
    () => filteredSessions.filter((s) => !s.closed_at),
    [filteredSessions]
  )

  const closedSessions = useMemo(
    () => filteredSessions.filter((s) => s.closed_at),
    [filteredSessions]
  )

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
        alert('Ya existe una sesión abierta para esta sucursal. Por favor, ciérrala primero.')
        return
      }

      const sessionData: CashSessionInsert = {
        ...data,
        opened_by: user?.id || null,
        expected_amount: data.opening_amount, // Initially same as opening
        notes: data.notes || null,
      }

      const { error } = await supabase
        .from('cash_sessions')
        .insert(sessionData)

      if (error) throw error

      setIsModalOpen(false)
      resetOpen()
      fetchSessions()
    } catch (error) {
      console.error('Error opening cash session:', error)
      alert('Error al abrir la sesión de caja')
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

      setIsCloseModalOpen(false)
      setEditingSession(null)
      resetClose()
      fetchSessions()
    } catch (error) {
      console.error('Error closing cash session:', error)
      alert('Error al cerrar la sesión de caja')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta sesión de caja? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const { error } = await supabase.from('cash_sessions').delete().eq('id', id)

      if (error) throw error
      fetchSessions()
    } catch (error) {
      console.error('Error deleting cash session:', error)
      alert('Error al eliminar la sesión de caja')
    }
  }

  const handleNew = () => {
    setEditingSession(null)
    resetOpen()
    setIsModalOpen(true)
  }

  // Calculate totals
  const totals = useMemo(() => {
    const openTotal = openSessions.reduce((sum, s) => sum + s.opening_amount, 0)
    const closedTotal = closedSessions.reduce((sum, s) => sum + (s.closing_amount || 0), 0)
    const differenceTotal = closedSessions.reduce((sum, s) => sum + (s.difference || 0), 0)

    return {
      openTotal,
      closedTotal,
      differenceTotal,
    }
  }, [openSessions, closedSessions])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Caja</h1>
          <p className="text-gray-600 mt-2">Gestiona las sesiones de caja por sucursal</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${
                viewMode === 'list'
                  ? 'bg-admin-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Vista de lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${
                viewMode === 'grid'
                  ? 'bg-admin-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Vista de grilla"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (branches.length === 0) {
                alert('No hay sucursales disponibles')
                return
              }
              if (branches.length === 1) {
                setSelectedBranchForSale(branches[0].id)
                setIsManualSaleOpen(true)
              } else {
                // Show simple selection - use first branch with open session, or first branch
                const branchWithOpenSession = branches.find((b) =>
                  openSessions.some((s) => s.branch_id === b.id)
                )
                setSelectedBranchForSale(branchWithOpenSession?.id || branches[0].id)
                setIsManualSaleOpen(true)
              }
            }}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Nueva Venta
          </Button>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Abrir Caja
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Sesiones Abiertas</p>
                <p className="text-2xl font-bold text-gray-900">{openSessions.length}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-gray-500">Suma de aperturas de sesiones abiertas</p>
              <p className="text-lg font-semibold text-blue-600">{formatPrice(totals.openTotal, settings)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Sesiones Cerradas</p>
                <p className="text-2xl font-bold text-gray-900">{closedSessions.length}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <Calendar className="h-6 w-6 text-gray-600" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-gray-500">Total cerrado</p>
              <p className="text-lg font-semibold text-gray-700">{formatPrice(totals.closedTotal, settings)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Diferencia Total</p>
                <p
                  className={`text-2xl font-bold ${
                    totals.differenceTotal >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {totals.differenceTotal >= 0 ? (
                    <TrendingUp className="h-6 w-6 inline mr-1" />
                  ) : (
                    <TrendingDown className="h-6 w-6 inline mr-1" />
                  )}
                  {formatPrice(Math.abs(totals.differenceTotal), settings)}
                </p>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  totals.differenceTotal >= 0 ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {totals.differenceTotal >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-gray-500">
                {totals.differenceTotal >= 0 ? 'Sobrante' : 'Faltante'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Panel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Buscar sesiones..."
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sucursal</label>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(search || selectedBranchFilter) && (
            <div className="mt-4">
              <Button variant="outline" onClick={() => {
                setSearch('')
                setSelectedBranchFilter('')
              }}>
                Limpiar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Mostrando {filteredSessions.length} de {sessions.length} sesiones
        </p>
      </div>

      {/* Sessions Display */}
      {viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0">
            <CashSessionTable
              sessions={filteredSessions}
              branches={branches}
              onEdit={handleCloseSession}
              onDelete={handleDelete}
              onViewPayments={setViewingPaymentsSessionId}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map((session) => {
            const isOpen = !session.closed_at
            const difference = session.difference || 0
            const branch = branches.find((b) => b.id === session.branch_id)

            return (
              <Card key={session.id} className="relative">
                <CardContent className="p-6">
                  <div className="absolute top-4 right-4">
                    <ActionsMenu
                      actions={[
                        {
                          label: 'Ver Ventas',
                          icon: <Receipt className="h-4 w-4" />,
                          onClick: () => setViewingPaymentsSessionId(session.id),
                        },
                        {
                          label: isOpen ? 'Cerrar Sesión' : 'Ver Detalles',
                          icon: <Edit className="h-4 w-4" />,
                          onClick: () => (isOpen ? handleCloseSession(session) : handleCloseSession(session)),
                        },
                        {
                          label: 'Eliminar',
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => handleDelete(session.id),
                          variant: 'danger',
                        },
                      ]}
                    />
                  </div>
                  <div className="pr-8">
                    <div className="flex items-center space-x-2 mb-3">
                      <Building2 className="h-5 w-5 text-admin-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {branch?.name || 'Sucursal desconocida'}
                      </h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        {formatDateShort(session.opened_at, settings)}
                      </div>
                      <div className="flex items-center text-gray-600">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        Apertura: {formatPrice(session.opening_amount, settings)}
                      </div>
                      {session.closed_at && (
                        <>
                          {session.expected_amount !== null && (
                            <div className="text-xs text-gray-500">
                              Esperado: {formatPrice(session.expected_amount, settings)}
                            </div>
                          )}
                          {session.closing_amount !== null && (
                            <div className="text-sm font-medium text-gray-700">
                              Cierre: {formatPrice(session.closing_amount, settings)}
                            </div>
                          )}
                          {difference !== 0 && (
                            <div
                              className={`text-sm font-semibold ${
                                difference > 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              Diferencia: {difference > 0 ? '+' : ''}
                              {formatPrice(difference, settings)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="mt-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          isOpen
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {isOpen ? 'Abierta' : 'Cerrada'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {filteredSessions.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg mb-4">
            {search || selectedBranchFilter
              ? 'No se encontraron sesiones con los filtros aplicados'
              : 'No hay sesiones de caja disponibles'}
          </p>
          {(search || selectedBranchFilter) && (
            <Button variant="outline" onClick={() => {
              setSearch('')
              setSelectedBranchFilter('')
            }}>
              Limpiar búsqueda
            </Button>
          )}
        </div>
      )}

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
            fetchSessions()
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
