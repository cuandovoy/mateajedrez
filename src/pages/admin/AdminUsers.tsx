import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useUserManagement } from '@/hooks/useUserManagement'
import { supabase } from '@/lib/supabase'
import { cn, formatDateShort } from '@/lib/utils'
import { PAGE_SIZE_ADMIN } from '@/lib/constants'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import type { UserProfile } from '@/types'
import { ChevronLeft, ChevronRight, Edit2, Plus, Search, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface UserProfileWithEmail extends UserProfile {
  email?: string | null
  isGuest?: boolean
  organization_role_id?: string | null
  role_name?: string | null
  base_role_key?: string | null
}

type UserRole = 'user' | 'admin' | 'manager' | 'viewer'

interface NewUserFormData {
  email: string
  password: string
  fullName: string
  phone: string
  role: UserRole
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
  }
  return (role && roleMap[role]) || role || 'Sin rol'
}

const getRoleColor = (role: string | null): string => {
  const colorMap: Record<string, string> = {
    user: 'bg-blue-100 text-blue-800',
    admin: 'bg-purple-100 text-purple-800',
    manager: 'bg-emerald-100 text-emerald-800',
    viewer: 'bg-gray-200 text-gray-800',
  }
  return (role && colorMap[role]) || 'bg-gray-100 text-gray-800'
}

