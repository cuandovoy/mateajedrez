import type { Category } from '@/types'

interface CategoryFilterProps {
  categories: Category[]
  selectedCategoryId: string
  onCategoryChange: (categoryId: string) => void
  label?: string
  showAllOption?: boolean
}

export function CategoryFilter({
  categories,
  selectedCategoryId,
  onCategoryChange,
  label = 'Categoría',
  showAllOption = true,
}: CategoryFilterProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <select
        value={selectedCategoryId}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
      >
        {showAllOption && <option value="">Todas las categorías</option>}
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  )
}
