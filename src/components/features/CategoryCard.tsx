import { Link } from 'react-router-dom'
import type { Category } from '@/types'

interface CategoryCardProps {
  category: Category
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link to={`/${category.slug}`}>
      <div className="group relative bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-105">
        <div className="aspect-w-16 aspect-h-9 bg-gray-200 overflow-hidden">
          {category.image_url ? (
            <img
              src={category.image_url}
              alt={category.name}
              className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-48 flex items-center justify-center text-gray-400 bg-primary-50">
              <span className="text-sm">Sin imagen</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-primary-200 transition-colors">
            {category.name}
          </h3>
          {category.description && (
            <p className="text-gray-600 text-sm line-clamp-2">
              {category.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
