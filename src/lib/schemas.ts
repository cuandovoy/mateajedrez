import { z } from 'zod'
import { validateUruguayanPhone } from '@/lib/utils'

export const URUGUAY_DEPARTMENTS = [
  'Artigas',
  'Canelones',
  'Cerro Largo',
  'Colonia',
  'Durazno',
  'Flores',
  'Florida',
  'Lavalleja',
  'Maldonado',
  'Montevideo',
  'Paysandú',
  'Río Negro',
  'Rivera',
  'Rocha',
  'Salto',
  'San José',
  'Soriano',
  'Tacuarembó',
  'Treinta y Tres',
] as const

export const DELIVERY_METHODS = ['pickup', 'shipping'] as const
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]

const contactFields = {
  fullName: z.string().trim().min(1, 'El nombre completo es obligatorio'),
  email: z.string().trim().min(1, 'El email es obligatorio').email('Email inválido'),
  phone: z
    .string()
    .trim()
    .min(1, 'El teléfono es obligatorio')
    .refine(validateUruguayanPhone, 'Teléfono inválido (ej: 099 123 456 o +598 99 123 456)'),
}

export const checkoutSchema = z.discriminatedUnion(
  'deliveryMethod',
  [
    z.object({
      ...contactFields,
      deliveryMethod: z.literal('pickup'),
      address: z.string().optional(),
      city: z.string().optional(),
      department: z.string().optional(),
    }),
    z.object({
      ...contactFields,
      deliveryMethod: z.literal('shipping'),
      address: z.string().trim().min(1, 'La dirección es obligatoria'),
      city: z.string().trim().min(1, 'La ciudad es obligatoria'),
      department: z
        .enum(URUGUAY_DEPARTMENTS, {
          errorMap: () => ({ message: 'Seleccioná un departamento' }),
        })
        .refine((d) => d !== 'Paysandú', 'Los envíos no incluyen Paysandú. Elegí Retiro en local.'),
    }),
  ],
  { errorMap: () => ({ message: 'Elegí cómo querés recibir tu pedido' }) },
)

export type CheckoutFormData = z.infer<typeof checkoutSchema>

/** Flat shape used by react-hook-form; the schema narrows it per delivery method on submit. */
export interface CheckoutFormInput {
  deliveryMethod: DeliveryMethod
  fullName: string
  email: string
  phone: string
  address?: string
  city?: string
  department?: string
}

/** JSON stored in `orders.shipping_address`. Legacy orders have no `delivery_method`. */
export interface ShippingAddress {
  fullName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  department?: string
  delivery_method?: DeliveryMethod
}

/** Orders created before pickup existed carry no key and are shipments. */
export function getDeliveryMethod(addr: unknown): DeliveryMethod {
  if (typeof addr !== 'object' || addr === null) return 'shipping'
  return (addr as ShippingAddress).delivery_method === 'pickup' ? 'pickup' : 'shipping'
}
