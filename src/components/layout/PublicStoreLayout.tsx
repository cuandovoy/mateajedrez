import { ReactNode } from 'react'
import { Helmet } from 'react-helmet-async'
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
      {/* Defaults SEO — deben coincidir con los tags estáticos de index.html
          (que siguen ahí como fallback para crawlers que no ejecutan JS).
          Cualquier <Helmet> de una página hija pisa estos tags puntuales. */}
      <Helmet>
        <title>RUEMIA — Mates artesanales</title>
        <meta
          name="description"
          content="Mates artesanales de cuero y detalles bordados, hechos en Uruguay. Las piezas con historia merecen ser parte de nuevos momentos."
        />
        <meta property="og:title" content="RUEMIA — Mates artesanales" />
        <meta
          property="og:description"
          content="Mates artesanales de cuero y detalles bordados, hechos en Uruguay. Las piezas con historia merecen ser parte de nuevos momentos."
        />
        <meta property="og:image" content="/og-image.png" />
        <link rel="canonical" href="/" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: `var(--org-font-family, Cambria)` }}>
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
