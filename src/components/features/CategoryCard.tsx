import { Link } from 'react-router-dom'
import type { Category } from '@/types'
import { useEffect, useState } from 'react'

interface CategoryCardProps {
  category: Category
  fallbackImages?: string[]
}

const CATEGORY_FALLBACK_INTERVAL_MS = 4500

export function CategoryCard({ category, fallbackImages = [] }: CategoryCardProps) {
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
    <Link to={`/categories/${category.slug}`} className="block">
      <div className="group relative rounded-md overflow-hidden aspect-[4/3] cursor-pointer border border-brand-line hover:border-brand-algarrobo transition-colors duration-300">
        {/* Image layer */}
        {category.image_url ? (
          <img
            src={category.image_url}
            alt={category.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : shouldUseFallback ? (
          <div className="absolute inset-0">
            {fallbackImages.map((imageUrl, index) => (
              <img
                key={`${imageUrl}-${index}`}
                src={imageUrl}
                alt={`${category.name} ${index + 1}`}
                className="absolute inset-0 w-full h-full object-cover transition-all duration-1000 group-hover:scale-105"
                style={{ opacity: index === fallbackIndex ? 1 : 0 }}
              />
            ))}
            {fallbackImages.length > 1 && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                {fallbackImages.map((_, index) => (
                  <button
                    key={`dot-${index}`}
                    type="button"
                    // La card entera es un <Link> a la categoría — sin esto, tocar
                    // un punto navegaría en vez de solo cambiar la foto de fondo.
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setFallbackIndex(index)
                    }}
                    aria-label={`Ver imagen ${index + 1} de ${category.name}`}
                    className={`h-1 w-1 rounded-full transition-all ${index === fallbackIndex ? 'bg-white w-3' : 'bg-white/60'}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--org-primary-color, #705931) 20%, white), color-mix(in srgb, var(--org-secondary-color, #A9875A) 15%, white))' }}
          />
        )}

        {/* Gradient overlay — always present */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-tinta/80 via-brand-tinta/20 to-transparent" />

        {/* Hover brightening */}
        <div className="absolute inset-0 bg-brand-crema/0 group-hover:bg-brand-crema/5 transition-all duration-300" />

        {/* Text */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
          <h3
            className="text-brand-crema text-lg font-light uppercase"
            style={{ fontFamily: 'var(--org-font-heading, var(--org-font-family, sans-serif))', letterSpacing: '0.22em' }}
          >
            {category.name}
          </h3>
          {category.description && (
            <p className="text-brand-crema/80 text-sm mt-1 line-clamp-1">
              {category.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
