import { Mail, Phone, MapPin, Globe, Edit, Trash2 } from 'lucide-react'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { formatUruguayanPhone, formatUruguayanRUT } from '@/lib/uruguay-validators'
import type { Supplier } from '@/types'

interface SupplierTableProps {
  suppliers: Supplier[]
  onEdit: (supplier: Supplier) => void
  onDelete: (id: string) => void
}

export function SupplierTable({
  suppliers,
  onEdit,
  onDelete,
}: SupplierTableProps) {
  if (suppliers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No se encontraron proveedores
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contacto
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
          {suppliers.map((supplier) => (
            <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <div className="text-sm font-semibold text-gray-900">{supplier.name}</div>
                {supplier.contact_name && (
                  <div className="text-sm text-gray-500">Contacto: {supplier.contact_name}</div>
                )}
                {supplier.tax_id && (
                  <div className="text-xs text-gray-400 mt-1">RUT: {formatUruguayanRUT(supplier.tax_id)}</div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="space-y-1">
                  {supplier.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      {supplier.email}
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      {formatUruguayanPhone(supplier.phone)}
                    </div>
                  )}
                  {supplier.website && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Globe className="h-4 w-4 mr-2 text-gray-400" />
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-admin-600 hover:text-admin-700"
                      >
                        Sitio web
                      </a>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                {supplier.address || supplier.city || supplier.country ? (
                  <div className="flex items-start text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      {supplier.address && <div>{supplier.address}</div>}
                      {(supplier.city || supplier.country) && (
                        <div className="text-xs text-gray-500">
                          {[supplier.city, supplier.country, supplier.postal_code]
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
                    supplier.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {supplier.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end">
                  <ActionsMenu
                    actions={[
                      {
                        label: 'Editar',
                        icon: <Edit className="h-4 w-4" />,
                        onClick: () => onEdit(supplier),
                      },
                      {
                        label: 'Eliminar',
                        icon: <Trash2 className="h-4 w-4" />,
                        onClick: () => onDelete(supplier.id),
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
