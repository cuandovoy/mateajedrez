import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { supabase } from '@/lib/supabase'
import { formatDateShort } from '@/lib/utils'
import { PAGE_SIZE_ADMIN } from '@/lib/constants'
import { useToastStore } from '@/store/toastStore'
import type { Customer } from '@/types/database.types'
import { ChevronLeft, ChevronRight, Edit, ExternalLink, Mail, MapPin, MessageCircle, Phone, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface CustomerForm {
  full_name: string
  email: string
  phone: string
  rut: string
  address: {
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  notes: string
}

export function AdminCustomers() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CustomerForm>({
    full_name: '',
    email: '',
    phone: '',
    rut: '',
    address: {
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'Uruguay',
    },
    notes: '',
  })
  const { show } = useToastStore()

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      setDebouncedSearch(searchTerm)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchCustomers = useCallback(async () => {
    if (!organizationId) return
    try {
      setLoading(true)
      const from = (currentPage - 1) * PAGE_SIZE_ADMIN
      const to = from + PAGE_SIZE_ADMIN - 1

      let query = (supabase as any)
        .from('customers')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (debouncedSearch.trim()) {
        query = query.or(
          `full_name.ilike.%${debouncedSearch.trim()}%,phone.ilike.%${debouncedSearch.trim()}%,email.ilike.%${debouncedSearch.trim()}%,rut.ilike.%${debouncedSearch.trim()}%`
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setCustomers(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error fetching customers:', error)
      show('Error al cargar clientes', 'error')
    } finally {
      setLoading(false)
    }
  }, [organizationId, currentPage, debouncedSearch])

  useEffect(() => {
    if (organizationId) fetchCustomers()
  }, [organizationId, currentPage, debouncedSearch, fetchCustomers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (editingId) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update({
            full_name: formData.full_name,
            email: formData.email || null,
            phone: formData.phone,
            rut: formData.rut.trim() || null,
            address: formData.address,
            notes: formData.notes || null,
          } as never)
          .eq('id', editingId)

        if (error) throw error
        show('Cliente actualizado correctamente', 'success')
      } else {
        // Create new customer
        const { error } = await supabase
          .from('customers')
          .insert({
            organization_id: organizationId,
            full_name: formData.full_name,
            email: formData.email || null,
            phone: formData.phone,
            rut: formData.rut.trim() || null,
            address: formData.address,
            notes: formData.notes || null,
            is_active: true,
          } as never)

        if (error) throw error
        show('Cliente creado correctamente', 'success')
      }

      setFormData({
        full_name: '',
        email: '',
        phone: '',
        rut: '',
        address: {
          address: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'Uruguay',
        },
        notes: '',
      })
      setEditingId(null)
      setShowForm(false)
      await fetchCustomers()
    } catch (error) {
      console.error('Error saving customer:', error)
      show('Error al guardar cliente', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (customer: Customer) => {
    const address = (customer.address || {}) as any
    setFormData({
      full_name: customer.full_name,
      email: customer.email || '',
      phone: customer.phone,
      rut: customer.rut || '',
      address: {
        address: address.address || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.zipCode || '',
        country: address.country || 'Uruguay',
      },
      notes: customer.notes || '',
    })
    setEditingId(customer.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este cliente?')) return

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) throw error
      show('Cliente eliminado correctamente', 'success')
      await fetchCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
      show('Error al eliminar cliente', 'error')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      rut: '',
      address: {
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'Uruguay',
      },
      notes: '',
    })
  }

  const handleWhatsApp = (phone: string, fullName: string) => {
    // Format phone number for WhatsApp (remove spaces and special characters)
    const formattedPhone = phone.replace(/[\s\-\(\)]/g, '')
    
    // Add country code if not present (assuming Uruguay +598)
    let whatsappPhone = formattedPhone
    if (!formattedPhone.startsWith('+')) {
      // If starts with 9, assume it's Uruguay number without country code
      if (formattedPhone.startsWith('9')) {
        whatsappPhone = '+598' + formattedPhone
      } else {
        whatsappPhone = '+' + formattedPhone
      }
    }
    
    // Create WhatsApp link with greeting message
    const message = `Hola ${fullName}, ¿cómo estás?`
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${whatsappPhone.replace('+', '')}?text=${encodedMessage}`
    
    // Open in new tab
    window.open(whatsappUrl, '_blank')
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE_ADMIN))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount > 0 ? `${totalCount} cliente${totalCount !== 1 ? 's' : ''}` : 'Sin clientes registrados'}
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? 'Editar Cliente' : 'Crear Nuevo Cliente'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    RUT (opcional)
                  </label>
                  <Input
                    type="text"
                    value={formData.rut}
                    onChange={(e) =>
                      setFormData({ ...formData, rut: e.target.value })
                    }
                    placeholder="Ej: 214567890012"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Dirección
                </label>
                <div className="space-y-3">
                  <Input
                    type="text"
                    placeholder="Calle y número"
                    value={formData.address.address}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, address: e.target.value },
                      })
                    }
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      type="text"
                      placeholder="Ciudad"
                      value={formData.address.city}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, city: e.target.value },
                        })
                      }
                    />
                    <Input
                      type="text"
                      placeholder="Provincia"
                      value={formData.address.state}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, state: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      type="text"
                      placeholder="Código Postal"
                      value={formData.address.zipCode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, zipCode: e.target.value },
                        })
                      }
                    />
                    <Input
                      type="text"
                      placeholder="País"
                      value={formData.address.country}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, country: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={loading}
                  isLoading={loading}
                >
                  {editingId ? 'Actualizar Cliente' : 'Crear Cliente'}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Barra de filtros inline */}
      {!showForm && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Nombre, teléfono, email o RUT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-8 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-admin-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="h-9 px-3 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* Customers Table */}
      {!showForm && (
        <Card>
          <CardContent className="pt-6">
            {loading && customers.length === 0 ? (
              <SkeletonTable rows={PAGE_SIZE_ADMIN} />
            ) : !loading && customers.length === 0 ? (
              <EmptyState
                icon={Users}
                title={debouncedSearch ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                description={debouncedSearch ? 'Probá ajustar el término de búsqueda.' : 'Agregá tu primer cliente para empezar a gestionar ventas.'}
                action={!debouncedSearch ? { label: 'Nuevo cliente', onClick: () => setShowForm(true) } : undefined}
              />
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y">
                  {customers.map((customer) => {
                    const address = (customer.address || {}) as any
                    return (
                      <div key={customer.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/customers/${customer.id}`}
                            className="font-medium text-gray-900 hover:text-admin-600 inline-flex items-center gap-1"
                          >
                            {customer.full_name}
                            <ExternalLink className="h-3 w-3 text-gray-400" />
                          </Link>
                          <ActionsMenu
                            actions={[
                              { label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" />, onClick: () => handleWhatsApp(customer.phone, customer.full_name) },
                              { label: 'Editar', icon: <Edit className="h-4 w-4" />, onClick: () => handleEdit(customer) },
                              { label: 'Eliminar', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(customer.id), variant: 'danger' },
                            ]}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-3.5 w-3.5 text-gray-400" />
                          {customer.phone}
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Mail className="h-3.5 w-3.5 text-gray-400" />
                            {customer.email}
                          </div>
                        )}
                        {address.city && (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <MapPin className="h-3.5 w-3.5" />
                            {[address.city, address.state].filter(Boolean).join(', ')}
                          </div>
                        )}
                        <p className="text-xs text-gray-400">{formatDateShort(customer.created_at, settings)}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Nombre</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Contacto</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Dirección</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Fecha Registro</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {customers.map((customer) => {
                        const address = (customer.address || {}) as any
                        return (
                          <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4">
                              <Link to={`/customers/${customer.id}`} className="font-medium text-gray-900 hover:text-admin-600 hover:underline inline-flex items-center gap-1">
                                {customer.full_name}
                                <ExternalLink className="h-3 w-3 text-gray-400" />
                              </Link>
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2 text-gray-600"><Phone className="h-4 w-4" />{customer.phone}</div>
                                {customer.email && <div className="flex items-center gap-2 text-gray-600"><Mail className="h-4 w-4" />{customer.email}</div>}
                                {customer.rut && <div className="flex items-center gap-2 text-gray-600"><span className="inline-block h-4 w-4 rounded-sm bg-gray-200 text-[10px] leading-4 text-center font-semibold text-gray-700">R</span>{customer.rut}</div>}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {address.address ? (
                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                  <div><div>{address.address}</div><div>{address.city}, {address.state}</div></div>
                                </div>
                              ) : <span className="text-gray-400 text-sm">—</span>}
                            </td>
                            <td className="py-3 px-4"><div className="text-sm text-gray-600">{formatDateShort(customer.created_at, settings)}</div></td>
                            <td className="py-3 px-4 text-right">
                              <ActionsMenu actions={[
                                { label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" />, onClick: () => handleWhatsApp(customer.phone, customer.full_name) },
                                { label: 'Editar', icon: <Edit className="h-4 w-4" />, onClick: () => handleEdit(customer) },
                                { label: 'Eliminar', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(customer.id), variant: 'danger' },
                              ]} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2">
                    <p className="text-sm text-gray-600">
                      {(currentPage - 1) * PAGE_SIZE_ADMIN + 1}–{Math.min(currentPage * PAGE_SIZE_ADMIN, totalCount)} de {totalCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Anterior</span>
                      </Button>
                      <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <span className="hidden sm:inline">Siguiente</span>
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
