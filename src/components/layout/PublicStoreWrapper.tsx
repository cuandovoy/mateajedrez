import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useOrganizationStore } from '@/store/organizationStore'
import { PublicStoreLayout } from './PublicStoreLayout'
import { usePageViewTracker } from '@/hooks/usePageViewTracker'
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

  usePageViewTracker(organization?.id, STORE_SLUG)

  useEffect(() => {
    const loadOrganization = async () => {
      if (!STORE_SLUG) {
        setError('VITE_STORE_SLUG no está configurado')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const org = await fetchOrgBySlug(STORE_SLUG)
        if (!org) {
          setError('Organización no encontrada')
        } else {
          setOrganization(org)
          setCurrentOrganization(org)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar la organización')
      } finally {
        setLoading(false)
      }
    }

    loadOrganization()
  }, [fetchOrgBySlug, setCurrentOrganization])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"
        ></div>
      </div>
    )
  }

  if (error || !organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Organización no encontrada</h1>
          <p className="text-gray-600">{error || 'La organización solicitada no existe o no está activa'}</p>
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
