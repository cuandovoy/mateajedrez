import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useOrganizationStore } from '@/store/organizationStore'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { Building2, Plus, Pencil, Bug, Clock, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreateOrganizationModal } from '@/components/admin/CreateOrganizationModal'
import { EditOrganizationModal } from '@/components/admin/EditOrganizationModal'
import type { Organization } from '@/types/database.types'

type OrgWithRole = Organization & { memberRole?: string }

export function AdminOrganizations() {
  const { currentOrganization, setCurrentOrganization, fetchOrganizations } =
    useOrganizationStore()
  const { isAdmin, profile, user } = useAuthStore()
  const { show } = useToastStore()
  const canAdmin = profile?.role === 'admin'
  const navigate = useNavigate()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [allOrgs, setAllOrgs] = useState<OrgWithRole[]>([])

  const fetchAllOrgs = useCallback(async () => {
    if (!user) return
    const { data: members, error } = await supabase
      .from('organization_members')
      .select(`
        role,
        organizations(id, name, slug, logo_url, deleted_at, subscription_tier, subscription_status, trial_ends_at, subscription_expires_at, created_at, updated_at, settings, primary_color, secondary_color, accent_color, font_family, font_heading, border_radius, button_style, cover_image_url)
      `)
      .eq('user_id', user.id)
    if (error) { console.error(error); return }
    const orgs: OrgWithRole[] = (members || [])
      .filter((m: { organizations: unknown }) => m.organizations != null)
      .map((m) => ({ ...(m.organizations as Organization), memberRole: m.role }))
    setAllOrgs(orgs)
  }, [user])

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }
    fetchAllOrgs()
  }, [isAdmin, navigate, fetchAllOrgs])

  const handleSoftDelete = async (id: string) => {
    if (!confirm('¿Marcar esta organización para eliminar? Los usuarios ya no podrán acceder a ella.')) return
    const { error } = await supabase
      .from('organizations')
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq('id', id)
    if (error) {
      show('Error al marcar la organización para eliminar', 'error')
      return
    }
    show('Organización marcada para eliminar', 'success')
    fetchAllOrgs()
    fetchOrganizations()
  }

  const handleRestore = async (id: string) => {
    const { error } = await supabase
      .from('organizations')
      .update({ deleted_at: null } as never)
      .eq('id', id)
    if (error) {
      show('Error al restaurar la organización', 'error')
      return
    }
    show('Organización restaurada', 'success')
    fetchAllOrgs()
    fetchOrganizations()
  }

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
          {canAdmin && (
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
            Mis Organizaciones ({allOrgs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allOrgs.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No tienes organizaciones aún"
              description={
                canAdmin
                  ? 'Crea tu primera organización para comenzar a gestionar tu tienda.'
                  : 'No tienes organizaciones asignadas. Un administrador puede crear una e invitarte.'
              }
              action={
                canAdmin
                  ? { label: 'Crear organización', onClick: () => setCreateModalOpen(true) }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {allOrgs.map((org) => {
                const isDeleted = !!org.deleted_at
                const isActive = currentOrganization?.id === org.id

                const actions = canAdmin
                  ? isDeleted
                    ? [
                        {
                          label: 'Restaurar',
                          icon: <RotateCcw className="h-4 w-4" />,
                          onClick: () => handleRestore(org.id),
                        },
                      ]
                    : [
                        {
                          label: 'Editar',
                          icon: <Pencil className="h-4 w-4" />,
                          onClick: () => setEditingOrg(org),
                        },
                        {
                          label: 'Marcar para eliminar',
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => handleSoftDelete(org.id),
                          variant: 'danger' as const,
                        },
                      ]
                  : []

                return (
                  <div
                    key={org.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      isDeleted
                        ? 'border-red-200 bg-red-50/30'
                        : isActive
                        ? 'border-admin-500 bg-admin-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden shrink-0 ${isDeleted ? 'bg-red-100' : 'bg-admin-100'}`}>
                        {org.logo_url ? (
                          <img src={org.logo_url} alt="" className={`h-full w-full object-contain ${isDeleted ? 'opacity-40' : ''}`} />
                        ) : (
                          <Building2 className={`h-5 w-5 ${isDeleted ? 'text-red-400' : 'text-admin-600'}`} />
                        )}
                      </div>
                      <div>
                        <p className={`font-medium ${isDeleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {org.name}
                        </p>
                        <p className="text-sm text-gray-500">{org.slug}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {org.memberRole === 'admin' ? 'Administrador' : 'Manager'}
                          </span>
                          {isDeleted && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 ring-1 ring-red-200">
                              <Clock className="h-3 w-3" />
                              Eliminación pendiente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!canAdmin && !isDeleted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingOrg(org)}
                          className="p-2"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {!isDeleted && (
                        <Button
                          variant={isActive ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentOrganization(org)}
                        >
                          {isActive ? 'Activa' : 'Cambiar'}
                        </Button>
                      )}
                      {canAdmin && actions.length > 0 && (
                        <ActionsMenu actions={actions} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {createModalOpen && (
        <CreateOrganizationModal onClose={() => { setCreateModalOpen(false); fetchAllOrgs() }} />
      )}
      {editingOrg && (
        <EditOrganizationModal
          organization={editingOrg}
          onClose={() => { setEditingOrg(null); fetchAllOrgs() }}
        />
      )}
    </div>
  )
}
