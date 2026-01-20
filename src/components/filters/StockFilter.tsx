interface StockFilterProps {
  value: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  onChange: (value: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock') => void
  label?: string
}

export function StockFilter({
  value,
  onChange,
  label = 'Stock',
}: StockFilterProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value as 'all' | 'in_stock' | 'low_stock' | 'out_of_stock')
        }
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
      >
        <option value="all">Todos</option>
        <option value="in_stock">En stock</option>
        <option value="low_stock">Stock bajo</option>
        <option value="out_of_stock">Sin stock</option>
      </select>
    </div>
  )
}
