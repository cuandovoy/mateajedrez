import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { usePermission } from '@/hooks/usePermission'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useUserManagement } from '@/hooks/useUserManagement'
import { useOrganizationStore } from '@/store/organizationStore'
import { supabase } from '@/lib/supabase'
import { cn, formatDateShort } from '@/lib/utils'
import { PAGE_SIZE_ADMIN } from '@/lib/constants'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import type { UserProfile } from '@/types'
import { ChevronLeft, ChevronRight, Edit2, Plus, Search, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface UserProfileWithEmail extends UserProfile {
  email?: string | null
  isGuest?: boolean
  organization_role_id?: string | null
  role_name?: string | null
  base_role_key?: string | null
}

type LegacyRole = 'user' | 'admin' | 'manager' | 'viewer'

interface NewUserFormData {
  email: string
  password: string
  fullName: string
  phone: string
  role: LegacyRole
}

type OrganizationRoleOption = {
  id: string
  name: string
  base_role_key: string
  is_system: boolean
}

const ITEMS_PER_PAGE = PAGE_SIZE_ADMIN

const getRoleLabel = (role: string | null): string => {
  const roleMap: Record<string, string> = {
    user: 'Usuario',
    admin: 'Administrador',
    manager: 'Gerente',
    viewer: 'Visualizador',
    custom: 'Custom',
  }
  return (role && roleMap[role]) || role || 'Sin rol'
}

const getRoleColor = (role: string | null): string => {
  const colorMap: Record<string, string> = {
    user: 'bg-blue-100 text-blue-800',
    admin: 'bg-purple-100 text-purple-800',
    manager: 'bg-emerald-100 text-emerald-800',
    viewer: 'bg-gray-200 text-gray-800',
    custom: 'bg-orange-100 text-orange-800',
  }
  return (role && colorMap[role]) || 'bg-gray-100 text-gray-800'
}

export function AdminUsers() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { isAdmin, loading: permLoading } = usePermission()
  const { show } = useToastStore()
  const navigate = useNavigate()
  const { createUser } = useUserManagement()
  const { user: authUser } = useAuthStore()
  const queryClient = useQueryClient()

  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<LegacyRole | 'all'>('all')
  const [editingUser, setEditingUser] = useState<UserProfileWithEmail | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newUserForm, setNewUserForm] = useState<NewUserFormData>({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'user',
  })

  // ─── Fetch organization roles (for dropdown options) ─────────────────────────
  const { data: organizationRoles = [] } = useQuery<OrganizationRoleOption[]>({
    queryKey: queryKeys.roles.all(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data, error } = await sb
        .from('organization_roles')
        .select('id, name, base_role_key, is_system')
        .eq('organization_id', organizationId!)
        .eq('is_active', true)
        .order('is_system', { ascending: false })
        .order('name', { ascending: true })
      if (error) throw error
      return data as OrganizationRoleOption[]
    },
  })

  // ─── Fetch members with profiles ─────────────────────────────────────────────
  const { data: allUsers = [], isLoading: loading } = useQuery<UserProfileWithEmail[]>({
    queryKey: queryKeys.roles.members(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any

      // Fetch roles first so we can map role_id → name/base_role_key
      const { data: rolesData, error: rolesError } = await sb
        .from('organization_roles')
        .select('id, name, base_role_key, is_system')
        .eq('organization_id', organizationId!)
        .eq('is_active', true)
      if (rolesError) throw rolesError
      const rolesById = new Map<string, OrganizationRoleOption>(
        (rolesData as OrganizationRoleOption[]).map((r) => [r.id, r])
      )

      // Fetch members
      const { data: membersData, error: membersError } = await sb
        .from('organization_members')
        .select('user_id, role, organization_role_id')
        .eq('organization_id', organizationId!)
      if (membersError) throw membersError

      const members = membersData || []
      const userIds = members.map((m: { user_id: string }) => m.user_id).filter(Boolean)
      if (userIds.length === 0) return []

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
      if (profilesError) throw profilesError

      const memberByUserId = new Map(
        members.map((m: { user_id: string; role: string; organization_role_id: string | null }) => [m.user_id, m])
      )

      return (profilesData || []).map((profile: UserProfileWithEmail) => {
        const member = memberByUserId.get(profile.user_id ?? '') as
          | { role: string; organization_role_id: string | null }
          | undefined
        const legacyRole = (member?.role ?? 'user') as LegacyRole
        const orgRole = member?.organization_role_id ? rolesById.get(member.organization_role_id) : null
        return {
          ...profile,
          role: (orgRole?.base_role_key ?? legacyRole) as LegacyRole,
          organization_role_id: member?.organization_role_id ?? null,
          role_name: orgRole?.name ?? getRoleLabel(legacyRole),
          base_role_key: orgRole?.base_role_key ?? legacyRole,
          isGuest: profile.user_id === null,
        } as UserProfileWithEmail
      })
    },
  })

  // ─── Mutation: change member role ────────────────────────────────────────────
  const roleChangeMutation = useMutation({
    mutationFn: async ({ userId, organizationRoleId }: { userId: string; organizationRoleId: string }) => {
      const selectedOrgRole = organizationRoles.find((r) => r.id === organizationRoleId)
      if (!selectedOrgRole) throw new Error('Rol inválido')

      const legacyRole = (selectedOrgRole.base_role_key || 'user') as LegacyRole
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { error } = await sb
        .from('organization_members')
        .update({ role: legacyRole, organization_role_id: selectedOrgRole.id } as never)
        .eq('organization_id', organizationId!)
        .eq('user_id', userId)
      if (error) throw error
      return { userId, selectedOrgRole, legacyRole }
    },
    onSuccess: ({ userId, selectedOrgRole }) => {
      show(`Rol actualizado a ${selectedOrgRole.name}`, 'success')
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.members(organizationId ?? '') })
      // If the changed member is the current user, re-resolve orgRole
      if (userId === authUser?.id) {
        useOrganizationStore.getState().fetchOrganizations()
      }
    },
    onError: (error) => {
      console.error('Error updating user role:', error)
      show('Error al actualizar el rol', 'error')
    },
  })

  const handleRoleChange = (userOrProfileId: string, organizationRoleId: string) => {
    const userData = allUsers.find((u) => u.id === userOrProfileId || u.user_id === userOrProfileId)
    const userId = userData?.user_id ?? userOrProfileId
    roleChangeMutation.mutate({ userId, organizationRoleId })
  }

  const handleEditSave = async () => {
    if (!editingUser) return
    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: editForm.full_name.trim() || null,
          phone: editForm.phone.trim() || null,
        })
        .eq('id', editingUser.id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.members(organizationId ?? '') })
      show('Usuario actualizado', 'success')
      setEditingUser(null)
    } catch (err) {
      console.error('Error updating user:', err)
      show('Error al actualizar el usuario', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingUser(true)
    try {
      await createUser({
        email: newUserForm.email,
        password: newUserForm.password,
        fullName: newUserForm.fullName || null,
        phone: newUserForm.phone || null,
        role: newUserForm.role,
        organizationId: organizationId ?? undefined,
      })
      show('Usuario creado correctamente', 'success')
      setNewUserForm({ email: '', password: '', fullName: '', phone: '', role: 'user' })
      setShowCreateForm(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.members(organizationId ?? '') })
    } catch (error) {
      console.error('Error creating user:', error)
      show(error instanceof Error ? error.message : 'Error al crear usuario', 'error')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    setRoleFilter('all')
    setCurrentPage(1)
  }

  // Client-side filtering and pagination
  const filteredUsers = useMemo(() => {
    let result = allUsers
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter || u.base_role_key === roleFilter)
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      result = result.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.phone?.includes(searchTerm) ||
          (u.address as { address?: string })?.address?.toLowerCase().includes(q) ||
          (u.address as { city?: string })?.city?.toLowerCase().includes(q)
      )
    }
    return result
  }, [allUsers, roleFilter, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE))
  const paginatedUsers = useMemo(() => {
    const from = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredUsers.slice(from, from + ITEMS_PER_PAGE)
  }, [filteredUsers, currentPage])

  // Guard: all hooks have already run — safe to return early now
  if (permLoading) return <SkeletonTable rows={PAGE_SIZE_ADMIN} />
  if (!isAdmin) {
    navigate('/')
    return null
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-600 mt-2">Gestioná usuarios y roles en la organización</p>
        </div>
        {!showCreateForm && (
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Usuario
          </Button>
        )}
      </div>

      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Crear Nuevo Usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <Input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <Input
                  type="text"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <Input
                  type="text"
                  value={newUserForm.phone}
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol <span className="text-red-500">*</span>
                </label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, role: e.target.value as LegacyRole }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-200"
                >
                  <option value="user">Usuario</option>
                  <option value="viewer">Visualizador</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="md:col-span-2 flex items-center gap-2 pt-2">
                <Button type="submit" disabled={creatingUser}>
                  {creatingUser ? 'Creando...' : 'Crear Usuario'}
                </Button>
                <Button type="button" variant="outline" disabled={creatingUser} onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            className="w-full h-9 pl-9 pr-8 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-admin-500"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setCurrentPage(1) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as LegacyRole | 'all'); setCurrentPage(1) }}
          className={`h-9 px-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${roleFilter !== 'all' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-200 text-gray-700'}`}
        >
          <option value="all">Rol: todos</option>
          <option value="user">Usuario</option>
          <option value="viewer">Visualizador</option>
          <option value="manager">Gerente</option>
          <option value="admin">Administrador</option>
        </select>
        {(searchTerm || roleFilter !== 'all') && (
          <button
            onClick={handleResetFilters}
            className="h-9 px-3 text-sm text-red-500 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
          >
            Limpiar
          </button>
        )}
        <span className="ml-auto text-sm text-gray-500">
          {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable rows={PAGE_SIZE_ADMIN} />
          ) : paginatedUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No se encontraron usuarios"
              description={
                searchTerm || roleFilter !== 'all'
                  ? 'Probá ajustar los filtros.'
                  : 'Aún no hay usuarios en esta organización.'
              }
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {paginatedUsers.map((user) => (
                  <div key={user.user_id ?? user.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{user.full_name || 'Sin nombre'}</p>
                        {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
                        {user.phone && <p className="text-sm text-gray-500">{user.phone}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            user.isGuest ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                          )}
                        >
                          {user.isGuest ? 'Invitado' : 'Registrado'}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            getRoleColor(user.base_role_key || user.role)
                          )}
                        >
                          {user.role_name || getRoleLabel(user.role)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.user_id === authUser?.id ? (
                        <span
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400"
                          title="No podés cambiar tu propio rol"
                        >
                          {user.role_name || getRoleLabel(user.role)} (tu rol)
                        </span>
                      ) : (
                        <select
                          value={user.organization_role_id ?? ''}
                          onChange={(e) => handleRoleChange(user.user_id ?? user.id, e.target.value)}
                          disabled={roleChangeMutation.isPending}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-200 disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          {organizationRoles.map((roleOption) => (
                            <option key={roleOption.id} value={roleOption.id}>
                              {roleOption.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() => {
                          setEditingUser(user)
                          setEditForm({ full_name: user.full_name || '', phone: user.phone || '' })
                        }}
                        className="p-1.5 text-gray-400 hover:text-admin-600 hover:bg-admin-50 rounded transition-colors"
                        title="Editar usuario"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">{formatDateShort(user.created_at, settings)}</p>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Usuario</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Teléfono</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Dirección</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipo</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Rol actual</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Cambiar rol</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha Registro</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => {
                      const address = user.address as {
                        address?: string
                        city?: string
                        state?: string
                      } | null
                      const userId = user.user_id ?? user.id
                      const isSelf = user.user_id === authUser?.id

                      return (
                        <tr key={userId} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{user.full_name || 'Sin nombre'}</p>
                              {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{user.phone || '—'}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {address ? (
                              <div>
                                {address.address && <p>{address.address}</p>}
                                {address.city && address.state && (
                                  <p className="text-xs text-gray-500">
                                    {address.city}, {address.state}
                                  </p>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium',
                                user.isGuest ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                              )}
                            >
                              {user.isGuest ? 'Invitado' : 'Registrado'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium',
                                getRoleColor(user.base_role_key || user.role)
                              )}
                            >
                              {user.role_name || getRoleLabel(user.role)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isSelf ? (
                              <span
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 inline-block"
                                title="No podés cambiar tu propio rol"
                              >
                                Tu rol
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <select
                                  value={user.organization_role_id ?? ''}
                                  onChange={(e) => handleRoleChange(userId, e.target.value)}
                                  disabled={roleChangeMutation.isPending}
                                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-200 disabled:bg-gray-100 disabled:text-gray-500"
                                >
                                  {organizationRoles.map((roleOption) => (
                                    <option key={roleOption.id} value={roleOption.id}>
                                      {roleOption.name}
                                    </option>
                                  ))}
                                </select>
                                {roleChangeMutation.isPending && (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-admin-600 shrink-0" />
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {formatDateShort(user.created_at, settings)}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => {
                                setEditingUser(user)
                                setEditForm({ full_name: user.full_name || '', phone: user.phone || '' })
                              }}
                              className="p-1.5 text-gray-400 hover:text-admin-600 hover:bg-admin-50 rounded transition-colors"
                              title="Editar usuario"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} de {filteredUsers.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-600">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit user modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Editar usuario</h2>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+598 9 123 4567"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <Button onClick={handleEditSave} isLoading={savingEdit} className="flex-1">
                Guardar
              </Button>
              <Button variant="outline" onClick={() => setEditingUser(null)} disabled={savingEdit} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
