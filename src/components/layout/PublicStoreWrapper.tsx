import { useEffect, useState } from 'react'
import { useParams, Outlet } from 'react-router-dom'
import { useOrganizationStore } from '@/store/organizationStore'
import { PublicStoreLayout } from './PublicStoreLayout'
import { usePageViewTracker } from '@/hooks/usePageViewTracker'
import type { Organization } from '@/types/database.types'

export function PublicStoreWrapper() {
  const { slug } = useParams<{ slug: string }>()
  const fetchOrgBySlug = useOrganizationStore((s) => s.fetchOrgBySlug)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  usePageViewTracker(organization?.id, slug)

  useEffect(() => {
    const loadOrganization = async () => {
      if (!slug) {
        setError('Slug no proporcionado')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const org = await fetchOrgBySlug(slug)
        if (!org) {
          setError('Organización no encontrada')
        } else {
          setOrganization(org)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar la organización')
      } finally {
        setLoading(false)
      }
    }

    loadOrganization()
  }, [slug, fetchOrgBySlug])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: '#6366f1' }}
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
    <PublicStoreLayout organization={organization} slug={slug!}>
      <Outlet />
    </PublicStoreLayout>
  )
}
