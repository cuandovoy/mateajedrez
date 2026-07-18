import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import type { ProductVariant, ProductVariantInsert, ProductVariantUpdate } from '@/types'
import type { VariantBatchResult } from '@/lib/variantGrid'

async function fetchVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Datos + mutaciones de la grilla editable de variantes (VariantGrid).
 * El batch save inserta todas las filas nuevas en un solo `insert` y aplica
 * los updates en paralelo — no hay transacción real entre ambos pasos porque
 * no existe una RPC dedicada; si esto empieza a fallar seguido en producción,
 * conviene mover el batch a una Edge Function para que sea atómico.
 */
export function useProductVariantGrid(productId: string, organizationId: string) {
  const queryClient = useQueryClient()

  const {
    data: variants = [],
    isPending: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.products.variants(organizationId, productId),
    queryFn: () => fetchVariants(productId),
    enabled: !!productId && !!organizationId,
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products.variants(organizationId, productId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all(organizationId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.store.productVariants(productId) })
  }, [queryClient, organizationId, productId])

  const saveBatchMutation = useMutation({
    mutationFn: async (batch: VariantBatchResult) => {
      if (batch.inserts.length > 0) {
        const { error } = await supabase
          .from('product_variants')
          .insert(batch.inserts as ProductVariantInsert[])
        if (error) throw error
      }

      if (batch.updates.length > 0) {
        await Promise.all(
          batch.updates.map(async ({ id, changes }) => {
            const { error } = await supabase
              .from('product_variants')
              .update(changes as ProductVariantUpdate)
              .eq('id', id)
            if (error) throw error
          })
        )
      }
    },
    onSuccess: invalidate,
  })

  const deleteVariantMutation = useMutation({
    mutationFn: async (variantId: string) => {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const saveBatch = useCallback(
    (batch: VariantBatchResult) => saveBatchMutation.mutateAsync(batch),
    [saveBatchMutation]
  )

  const deleteVariant = useCallback(
    (variantId: string) => deleteVariantMutation.mutateAsync(variantId),
    [deleteVariantMutation]
  )

  return {
    variants,
    loading,
    error: queryError ? (queryError as Error).message : null,
    saveBatch,
    isSaving: saveBatchMutation.isPending,
    deleteVariant,
    isDeleting: deleteVariantMutation.isPending,
    refetch,
  }
}
