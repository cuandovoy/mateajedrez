interface StatusFilterProps {
  value: 'all' | 'active' | 'inactive'
  onChange: (value: 'all' | 'active' | 'inactive') => void
  label?: string
}

export function StatusFilter({
  value,
  onChange,
  label = 'Estado',
}: StatusFilterProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'all' | 'active' | 'inactive')}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
      >
        <option value="all">Todos</option>
        <option value="active">Activos</option>
        <option value="inactive">Inactivos</option>
      </select>
    </div>
  )
}
