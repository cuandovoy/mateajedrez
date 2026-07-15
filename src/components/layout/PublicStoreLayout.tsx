import { useEffect, ReactNode } from 'react'
import { PublicStoreHeader } from './PublicStoreHeader'
import { PublicStoreFooter } from './Footer'
import { ToastContainer } from './ToastContainer'
import { PublicStoreProvider } from '@/contexts/PublicStoreContext'
import { getReadableTextColor } from '@/lib/colorContrast'
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

    // Texto legible (blanco o tinta oscura) sobre cada color de marca — una
    // org puede elegir un color claro/pastel, y un text-white fijo se vuelve
    // invisible en ese caso. Se calcula acá, el único lugar que conoce el hex
    // real; el resto de la tienda solo consume var(--org-*-ink, white).
    root.style.setProperty('--org-primary-ink', getReadableTextColor(primaryColor))
    root.style.setProperty('--org-secondary-ink', getReadableTextColor(secondaryColor))
    root.style.setProperty('--org-accent-ink', getReadableTextColor(accentColor))

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
      root.style.removeProperty('--org-primary-ink')
      root.style.removeProperty('--org-secondary-ink')
      root.style.removeProperty('--org-accent-ink')
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
        <ToastContainer />
      </div>
    </PublicStoreProvider>
  )
}
