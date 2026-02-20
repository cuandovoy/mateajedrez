import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { PaymentMethodsManager } from '@/components/admin/PaymentMethodsManager'
import { PlanGate } from '@/components/features/PlanGate'
import { supabase } from '@/lib/supabase'
import { uploadOrganizationLogo, deleteImage } from '@/lib/storage'
import { canUseFeature } from '@/lib/planLimits'
import { useAdminStore } from '@/store/adminStore'
import { useOrganizationStore } from '@/store/organizationStore'
import { useToastStore } from '@/store/toastStore'
import type { Organization, OrganizationSettings } from '@/types/database.types'
import { Bell, Building2, CreditCard, Globe, Upload, X } from 'lucide-react'
import { useState, useEffect } from 'react'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_MB = 5

const CURRENCIES = [
  { value: 'ARS', label: 'ARS - Peso argentino' },
  { value: 'UYU', label: 'UYU - Peso uruguayo' },
  { value: 'USD', label: 'USD - Dólar estadounidense' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'BRL', label: 'BRL - Real brasileño' },
  { value: 'CLP', label: 'CLP - Peso chileno' },
  { value: 'MXN', label: 'MXN - Peso mexicano' },
  { value: 'PYG', label: 'PYG - Guaraní paraguayo' },
]

const LOCALES = [
  { value: 'es-AR', label: 'es-AR (Argentina)' },
  { value: 'es-UY', label: 'es-UY (Uruguay)' },
  { value: 'es-CL', label: 'es-CL (Chile)' },
  { value: 'es-MX', label: 'es-MX (México)' },
  { value: 'es-ES', label: 'es-ES (España)' },
  { value: 'pt-BR', label: 'pt-BR (Brasil)' },
  { value: 'en-US', label: 'en-US (Estados Unidos)' },
  { value: 'en-GB', label: 'en-GB (Reino Unido)' },
]

const TIMEZONES = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { value: 'America/Asuncion', label: 'Paraguay (Asunción)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/New_York', label: 'Estados Unidos (Este)' },
  { value: 'America/Los_Angeles', label: 'Estados Unidos (Pacífico)' },
  { value: 'Europe/Madrid', label: 'España (Madrid)' },
  { value: 'UTC', label: 'UTC' },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type Props = {
  organization: Organization
  onClose: () => void
}