export function AdminUsers() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { isAdmin } = useAuthStore()
  const { show } = useToastStore()
  const navigate = useNavigate()
  const { createUser } = useUserManagement()
  const { user: authUser } = useAuthStore()

  const [allUsers, setAllUsers] = useState<UserProfileWithEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [organizationRoles, setOrganizationRoles] = useState<OrganizationRoleOption[]>([])
  // Ref para que handleRoleChange siempre lea los roles actuales sin depender del closure
  const organizationRolesRef = useRef<OrganizationRoleOption[]>([])

  const [creatingUser, setCreatingUser] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newUserForm, setNewUserForm] = useState<NewUserFormData>({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'user',
  })

  // Filters (client-side)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')

  // Edit modal
  const [editingUser, setEditingUser] = useState<UserProfileWithEmail | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }
    if (organizationId) {
      fetchOrganizationRoles()
      fetchUsers()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, organizationId])

  // Resetear página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, roleFilter])

  const fetchOrganizationRoles = async () => {
    if (!organizationId) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data, error } = await sb
        .from('organization_roles')
        .select('id, name, base_role_key, is_system')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_system', { ascending: false })
        .order('name', { ascending: true })

      if (error) throw error
      const roles = (data || []) as OrganizationRoleOption[]
      setOrganizationRoles(roles)
      organizationRolesRef.current = roles
    } catch (error) {
      console.error('Error fetching organization roles:', error)
    }
  }

  const fetchUsers = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any

      // Usar ref para tener roles actualizados; si vacíos, fetchear primero
      let rolesForMapping = organizationRolesRef.current
      if (!rolesForMapping.length) {
        const { data: rolesData, error: rolesError } = await sb
          .from('organization_roles')
          .select('id, name, base_role_key, is_system')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
        if (!rolesError && rolesData) {
          rolesForMapping = rolesData as OrganizationRoleOption[]
          setOrganizationRoles(rolesForMapping)
          organizationRolesRef.current = rolesForMapping
        }
      }

      const { data: membersData, error: membersError } = await sb
        .from('organization_members')
        .select('user_id, role, organization_role_id')
        .eq('organization_id', organizationId)

      if (membersError) throw membersError

      const members = membersData || []
      const userIds = members.map((m: { user_id: string }) => m.user_id).filter(Boolean)

      if (userIds.length === 0) {
        setAllUsers([])
        return
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      const roleById = new Map(rolesForMapping.map((r) => [r.id, r]))
      const memberByUserId = new Map(
        members.map((m: { user_id: string; role: string; organization_role_id: string | null }) => [m.user_id, m])
      )

      const processedUsers: UserProfileWithEmail[] = (profilesData || []).map((profile: UserProfileWithEmail) => {
        const member = memberByUserId.get(profile.user_id ?? '') as
          | { role: string; organization_role_id: string | null }
          | undefined
        const legacyRole = ((member?.role as UserRole | undefined) ?? 'user') as UserRole
        const orgRole = member?.organization_role_id ? roleById.get(member.organization_role_id) : null
        return {
          ...profile,
          role: (orgRole?.base_role_key as UserRole | undefined) ?? legacyRole,
          organization_role_id: member?.organization_role_id ?? null,
          role_name: orgRole?.name ?? getRoleLabel(legacyRole),
          base_role_key: orgRole?.base_role_key ?? legacyRole,
          isGuest: profile.user_id === null,
        }
      })

      setAllUsers(processedUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
      show('Error al cargar los usuarios', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Filtrado y paginación client-side
  const filteredUsers = useMemo(() => {
    let result = allUsers
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter || u.base_role_key === roleFilter)
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      result = result.filter((u) =>
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

  const handleResetFilters = () => {
    setSearchTerm('')
    setRoleFilter('all')
    setCurrentPage(1)
  }

  const handleRoleChange = async (userOrProfileId: string, organizationRoleId: string) => {
    const user = allUsers.find((u) => u.id === userOrProfileId || u.user_id === userOrProfileId)
    const userId = user?.user_id ?? userOrProfileId
    // Leer desde ref para evitar stale closure
    const selectedOrgRole = organizationRolesRef.current.find((r) => r.id === organizationRoleId)
    if (!selectedOrgRole) {
      show('Rol inválido', 'error')
      return
    }

    const legacyRole = (selectedOrgRole.base_role_key || 'user') as UserRole

    setUpdatingRole(userId)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { error } = await sb
        .from('organization_members')
        .update({
          role: legacyRole,
          organization_role_id: selectedOrgRole.id,
        } as never)
        .eq('organization_id', organizationId!)
        .eq('user_id', userId)

      if (error) throw error

      setAllUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId
            ? {
                ...u,
                role: legacyRole,
                organization_role_id: selectedOrgRole.id,
                role_name: selectedOrgRole.name,
                base_role_key: selectedOrgRole.base_role_key,
              }
            : u
        )
      )
      show(`Rol actualizado a ${selectedOrgRole.name}`, 'success')
    } catch (error) {
      console.error('Error updating user role:', error)
      show('Error al actualizar el rol', 'error')
    } finally {
      setUpdatingRole(null)
    }
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

      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, full_name: editForm.full_name.trim() || null, phone: editForm.phone.trim() || null }
            : u
        )
      )
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
      await fetchUsers()
    } catch (error) {
      console.error('Error creating user:', error)
      show(error instanceof Error ? error.message : 'Error al crear usuario', 'error')
    } finally {
      setCreatingUser(false)
    }
  }

  if (!isAdmin) return null

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-600 mt-2">Gestiona usuarios y roles en la organización</p>
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
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
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
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
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
          onChange={(e) => { setRoleFilter(e.target.value as UserRole | 'all'); setCurrentPage(1) }}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${roleFilter !== 'all' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
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
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
              description={searchTerm || roleFilter !== 'all' ? 'Probá ajustar los filtros.' : 'Aún no hay usuarios en esta organización.'}
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
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', user.isGuest ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800')}>
                          {user.isGuest ? 'Invitado' : 'Registrado'}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getRoleColor(user.base_role_key || user.role))}>
                          {user.role_name || getRoleLabel(user.role)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={user.organization_role_id ?? ''}
                        onChange={(e) => handleRoleChange(user.user_id ?? user.id, e.target.value)}
                        disabled={updatingRole === (user.user_id ?? user.id) || user.user_id === authUser?.id}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-200 disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        {organizationRoles.map((roleOption) => (
                          <option key={roleOption.id} value={roleOption.id}>
                            {roleOption.name}
                          </option>
                        ))}
                      </select>
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

                      return (
                        <tr key={userId} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{user.full_name || 'Sin nombre'}</p>
                              {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {user.phone || '—'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {address ? (
                              <div>
                                {address.address && <p>{address.address}</p>}
                                {address.city && address.state && (
                                  <p className="text-xs text-gray-500">{address.city}, {address.state}</p>
                                )}
                              </div>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn('px-2 py-1 rounded-full text-xs font-medium', user.isGuest ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800')}>
                              {user.isGuest ? 'Invitado' : 'Registrado'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getRoleColor(user.base_role_key || user.role))}>
                              {user.role_name || getRoleLabel(user.role)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <select
                                value={user.organization_role_id ?? ''}
                                onChange={(e) => handleRoleChange(userId, e.target.value)}
                                disabled={updatingRole === userId || user.user_id === authUser?.id}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-200 disabled:bg-gray-100 disabled:text-gray-500"
                              >
                                {organizationRoles.map((roleOption) => (
                                  <option key={roleOption.id} value={roleOption.id}>
                                    {roleOption.name}
                                  </option>
                                ))}
                              </select>
                              {updatingRole === userId && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-admin-600 shrink-0" />
                              )}
                            </div>
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
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} de {filteredUsers.length}
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
                    <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
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
