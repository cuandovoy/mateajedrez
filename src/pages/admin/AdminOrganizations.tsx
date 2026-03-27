import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useOrganizationStore } from '@/store/organizationStore'
import { useAuthStore } from '@/store/authStore'
import { Building2, Plus, Pencil, Bug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreateOrganizationModal } from '@/components/admin/CreateOrganizationModal'
import { EditOrganizationModal } from '@/components/admin/EditOrganizationModal'
import type { Organization } from '@/types/database.types'

export function AdminOrganizations() {
  const { organizations, currentOrganization, setCurrentOrganization, fetchOrganizations } =
    useOrganizationStore()
  const { isAdmin, profile } = useAuthStore()
  const canCreateOrganization = profile?.role === 'admin'
  const navigate = useNavigate()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)

  const runDebugCanCreateOrg = async () => {
    const { data, error } = await supabase.rpc('debug_can_create_org' as never)
    if (error) {
      console.error('debug_can_create_org', error)
      alert(`Error: ${error.message}`)
      return
    }
    type DebugRow = { uid: string; has_profile: boolean; profile_role: string | null; is_admin_role: boolean; org_count: number; can_bootstrap: boolean; would_allow_insert: boolean }
    const row = (Array.isArray(data) ? data[0] : data) as DebugRow | null
    console.table(row ?? data)
    alert(
      row
        ? `uid: ${row.uid}\nhas_profile: ${row.has_profile}\nprofile_role: ${row.profile_role}\nis_admin_role: ${row.is_admin_role}\norg_count: ${row.org_count}\ncan_bootstrap: ${row.can_bootstrap}\nwould_allow_insert: ${row.would_allow_insert}`
        : JSON.stringify(data)
    )
  }

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }
    fetchOrganizations()
  }, [isAdmin, navigate, fetchOrganizations])

  if (!isAdmin) return null

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizaciones</h1>
          <p className="text-gray-600 mt-2">
            Administra tus organizaciones y cambia entre ellas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={runDebugCanCreateOrg}
            className="text-gray-500"
            title="Diagnóstico RLS crear organización"
            aria-label="Debug RLS"
          >
            <Bug className="h-4 w-4" />
          </Button>
          {canCreateOrganization && (
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Crear Organización
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-admin-600" />
            Mis Organizaciones ({organizations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No tienes organizaciones aún"
              description={
                canCreateOrganization
                  ? 'Crea tu primera organización para comenzar a gestionar tu tienda.'
                  : 'No tienes organizaciones asignadas. Un administrador puede crear una e invitarte.'
              }
              action={
                canCreateOrganization
                  ? { label: 'Crear organización', onClick: () => setCreateModalOpen(true) }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    currentOrganization?.id === org.id
                      ? 'border-admin-500 bg-admin-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-admin-100 flex items-center justify-center overflow-hidden shrink-0">
                      {org.logo_url ? (
                        <img src={org.logo_url} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Building2 className="h-5 w-5 text-admin-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{org.name}</p>
                      <p className="text-sm text-gray-500">{org.slug}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {org.member?.role === 'admin' ? 'Administrador' : 'Manager'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingOrg(org)}
                      className="p-2"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={currentOrganization?.id === org.id ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentOrganization(org)}
                    >
                      {currentOrganization?.id === org.id ? 'Activa' : 'Cambiar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {createModalOpen && (
        <CreateOrganizationModal onClose={() => setCreateModalOpen(false)} />
      )}
      {editingOrg && (
        <EditOrganizationModal
          organization={editingOrg}
          onClose={() => setEditingOrg(null)}
        />
      )}
    </div>
  )
}
