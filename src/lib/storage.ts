import { supabase } from './supabase'

const PRODUCT_IMAGES_BUCKET = 'product-images'
const CATEGORY_IMAGES_BUCKET = 'category-images'
const ORGANIZATION_LOGOS_BUCKET = 'organization-logos'

/**
 * Upload product image. Path: {orgId}/{fileName} for multi-tenant isolation.
 */
export async function uploadProductImage(
  file: File,
  productId?: string,
  organizationId?: string
): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${productId || Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = organizationId ? `${organizationId}/${fileName}` : fileName

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * Upload category image. Path: {orgId}/{fileName} for multi-tenant isolation.
 */
export async function uploadCategoryImage(
  file: File,
  categoryId?: string,
  organizationId?: string
): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${categoryId || Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = organizationId ? `${organizationId}/${fileName}` : fileName

  const { error: uploadError } = await supabase.storage
    .from(CATEGORY_IMAGES_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage
    .from(CATEGORY_IMAGES_BUCKET)
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * Upload organization logo. Path: {orgId}/{fileName}
 */
export async function uploadOrganizationLogo(
  file: File,
  organizationId: string
): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `logo-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${organizationId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(ORGANIZATION_LOGOS_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage
    .from(ORGANIZATION_LOGOS_BUCKET)
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * Upload organization cover/hero image. Path: {orgId}/cover-{timestamp}.{ext}
 */
export async function uploadOrganizationCover(
  file: File,
  organizationId: string
): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `cover-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${organizationId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(ORGANIZATION_LOGOS_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage
    .from(ORGANIZATION_LOGOS_BUCKET)
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * Delete image from storage. Extracts path from URL (handles both org-prefixed and legacy paths).
 */
export async function deleteImage(
  url: string,
  bucket: 'product-images' | 'category-images' | 'organization-logos'
): Promise<void> {
  const urlParts = url.split('/')
  const bucketIndex = urlParts.findIndex((p) => p === bucket)
  const pathAfterBucket = bucketIndex >= 0 ? urlParts.slice(bucketIndex + 1).join('/') : urlParts[urlParts.length - 1]

  const { error } = await supabase.storage
    .from(bucket)
    .remove([pathAfterBucket])

  if (error) {
    throw error
  }
}

/**
 * Delete a product image file from Storage only if no `product_images` row (of any
 * product) still references the same `image_url`. Duplicar producto crea filas nuevas
 * de `product_images` que apuntan a la misma URL del producto original (sin volver a
 * subir el archivo), por lo que dos productos distintos pueden compartir el mismo
 * archivo físico. Llamar a esta función DESPUÉS de borrar/actualizar la fila de
 * `product_images` del producto actual en la base, para que el conteo refleje
 * correctamente si el archivo sigue en uso por otro producto.
 */
export async function deleteProductImageIfUnused(imageUrl: string): Promise<void> {
  const { count, error } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .eq('image_url', imageUrl)

  if (error) {
    throw error
  }

  if (count && count > 0) {
    // Otro producto todavía referencia este archivo — no tocar el Storage.
    return
  }

  await deleteImage(imageUrl, 'product-images')
}