export function EditOrganizationModal({ organization, onClose }: Props) {
  const { fetchOrganizations, setCurrentOrganization, currentOrganization } = useOrganizationStore()
  const { show } = useToastStore()
  const canUseNotifications = canUseFeature(organization.subscription_tier ?? 'starter', 'notifications_config')
  const setHasUnsavedChanges = useAdminStore((s) => s.setHasUnsavedChanges)
  const [name, setName] = useState(organization.name)
  const [slug, setSlug] = useState(organization.slug)
  const [primaryColor, setPrimaryColor] = useState(organization.primary_color ?? '')
  const rawSettings = (organization.settings as Record<string, unknown>) ?? {}
  const [currency, setCurrency] = useState((rawSettings.currency as string) ?? 'ARS')
  const [locale, setLocale] = useState((rawSettings.locale as string) ?? 'es-AR')
  const [timezone, setTimezone] = useState((rawSettings.timezone as string) ?? 'America/Argentina/Buenos_Aires')
  const [allowNegativeStock, setAllowNegativeStock] = useState((rawSettings.allow_negative_stock as boolean) !== false)
  const [notificationEmail, setNotificationEmail] = useState((rawSettings.notification_email as string) ?? '')
  const [newOrderNotify, setNewOrderNotify] = useState((rawSettings.new_order_notify as boolean) ?? false)
  const [lowStockNotify, setLowStockNotify] = useState((rawSettings.low_stock_notify as boolean) ?? false)
  const [orderStatusNotifyCustomer, setOrderStatusNotifyCustomer] = useState(
    (rawSettings.order_status_notify_customer as boolean) ?? false
  )
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(organization.logo_url ?? null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(organization.name)
    setSlug(organization.slug)
    setLogoPreview(organization.logo_url ?? null)
    setPrimaryColor(organization.primary_color ?? '')
    setLogoFile(null)
    const s = (organization.settings as Record<string, unknown>) ?? {}
    setCurrency((s.currency as string) ?? 'ARS')
    setLocale((s.locale as string) ?? 'es-AR')
    setTimezone((s.timezone as string) ?? 'America/Argentina/Buenos_Aires')
    setAllowNegativeStock((s.allow_negative_stock as boolean) !== false)
    setNotificationEmail((s.notification_email as string) ?? '')
    setNewOrderNotify((s.new_order_notify as boolean) ?? false)
    setLowStockNotify((s.low_stock_notify as boolean) ?? false)
    setOrderStatusNotifyCustomer((s.order_status_notify_customer as boolean) ?? false)
  }, [organization])

  const prevSettings = (organization.settings as Record<string, unknown>) ?? {}
  const isDirty =
    name !== organization.name ||
    slug !== organization.slug ||
    primaryColor !== (organization.primary_color ?? '') ||
    logoFile !== null ||
    (logoPreview === null && organization.logo_url) ||
    currency !== (prevSettings.currency ?? 'ARS') ||
    locale !== (prevSettings.locale ?? 'es-AR') ||
    timezone !== (prevSettings.timezone ?? 'America/Argentina/Buenos_Aires') ||
    allowNegativeStock !== ((prevSettings.allow_negative_stock as boolean) !== false) ||
    notificationEmail !== ((prevSettings.notification_email as string) ?? '') ||
    newOrderNotify !== ((prevSettings.new_order_notify as boolean) ?? false) ||
    lowStockNotify !== ((prevSettings.low_stock_notify as boolean) ?? false) ||
    orderStatusNotifyCustomer !== ((prevSettings.order_status_notify_customer as boolean) ?? false)

  useEffect(() => {
    setHasUnsavedChanges(Boolean(isDirty))
    return () => setHasUnsavedChanges(false)
  }, [isDirty, setHasUnsavedChanges])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      show('Formato no válido. Usa JPG, PNG o WEBP', 'error')
      return
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      show(`La imagen es demasiado grande. Máximo ${MAX_FILE_SIZE_MB}MB`, 'error')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slug || slug === slugify(organization.name)) {
      setSlug(slugify(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    const finalSlug = slug.trim() || slugify(name)
    if (!finalSlug) {
      setError('El slug es obligatorio')
      return
    }
    setLoading(true)
    setError(null)

    try {
      let finalLogoUrl: string | null = logoPreview && !logoFile ? logoPreview : null

      if (logoFile) {
        setUploadingLogo(true)
        try {
          if (organization.logo_url && organization.logo_url.includes('organization-logos')) {
            await deleteImage(organization.logo_url, 'organization-logos')
          }
          finalLogoUrl = await uploadOrganizationLogo(logoFile, organization.id)
        } catch (uploadErr) {
          throw uploadErr
        } finally {
          setUploadingLogo(false)
        }
      } else if (!logoPreview && organization.logo_url?.includes('organization-logos')) {
        finalLogoUrl = null
        await deleteImage(organization.logo_url, 'organization-logos')
      }

      const existingSettings = (organization.settings as Record<string, unknown>) ?? {}
      const settingsUpdate: OrganizationSettings = {
        currency: currency.trim() || 'ARS',
        locale: locale.trim() || 'es-AR',
        timezone: timezone.trim() || 'America/Argentina/Buenos_Aires',
        allow_negative_stock: allowNegativeStock,
        notification_email: notificationEmail.trim() || undefined,
        new_order_notify: newOrderNotify,
        low_stock_notify: lowStockNotify,
        order_status_notify_customer: orderStatusNotifyCustomer,
      }
      const { data, error: updateError } = await supabase
        .from('organizations')
        .update({
          name: name.trim(),
          slug: finalSlug,
          logo_url: finalLogoUrl,
          primary_color: primaryColor.trim() || null,
          settings: { ...existingSettings, ...settingsUpdate },
        } as never)
        .eq('id', organization.id)
        .select()
        .single()

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error('Ya existe una organización con ese slug. Elige otro.')
        }
        throw updateError
      }

      show('Organización actualizada correctamente', 'success')
      await fetchOrganizations()

      if (currentOrganization?.id === organization.id) {
        setCurrentOrganization(data as Organization)
      }
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar la organización'
      setError(message)
      show(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-md max-h-[90vh] flex flex-col shrink-0">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-admin-600" />
            Editar Organización
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="pt-4 overflow-y-auto flex-1 min-h-0">
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <Tabs defaultValue="general" className="flex flex-col flex-1 min-h-0">
              <TabsList className="w-full grid grid-cols-4 shrink-0">
                <TabsTrigger value="general" className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="formato" className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" />
                  Formato
                </TabsTrigger>
                <TabsTrigger value="pagos" className="flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" />
                  Pagos
                </TabsTrigger>
                <TabsTrigger value="notificaciones" className="flex items-center gap-1.5">
                  <Bell className="h-4 w-4" />
                  Notificaciones
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-4 space-y-4 flex-1 min-h-0">
                <Input
                  label="Nombre de la organización *"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej: Mi Tienda"
                  required
                />
                <div>
                  <Input
                    label="Slug (URL) *"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="Ej: mi-tienda"
                  />
                  <p className="mt-1 text-xs text-gray-500">Se usa en la URL. Solo letras, números y guiones.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Logo de la organización</label>
                  {logoPreview && (
                    <div className="relative inline-block mb-3">
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="w-24 h-24 object-contain rounded-lg border-2 border-gray-200 bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                        aria-label="Eliminar logo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-admin-500 hover:bg-admin-50 transition-colors">
                      <Upload className="h-5 w-5 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-700 font-medium">
                        {logoFile ? 'Cambiar imagen' : 'Seleccionar logo'}
                      </span>
                    </div>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">Formatos: JPG, PNG, WEBP. Máximo {MAX_FILE_SIZE_MB}MB</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color primario</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor || '#6366f1'}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white p-1 shrink-0"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#6366f1"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 font-mono text-sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Color en formato hex para la tienda</p>
                </div>
              </TabsContent>

              <TabsContent value="formato" className="mt-4 space-y-4 flex-1 min-h-0">
                <p className="text-sm text-gray-600">Configuración regional y reglas de negocio.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  >
                    {!CURRENCIES.some((c) => c.value === currency) && (
                      <option value={currency}>{currency} (actual)</option>
                    )}
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Locale</label>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  >
                    {!LOCALES.some((l) => l.value === locale) && (
                      <option value={locale}>{locale} (actual)</option>
                    )}
                    {LOCALES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zona horaria</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  >
                    {!TIMEZONES.some((t) => t.value === timezone) && (
                      <option value={timezone}>{timezone} (actual)</option>
                    )}
                    {TIMEZONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500">Afecta precios, fechas y reportes.</p>
                <div className="space-y-2 border-t pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowNegativeStock}
                      onChange={(e) => setAllowNegativeStock(e.target.checked)}
                      className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Permitir ventas con stock insuficiente</span>
                  </label>
                  <p className="text-xs text-gray-500">
                    Si está desactivado, no se podrá completar una venta cuando falte stock.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="pagos" className="mt-4 flex-1 min-h-0">
                <PaymentMethodsManager organizationId={organization.id} />
              </TabsContent>

              <TabsContent value="notificaciones" className="mt-4 flex-1 min-h-0">
                <PlanGate feature="notifications_config" canUse={canUseNotifications}>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Configura las notificaciones por email para tu organización.
                    </p>
                    <Input
                      label="Email para notificaciones"
                      type="email"
                      value={notificationEmail}
                      onChange={(e) => setNotificationEmail(e.target.value)}
                      placeholder="admin@mitienda.com"
                    />
                    <p className="text-xs text-gray-500">
                      Recibirás aquí las notificaciones de nuevas órdenes y stock bajo.
                    </p>
                    <div className="space-y-3 border-t pt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newOrderNotify}
                          onChange={(e) => setNewOrderNotify(e.target.checked)}
                          className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Notificar nueva orden</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={lowStockNotify}
                          onChange={(e) => setLowStockNotify(e.target.checked)}
                          className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Notificar stock bajo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={orderStatusNotifyCustomer}
                          onChange={(e) => setOrderStatusNotifyCustomer(e.target.checked)}
                          className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Notificar al cliente al cambiar estado de la orden
                        </span>
                      </label>
                    </div>
                  </div>
                </PlanGate>
              </TabsContent>
            </Tabs>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-4 shrink-0">{error}</p>
            )}
            <div className="flex gap-3 pt-4 mt-4 border-t shrink-0">
              <Button type="submit" disabled={loading || uploadingLogo} className="flex-1">
                {loading || uploadingLogo ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
