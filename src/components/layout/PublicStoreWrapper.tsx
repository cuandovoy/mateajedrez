import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useOrganizationStore } from '@/store/organizationStore'
import { PublicStoreLayout } from './PublicStoreLayout'
import { usePageViewTracker } from '@/hooks/usePageViewTracker'
import { BrandLoader } from '@/components/ui/BrandLoader'
import type { Organization } from '@/types/database.types'

// Fork de un único cliente: la organización ya no viene de la URL (:slug),
// se resuelve una sola vez desde esta env var de build.
const STORE_SLUG = import.meta.env.VITE_STORE_SLUG as string | undefined

export function PublicStoreWrapper() {
  const fetchOrgBySlug = useOrganizationStore((s) => s.fetchOrgBySlug)
  const setCurrentOrganization = useOrganizationStore((s) => s.setCurrentOrganization)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isNetworkError, setIsNetworkError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  usePageViewTracker(organization?.id, STORE_SLUG)

  useEffect(() => {
    const loadOrganization = async () => {
      if (!STORE_SLUG) {
        setError('La tienda no está configurada correctamente.')
        setIsNetworkError(false)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      setIsNetworkError(false)

      try {
        const org = await fetchOrgBySlug(STORE_SLUG)
        if (!org) {
          setError('La organización solicitada no existe o no está activa.')
        } else {
          setOrganization(org)
          setCurrentOrganization(org)
        }
      } catch (err) {
        // Nunca se muestra err.message crudo al usuario final — puede ser un
        // string técnico en inglés (ej. "Failed to fetch").
        console.error('Error loading organization:', err)
        setError('No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.')
        setIsNetworkError(true)
      } finally {
        setLoading(false)
      }
    }

    loadOrganization()
  }, [fetchOrgBySlug, setCurrentOrganization, retryCount])

  if (loading) {
    return <BrandLoader />
  }

  if (error || !organization) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-bg">
        <div className="text-center max-w-sm px-4">
          <h1 className="brand-title text-xl mb-3">
            {isNetworkError ? 'No se pudo cargar la tienda' : 'Organización no encontrada'}
          </h1>
          <p className="text-brand-muted mb-5">{error || 'La organización solicitada no existe o no está activa.'}</p>
          {isNetworkError && (
            <button
              type="button"
              onClick={() => setRetryCount((n) => n + 1)}
              className="px-6 py-2.5 rounded-md font-heading text-xs font-semibold uppercase tracking-[0.14em] text-brand-crema bg-brand-cuero hover:bg-brand-cuero-oscuro transition-colors"
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <PublicStoreLayout organization={organization} slug={STORE_SLUG!}>
      <Outlet />
    </PublicStoreLayout>
  )
}
