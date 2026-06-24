import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/hooks/useOrganization'
import { usePermission } from '@/hooks/usePermission'
import { useToastStore } from '@/store/toastStore'
import { MODULES, MODULE_META, SYSTEM_ROLE_DEFAULTS, type Permission } from '@/lib/permissions'
import { ChevronDown, ChevronRight, Plus, Settings, Trash2, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type OrgRole = {
  id: string
  organization_id: string
  key: string
  name: string
  description: string | null
  is_system: boolean
  base_role_key: string
  is_active: boolean
  member_count?: number
}

type PermissionRow = {
  id: string
  key: string
  name: string
}

function slugifyRoleKey(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || 'rol_custom'
}

/** Returns true if this role+module combination should have its toggle disabled */
function isConfiguracionGestionarLocked(role: OrgRole, module: typeof MODULES[number]): boolean {
  // Anti-lockout: configuracion:gestionar on the system admin role cannot be disabled
  return module === 'configuracion' && role.base_role_key === 'admin' && role.is_system
}

export function AdminRolesPermissions() {
  const { show } = useToastStore()
  const { organizationId } = useOrganization()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { isAdmin, loading: permLoading } = usePermission()

  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')

  // ─── Fetch all roles with member count ───────────────────────────────────────
  const { data: roles = [], isLoading: rolesLoading } = useQuery<OrgRole[]>({
    queryKey: queryKeys.roles.all(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await sb
        .from('organization_roles')
        .select('*')
        .eq('organization_id', organizationId!)
        .eq('is_active', true)
        .order('is_system', { ascending: false })
        .order('name', { ascending: true })
      if (rolesError) throw rolesError

      const roleIds = (rolesData || []).map((r: OrgRole) => r.id)
      let memberCountByRole = new Map<string, number>()
      if (roleIds.length > 0) {
        const { data: membersData } = await sb
          .from('organization_members')
          .select('organization_role_id')
          .eq('organization_id', organizationId!)
          .in('organization_role_id', roleIds)
        ;(membersData || []).forEach((m: { organization_role_id: string }) => {
          memberCountByRole.set(m.organization_role_id, (memberCountByRole.get(m.organization_role_id) ?? 0) + 1)
        })
      }

      return (rolesData || []).map((r: OrgRole) => ({
        ...r,
        member_count: memberCountByRole.get(r.id) ?? 0,
      }))
    },
  })

  // ─── Fetch module permissions for the expanded role ──────────────────────────
  const { data: expandedRolePermissions = new Set<string>(), isLoading: permsLoading } = useQuery<Set<string>>({
    queryKey: queryKeys.roles.permissions(organizationId ?? '', expandedRoleId ?? ''),
    enabled: Boolean(organizationId) && Boolean(expandedRoleId),
    queryFn: async () => {
      // Fetch the 16 module permission rows by exact key list
      const moduleKeys = MODULES.flatMap((m) => [`${m}:ver`, `${m}:gestionar`])
      const { data: allModulePerms, error: permsError } = await supabase
        .from('permissions')
        .select('id, key, name')
        .in('key', moduleKeys)
        .order('key')
      if (permsError) throw permsError

      const modulePermissions = allModulePerms || []
      const modulePermIds = modulePermissions.map((p: PermissionRow) => p.id)

      if (modulePermIds.length === 0) return new Set<string>()

      // Fetch which of those are granted to this role
      const { data: granted, error: grantedError } = await sb
        .from('organization_role_permissions')
        .select('permission_id, permissions(key)')
        .eq('organization_role_id', expandedRoleId!)
        .in('permission_id', modulePermIds)
      if (grantedError) throw grantedError

      return new Set<string>(
        (granted || [])
          .map((g: { permissions: { key: string } | null }) => g.permissions?.key)
          .filter(Boolean) as string[]
      )
    },
    select: (data) => data,
  })

  // ─── Fetch permission ID map (key → id) ──────────────────────────────────────
  // Needed for the save mutation to convert keys → IDs
  const { data: permissionIdByKey = new Map<string, string>() } = useQuery<Map<string, string>>({
    queryKey: ['admin', organizationId, 'module-permission-ids'],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const moduleKeySet = MODULES.flatMap((m) => [`${m}:ver`, `${m}:gestionar`])
      const { data, error } = await supabase
        .from('permissions')
        .select('id, key')
        .in('key', moduleKeySet)
      if (error) throw error
      return new Map<string, string>((data || []).map((p: { id: string; key: string }) => [p.key, p.id]))
    },
  })

  // ─── Mutation: save module permissions (delete-all + re-insert per ADR-4) ────
  const savePermsMutation = useMutation({
    mutationFn: async ({ roleId, grantedKeys }: { roleId: string; grantedKeys: string[] }) => {
      // Only operate on the 16 module permission IDs
      const modulePermIds = [...permissionIdByKey.values()]
      if (modulePermIds.length === 0) throw new Error('No se encontraron permisos de módulo en la DB')

      // Delete existing module-key permissions for this role
      const { error: deleteError } = await sb
        .from('organization_role_permissions')
        .delete()
        .eq('organization_role_id', roleId)
        .in('permission_id', modulePermIds)
      if (deleteError) throw deleteError

      // Insert new set
      if (grantedKeys.length > 0) {
        const rows = grantedKeys
          .map((key) => ({ organization_role_id: roleId, permission_id: permissionIdByKey.get(key) }))
          .filter((r) => r.permission_id != null)

        if (rows.length > 0) {
          const { error: insertError } = await sb
            .from('organization_role_permissions')
            .upsert(rows, { onConflict: 'organization_role_id,permission_id' })
          if (insertError) throw insertError
        }
      }
    },
    onSuccess: (_, { roleId }) => {
      show('Permisos guardados', 'success')
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.permissions(organizationId ?? '', roleId) })
    },
    onError: (error) => {
      console.error('Error saving permissions:', error)
      show('Error al guardar permisos', 'error')
    },
  })

  // ─── Mutation: create custom role ────────────────────────────────────────────
  const createRoleMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const trimmedName = name.trim()
      if (!trimmedName) throw new Error('Ingresá un nombre para el rol')

      const key = slugifyRoleKey(trimmedName)
      const { data: newRole, error } = await sb
        .from('organization_roles')
        .insert({
          organization_id: organizationId!,
          key,
          name: trimmedName,
          description: description.trim() || null,
          is_system: false,
          base_role_key: 'custom',
          is_active: true,
        })
        .select('id')
        .single()
      if (error) throw error

      // Seed with viewer defaults (all 8 :ver keys)
      const viewerPermIds = SYSTEM_ROLE_DEFAULTS.viewer
        .map((permKey) => permissionIdByKey.get(permKey))
        .filter(Boolean) as string[]

      if (viewerPermIds.length > 0 && newRole?.id) {
        const rows = viewerPermIds.map((pid) => ({
          organization_role_id: newRole.id,
          permission_id: pid,
        }))
        const { error: seedError } = await sb
          .from('organization_role_permissions')
          .upsert(rows, { onConflict: 'organization_role_id,permission_id' })
        if (seedError) throw seedError
      }
    },
    onSuccess: () => {
      show('Rol custom creado', 'success')
      setNewRoleName('')
      setNewRoleDescription('')
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all(organizationId ?? '') })
    },
    onError: (error) => {
      console.error('Error creating role:', error)
      show(error instanceof Error ? error.message : 'Error al crear rol', 'error')
    },
  })

  // ─── Mutation: delete custom role ────────────────────────────────────────────
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await sb
        .from('organization_roles')
        .update({ is_active: false })
        .eq('id', roleId)
        .eq('is_system', false)
      if (error) throw error
    },
    onSuccess: () => {
      show('Rol eliminado', 'success')
      setExpandedRoleId(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all(organizationId ?? '') })
    },
    onError: (error) => {
      console.error('Error deleting role:', error)
      show('Error al eliminar el rol', 'error')
    },
  })

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleTogglePermission = (role: OrgRole, module: typeof MODULES[number], action: 'ver' | 'gestionar') => {
    const key = `${module}:${action}` as Permission
    const verKey = `${module}:ver` as Permission

    // Anti-lockout: cannot uncheck configuracion:gestionar for system admin role
    if (isConfiguracionGestionarLocked(role, module) && action === 'gestionar') return

    const currentKeys = new Set(expandedRolePermissions)

    if (currentKeys.has(key)) {
      currentKeys.delete(key)
      // If unchecking gestionar, also uncheck ver (optional: keep independent)
    } else {
      currentKeys.add(key)
      // UI rule: checking gestionar also checks ver
      if (action === 'gestionar') {
        currentKeys.add(verKey)
      }
    }

    savePermsMutation.mutate({ roleId: role.id, grantedKeys: [...currentKeys] })
  }

  const handleDeleteRole = (role: OrgRole) => {
    if ((role.member_count ?? 0) > 0) {
      show(`No se puede eliminar: el rol tiene ${role.member_count} miembro(s) asignado(s)`, 'error')
      return
    }
    if (!confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return
    deleteRoleMutation.mutate(role.id)
  }

  if (permLoading) return <SkeletonTable rows={5} />
  if (!isAdmin) { navigate('/'); return null }

  if (rolesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles y Permisos</h1>
          <p className="text-gray-600 mt-2">Roles por organización, permisos de módulo y usuarios asignados</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Roles y Permisos</h1>
        <p className="text-gray-600 mt-2">Roles por organización, permisos de módulo y usuarios asignados</p>
      </div>

      {/* Create custom role */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Crear Rol Custom</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            placeholder="Nombre del rol"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />
          <Input
            placeholder="Descripción (opcional)"
            value={newRoleDescription}
            onChange={(e) => setNewRoleDescription(e.target.value)}
          />
          <Button
            onClick={() => createRoleMutation.mutate({ name: newRoleName, description: newRoleDescription })}
            disabled={createRoleMutation.isPending || !newRoleName.trim()}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {createRoleMutation.isPending ? 'Creando...' : 'Crear'}
          </Button>
        </CardContent>
      </Card>

      {/* Role cards */}
      {roles.length === 0 ? (
        <EmptyState
          icon={Settings}
          title="No hay roles"
          description="Creá un rol custom para comenzar."
        />
      ) : (
        <div className="space-y-3">
          {roles.map((role) => {
            const isExpanded = expandedRoleId === role.id

            return (
              <Card key={role.id} className="overflow-hidden">
                {/* Role header */}
                <button
                  type="button"
                  onClick={() => setExpandedRoleId(isExpanded ? null : role.id)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
                        role.base_role_key === 'admin' ? 'bg-purple-100 text-purple-800' :
                        role.base_role_key === 'manager' ? 'bg-emerald-100 text-emerald-800' :
                        role.base_role_key === 'viewer' ? 'bg-gray-200 text-gray-700' :
                        role.base_role_key === 'user' ? 'bg-blue-100 text-blue-800' :
                        'bg-orange-100 text-orange-800'
                      )}>
                        {role.name}
                      </span>
                      {role.is_system && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                          Sistema
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 shrink-0">
                      <Users className="h-3.5 w-3.5" />
                      <span>{role.member_count ?? 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!role.is_system && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteRole(role) }}
                        disabled={deleteRoleMutation.isPending}
                        title={(role.member_count ?? 0) > 0 ? 'No se puede eliminar: tiene miembros' : 'Eliminar rol'}
                        className={cn(
                          'p-1.5 rounded transition-colors',
                          (role.member_count ?? 0) > 0
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />
                    }
                  </div>
                </button>

                {/* Module permission matrix */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    {permsLoading ? (
                      <div className="h-40 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-admin-600" />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left py-2 pr-4 font-semibold text-gray-700 w-1/2">Módulo</th>
                              <th className="text-center py-2 px-4 font-semibold text-gray-700">Ver</th>
                              <th className="text-center py-2 px-4 font-semibold text-gray-700">Gestionar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {MODULES.map((module) => {
                              const verKey = `${module}:ver`
                              const gestionarKey = `${module}:gestionar`
                              const hasVer = expandedRolePermissions.has(verKey)
                              const hasGestionar = expandedRolePermissions.has(gestionarKey)
                              const gestionarLocked = isConfiguracionGestionarLocked(role, module)

                              return (
                                <tr key={module} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="py-2.5 pr-4">
                                    <span className="font-medium text-gray-800">
                                      {MODULE_META[module].label}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={hasVer}
                                      onChange={() => handleTogglePermission(role, module, 'ver')}
                                      disabled={savePermsMutation.isPending || gestionarLocked}
                                      className="h-4 w-4 rounded border-gray-300 text-admin-600 focus:ring-admin-500 disabled:opacity-50"
                                    />
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={hasGestionar}
                                      onChange={() => handleTogglePermission(role, module, 'gestionar')}
                                      disabled={savePermsMutation.isPending || gestionarLocked}
                                      title={gestionarLocked ? 'Requerido para el rol Admin del sistema' : undefined}
                                      className="h-4 w-4 rounded border-gray-300 text-admin-600 focus:ring-admin-500 disabled:opacity-50"
                                    />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        {savePermsMutation.isPending && (
                          <p className="mt-2 text-xs text-gray-500 animate-pulse">Guardando...</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
