import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/types'

export interface CategoryWithSubcategories {
  value: string
  label: string
  subcategories?: Array<{ value: string; label: string }>
}

async function fetchPublicCategories(organizationId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name')

  if (error) throw error
  return data ?? []
}

/**
 * Hook para obtener categorías públicas de una organización.
 * Cache key incluye organizationId para separar correctamente entre tenants.
 * staleTime: 5 min — las categorías no cambian frecuentemente.
 */
export function usePublicCategories(organizationId: string) {
  return useQuery({
    queryKey: ['public-categories', organizationId],
    queryFn: () => fetchPublicCategories(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Versión del hook que devuelve las categorías ya estructuradas
 * para el dropdown del header (padres + subcategorías anidadas).
 */
export function usePublicCategoriesForMenu(organizationId: string) {
  const query = usePublicCategories(organizationId)

  const categoriesWithSubs: CategoryWithSubcategories[] = []

  if (query.data) {
    const parentCategories = query.data.filter((cat) => !cat.parent_id)
    const subcategoriesMap = new Map<string, Category[]>()

    query.data.forEach((cat) => {
      if (cat.parent_id) {
        if (!subcategoriesMap.has(cat.parent_id)) {
          subcategoriesMap.set(cat.parent_id, [])
        }
        subcategoriesMap.get(cat.parent_id)!.push(cat)
      }
    })

    parentCategories.forEach((parent) => {
      const subs = subcategoriesMap.get(parent.id) ?? []
      categoriesWithSubs.push({
        value: parent.slug,
        label: parent.name,
        subcategories: subs.length > 0
          ? subs.map((sub) => ({ value: sub.slug, label: sub.name }))
          : undefined,
      })
    })
  }

  return { ...query, categoriesWithSubs }
}
