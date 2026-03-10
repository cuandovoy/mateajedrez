import { Link } from 'react-router-dom'
import type { Category } from '@/types'
import { useEffect, useState } from 'react'

interface CategoryCardProps {
  category: Category
  basePath?: string
  fallbackImages?: string[]
}

const CATEGORY_FALLBACK_INTERVAL_MS = 4500

export function CategoryCard({ category, basePath = '', fallbackImages = [] }: CategoryCardProps) {
  const [fallbackIndex, setFallbackIndex] = useState(0)
  const shouldUseFallback = !category.image_url && fallbackImages.length > 0

  useEffect(() => {
    setFallbackIndex(0)
  }, [category.id, fallbackImages.join('|')])

  useEffect(() => {
    if (!shouldUseFallback || fallbackImages.length <= 1) return
    const interval = window.setInterval(() => {
      setFallbackIndex((prev) => (prev + 1) % fallbackImages.length)
    }, CATEGORY_FALLBACK_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [fallbackImages.length, shouldUseFallback])

  return (
    <Link to={`${basePath}/categories/${category.slug}`}>
      <div className="group relative bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-xl hover:border-primary-300 transition-all duration-300 hover:scale-105">
        <div className="aspect-w-16 aspect-h-9 bg-gray-200 overflow-hidden">
          {category.image_url ? (
            <img
              src={category.image_url}
              alt={category.name}
              className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : shouldUseFallback ? (
            <div className="relative w-full h-48 overflow-hidden">
              {fallbackImages.map((imageUrl, index) => (
                <img
                  key={`${imageUrl}-${index}`}
                  src={imageUrl}
                  alt={`${category.name} ${index + 1}`}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
                  style={{ opacity: index === fallbackIndex ? 1 : 0 }}
                />
              ))}
              <div className="absolute inset-0 bg-black/10" />
              {fallbackImages.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                  {fallbackImages.map((_, index) => (
                    <span
                      key={`dot-${index}`}
                      className={`h-1.5 w-1.5 rounded-full ${index === fallbackIndex ? 'bg-white' : 'bg-white/55'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-48 flex items-center justify-center text-gray-400 bg-primary-50">
              <span className="text-sm">Sin imagen</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors duration-300">
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
