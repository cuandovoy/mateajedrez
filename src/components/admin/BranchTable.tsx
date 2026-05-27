import { Edit, MapPin, Phone, Mail, Building2, Trash2, RotateCcw, Clock } from 'lucide-react'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Branch } from '@/types'

interface BranchTableProps {
  branches: Branch[]
  onEdit: (branch: Branch) => void
  onSoftDelete: (id: string) => void
  onRestore: (id: string) => void
}

function StatusBadge({ branch }: { branch: Branch }) {
  if (branch.deleted_at) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 ring-1 ring-red-200">
        <Clock className="h-3 w-3" />
        Eliminación pendiente
      </span>
    )
  }
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${branch.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
      {branch.is_active ? 'Activa' : 'Inactiva'}
    </span>
  )
}

function getBranchActions(
  branch: Branch,
  onEdit: (b: Branch) => void,
  onSoftDelete: (id: string) => void,
  onRestore: (id: string) => void,
) {
  if (branch.deleted_at) {
    return [
      {
        label: 'Restaurar',
        icon: <RotateCcw className="h-4 w-4" />,
        onClick: () => onRestore(branch.id),
      },
    ]
  }
  return [
    {
      label: 'Editar',
      icon: <Edit className="h-4 w-4" />,
      onClick: () => onEdit(branch),
    },
    {
      label: 'Marcar para eliminar',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => onSoftDelete(branch.id),
      variant: 'danger' as const,
    },
  ]
}

function getBranchKindLabel(kind: string | null | undefined) {
  if (kind === 'warehouse') return 'Depósito'
  if (kind === 'seller') return 'Vendedor'
  return 'Tienda'
}

export function BranchTable({ branches, onEdit, onSoftDelete, onRestore }: BranchTableProps) {
  if (branches.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No se encontraron sucursales"
        description="Creá tu primera sucursal para empezar a gestionar tu inventario y ventas."
      />
    )
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden divide-y">
        {branches.map((branch) => (
          <div key={branch.id} className={`p-4 space-y-2 ${branch.deleted_at ? 'bg-red-50/30' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <Building2 className={`h-5 w-5 shrink-0 ${branch.deleted_at ? 'text-red-400' : 'text-admin-600'}`} />
                <div>
                  <p className={`font-semibold ${branch.deleted_at ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {branch.name}
                  </p>
                  {branch.code && <p className="text-xs text-gray-500">Código: {branch.code}</p>}
                  <p className="text-xs text-gray-500">
                    {getBranchKindLabel(branch.kind)}
                    {branch.is_isolated_warehouse ? ' · Aislado' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge branch={branch} />
                <ActionsMenu actions={getBranchActions(branch, onEdit, onSoftDelete, onRestore)} />
              </div>
            </div>
            <div className="space-y-1">
              {branch.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  {branch.email}
                </div>
              )}
              {branch.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  {branch.phone}
                </div>
              )}
              {(branch.city || branch.country) && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  {[branch.address, branch.city, branch.country].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {branches.map((branch) => (
              <tr key={branch.id} className={`transition-colors ${branch.deleted_at ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-gray-50'}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <Building2 className={`h-5 w-5 mr-3 flex-shrink-0 ${branch.deleted_at ? 'text-red-400' : 'text-admin-600'}`} />
                    <div>
                      <div className={`text-sm font-semibold ${branch.deleted_at ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {branch.name}
                      </div>
                      {branch.code && (
                        <div className="text-xs text-gray-500">Código: {branch.code}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    {branch.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        {branch.email}
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {branch.phone}
                      </div>
                    )}
                    {!branch.email && !branch.phone && <span className="text-sm text-gray-400">—</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <span className="text-sm text-gray-700">{getBranchKindLabel(branch.kind)}</span>
                    {branch.is_isolated_warehouse && <div className="text-xs text-gray-500">Aislado</div>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {branch.address || branch.city || branch.country ? (
                    <div className="flex items-start text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        {branch.address && <div>{branch.address}</div>}
                        {(branch.city || branch.country) && (
                          <div className="text-xs text-gray-500">
                            {[branch.city, branch.country, branch.postal_code].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge branch={branch} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <ActionsMenu actions={getBranchActions(branch, onEdit, onSoftDelete, onRestore)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
