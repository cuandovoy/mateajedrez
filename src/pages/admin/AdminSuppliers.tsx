import { SupplierTable } from '@/components/admin/SupplierTable'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { normalizeUruguayanPhone } from '@/lib/uruguay-validators'
import { supplierSchema } from '@/lib/schemas'
import type { SupplierForm } from '@/lib/schemas'
import type { Supplier, SupplierInsert, SupplierUpdate } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useOrganization } from '@/hooks/useOrganization'
import { ArrowUpDown, Building2, Edit, Globe, Grid3x3, List, Mail, MapPin, Phone, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

// Helper to format RUT for display in form
function formatRUTForInput(rut: string): string {
  if (!rut) return ''
  const clean = rut.replace(/[^\d]/g, '')
  if (clean.length !== 12) return rut
  return `${clean.slice(0, 2)}.${clean.slice(2, 8)}.${clean.slice(8, 11)}-${clean.slice(11)}`
}

// Helper to format phone for display in form
function formatPhoneForInput(phone: string): string {
  if (!phone) return ''
  // If it already has +598, return as is
  if (phone.startsWith('+598')) {
    const digits = phone.slice(4).replace(/\D/g, '')
    if (digits.length === 8) {
      return `+598 ${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`
    }
  }
  return phone
}

type ViewMode = 'grid' | 'list'
type SupplierSortBy = 'name' | 'city' | 'country' | 'created_at'
type SortDirection = 'asc' | 'desc'


function AdminSuppliersContent() {
  const { organizationId } = useOrganization()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SupplierSortBy>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
  })

  useEffect(() => {
    if (organizationId) fetchSuppliers()
  }, [organizationId])

  const fetchSuppliers = async () => {
    if (!organizationId) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name')

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter suppliers by search term
  const filteredSuppliers = useMemo(() => {
    const searchLower = search.toLowerCase().trim()
    const filtered = !searchLower
      ? suppliers
      : suppliers.filter(
          (supplier) =>
            supplier.name.toLowerCase().includes(searchLower) ||
            supplier.contact_name?.toLowerCase().includes(searchLower) ||
            supplier.email?.toLowerCase().includes(searchLower) ||
            supplier.phone?.toLowerCase().includes(searchLower) ||
            supplier.city?.toLowerCase().includes(searchLower) ||
            supplier.country?.toLowerCase().includes(searchLower)
        )

    const direction = sortDirection === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'es') * direction
      if (sortBy === 'city') return (a.city || '').localeCompare(b.city || '', 'es') * direction
      if (sortBy === 'country') return (a.country || '').localeCompare(b.country || '', 'es') * direction
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      return (aTime - bTime) * direction
    })
  }, [suppliers, search, sortBy, sortDirection])

  const onSubmit = async (data: SupplierForm) => {
    try {
      // Normalize phone number
      const normalizedPhone = data.phone ? normalizeUruguayanPhone(data.phone) : null
      
      // Clean RUT (remove formatting)
      const cleanRUT = data.tax_id
        ? data.tax_id.replace(/[\s.\-]/g, '')
        : null

      const baseData = {
        ...data,
        email: data.email || null,
        website: data.website || null,
        phone: normalizedPhone,
        tax_id: cleanRUT,
      }

      if (editingSupplier) {
        const supplierData: SupplierUpdate = { ...baseData }
        const { error } = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', editingSupplier.id)

        if (error) throw error
      } else {
        const supplierData: SupplierInsert = { ...baseData, organization_id: organizationId! }
        const { error } = await supabase
          .from('suppliers')
          .insert(supplierData)

        if (error) throw error
      }

      setIsModalOpen(false)
      setEditingSupplier(null)
      reset({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: 'Uruguay',
        postal_code: '',
        tax_id: '',
        website: '',
        notes: '',
        is_active: true,
      })
      fetchSuppliers()
    } catch (error) {
      console.error('Error saving supplier:', error)
      alert('Error al guardar el proveedor')
    }
  }

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    reset({
      name: supplier.name,
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: formatPhoneForInput(supplier.phone || ''),
      address: supplier.address || '',
      city: supplier.city || '',
      country: supplier.country || 'Uruguay',
      postal_code: supplier.postal_code || '',
      tax_id: formatRUTForInput(supplier.tax_id || ''),
      website: supplier.website || '',
      notes: supplier.notes || '',
      is_active: supplier.is_active ?? true,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este proveedor?')) return

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchSuppliers()
    } catch (error) {
      console.error('Error deleting supplier:', error)
      alert('Error al eliminar el proveedor')
    }
  }

  const handleNew = () => {
    setEditingSupplier(null)
    reset({
      name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'Uruguay',
      postal_code: '',
      tax_id: '',
      website: '',
      notes: '',
      is_active: true,
    })
    setIsModalOpen(true)
  }

  if (!organizationId || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Gestiona la información de tus proveedores</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-admin-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              title="Vista de lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-admin-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              title="Vista de grilla"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Proveedor
          </Button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar proveedores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SupplierSortBy)}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${sortBy !== 'name' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
        >
          <option value="name">Nombre</option>
          <option value="city">Ciudad</option>
          <option value="country">País</option>
          <option value="created_at">Fecha creación</option>
        </select>
        <button
          onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          title={sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortDirection === 'asc' ? 'A→Z' : 'Z→A'}
        </button>
        {(search || sortBy !== 'name' || sortDirection !== 'asc') && (
          <button
            onClick={() => { setSearch(''); setSortBy('name'); setSortDirection('asc') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Limpiar
          </button>
        )}
        <span className="ml-auto text-sm text-gray-500">
          {filteredSuppliers.length} de {suppliers.length}
        </span>
      </div>

      {/* Suppliers Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="relative">
              <CardContent className="p-6">
                {/* Actions Menu */}
                <div className="absolute top-4 right-4">
                  <ActionsMenu
                    actions={[
                      {
                        label: 'Editar',
                        icon: <Edit className="h-4 w-4" />,
                        onClick: () => handleEdit(supplier),
                      },
                      {
                        label: 'Eliminar',
                        icon: <Trash2 className="h-4 w-4" />,
                        onClick: () => handleDelete(supplier.id),
                        variant: 'danger',
                      },
                    ]}
                  />
                </div>
                <div className="pr-8">
                  <div className="flex items-center space-x-2 mb-3">
                    <Building2 className="h-5 w-5 text-admin-600" />
                    <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
                  </div>
                  {supplier.contact_name && (
                    <p className="text-sm text-gray-600 mb-2">Contacto: {supplier.contact_name}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    {supplier.email && (
                      <div className="flex items-center text-gray-600">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        {supplier.email}
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center text-gray-600">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {supplier.phone}
                      </div>
                    )}
                    {(supplier.city || supplier.country) && (
                      <div className="flex items-center text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                        {[supplier.city, supplier.country].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {supplier.website && (
                      <div className="flex items-center text-gray-600">
                        <Globe className="h-4 w-4 mr-2 text-gray-400" />
                        <a
                          href={supplier.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-admin-600 hover:text-admin-700"
                        >
                          Sitio web
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        supplier.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {supplier.is_active ? 'Activo' : 'Inactivo'}
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
            <SupplierTable
              suppliers={filteredSuppliers}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </CardContent>
        </Card>
      )}

      {filteredSuppliers.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg mb-4">
            {search
              ? 'No se encontraron proveedores con el término de búsqueda'
              : 'No hay proveedores disponibles'}
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
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <CardTitle>
                  {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingSupplier(null)
                    reset({
                      name: '',
                      contact_name: '',
                      email: '',
                      phone: '',
                      address: '',
                      city: '',
                      country: 'Uruguay',
                      postal_code: '',
                      tax_id: '',
                      website: '',
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
                {/* Información Básica */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Información Básica
                  </h3>
                  <div className="space-y-4">
                    <Input
                      label="Nombre del Proveedor *"
                      {...register('name')}
                      error={errors.name?.message}
                      placeholder="Ej: Proveedor ABC S.A."
                    />
                    <Input
                      label="Persona de Contacto"
                      {...register('contact_name')}
                      error={errors.contact_name?.message}
                      placeholder="Nombre del contacto principal"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Email"
                        type="email"
                        {...register('email')}
                        error={errors.email?.message}
                        placeholder="contacto@proveedor.com"
                      />
                      <div>
                        <Input
                          label="Teléfono Uruguayo *"
                          {...register('phone')}
                          error={errors.phone?.message}
                          placeholder="+598 9 123 4567 o 0912 3456"
                          onChange={(e) => {
                            let value = e.target.value.replace(/[\s\-()]/g, '')
                            
                            // If user types +598, keep it
                            if (value.startsWith('+598')) {
                              let digits = value.slice(4).replace(/\D/g, '')
                              if (digits.length > 8) digits = digits.slice(0, 8)
                              if (digits.length > 0) {
                                // Format: +598 X XXX XXXX
                                if (digits.length <= 1) {
                                  value = `+598 ${digits}`
                                } else if (digits.length <= 4) {
                                  value = `+598 ${digits.slice(0, 1)} ${digits.slice(1)}`
                                } else {
                                  value = `+598 ${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`
                                }
                              } else {
                                value = '+598 '
                              }
                            } else if (value.startsWith('598')) {
                              // User typed 598, add +
                              let digits = value.slice(3).replace(/\D/g, '')
                              if (digits.length > 8) digits = digits.slice(0, 8)
                              if (digits.length > 0) {
                                if (digits.length <= 1) {
                                  value = `+598 ${digits}`
                                } else if (digits.length <= 4) {
                                  value = `+598 ${digits.slice(0, 1)} ${digits.slice(1)}`
                                } else {
                                  value = `+598 ${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`
                                }
                              } else {
                                value = '+598 '
                              }
                            } else if (value.startsWith('0')) {
                              // User typed 0 (local format), convert to +598
                              let digits = value.slice(1).replace(/\D/g, '')
                              if (digits.length > 8) digits = digits.slice(0, 8)
                              if (digits.length > 0) {
                                if (digits.length <= 1) {
                                  value = `+598 ${digits}`
                                } else if (digits.length <= 4) {
                                  value = `+598 ${digits.slice(0, 1)} ${digits.slice(1)}`
                                } else {
                                  value = `+598 ${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`
                                }
                              } else {
                                value = '+598 '
                              }
                            } else {
                              // Just digits, add +598 prefix
                              let digits = value.replace(/\D/g, '')
                              if (digits.length > 8) digits = digits.slice(0, 8)
                              if (digits.length > 0) {
                                if (digits.length <= 1) {
                                  value = `+598 ${digits}`
                                } else if (digits.length <= 4) {
                                  value = `+598 ${digits.slice(0, 1)} ${digits.slice(1)}`
                                } else {
                                  value = `+598 ${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`
                                }
                              } else {
                                value = ''
                              }
                            }
                            
                            e.target.value = value
                            register('phone').onChange(e)
                          }}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Formato: +598 9 123 4567 (móvil) o +598 2 123 4567 (fijo)
                        </p>
                      </div>
                    </div>
                    <div>
                      <Input
                        label="RUT (Registro Único Tributario) *"
                        {...register('tax_id')}
                        error={errors.tax_id?.message}
                        placeholder="XX.XXXXXX.001-X"
                        onChange={(e) => {
                          // Auto-format RUT as user types
                          let value = e.target.value.replace(/[^\d]/g, '')
                          if (value.length > 12) value = value.slice(0, 12)
                          
                          // Format: XX.XXXXXX.001-X
                          if (value.length > 11) {
                            value = `${value.slice(0, 2)}.${value.slice(2, 8)}.${value.slice(8, 11)}-${value.slice(11)}`
                          } else if (value.length > 8) {
                            value = `${value.slice(0, 2)}.${value.slice(2, 8)}.${value.slice(8)}`
                          } else if (value.length > 2) {
                            value = `${value.slice(0, 2)}.${value.slice(2)}`
                          }
                          
                          e.target.value = value
                          register('tax_id').onChange(e)
                        }}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Formato: XX.XXXXXX.001-X (12 dígitos)
                      </p>
                    </div>
                    <Input
                      label="Sitio Web"
                      type="url"
                      {...register('website')}
                      error={errors.website?.message}
                      placeholder="https://www.proveedor.com"
                    />
                  </div>
                </div>

                {/* Dirección */}
                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          País
                        </label>
                        <select
                          {...register('country')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 bg-white"
                          defaultValue="Uruguay"
                        >
                          <option value="">Seleccionar país</option>
                          <option value="Uruguay">Uruguay</option>
                          <option value="Argentina">Argentina</option>
                          <option value="Brasil">Brasil</option>
                          <option value="Chile">Chile</option>
                          <option value="Paraguay">Paraguay</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <Input
                        label="Código Postal"
                        {...register('postal_code')}
                        error={errors.postal_code?.message}
                        placeholder="CP"
                      />
                    </div>
                  </div>
                </div>

                {/* Notas */}
                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Información Adicional
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas
                    </label>
                    <textarea
                      {...register('notes')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 resize-none"
                      rows={4}
                      placeholder="Información adicional sobre el proveedor..."
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('is_active')}
                      className="h-4 w-4 text-admin-600 focus:ring-admin-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      Proveedor activo
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-4 pt-4 border-t border-gray-200">
                  <Button type="submit" className="flex-1">
                    {editingSupplier ? 'Actualizar Proveedor' : 'Crear Proveedor'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingSupplier(null)
                      reset({
                        name: '',
                        contact_name: '',
                        email: '',
                        phone: '',
                        address: '',
                        city: '',
                        country: 'Uruguay',
                        postal_code: '',
                        tax_id: '',
                        website: '',
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

export function AdminSuppliers() {
  return <AdminSuppliersContent />
}
