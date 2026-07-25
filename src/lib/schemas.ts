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

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(1, 'El nombre completo es obligatorio'),
  email: z.string().trim().min(1, 'El email es obligatorio').email('Email inválido'),
  phone: z
    .string()
    .trim()
    .min(1, 'El teléfono es obligatorio')
    .refine(validateUruguayanPhone, 'Teléfono inválido (ej: 099 123 456 o +598 99 123 456)'),
  address: z.string().trim().min(1, 'La dirección es obligatoria'),
  city: z.string().trim().min(1, 'La ciudad es obligatoria'),
  department: z.enum(URUGUAY_DEPARTMENTS, {
    errorMap: () => ({ message: 'Seleccioná un departamento' }),
  }),
})

export type CheckoutFormData = z.infer<typeof checkoutSchema>
