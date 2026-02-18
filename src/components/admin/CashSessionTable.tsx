import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { formatDateShort, formatPrice, formatTime } from '@/lib/utils'
import { Building2, DollarSign, Edit, Trash2, Receipt } from 'lucide-react'
import type { CashSession } from '@/types'

interface CashSessionTableProps {
  sessions: CashSession[]
  branches: Array<{ id: string; name: string }>
  onEdit: (session: CashSession) => void
  onDelete: (id: string) => void
  onViewPayments?: (sessionId: string) => void
}

export function CashSessionTable({
  sessions,
  branches,
  onEdit,
  onDelete,
  onViewPayments,
}: CashSessionTableProps) {
  const settings = useOrgSettings()
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No se encontraron sesiones de caja
      </div>
    )
  }

  const getBranchName = (branchId: string) => {
    return branches.find((b) => b.id === branchId)?.name || 'Sucursal desconocida'
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sucursal
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Apertura
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cierre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Montos
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Diferencia
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sessions.map((session) => {
            const isOpen = !session.closed_at
            const difference = session.difference || 0
            const hasDifference = Math.abs(difference) > 0.01

            return (
              <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Building2 className="h-4 w-4 text-admin-600 mr-2" />
                    <span className="text-sm font-medium text-gray-900">
                      {getBranchName(session.branch_id)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatDateShort(session.opened_at, settings)}</div>
                  <div className="text-xs text-gray-500">{formatTime(session.opened_at, settings)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {session.closed_at ? (
                    <>
                      <div className="text-sm text-gray-900">{formatDateShort(session.closed_at, settings)}
                      </div>
                      <div className="text-xs text-gray-500">{formatTime(session.closed_at, settings)}</div>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">Abierta</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm space-y-1">
                    <div className="flex items-center text-gray-600">
                      <DollarSign className="h-3 w-3 mr-1" />
                      <span>Apertura: {formatPrice(session.opening_amount, settings)}</span>
                    </div>
                    {session.expected_amount !== null && (
                      <div className="text-xs text-gray-500">
                        Esperado: {formatPrice(session.expected_amount, settings)}
                      </div>
                    )}
                    {session.closing_amount !== null && (
                      <div className="text-xs text-gray-700 font-medium">
                        Cierre: {formatPrice(session.closing_amount, settings)}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {hasDifference ? (
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        difference > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {difference > 0 ? '+' : ''}
                      {formatPrice(difference, settings)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      isOpen
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {isOpen ? 'Abierta' : 'Cerrada'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end">
                    <ActionsMenu
                      actions={[
                        ...(onViewPayments
                          ? [
                              {
                                label: 'Ver Ventas',
                                icon: <Receipt className="h-4 w-4" />,
                                onClick: () => onViewPayments(session.id),
                              },
                            ]
                          : []),
                        {
                          label: isOpen ? 'Cerrar Sesión' : 'Ver Detalles',
                          icon: <Edit className="h-4 w-4" />,
                          onClick: () => onEdit(session),
                        },
                        {
                          label: 'Eliminar',
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => onDelete(session.id),
                          variant: 'danger',
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
