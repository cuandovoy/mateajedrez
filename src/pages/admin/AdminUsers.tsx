import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useUserManagement } from '@/hooks/useUserManagement'
import { supabase } from '@/lib/supabase'
import { cn, formatDateShort } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import type { UserProfile } from '@/types'
import { ChevronLeft, ChevronRight, Filter, Plus, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface UserProfileWithEmail extends UserProfile {
  email?: string | null
  isGuest?: boolean
}

type UserRole = 'user' | 'admin' | 'manager' | 'viewer'

interface NewUserFormData {
  email: string
  password: string
  fullName: string
  phone: string
  role: UserRole
}

const ITEMS_PER_PAGE = 10

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
  const [users, setUsers] = useState<UserProfileWithEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [creatingUser, setCreatingUser] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newUserForm, setNewUserForm] = useState<NewUserFormData>({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'user',
  })
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }
    if (organizationId) fetchUsers()
  }, [isAdmin, organizationId, currentPage, roleFilter, searchTerm, navigate])

  const fetchUsers = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      // Fetch org members (role is per-org)
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId)

      if (membersError) throw membersError

      const members = membersData || []
      const userIds = members.map((m: { user_id: string }) => m.user_id).filter(Boolean)

      if (userIds.length === 0) {
        setUsers([])
        setTotalCount(0)
        return
      }

      // Fetch user profiles for those users
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      const memberByUserId = new Map(members.map((m: { user_id: string; role: string }) => [m.user_id, m.role]))

      // Merge: profile + org role (role from organization_members)
      let processedUsers: UserProfileWithEmail[] = (profilesData || []).map((profile: UserProfileWithEmail) => {
        const orgRole = (memberByUserId.get(profile.user_id ?? '') ?? 'user') as UserRole
        return {
          ...profile,
          role: orgRole,
          isGuest: profile.user_id === null,
        }
      })

      // Apply role filter
      if (roleFilter !== 'all') {
        processedUsers = processedUsers.filter((u) => u.role === roleFilter)
      }

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        processedUsers = processedUsers.filter((user) =>
          user.full_name?.toLowerCase().includes(searchLower) ||
          user.phone?.includes(searchTerm) ||
          (user.address as { address?: string; city?: string })?.address?.toLowerCase().includes(searchLower) ||
          (user.address as { city?: string })?.city?.toLowerCase().includes(searchLower)
        )
      }

      // Pagination (client-side after filters)
      const total = processedUsers.length
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE
      processedUsers = processedUsers.slice(from, to)

      setUsers(processedUsers)
      setTotalCount(total)
    } catch (error) {
      console.error('Error fetching users:', error)
      show('Error al cargar los usuarios', 'error')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const handleResetFilters = () => {
    setSearchTerm('')
    setRoleFilter('all')
    setCurrentPage(1)
  }

  const handleRoleChange = async (userOrProfileId: string, role: UserRole) => {
    const user = users.find((u) => u.id === userOrProfileId || u.user_id === userOrProfileId)
    const userId = user?.user_id ?? userOrProfileId
    setUpdatingRole(userId)
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role } as never)
        .eq('organization_id', organizationId!)
        .eq('user_id', userId)

      if (error) throw error

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.user_id === userId ? { ...user, role } : user
        )
      )
      show(`Rol actualizado a ${getRoleLabel(role)}`, 'success')
    } catch (error) {
      console.error('Error updating user role:', error)
      show('Error al actualizar el rol', 'error')
    } finally {
      setUpdatingRole(null)
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
      setNewUserForm({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        role: 'user',
      })
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo
                </label>
                <Input
                  type="text"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
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
                <Button
                  type="button"
                  variant="outline"
                  disabled={creatingUser}
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Nombre, teléfono, dirección..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rol
              </label>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as UserRole | 'all')
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-200"
              >
                <option value="all">Todos</option>
                <option value="user">Usuario</option>
                <option value="viewer">Visualizador</option>
                <option value="manager">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>

          {(roleFilter !== 'all' || searchTerm) && (
            <div className="mt-4">
              <Button variant="outline" onClick={handleResetFilters}>
                Limpiar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600"></div>
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No se encontraron usuarios"
              description={searchTerm || roleFilter !== 'all' ? 'Prueba ajustar los filtros de búsqueda.' : 'Aún no hay usuarios en esta organización.'}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Usuario</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Teléfono</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Dirección</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipo</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Rol</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Acciones</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const address = user.address as {
                        address?: string
                        city?: string
                        state?: string
                        zipCode?: string
                        country?: string
                      } | null

                      return (
                        <tr key={user.user_id ?? user.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {user.full_name || 'Sin nombre'}
                              </p>
                              {user.email && (
                                <p className="text-sm text-gray-500">{user.email}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {user.phone || 'N/A'}
                          </td>
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
                              'N/A'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium',
                                user.isGuest
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-green-100 text-green-800'
                              )}
                            >
                              {user.isGuest ? 'Invitado' : 'Registrado'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium',
                                getRoleColor(user.role)
                              )}
                            >
                              {getRoleLabel(user.role)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <select
                                value={user.role ?? 'user'}
                                onChange={(e) => handleRoleChange(user.user_id ?? user.id, e.target.value as UserRole)}
                                disabled={updatingRole === (user.user_id ?? user.id) || user.user_id === authUser?.id}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-200 disabled:bg-gray-100 disabled:text-gray-500"
                              >
                                <option value="user">Usuario</option>
                                <option value="viewer">Visualizador</option>
                                <option value="manager">Gerente</option>
                                <option value="admin">Administrador</option>
                              </select>
                              {updatingRole === user.id && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-admin-600"></div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {formatDateShort(user.created_at, settings)}
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
                  <div className="text-sm text-gray-600">
                    Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount} usuarios
                  </div>
                  <div className="flex items-center space-x-2">
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
    </div>
  )
}
