import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
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

export function usePublicCategories(organizationId: string) {
  return useQuery({
    queryKey: queryKeys.store.categories(organizationId),
    queryFn: () => fetchPublicCategories(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })
}

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
