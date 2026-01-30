import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/store/toastStore'
import type { Customer } from '@/types/database.types'
import { Edit, Mail, MapPin, MessageCircle, Phone, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CustomerForm {
  full_name: string
  email: string
  phone: string
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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CustomerForm>({
    full_name: '',
    email: '',
    phone: '',
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
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      show('Error al cargar clientes', 'error')
    } finally {
      setLoading(false)
    }
  }

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
            full_name: formData.full_name,
            email: formData.email || null,
            phone: formData.phone,
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

  const filteredCustomers = customers.filter((customer) =>
    customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Total de clientes: {filteredCustomers.length}
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

      {/* Search */}
      {!showForm && (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {/* Customers Table */}
      {!showForm && (
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500">
                Cargando clientes...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">
                        Nombre
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">
                        Contacto
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">
                        Dirección
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">
                        Fecha Registro
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-900">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCustomers.map((customer) => {
                      const address = (customer.address || {}) as any
                      return (
                        <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {customer.full_name}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2 text-gray-600">
                                <Phone className="h-4 w-4" />
                                {customer.phone}
                              </div>
                              {customer.email && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Mail className="h-4 w-4" />
                                  {customer.email}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {address.address ? (
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div>{address.address}</div>
                                  <div>{address.city}, {address.state}</div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm text-gray-600">
                              {new Date(customer.created_at).toLocaleDateString('es-UY')}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <ActionsMenu
                              actions={[
                                {
                                  label: 'WhatsApp',
                                  icon: <MessageCircle className="h-4 w-4" />,
                                  onClick: () => handleWhatsApp(customer.phone, customer.full_name),
                                },
                                {
                                  label: 'Editar',
                                  icon: <Edit className="h-4 w-4" />,
                                  onClick: () => handleEdit(customer),
                                },
                                {
                                  label: 'Eliminar',
                                  icon: <Trash2 className="h-4 w-4" />,
                                  onClick: () => handleDelete(customer.id),
                                  variant: 'danger',
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
