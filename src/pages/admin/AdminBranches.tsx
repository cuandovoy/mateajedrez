import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { BranchTable } from '@/components/admin/BranchTable'
import { SearchFilter } from '@/components/filters'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import {
  Building2,
  Edit,
  Filter,
  Grid3x3,
  List,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import type { Branch, BranchInsert, BranchUpdate } from '@/types'

type ViewMode = 'grid' | 'list'

const branchSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  code: z.string().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('Uruguay'),
  postal_code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
})

type BranchForm = z.infer<typeof branchSchema>

function AdminBranchesContent() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BranchForm>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      country: 'Uruguay',
      is_active: true,
    },
  })

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name')

      if (error) throw error
      setBranches((data || []) as Branch[])
    } catch (error) {
      console.error('Error fetching branches:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredBranches = useMemo(() => {
    if (!search.trim()) {
      return branches
    }

    const searchLower = search.toLowerCase()
    return branches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(searchLower) ||
        branch.code?.toLowerCase().includes(searchLower) ||
        branch.email?.toLowerCase().includes(searchLower) ||
        branch.phone?.toLowerCase().includes(searchLower) ||
        branch.city?.toLowerCase().includes(searchLower) ||
        branch.country?.toLowerCase().includes(searchLower) ||
        branch.address?.toLowerCase().includes(searchLower)
    )
  }, [branches, search])

  const onSubmit = async (data: BranchForm) => {
    try {
      const branchData: BranchInsert | BranchUpdate = {
        ...data,
        code: data.code || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        postal_code: data.postal_code || null,
        phone: data.phone || null,
        notes: data.notes || null,
      }

      if (editingBranch) {
        const { error } = await supabase
          .from('branches')
          // @ts-expect-error - Supabase types need to be regenerated after migration
          .update(branchData)
          .eq('id', editingBranch.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('branches')
          // @ts-expect-error - Supabase types need to be regenerated after migration
          .insert(branchData)

        if (error) throw error
      }

      setIsModalOpen(false)
      setEditingBranch(null)
      reset({
        name: '',
        code: '',
        address: '',
        city: '',
        country: 'Uruguay',
        postal_code: '',
        phone: '',
        email: '',
        notes: '',
        is_active: true,
      })
      fetchBranches()
    } catch (error) {
      console.error('Error saving branch:', error)
      alert('Error al guardar la sucursal')
    }
  }

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch)
    reset({
      name: branch.name,
      code: branch.code || '',
      address: branch.address || '',
      city: branch.city || '',
      country: branch.country || 'Uruguay',
      postal_code: branch.postal_code || '',
      phone: branch.phone || '',
      email: branch.email || '',
      notes: branch.notes || '',
      is_active: branch.is_active,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta sucursal? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const { error } = await supabase.from('branches').delete().eq('id', id)

      if (error) throw error
      fetchBranches()
    } catch (error) {
      console.error('Error deleting branch:', error)
      alert('Error al eliminar la sucursal. Asegúrate de que no tenga órdenes asociadas.')
    }
  }

  const handleNew = () => {
    setEditingBranch(null)
    reset({
      name: '',
      code: '',
      address: '',
      city: '',
      country: 'Uruguay',
      postal_code: '',
      phone: '',
      email: '',
      notes: '',
      is_active: true,
    })
    setIsModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sucursales</h1>
          <p className="text-gray-600 mt-2">Gestiona las sucursales de tu tienda</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${
                viewMode === 'list'
                  ? 'bg-admin-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Vista de lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${
                viewMode === 'grid'
                  ? 'bg-admin-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Vista de grilla"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Sucursal
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Buscar sucursales..."
            />
          </div>
          {search && (
            <div className="mt-4">
              <Button variant="outline" onClick={() => setSearch('')}>
                Limpiar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Mostrando {filteredBranches.length} de {branches.length} sucursales
        </p>
      </div>

      {/* Branches Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBranches.map((branch) => (
            <Card key={branch.id} className="relative">
              <CardContent className="p-6">
                <div className="absolute top-4 right-4">
                  <ActionsMenu
                    actions={[
                      {
                        label: 'Editar',
                        icon: <Edit className="h-4 w-4" />,
                        onClick: () => handleEdit(branch),
                      },
                      {
                        label: 'Eliminar',
                        icon: <Trash2 className="h-4 w-4" />,
                        onClick: () => handleDelete(branch.id),
                        variant: 'danger',
                      },
                    ]}
                  />
                </div>
                <div className="pr-8">
                  <div className="flex items-center space-x-2 mb-3">
                    <Building2 className="h-5 w-5 text-admin-600" />
                    <h3 className="text-lg font-semibold text-gray-900">{branch.name}</h3>
                  </div>
                  {branch.code && (
                    <p className="text-sm text-gray-600 mb-2">Código: {branch.code}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    {branch.email && (
                      <div className="flex items-center text-gray-600">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        {branch.email}
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center text-gray-600">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {branch.phone}
                      </div>
                    )}
                    {(branch.address || branch.city || branch.country) && (
                      <div className="flex items-start text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          {branch.address && <div>{branch.address}</div>}
                          {(branch.city || branch.country) && (
                            <div className="text-xs text-gray-500">
                              {[branch.city, branch.country, branch.postal_code]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        branch.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {branch.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <BranchTable
              branches={filteredBranches}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </CardContent>
        </Card>
      )}

      {filteredBranches.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg mb-4">
            {search
              ? 'No se encontraron sucursales con el término de búsqueda'
              : 'No hay sucursales disponibles'}
          </p>
          {search && (
            <Button variant="outline" onClick={() => setSearch('')}>
              Limpiar búsqueda
            </Button>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">
                  {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingBranch(null)
                    reset({
                      name: '',
                      code: '',
                      address: '',
                      city: '',
                      country: 'Uruguay',
                      postal_code: '',
                      phone: '',
                      email: '',
                      notes: '',
                      is_active: true,
                    })
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-6 py-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                    Información Básica
                  </h3>
                  <div className="space-y-4">
                    <Input
                      label="Nombre de la Sucursal *"
                      {...register('name')}
                      error={errors.name?.message}
                      placeholder="Ej: Sucursal Centro"
                    />
                    <Input
                      label="Código (opcional)"
                      {...register('code')}
                      error={errors.code?.message}
                      placeholder="Ej: MAIN, BRANCH-01"
                    />
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('is_active')}
                        className="h-4 w-4 text-admin-600 focus:ring-admin-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">Sucursal activa</label>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                    Contacto
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Email"
                        type="email"
                        {...register('email')}
                        error={errors.email?.message}
                        placeholder="sucursal@tienda.com"
                      />
                      <Input
                        label="Teléfono"
                        {...register('phone')}
                        error={errors.phone?.message}
                        placeholder="+598 9 123 4567"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                    Dirección
                  </h3>
                  <div className="space-y-4">
                    <Input
                      label="Dirección"
                      {...register('address')}
                      error={errors.address?.message}
                      placeholder="Calle y número"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        label="Ciudad"
                        {...register('city')}
                        error={errors.city?.message}
                        placeholder="Ciudad"
                      />
                      <Input
                        label="País"
                        {...register('country')}
                        error={errors.country?.message}
                        placeholder="País"
                      />
                      <Input
                        label="Código Postal"
                        {...register('postal_code')}
                        error={errors.postal_code?.message}
                        placeholder="Ej: 11300"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                    Notas
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <textarea
                      {...register('notes')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                      rows={3}
                      placeholder="Notas adicionales sobre la sucursal..."
                    />
                  </div>
                </section>

                <div className="flex space-x-4 pt-4 border-t">
                  <Button type="submit" className="flex-1">
                    {editingBranch ? 'Actualizar' : 'Crear'} Sucursal
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingBranch(null)
                      reset({
                        name: '',
                        code: '',
                        address: '',
                        city: '',
                        country: 'Uruguay',
                        postal_code: '',
                        phone: '',
                        email: '',
                        notes: '',
                        is_active: true,
                      })
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export function AdminBranches() {
  return <AdminBranchesContent />
}
