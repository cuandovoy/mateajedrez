import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import type { UserProfile } from '@/types'
import { ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

interface UserProfileWithEmail extends UserProfile {
  email?: string | null
  isGuest?: boolean
}

type UserRole = 'user' | 'admin'

const ITEMS_PER_PAGE = 10

const getRoleLabel = (role: string): string => {
  const roleMap: Record<string, string> = {
    user: 'Usuario',
    admin: 'Administrador',
  }
  return roleMap[role] || role
}

const getRoleColor = (role: string): string => {
  const colorMap: Record<string, string> = {
    user: 'bg-blue-100 text-blue-800',
    admin: 'bg-purple-100 text-purple-800',
  }
  return colorMap[role] || 'bg-gray-100 text-gray-800'
}

export function AdminUsers() {
  const { show } = useToastStore()
  const [users, setUsers] = useState<UserProfileWithEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')

  useEffect(() => {
    fetchUsers()
  }, [currentPage, roleFilter, searchTerm])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      // Apply role filter
      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter)
      }

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      // Process users data
      let processedUsers: UserProfileWithEmail[] = (data || []).map((user: UserProfileWithEmail) => ({
        ...user,
        isGuest: user.user_id === null,
      }))

      // Filter by search term (client-side for now, since we're searching across multiple fields)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        processedUsers = processedUsers.filter((user) => {
          return (
            user.full_name?.toLowerCase().includes(searchLower) ||
            user.phone?.includes(searchTerm) ||
            (user.address as { address?: string; city?: string })?.address?.toLowerCase().includes(searchLower) ||
            (user.address as { city?: string })?.city?.toLowerCase().includes(searchLower)
          )
        })
      }

      setUsers(processedUsers)
      setTotalCount(count || 0)
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
        <p className="text-gray-600 mt-2">Gestiona todos los usuarios y sus roles</p>
      </div>

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
            <div className="text-center py-12">
              <p className="text-gray-600">No se encontraron usuarios</p>
            </div>
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
                        <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
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
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {new Date(user.created_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          {/* <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {user.role === 'user' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRoleChange(user.id, 'admin')}
                                  disabled={updatingRole === user.id}
                                  className="text-purple-600 hover:text-purple-700"
                                >
                                  {updatingRole === user.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                  ) : (
                                    <>
                                      <ShieldCheck className="h-4 w-4 mr-1" />
                                      Hacer Admin
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRoleChange(user.id, 'user')}
                                  disabled={updatingRole === user.id}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  {updatingRole === user.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                  ) : (
                                    <>
                                      <UserCheck className="h-4 w-4 mr-1" />
                                      Hacer Usuario
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </td> */}
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
