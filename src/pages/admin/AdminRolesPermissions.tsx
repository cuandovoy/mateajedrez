// src/pages/admin/AdminRolesPermissions.tsx
// Admin page to manage roles and permissions

import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import type { Database } from '@/types/database.types'
import { Loader, Save } from 'lucide-react'
import { useEffect, useState } from 'react'

type Role = Database['public']['Tables']['roles']['Row']
type Permission = Database['public']['Tables']['permissions']['Row']
type RolePermission = Database['public']['Tables']['roles_permissions']['Row']

interface RoleWithPermissions extends Role {
  permissions: Permission[]
}

export function AdminRolesPermissions() {
  const { show } = useToastStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [roles, setRoles] = useState<RoleWithPermissions[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (rolesError) throw rolesError

      // Fetch permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .order('category, key')

      if (permissionsError) throw permissionsError

      setPermissions(permissionsData || [])

      // Fetch role permissions and merge
      const { data: rolePermissionsData, error: rpError } = await supabase
        .from('roles_permissions')
        .select('*')

      if (rpError) throw rpError

      const rolesWithPerms = (rolesData || []).map((role) => ({
        ...role,
        permissions: (rolePermissionsData || [])
          .filter((rp) => rp.role_id === role.id)
          .map((rp) => permissionsData?.find((p) => p.id === rp.permission_id))
          .filter(Boolean) as Permission[],
      }))

      setRoles(rolesWithPerms)
      if (rolesWithPerms.length > 0) {
        selectRole(rolesWithPerms[0])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      show('Error al cargar datos', 'error')
    } finally {
      setLoading(false)
    }
  }

  const selectRole = (role: RoleWithPermissions) => {
    setSelectedRole(role)
    setSelectedPermissions(new Set(role.permissions.map((p) => p.id)))
  }

  const handlePermissionToggle = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions)
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId)
    } else {
      newSelected.add(permissionId)
    }
    setSelectedPermissions(newSelected)
  }

  const handleSavePermissions = async () => {
    if (!selectedRole) return

    setSaving(true)
    try {
      // Delete existing role permissions
      const { error: deleteError } = await supabase
        .from('roles_permissions')
        .delete()
        .eq('role_id', selectedRole.id)

      if (deleteError) throw deleteError

      // Insert new role permissions
      if (selectedPermissions.size > 0) {
        const newRolePermissions = Array.from(selectedPermissions).map((permId) => ({
          role_id: selectedRole.id,
          permission_id: permId,
        }))

        // Use upsert with onConflict on (role_id, permission_id) to avoid duplicate key errors
        const { error: insertError } = await supabase
          .from('roles_permissions')
          .upsert(newRolePermissions, { onConflict: 'role_id,permission_id' })

        if (insertError) throw insertError
      }

      show(`Permisos guardados para ${selectedRole.name}`, 'success')
      fetchData()
    } catch (error) {
      console.error('Error saving permissions:', error)
      show('Error al guardar permisos', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  // Group permissions by category
  const permissionsByCategory = permissions.reduce(
    (acc, perm) => {
      const category = perm.category || 'other'
      if (!acc[category]) acc[category] = []
      acc[category].push(perm)
      return acc
    },
    {} as Record<string, Permission[]>
  )

  const categories = Object.keys(permissionsByCategory).sort()

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles y Permisos</h1>
          <p className="text-gray-600 mt-2">Gestiona roles de usuario y sus permisos</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Roles List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Roles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => selectRole(role)}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                      selectedRole?.id === role.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    )}
                  >
                    <div className="font-semibold">{role.name}</div>
                    <div className="text-xs opacity-75">
                      {role.permissions.length} permisos
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Permissions Editor */}
          <div className="lg:col-span-3">
            {selectedRole ? (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Permisos - {selectedRole.name}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedRole.description}
                      </p>
                    </div>
                    {selectedRole.is_system && (
                      <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                        Sistema
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {categories.map((category) => (
                      <div key={category}>
                        <h3 className="font-semibold text-gray-900 mb-3 capitalize">
                          {category}
                        </h3>
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
                                <div className="font-medium text-sm text-gray-900">
                                  {perm.name}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {perm.description}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400 font-mono">
                                {perm.key}
                              </div>
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

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen de Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="p-4 rounded-lg border border-gray-200 hover:border-primary-300 transition"
                >
                  <div className="font-semibold text-gray-900">{role.name}</div>
                  <div className="text-sm text-gray-600 mt-1">{role.description}</div>
                  <div className="text-sm font-medium text-primary-600 mt-3">
                    {role.permissions.length} permisos
                  </div>
                  <div className="mt-3 text-xs">
                    <div className="font-semibold text-gray-700 mb-2">Permisos:</div>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 3).map((p) => (
                        <span
                          key={p.id}
                          className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                        >
                          {p.category}
                        </span>
                      ))}
                      {role.permissions.length > 3 && (
                        <span className="text-gray-500 text-xs">
                          +{role.permissions.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
  )
}
