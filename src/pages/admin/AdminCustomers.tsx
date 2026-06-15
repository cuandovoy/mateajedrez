import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { formatDateShort } from '@/lib/utils'
import { PAGE_SIZE_ADMIN } from '@/lib/constants'
import { useToastStore } from '@/store/toastStore'
import type { Customer } from '@/types/database.types'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Edit,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'

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

const EMPTY_FORM: CustomerForm = {
  full_name: '',
  email: '',
  phone: '',
  rut: '',
  address: { address: '', city: '', state: '', zipCode: '', country: 'Uruguay' },
  notes: '',
}

export function AdminCustomers() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { show } = useToastStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // UI state
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [filterActiveOnly, setFilterActiveOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CustomerForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; full_name: string; orderCount: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sortKey, setSortKey] = useState<'full_name' | 'created_at' | 'orders'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      setDebouncedSearch(searchTerm)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // ─── QUERIES ─────────────────────────────────────────────────────────────────

  const customersListKey = queryKeys.customers.list(organizationId!, {
    page: currentPage,
    search: debouncedSearch,
    activeOnly: filterActiveOnly,
    sortKey,
    sortDir,
  })

  const { data: listData, isPending: loading } = useQuery({
    queryKey: customersListKey,
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE_ADMIN
      const to = from + PAGE_SIZE_ADMIN - 1

      const ascending = sortDir === 'asc'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('customers')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId!)
        .range(from, to)

      if (sortKey !== 'orders') {
        q = q.order(sortKey, { ascending })
      } else {
        q = q.order('created_at', { ascending: false })
      }

      if (debouncedSearch.trim())
        q = q.or(
          `full_name.ilike.%${debouncedSearch.trim()}%,phone.ilike.%${debouncedSearch.trim()}%,email.ilike.%${debouncedSearch.trim()}%,rut.ilike.%${debouncedSearch.trim()}%`
        )
      if (filterActiveOnly) q = q.eq('is_active', true)

      const { data: customersData, count, error } = await q
      if (error) throw error

      // Fetch order counts for this page's customers
      const ids = (customersData || []).map((c: Customer) => c.id)
      const orderCountMap: Record<string, number> = {}
      if (ids.length > 0) {
        const { data: orderRows } = await supabase
          .from('orders')
          .select('customer_id')
          .eq('organization_id', organizationId!)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .in('customer_id', ids as any)
        for (const row of (orderRows || []) as { customer_id: string }[]) {
          if (row.customer_id)
            orderCountMap[row.customer_id] = (orderCountMap[row.customer_id] || 0) + 1
        }
      }

      const rawCustomers = (customersData || []) as Customer[]
      const sortedCustomers = sortKey === 'orders'
        ? [...rawCustomers].sort((a, b) => {
            const diff = (orderCountMap[b.id] ?? 0) - (orderCountMap[a.id] ?? 0)
            return sortDir === 'asc' ? -diff : diff
          })
        : rawCustomers

      return { customers: sortedCustomers, totalCount: count || 0, orderCountMap }
    },
    enabled: !!organizationId,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const customers = listData?.customers ?? []
  const totalCount = listData?.totalCount ?? 0
  const orderCountMap = listData?.orderCountMap ?? {}

  const { data: stats } = useQuery({
    queryKey: queryKeys.customers.stats(organizationId!),
    queryFn: async () => {
      const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const [all, active, newMonth] = await Promise.all([
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId!),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId!)
          .eq('is_active', true),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId!)
          .gte('created_at', thisMonthStart),
      ])
      return {
        total: all.count ?? 0,
        active: active.count ?? 0,
        newThisMonth: newMonth.count ?? 0,
      }
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })

  const invalidateCustomers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.all(organizationId!) })

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setCurrentPage(1)
  }

  // ─── HANDLERS ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
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
      setFormData(EMPTY_FORM)
      setEditingId(null)
      setShowForm(false)
      invalidateCustomers()
    } catch (error) {
      console.error('Error saving customer:', error)
      show('Error al guardar cliente', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (customer: Customer) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const handleDelete = (customer: Customer) => {
    setDeleteTarget({
      id: customer.id,
      full_name: customer.full_name,
      orderCount: orderCountMap[customer.id] ?? 0,
    })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id)
      if (error) throw error
      show('Cliente eliminado correctamente', 'success')
      invalidateCustomers()
      setDeleteTarget(null)
    } catch {
      show('Error al eliminar cliente', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (customer: Customer) => {
    const label = customer.is_active ? 'desactivar' : 'activar'
    if (!confirm(`¿${label.charAt(0).toUpperCase() + label.slice(1)} a ${customer.full_name}?`)) return
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: !customer.is_active } as never)
        .eq('id', customer.id)
      if (error) throw error
      show(`Cliente ${customer.is_active ? 'desactivado' : 'activado'} correctamente`, 'success')
      invalidateCustomers()
    } catch (err: unknown) {
      console.error('Error toggling customer active:', err)
      show('Error al cambiar estado del cliente', 'error')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(EMPTY_FORM)
  }

  const handleWhatsApp = (phone: string, fullName: string) => {
    const formattedPhone = phone.replace(/[\s\-\(\)]/g, '')
    let whatsappPhone = formattedPhone
    if (!formattedPhone.startsWith('+')) {
      whatsappPhone = formattedPhone.startsWith('9') ? '+598' + formattedPhone : '+' + formattedPhone
    }
    const message = encodeURIComponent(`Hola ${fullName}, ¿cómo estás?`)
    window.open(`https://wa.me/${whatsappPhone.replace('+', '')}?text=${message}`, '_blank')
  }

  const handleExportCsv = async () => {
    if (!organizationId) return
    try {
      setExportingCsv(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('customers')
        .select('*')
        .eq('organization_id', organizationId)
        .order('full_name')
      if (debouncedSearch.trim())
        q = q.or(
          `full_name.ilike.%${debouncedSearch.trim()}%,phone.ilike.%${debouncedSearch.trim()}%,email.ilike.%${debouncedSearch.trim()}%,rut.ilike.%${debouncedSearch.trim()}%`
        )
      if (filterActiveOnly) q = q.eq('is_active', true)

      const { data, error } = await q
      if (error) throw error
      if (!data?.length) {
        show('No hay clientes para exportar', 'info')
        return
      }

      const headers = ['Nombre', 'Teléfono', 'Email', 'RUT', 'Ciudad', 'Activo', 'Fecha registro']
      const rows = data.map((c: Customer) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addr = (c.address || {}) as any
        return [
          c.full_name,
          c.phone,
          c.email || '',
          c.rut || '',
          addr.city || '',
          c.is_active ? 'Sí' : 'No',
          c.created_at ? new Date(c.created_at).toLocaleDateString('es-UY') : '',
        ]
      })

      const escapeCsv = (v: string) => {
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
      }
      const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `clientes_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      show(`${data.length} clientes exportados`, 'success')
    } catch (err: unknown) {
      console.error('Error exporting customers:', err)
      show('Error al exportar clientes', 'error')
    } finally {
      setExportingCsv(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE_ADMIN))
  const hasFilters = !!searchTerm || filterActiveOnly

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Clientes</h1>
          {stats ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">
                Total: {stats.total}
              </span>
              <span className="bg-green-50 text-green-700 rounded-full px-2.5 py-0.5">
                Activos: {stats.active}
              </span>
              <span className="bg-blue-50 text-blue-700 rounded-full px-2.5 py-0.5">
                Nuevos este mes: {stats.newThisMonth}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {totalCount > 0 ? `${totalCount} cliente${totalCount !== 1 ? 's' : ''}` : 'Sin clientes registrados'}
            </p>
          )}
        </div>
        {!showForm && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exportingCsv}>
              <Download className="h-4 w-4 mr-2" />
              {exportingCsv ? 'Exportando...' : 'Exportar CSV'}
            </Button>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Cliente
            </Button>
          </div>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</CardTitle>
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
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUT (opcional)</label>
                  <Input
                    type="text"
                    value={formData.rut}
                    onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                    placeholder="Ej: 214567890012"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Dirección</label>
                <div className="space-y-3">
                  <Input
                    type="text"
                    placeholder="Calle y número"
                    value={formData.address.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: { ...formData.address, address: e.target.value } })
                    }
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      type="text"
                      placeholder="Ciudad"
                      value={formData.address.city}
                      onChange={(e) =>
                        setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })
                      }
                    />
                    <Input
                      type="text"
                      placeholder="Provincia"
                      value={formData.address.state}
                      onChange={(e) =>
                        setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      type="text"
                      placeholder="Código Postal"
                      value={formData.address.zipCode}
                      onChange={(e) =>
                        setFormData({ ...formData, address: { ...formData.address, zipCode: e.target.value } })
                      }
                    />
                    <Input
                      type="text"
                      placeholder="País"
                      value={formData.address.country}
                      onChange={(e) =>
                        setFormData({ ...formData, address: { ...formData.address, country: e.target.value } })
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-200 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={saving} isLoading={saving}>
                  {editingId ? 'Actualizar Cliente' : 'Crear Cliente'}
                </Button>
                <Button variant="outline" onClick={handleCancel} type="button">
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter toolbar */}
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

          <button
            type="button"
            onClick={() => { setFilterActiveOnly((prev) => !prev); setCurrentPage(1) }}
            className={`h-9 px-3 rounded-lg text-sm font-medium border flex items-center gap-1.5 shrink-0 transition-colors ${
              filterActiveOnly
                ? 'border-admin-400 bg-admin-50 text-admin-800'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Solo activos</span>
          </button>

          {hasFilters && (
            <button
              onClick={() => { setSearchTerm(''); setFilterActiveOnly(false); setCurrentPage(1) }}
              className="h-9 px-3 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Limpiar</span>
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
                title={debouncedSearch || filterActiveOnly ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                description={
                  debouncedSearch || filterActiveOnly
                    ? 'Probá ajustar los filtros de búsqueda.'
                    : 'Agregá tu primer cliente para empezar a gestionar ventas.'
                }
                action={
                  !debouncedSearch && !filterActiveOnly
                    ? { label: 'Nuevo cliente', onClick: () => setShowForm(true) }
                    : undefined
                }
              />
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y">
                  {customers.map((customer) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const address = (customer.address || {}) as any
                    const orderCount = orderCountMap[customer.id] || 0
                    return (
                      <div key={customer.id} className={`p-4 space-y-2 ${!customer.is_active ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/customers/${customer.id}`}
                            className="font-medium text-gray-900 hover:text-admin-600 inline-flex items-center gap-1"
                          >
                            {customer.full_name}
                            {!customer.is_active && (
                              <span className="text-xs text-gray-400 font-normal">(inactivo)</span>
                            )}
                            <ExternalLink className="h-3 w-3 text-gray-400" />
                          </Link>
                          <ActionsMenu
                            actions={[
                              {
                                label: 'Ver ficha',
                                icon: <ExternalLink className="h-4 w-4" />,
                                onClick: () => navigate(`/customers/${customer.id}`),
                              },
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
                                label: customer.is_active ? 'Desactivar' : 'Activar',
                                icon: customer.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />,
                                onClick: () => handleToggleActive(customer),
                              },
                              {
                                label: 'Eliminar',
                                icon: <Trash2 className="h-4 w-4" />,
                                onClick: () => handleDelete(customer),
                                variant: 'danger',
                              },
                            ]}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-3.5 w-3.5 text-gray-400" />
                          {customer.phone}
                        </div>
                        {orderCount > 0 && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <ShoppingBag className="h-3.5 w-3.5 text-gray-400" />
                            {orderCount} pedido{orderCount !== 1 ? 's' : ''}
                          </div>
                        )}
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
                        <th
                          className="text-left py-3 px-4 font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-50 group"
                          onClick={() => handleSort('full_name')}
                        >
                          <span className="flex items-center gap-1">
                            Nombre
                            <span className="text-gray-400">
                              {sortKey === 'full_name'
                                ? (sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
                                : <ChevronUp className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40" />}
                            </span>
                          </span>
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Contacto</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Dirección</th>
                        <th
                          className="text-center py-3 px-4 font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-50 group"
                          onClick={() => handleSort('orders')}
                        >
                          <span className="flex items-center justify-center gap-1">
                            Pedidos
                            <span className="text-gray-400">
                              {sortKey === 'orders'
                                ? (sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
                                : <ChevronUp className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40" />}
                            </span>
                          </span>
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Registro</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {customers.map((customer) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const address = (customer.address || {}) as any
                        const orderCount = orderCountMap[customer.id] || 0
                        return (
                          <tr
                            key={customer.id}
                            className={`hover:bg-gray-50 transition-colors ${!customer.is_active ? 'opacity-60' : ''}`}
                          >
                            <td className="py-3 px-4">
                              <Link
                                to={`/customers/${customer.id}`}
                                className="font-medium text-gray-900 hover:text-admin-600 hover:underline inline-flex items-center gap-1"
                              >
                                {customer.full_name}
                                <ExternalLink className="h-3 w-3 text-gray-400" />
                              </Link>
                              {!customer.is_active && (
                                <span className="ml-2 text-xs text-gray-400">(inactivo)</span>
                              )}
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
                                {customer.rut && (
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <span className="inline-block h-4 w-4 rounded-sm bg-gray-200 text-[10px] leading-4 text-center font-semibold text-gray-700">
                                      R
                                    </span>
                                    {customer.rut}
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
                                    <div>
                                      {[address.city, address.state].filter(Boolean).join(', ')}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`text-sm font-semibold ${orderCount > 0 ? 'text-gray-900' : 'text-gray-400'}`}
                              >
                                {orderCount}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-gray-600">
                                {formatDateShort(customer.created_at, settings)}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <ActionsMenu
                                actions={[
                                  {
                                    label: 'Ver ficha',
                                    icon: <ExternalLink className="h-4 w-4" />,
                                    onClick: () => navigate(`/customers/${customer.id}`),
                                  },
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
                                    label: customer.is_active ? 'Desactivar' : 'Activar',
                                    icon: customer.is_active
                                      ? <UserX className="h-4 w-4" />
                                      : <UserCheck className="h-4 w-4" />,
                                    onClick: () => handleToggleActive(customer),
                                  },
                                  {
                                    label: 'Eliminar',
                                    icon: <Trash2 className="h-4 w-4" />,
                                    onClick: () => handleDelete(customer),
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-semibold text-gray-900">Eliminar cliente</h2>
              <p className="mt-2 text-sm text-gray-600">
                ¿Eliminar a <span className="font-medium">{deleteTarget.full_name}</span>?
                Esta acción no se puede deshacer.
              </p>
              {deleteTarget.orderCount > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  Este cliente tiene <span className="font-semibold">{deleteTarget.orderCount} orden{deleteTarget.orderCount !== 1 ? 'es' : ''}</span> asociada{deleteTarget.orderCount !== 1 ? 's' : ''}. Eliminarlo no borrará las órdenes pero perderás el vínculo con este cliente.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
