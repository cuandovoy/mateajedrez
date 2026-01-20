import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/types'

export function Footer() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    let isMounted = true

    const fetchParentCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .is('parent_id', null)
          .order('name')

        if (error) throw error
        if (isMounted) {
          setCategories(data || [])
        }
      } catch (error) {
        // Ignore abort errors - they're expected in development mode with StrictMode
        if ((error instanceof Error && error.name !== 'AbortError') || !(error instanceof Error)) {
          if (isMounted) {
            console.error('Error fetching categories:', error)
          }
        }
      }
    }

    fetchParentCategories()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <footer className="bg-primary-200 text-white mt-auto">
      <div className="container-custom py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">Flormaria Soria González</h3>
            <p className="text-white">
              Tu tienda online de confianza con los mejores productos.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Categorías</h3>
            <ul className="space-y-2 text-gray-400">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      to={`/${category.slug}`}
                      className="text-white hover:text-gray-700 transition-colors"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-gray-500">Cargando categorías...</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Contacto</h3>
            <p className="text-white">
              Email: flormaria.soria@gmail.com
            </p>
            <p className="text-white">
              Teléfono: +598 98 257 909
            </p>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p className="text-white">&copy; {new Date().getFullYear()} Flormaria Soria González. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
