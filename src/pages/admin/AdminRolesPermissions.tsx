import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/hooks/useOrganization'
import { useToastStore } from '@/store/toastStore'
import type { Database } from '@/types/database.types'
import { Loader, Plus, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type Permission = Database['public']['Tables']['permissions']['Row']

type OrgRole = {
  id: string
  organization_id: string
  key: string
  name: string
  description: string | null
  is_system: boolean
  base_role_key: string
  is_active: boolean
}

type RolePermission = {
  organization_role_id: string
  permission_id: string
}

type AssignedUser = {
  user_id: string
  full_name: string | null
}

interface RoleWithPermissions extends OrgRole {
  permissions: Permission[]
  users: AssignedUser[]
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

export function AdminRolesPermissions() {
  const { show } = useToastStore()
  const { organizationId } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creatingRole, setCreatingRole] = useState(false)

  const [roles, setRoles] = useState<RoleWithPermissions[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())

  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')

  const sb = supabase as any

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const fetchData = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const { data: rolesData, error: rolesError } = await sb
        .from('organization_roles')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_system', { ascending: false })
        .order('name', { ascending: true })

      if (rolesError) throw rolesError

      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .order('category, key')

      if (permissionsError) throw permissionsError

      const roleIds = (rolesData || []).map((r: OrgRole) => r.id)

      const rolePermsRes = roleIds.length
        ? await sb
            .from('organization_role_permissions')
            .select('organization_role_id, permission_id')
            .in('organization_role_id', roleIds)
        : { data: [], error: null }

      if (rolePermsRes.error) throw rolePermsRes.error

      const membersRes = await sb
        .from('organization_members')
        .select('user_id, organization_role_id')
        .eq('organization_id', organizationId)
        .not('organization_role_id', 'is', null)

      if (membersRes.error) throw membersRes.error

      const members = (membersRes.data || []) as Array<{ user_id: string; organization_role_id: string | null }>
      const userIds = members.map((m) => m.user_id).filter(Boolean)

      const profilesRes = userIds.length
        ? await supabase
            .from('user_profiles')
            .select('user_id, full_name')
            .in('user_id', userIds)
        : { data: [], error: null }

      if (profilesRes.error) throw profilesRes.error

      const profileByUserId = new Map<string, string | null>()
      ;(profilesRes.data || []).forEach((p: { user_id: string | null; full_name: string | null }) => {
        if (p.user_id) profileByUserId.set(p.user_id, p.full_name)
      })

      const rolePerms = (rolePermsRes.data || []) as RolePermission[]
      const permsByRole = new Map<string, Permission[]>()
      rolePerms.forEach((rp) => {
        const perm = (permissionsData || []).find((p) => p.id === rp.permission_id)
        if (!perm) return
        const list = permsByRole.get(rp.organization_role_id) || []
        list.push(perm)
        permsByRole.set(rp.organization_role_id, list)
      })

      const usersByRole = new Map<string, AssignedUser[]>()
      members.forEach((m) => {
        if (!m.organization_role_id) return
        const list = usersByRole.get(m.organization_role_id) || []
        list.push({
          user_id: m.user_id,
          full_name: profileByUserId.get(m.user_id) || null,
        })
        usersByRole.set(m.organization_role_id, list)
      })

      const mergedRoles: RoleWithPermissions[] = ((rolesData || []) as OrgRole[]).map((role) => ({
        ...role,
        permissions: permsByRole.get(role.id) || [],
        users: usersByRole.get(role.id) || [],
      }))

      setPermissions(permissionsData || [])
      setRoles(mergedRoles)

      if (mergedRoles.length === 0) {
        setSelectedRole(null)
        setSelectedPermissions(new Set())
      } else {
        const keepSelected = selectedRole ? mergedRoles.find((r) => r.id === selectedRole.id) : null
        const next = keepSelected || mergedRoles[0]
        setSelectedRole(next)
        setSelectedPermissions(new Set(next.permissions.map((p) => p.id)))
      }
    } catch (error) {
      console.error('Error fetching role data:', error)
      show('Error al cargar roles y permisos', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionToggle = (permissionId: string) => {
    const next = new Set(selectedPermissions)
    if (next.has(permissionId)) {
      next.delete(permissionId)
    } else {
      next.add(permissionId)
    }
    setSelectedPermissions(next)
  }

  const handleSavePermissions = async () => {
    if (!selectedRole) return

    setSaving(true)
    try {
      const { error: deleteError } = await sb
        .from('organization_role_permissions')
        .delete()
        .eq('organization_role_id', selectedRole.id)

      if (deleteError) throw deleteError

      if (selectedPermissions.size > 0) {
        const rows = Array.from(selectedPermissions).map((permissionId) => ({
          organization_role_id: selectedRole.id,
          permission_id: permissionId,
        }))

        const { error: insertError } = await sb
          .from('organization_role_permissions')
          .upsert(rows, { onConflict: 'organization_role_id,permission_id' })

        if (insertError) throw insertError
      }

      show(`Permisos guardados para ${selectedRole.name}`, 'success')
      await fetchData()
    } catch (error) {
      console.error('Error saving role permissions:', error)
      show('Error al guardar permisos', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateRole = async () => {
    if (!organizationId) return
    const trimmedName = newRoleName.trim()
    if (!trimmedName) {
      show('Ingresa un nombre para el rol', 'error')
      return
    }

    setCreatingRole(true)
    try {
      const key = slugifyRoleKey(trimmedName)
      const { error } = await sb.from('organization_roles').insert({
        organization_id: organizationId,
        key,
        name: trimmedName,
        description: newRoleDescription.trim() || null,
        is_system: false,
        base_role_key: 'custom',
        is_active: true,
      })

      if (error) throw error

      setNewRoleName('')
      setNewRoleDescription('')
      show('Rol custom creado', 'success')
      await fetchData()
    } catch (error: any) {
      console.error('Error creating role:', error)
      show(error?.message || 'Error al crear rol', 'error')
    } finally {
      setCreatingRole(false)
    }
  }

  const permissionsByCategory = useMemo(
    () =>
      permissions.reduce((acc, perm) => {
        const category = perm.category || 'other'
        if (!acc[category]) acc[category] = []
        acc[category].push(perm)
        return acc
      }, {} as Record<string, Permission[]>),
    [permissions]
  )

  const categories = useMemo(() => Object.keys(permissionsByCategory).sort(), [permissionsByCategory])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Roles y Permisos</h1>
        <p className="text-gray-600 mt-2">Roles por organización, permisos y usuarios asignados</p>
      </div>

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
          <Button onClick={handleCreateRole} disabled={creatingRole} className="gap-2">
            {creatingRole ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => {
                    setSelectedRole(role)
                    setSelectedPermissions(new Set(role.permissions.map((p) => p.id)))
                  }}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                    selectedRole?.id === role.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">{role.name}</div>
                    {role.is_system && (
                      <span className="text-[10px] bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded">Sistema</span>
                    )}
                  </div>
                  <div className="text-xs opacity-75 mt-1">
                    {role.permissions.length} permisos | {role.users.length} usuarios
                  </div>
                </button>
              ))}
              {roles.length === 0 && <p className="text-sm text-gray-500">No hay roles para esta organización.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {selectedRole ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <CardTitle>Permisos - {selectedRole.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{selectedRole.description || 'Sin descripción'}</p>
                  </div>
                  {selectedRole.is_system && (
                    <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">Sistema</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-6 rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Usuarios con este rol ({selectedRole.users.length})</p>
                  {selectedRole.users.length === 0 ? (
                    <p className="text-sm text-gray-500">Sin usuarios asignados</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedRole.users.map((u) => (
                        <span key={u.user_id} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                          {u.full_name || u.user_id.slice(0, 8)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {categories.map((category) => (
                    <div key={category}>
                      <h3 className="font-semibold text-gray-900 mb-3 capitalize">{category}</h3>
                      <div className="space-y-2">
                        {permissionsByCategory[category].map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-start space-x-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                          >
                            <div className="flex items-center h-5 mt-0.5">
                              <input
                                type="checkbox"
                                checked={selectedPermissions.has(perm.id)}
                                onChange={() => handlePermissionToggle(perm.id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-900">{perm.name}</div>
                              <div className="text-xs text-gray-600">{perm.description}</div>
                            </div>
                            <div className="text-xs text-gray-400 font-mono">{perm.key}</div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex gap-2 border-t pt-6">
                  <Button
                    onClick={handleSavePermissions}
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-600">Selecciona un rol para editar permisos</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
