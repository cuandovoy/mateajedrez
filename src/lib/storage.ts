import { supabase } from './supabase'

const PRODUCT_IMAGES_BUCKET = 'product-images'
const CATEGORY_IMAGES_BUCKET = 'category-images'

export async function uploadProductImage(file: File, productId?: string): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${productId || Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${fileName}`

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

export async function uploadCategoryImage(file: File, categoryId?: string): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${categoryId || Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${fileName}`

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

export async function deleteImage(url: string, bucket: 'product-images' | 'category-images'): Promise<void> {
  // Extract file path from URL
  const urlParts = url.split('/')
  const fileName = urlParts[urlParts.length - 1]

  const { error } = await supabase.storage
    .from(bucket)
    .remove([fileName])

  if (error) {
    throw error
  }
}
