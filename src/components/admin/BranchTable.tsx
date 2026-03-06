import { Edit, Trash2, MapPin, Phone, Mail, Building2 } from 'lucide-react'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import type { Branch } from '@/types'

interface BranchTableProps {
  branches: Branch[]
  onEdit: (branch: Branch) => void
  onDelete: (id: string) => void
}

export function BranchTable({ branches, onEdit, onDelete }: BranchTableProps) {
  const getBranchKindLabel = (kind: string | null | undefined) => {
    if (kind === 'warehouse') return 'Depósito'
    if (kind === 'seller') return 'Vendedor'
    return 'Tienda'
  }

  if (branches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No se encontraron sucursales
      </div>
    )
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
              Contacto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ubicación
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
          {branches.map((branch) => (
            <tr key={branch.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center">
                  <Building2 className="h-5 w-5 text-admin-600 mr-3 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{branch.name}</div>
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
                  {!branch.email && !branch.phone && (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="space-y-1">
                  <span className="text-sm text-gray-700">{getBranchKindLabel(branch.kind)}</span>
                  {branch.is_isolated_warehouse && (
                    <div className="text-xs text-gray-500">Aislado</div>
                  )}
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
                          {[branch.city, branch.country, branch.postal_code]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    branch.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {branch.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end">
                  <ActionsMenu
                    actions={[
                      {
                        label: 'Editar',
                        icon: <Edit className="h-4 w-4" />,
                        onClick: () => onEdit(branch),
                      },
                      {
                        label: 'Eliminar',
                        icon: <Trash2 className="h-4 w-4" />,
                        onClick: () => onDelete(branch.id),
                        variant: 'danger',
                      },
                    ]}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
