import { useEffect, ReactNode } from 'react'
import { PublicStoreHeader } from './PublicStoreHeader'
import { PublicStoreFooter } from './Footer'
import { PublicStoreProvider } from '@/contexts/PublicStoreContext'
import type { Organization } from '@/types/database.types'

interface PublicStoreLayoutProps {
  organization: Organization
  slug: string
  children: ReactNode
}

export function PublicStoreLayout({ organization, slug, children }: PublicStoreLayoutProps) {
  useEffect(() => {
    // Aplicar CSS variables dinámicas al documento
    const root = document.documentElement
    
    const primaryColor = organization.primary_color || '#6366f1'
    const secondaryColor = organization.secondary_color || '#8b5cf6'
    const accentColor = organization.accent_color || '#ec4899'
    const fontFamily = organization.font_family || 'Poppins'
    const fontHeading = organization.font_heading || organization.font_family || 'Poppins'
    
    root.style.setProperty('--org-primary-color', primaryColor)
    root.style.setProperty('--org-secondary-color', secondaryColor)
    root.style.setProperty('--org-accent-color', accentColor)
    root.style.setProperty('--org-font-family', fontFamily)
    root.style.setProperty('--org-font-heading', fontHeading)
    
    // Aplicar fuente al body
    if (fontFamily) {
      document.body.style.fontFamily = `"${fontFamily}", sans-serif`
    }
    
    return () => {
      // Limpiar estilos al desmontar
      root.style.removeProperty('--org-primary-color')
      root.style.removeProperty('--org-secondary-color')
      root.style.removeProperty('--org-accent-color')
      root.style.removeProperty('--org-font-family')
      root.style.removeProperty('--org-font-heading')
      document.body.style.fontFamily = ''
    }
  }, [organization])

  return (
    <PublicStoreProvider organization={organization} slug={slug}>
      <div className="min-h-screen bg-white" style={{ fontFamily: `var(--org-font-family, Poppins)` }}>
        <PublicStoreHeader organization={organization} slug={slug} />
        <main className="flex-1">
          {children}
        </main>
        <PublicStoreFooter />
      </div>
    </PublicStoreProvider>
  )
}
