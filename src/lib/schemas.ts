import { z } from 'zod'
import { validateUruguayanRUT, validateUruguayanPhone } from './uruguay-validators'

export const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  price: z.number().min(0, 'El precio debe ser mayor a 0'),
  stock: z.number().min(0, 'El stock debe ser mayor o igual a 0'),
  category_id: z.string().optional(),
  sku: z.string().min(1, 'El SKU es requerido'),
  is_active: z.boolean().default(true),
  discount_percentage: z.number().min(0).max(100).nullable().optional(),
  discount_expires_at: z.string().nullable().optional(),
})

export const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  slug: z.string().min(1, 'El slug es requerido'),
  image_url: z.string().url().optional().or(z.literal('')),
  parent_id: z.string().optional().or(z.literal('')),
})

export const branchSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  code: z.string().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('Uruguay'),
  postal_code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  kind: z.enum(['store', 'warehouse', 'seller']).default('store'),
  can_dispatch: z.boolean().default(true),
  can_receive: z.boolean().default(true),
  can_sell: z.boolean().default(true),
  is_isolated_warehouse: z.boolean().default(false),
  notes: z.string().optional(),
})

export const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  contact_name: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z
    .string()
    .min(1, 'El teléfono es requerido')
    .refine(validateUruguayanPhone, {
      message: 'Teléfono inválido. Formato: +598 X XXX XXXX o 0X XXXX XXXX (8 dígitos)',
    }),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  tax_id: z
    .string()
    .min(1, 'El RUT es requerido')
    .refine(validateUruguayanRUT, {
      message: 'RUT inválido. Formato: XX.XXXXXX.001-X (12 dígitos)',
    }),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
})

export type ProductForm = z.infer<typeof productSchema>
export type CategoryForm = z.infer<typeof categorySchema>
export type BranchForm = z.infer<typeof branchSchema>
export type SupplierForm = z.infer<typeof supplierSchema>
