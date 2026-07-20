import { ReactNode } from 'react'
import { PublicStoreHeader } from './PublicStoreHeader'
import { PublicStoreFooter } from './Footer'
import { ShippingNoticeBanner } from './ShippingNoticeBanner'
import { ToastContainer } from './ToastContainer'
import { PublicStoreProvider } from '@/contexts/PublicStoreContext'
import type { Organization } from '@/types/database.types'

interface PublicStoreLayoutProps {
  organization: Organization
  slug: string
  children: ReactNode
}

// Theming dinámico por organización fue removido: la marca (Ruemia) está
// hardcodeada como tokens estáticos en src/index.css (--org-*). Ver
// tailwind.config.js / index.css para los valores reales.
export function PublicStoreLayout({ organization, slug, children }: PublicStoreLayoutProps) {
  return (
    <PublicStoreProvider organization={organization} slug={slug}>
      <div className="min-h-screen bg-white" style={{ fontFamily: `var(--org-font-family, Cambria)` }}>
        <ShippingNoticeBanner />
        <PublicStoreHeader organization={organization} />
        <main className="flex-1">
          {children}
        </main>
        <PublicStoreFooter />
        <ToastContainer />
      </div>
    </PublicStoreProvider>
  )
}
