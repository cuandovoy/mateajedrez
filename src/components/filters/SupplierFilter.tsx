import type { Supplier } from '@/types'

interface SupplierFilterProps {
  suppliers: Supplier[]
  selectedSupplierId: string
  onSupplierChange: (supplierId: string) => void
  label?: string
  showAllOption?: boolean
}

export function SupplierFilter({
  suppliers,
  selectedSupplierId,
  onSupplierChange,
  label = 'Proveedor',
  showAllOption = true,
}: SupplierFilterProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <select
        value={selectedSupplierId}
        onChange={(e) => onSupplierChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
      >
        {showAllOption && <option value="">Todos los proveedores</option>}
        {suppliers
          .filter((supplier) => supplier.is_active)
          .map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
      </select>
    </div>
  )
}
