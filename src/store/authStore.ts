import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  /** Platform admin or org admin - puede gestionar miembros y organizaciones */
  isAdmin: boolean
  /** Admin o manager en alguna org - puede acceder al panel admin */
  canAccessAdminPanel: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName?: string) => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
  initialize: () => Promise<void>
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  canAccessAdminPanel: false,

  setLoading: (loading: boolean) => {
    set({ loading })
  },

  initialize: async () => {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Auth initialization timeout')), 10000)
      })

      const sessionPromise = supabase.auth.getSession()

      const result = await Promise.race([
        sessionPromise,
        timeoutPromise,
      ])

      const { data: { session }, error } = result

      if (error) {
        console.error('Supabase auth error:', error)
        throw error
      }
      
      set({ user: session?.user ?? null })

      if (session?.user) {
        const { useOrganizationStore } = await import('./organizationStore')
        await useOrganizationStore.getState().fetchOrganizations()
        await get().fetchProfile()
        // Sync local cart to database when user logs in
        const { useCartStore } = await import('./cartStore')
        await useCartStore.getState().syncLocalCart()
      }
    } catch (error) {
      // Ignore abort errors - they're expected in development mode
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // Silently ignore abort errors
          return
        }
        if (error.message === 'Auth initialization timeout') {
          console.warn('Auth initialization timed out, continuing without session')
          set({ user: null, profile: null, isAdmin: false, canAccessAdminPanel: false })
          return
        }
        console.error('Error initializing auth:', error)
      } else {
        console.error('Error initializing auth:', error)
      }
    } finally {
      set({ loading: false })
    }
  },

  fetchProfile: async () => {
    const { user } = get()
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      if (data) {
        const profile = data as UserProfile
        const { useOrganizationStore } = await import('./organizationStore')
        const orgs = useOrganizationStore.getState().organizations
        const isAdminInOrg = orgs.some((o) => o.member?.role === 'admin')
        const isManagerInOrg = orgs.some((o) => o.member?.role === 'manager')
        set({
          profile,
          isAdmin: profile.role === 'admin' || isAdminInOrg,
          canAccessAdminPanel: profile.role === 'admin' || isAdminInOrg || isManagerInOrg,
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  },

  signIn: async (email: string, password: string) => {
    isManualLogin = true
    try {
      set({ loading: true })
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      set({ user: data.user })
      
      const { useOrganizationStore } = await import('./organizationStore')
      await useOrganizationStore.getState().fetchOrganizations()
      await get().fetchProfile()
      try {
        const { useCartStore } = await import('./cartStore')
        await useCartStore.getState().syncLocalCart()
      } catch (err) {
        console.error('Error syncing cart:', err)
      }
    } catch (error) {
      console.error('Error signing in:', error)
      throw error
    } finally {
      set({ loading: false })
      // Reset flag after a short delay to allow auth state change to process
      setTimeout(() => {
        isManualLogin = false
      }, 1000)
    }
  },

  signUp: async (email: string, password: string, fullName?: string) => {
    try {
      const frontendUrl =
        import.meta.env.VITE_FRONTEND_URL ||
        import.meta.env.VITE_APP_URL ||
        (typeof window !== 'undefined' ? window.location.origin : '')

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: frontendUrl ? frontendUrl.replace(/\/$/, '') : undefined,
          data: {
            full_name: fullName || null,
          },
        },
      })

      if (error) throw error

      if (data.user) {
        // Profile is created automatically by database trigger
        // Wait a bit for the trigger to complete, then fetch profile
        await new Promise((resolve) => setTimeout(resolve, 500))
        
        set({ user: data.user })
        await get().fetchProfile()
      }
    } catch (error) {
      console.error('Error signing up:', error)
      throw error
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      set({ user: null, profile: null, isAdmin: false, canAccessAdminPanel: false })
      const { useOrganizationStore } = await import('./organizationStore')
      useOrganizationStore.getState().clear()
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  },
}))

// Initialize auth on store creation
// Use a flag to prevent multiple simultaneous updates and manual login conflicts
let isUpdatingAuth = false
let isManualLogin = false

supabase.auth.onAuthStateChange(async (_event, session) => {
  // Skip if we're in the middle of a manual login/signup
  if (isManualLogin) {
    return
  }

  // Prevent concurrent updates
  if (isUpdatingAuth) {
    return
  }

  isUpdatingAuth = true
  try {
    const currentUser = useAuthStore.getState().user
    const newUser = session?.user ?? null

    // Only update if user actually changed
    if (currentUser?.id !== newUser?.id) {
      useAuthStore.setState({ user: newUser })

      if (newUser) {
        // Fetch profile and sync cart in parallel, but don't block
        Promise.all([
          useAuthStore.getState().fetchProfile(),
          (async () => {
            try {
              const { useCartStore } = await import('./cartStore')
              await useCartStore.getState().syncLocalCart()
            } catch (err) {
              console.error('Error syncing cart in auth state change:', err)
              // Don't throw - cart sync failure shouldn't block auth
            }
          })(),
        ]).catch((err) => {
          console.error('Error in auth state change operations:', err)
        })
      } else {
        useAuthStore.setState({ profile: null, isAdmin: false, canAccessAdminPanel: false })
      }
    }
  } catch (error) {
    console.error('Error in auth state change:', error)
  } finally {
    isUpdatingAuth = false
  }
})
