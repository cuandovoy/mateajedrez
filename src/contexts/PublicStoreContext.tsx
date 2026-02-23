import { createContext, useContext, ReactNode } from 'react'
import type { Organization } from '@/types/database.types'

interface PublicStoreContextValue {
  organization: Organization
  slug: string
}

export const PublicStoreContext = createContext<PublicStoreContextValue | null>(null)

export function PublicStoreProvider({ 
  organization, 
  slug, 
  children 
}: { 
  organization: Organization
  slug: string
  children: ReactNode 
}) {
  return (
    <PublicStoreContext.Provider value={{ organization, slug }}>
      {children}
    </PublicStoreContext.Provider>
  )
}

export function usePublicStore() {
  const context = useContext(PublicStoreContext)
  if (!context) {
    throw new Error('usePublicStore must be used within PublicStoreProvider')
  }
  return context
}
