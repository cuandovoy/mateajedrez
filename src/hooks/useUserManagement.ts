import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import { createClient } from '@supabase/supabase-js'
import { useMemo } from 'react'

export type ManagedUserRole = 'user' | 'viewer' | 'manager' | 'admin'

export interface CreateManagedUserInput {
  email: string
  password: string
  role: ManagedUserRole
  fullName?: string | null
  phone?: string | null
  address?: Database['public']['Tables']['user_profiles']['Row']['address']
  organizationId?: string
}

const ALLOWED_ROLES: ManagedUserRole[] = ['user', 'viewer', 'manager', 'admin']

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useUserManagement() {
  const signupClient = useMemo(() => {
    return createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    )
  }, [])

  const createUser = async (input: CreateManagedUserInput) => {
    const email = input.email.trim().toLowerCase()
    const password = input.password.trim()
    const role = input.role
    const fullName = input.fullName?.trim() || null
    const phone = input.phone?.trim() || null
    const address = input.address ?? null

    if (!email || !password || !role) {
      throw new Error('Email, contraseña y rol son obligatorios')
    }

    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error('Rol inválido')
    }

    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres')
    }

    const { data: signUpData, error: signUpError } = await signupClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (signUpError) {
      throw new Error(signUpError.message)
    }

    const createdUser = signUpData.user
    if (!createdUser?.id) {
      throw new Error('No se pudo crear el usuario en auth')
    }

    // identities vacío = usuario ya existía (Supabase no crea uno nuevo)
    const identities = (createdUser as { identities?: unknown[] }).identities ?? []
    if (identities.length === 0) {
      throw new Error('Ya existe un usuario con este email.')
    }

    let profileAvailable = false
    for (let i = 0; i < 6; i++) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', createdUser.id)
        .maybeSingle()
      const profile = data as { id: string } | null

      if (error) {
        throw new Error(error.message)
      }

      if (profile?.id) {
        profileAvailable = true
        break
      }

      await sleep(250)
    }

    if (!profileAvailable) {
      throw new Error('El perfil no se creó automáticamente. Revisa el trigger handle_new_user')
    }

    const { error: updateProfileError } = await supabase
      .from('user_profiles')
      .update({
        full_name: fullName,
        phone,
        address,
      } as never)
      .eq('user_id', createdUser.id)

    if (updateProfileError) {
      throw new Error(updateProfileError.message)
    }

    // Add user to organization (role is per-org in organization_members)
    const orgId = input.organizationId
    if (orgId) {
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert(
          { organization_id: orgId, user_id: createdUser.id, role } as never,
          { onConflict: 'organization_id,user_id' }
        )

      if (memberError) {
        throw new Error(memberError.message)
      }
    }

    return {
      id: createdUser.id,
      email: createdUser.email,
      role,
      fullName,
      phone,
    }
  }

  return {
    createUser,
  }
}
