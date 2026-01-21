import { ActionsMenu } from '@/components/ui/ActionsMenu'
import type { Category } from '@/types'
import { Edit, Image as ImageIcon, Trash2 } from 'lucide-react'

interface CategoryTableProps {
  categories: Category[]
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
}

export function CategoryTable({
  categories,
  onEdit,
  onDelete,
}: CategoryTableProps) {
  // Separate parent categories and subcategories
  const parentCategories = categories.filter((cat) => !cat.parent_id)
  const subcategoriesMap = new Map<string, Category[]>()
  
  categories.forEach((cat) => {
    if (cat.parent_id) {
      if (!subcategoriesMap.has(cat.parent_id)) {
        subcategoriesMap.set(cat.parent_id, [])
      }
      subcategoriesMap.get(cat.parent_id)!.push(cat)
    }
  })

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No se encontraron categorías
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Imagen
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Slug
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Subcategorías
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {parentCategories.map((category) => {
            const subcategories = subcategoriesMap.get(category.id) || []
            return (
              <>
                {/* Parent Category Row */}
                <tr key={category.id} className="hover:bg-gray-50 transition-colors bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex-shrink-0 h-12 w-12">
                      {category.image_url ? (
                        <img
                          src={category.image_url}
                          alt={category.name}
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900">{category.name}</div>
                    {category.description && (
                      <div className="text-sm text-gray-500 line-clamp-1">
                        {category.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-mono">{category.slug}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      Principal
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {subcategories.length} {subcategories.length === 1 ? 'subcategoría' : 'subcategorías'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end">
                      <ActionsMenu
                        actions={[
                          {
                            label: 'Editar',
                            icon: <Edit className="h-4 w-4" />,
                            onClick: () => onEdit(category),
                          },
                          {
                            label: 'Eliminar',
                            icon: <Trash2 className="h-4 w-4" />,
                            onClick: () => onDelete(category.id),
                            variant: 'danger',
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
                {/* Subcategories Rows */}
                {subcategories.map((subcategory) => (
                  <tr key={subcategory.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 border-l-2 border-gray-300 mr-2"></div>
                        <div className="flex-shrink-0 h-10 w-10">
                          {subcategory.image_url ? (
                            <img
                              src={subcategory.image_url}
                              alt={subcategory.name}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 mr-2"></div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{subcategory.name}</div>
                          {subcategory.description && (
                            <div className="text-sm text-gray-500 line-clamp-1">
                              {subcategory.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">{subcategory.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        Subcategoría
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">—</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end">
                        <ActionsMenu
                          actions={[
                            {
                              label: 'Editar',
                              icon: <span className="text-gray-600">✏️</span>,
                              onClick: () => onEdit(subcategory),
                            },
                            {
                              label: 'Eliminar',
                              icon: <span className="text-red-600">🗑️</span>,
                              onClick: () => onDelete(subcategory.id),
                              variant: 'danger',
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
