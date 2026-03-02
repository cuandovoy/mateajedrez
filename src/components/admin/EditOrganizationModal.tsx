import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { PaymentMethodsManager } from '@/components/admin/PaymentMethodsManager'
import { PlanGate } from '@/components/features/PlanGate'
import { supabase } from '@/lib/supabase'
import { uploadOrganizationLogo, uploadOrganizationCover, deleteImage } from '@/lib/storage'
import { canUseFeature } from '@/lib/planLimits'
import { useAdminStore } from '@/store/adminStore'
import { useOrganizationStore } from '@/store/organizationStore'
import { useToastStore } from '@/store/toastStore'
import type { Tables } from '@/types/database.types'
import { Bell, Building2, CreditCard, Globe, Upload, X } from 'lucide-react'
import { useState, useEffect } from 'react'

type Organization = Tables<'organizations'>
export type OrganizationSettings = Record<string, unknown>

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
  const [secondaryColor, setSecondaryColor] = useState(organization.secondary_color ?? '')
  const [accentColor, setAccentColor] = useState(organization.accent_color ?? '')
  const [fontFamily, setFontFamily] = useState(organization.font_family ?? '')
  const [fontHeading, setFontHeading] = useState(organization.font_heading ?? '')
  const [borderRadius, setBorderRadius] = useState(organization.border_radius ?? 'rounded-lg')
  const [buttonStyle, setButtonStyle] = useState(organization.button_style ?? 'rounded')
  const rawSettings = (organization.settings as Record<string, unknown>) ?? {}
  const [currency, setCurrency] = useState((rawSettings.currency as string) ?? 'ARS')
  const [locale, setLocale] = useState((rawSettings.locale as string) ?? 'es-AR')
  const [timezone, setTimezone] = useState((rawSettings.timezone as string) ?? 'America/Argentina/Buenos_Aires')
  const [allowNegativeStock, setAllowNegativeStock] = useState((rawSettings.allow_negative_stock as boolean) !== false)
  const [defaultLowStockThreshold, setDefaultLowStockThreshold] = useState(
    Number.isFinite(rawSettings.default_low_stock_threshold as number)
      ? Number(rawSettings.default_low_stock_threshold)
      : 10
  )
  const [transferContactPhone, setTransferContactPhone] = useState((rawSettings.transfer_contact_phone as string) ?? '')
  const [notificationEmail, setNotificationEmail] = useState((rawSettings.notification_email as string) ?? '')
  const [newOrderNotify, setNewOrderNotify] = useState((rawSettings.new_order_notify as boolean) ?? false)
  const [lowStockNotify, setLowStockNotify] = useState((rawSettings.low_stock_notify as boolean) ?? false)
  const [orderStatusNotifyCustomer, setOrderStatusNotifyCustomer] = useState(
    (rawSettings.order_status_notify_customer as boolean) ?? false
  )
  const [transferMethodId, setTransferMethodId] = useState<string | null>(null)
  const [transferMethodConfig, setTransferMethodConfig] = useState<Record<string, unknown>>({})
  const [transferInstructions, setTransferInstructions] = useState('')
  const [initialTransferInstructions, setInitialTransferInstructions] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(organization.logo_url ?? null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(organization.cover_image_url ?? null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(organization.name)
    setSlug(organization.slug)
    setLogoPreview(organization.logo_url ?? null)
    setCoverPreview(organization.cover_image_url ?? null)
    setCoverFile(null)
    setPrimaryColor(organization.primary_color ?? '')
    setSecondaryColor(organization.secondary_color ?? '')
    setAccentColor(organization.accent_color ?? '')
    setFontFamily(organization.font_family ?? '')
    setFontHeading(organization.font_heading ?? '')
    setBorderRadius(organization.border_radius ?? 'rounded-lg')
    setButtonStyle(organization.button_style ?? 'rounded')
    setLogoFile(null)
    const s = (organization.settings as Record<string, unknown>) ?? {}
    setCurrency((s.currency as string) ?? 'ARS')
    setLocale((s.locale as string) ?? 'es-AR')
    setTimezone((s.timezone as string) ?? 'America/Argentina/Buenos_Aires')
    setAllowNegativeStock((s.allow_negative_stock as boolean) !== false)
    setDefaultLowStockThreshold(
      Number.isFinite(s.default_low_stock_threshold as number)
        ? Number(s.default_low_stock_threshold)
        : 10
    )
    setTransferContactPhone((s.transfer_contact_phone as string) ?? '')
    setNotificationEmail((s.notification_email as string) ?? '')
    setNewOrderNotify((s.new_order_notify as boolean) ?? false)
    setLowStockNotify((s.low_stock_notify as boolean) ?? false)
    setOrderStatusNotifyCustomer((s.order_status_notify_customer as boolean) ?? false)
    setTransferMethodId(null)
    setTransferMethodConfig({})
    setTransferInstructions('')
    setInitialTransferInstructions('')
  }, [organization])

  useEffect(() => {
    let mounted = true
    const fetchTransferConfig = async () => {
      try {
        const { data } = await supabase
          .from('organization_payment_methods')
          .select('id, config')
          .eq('organization_id', organization.id)
          .eq('key', 'transfer')
          .limit(1)
          .maybeSingle()

        if (!mounted) return
        const row = data as { id: string; config: Record<string, unknown> | null } | null
        const config = row?.config ?? {}
        const instructions = typeof config.transfer_instructions === 'string' ? config.transfer_instructions : ''
        setTransferMethodId(row?.id ?? null)
        setTransferMethodConfig(config)
        setTransferInstructions(instructions)
        setInitialTransferInstructions(instructions)
      } catch {
        if (!mounted) return
        setTransferMethodId(null)
        setTransferMethodConfig({})
        setTransferInstructions('')
        setInitialTransferInstructions('')
      }
    }

    fetchTransferConfig()
    return () => {
      mounted = false
    }
  }, [organization.id])

  const prevSettings = (organization.settings as Record<string, unknown>) ?? {}
  const isDirty =
    name !== organization.name ||
    slug !== organization.slug ||
    primaryColor !== (organization.primary_color ?? '') ||
    secondaryColor !== (organization.secondary_color ?? '') ||
    accentColor !== (organization.accent_color ?? '') ||
    fontFamily !== (organization.font_family ?? '') ||
    fontHeading !== (organization.font_heading ?? '') ||
    borderRadius !== (organization.border_radius ?? 'rounded-lg') ||
    buttonStyle !== (organization.button_style ?? 'rounded') ||
    logoFile !== null ||
    (logoPreview === null && organization.logo_url) ||
    coverFile !== null ||
    (coverPreview === null && organization.cover_image_url) ||
    currency !== (prevSettings.currency ?? 'ARS') ||
    locale !== (prevSettings.locale ?? 'es-AR') ||
    timezone !== (prevSettings.timezone ?? 'America/Argentina/Buenos_Aires') ||
    allowNegativeStock !== ((prevSettings.allow_negative_stock as boolean) !== false) ||
    defaultLowStockThreshold !==
      (Number.isFinite(prevSettings.default_low_stock_threshold as number)
        ? Number(prevSettings.default_low_stock_threshold)
        : 10) ||
    transferContactPhone !== ((prevSettings.transfer_contact_phone as string) ?? '') ||
    transferInstructions !== initialTransferInstructions ||
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

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const removeCover = () => {
    setCoverFile(null)
    setCoverPreview(null)
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

      let finalCoverUrl: string | null = coverPreview && !coverFile ? coverPreview : null
      if (coverFile) {
        setUploadingCover(true)
        try {
          if (organization.cover_image_url?.includes('organization-logos')) {
            await deleteImage(organization.cover_image_url, 'organization-logos')
          }
          finalCoverUrl = await uploadOrganizationCover(coverFile, organization.id)
        } catch (uploadErr) {
          throw uploadErr
        } finally {
          setUploadingCover(false)
        }
      } else if (!coverPreview && organization.cover_image_url?.includes('organization-logos')) {
        finalCoverUrl = null
        await deleteImage(organization.cover_image_url, 'organization-logos')
      }

      const existingSettings = (organization.settings as Record<string, unknown>) ?? {}
      const settingsUpdate: OrganizationSettings = {
        currency: currency.trim() || 'ARS',
        locale: locale.trim() || 'es-AR',
        timezone: timezone.trim() || 'America/Argentina/Buenos_Aires',
        allow_negative_stock: allowNegativeStock,
        default_low_stock_threshold: Math.max(0, Math.trunc(defaultLowStockThreshold || 0)),
        transfer_contact_phone: transferContactPhone.trim() || undefined,
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
          cover_image_url: finalCoverUrl,
          primary_color: primaryColor.trim() || null,
          secondary_color: secondaryColor.trim() || null,
          accent_color: accentColor.trim() || null,
          font_family: fontFamily.trim() || null,
          font_heading: fontHeading.trim() || null,
          border_radius: borderRadius.trim() || null,
          button_style: buttonStyle.trim() || null,
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

      const nextTransferConfig: Record<string, unknown> = {
        ...transferMethodConfig,
        transfer_instructions: transferInstructions.trim(),
      }

      if (transferMethodId) {
        const { error: transferUpdateError } = await supabase
          .from('organization_payment_methods')
          .update({ config: nextTransferConfig } as never)
          .eq('id', transferMethodId)
        if (transferUpdateError) throw transferUpdateError
      } else if (transferInstructions.trim()) {
        const { error: transferInsertError } = await supabase
          .from('organization_payment_methods')
          .insert({
            organization_id: organization.id,
            key: 'transfer',
            name: 'Transferencia Bancaria',
            requires_cash_session: false,
            is_active: true,
            display_order: 0,
            config: nextTransferConfig,
          } as never)
        if (transferInsertError) throw transferInsertError
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 overflow-y-auto">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shrink-0">
        <CardHeader className="flex flex-row items-center justify-between px-6 pb-5 border-b shrink-0">
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
        <CardContent className="pt-6 px-6 pb-6 overflow-y-auto flex-1 min-h-0">
          <form onSubmit={handleSubmit} className="flex flex-col h-full gap-6">
            <Tabs defaultValue="general" className="flex flex-col flex-1 min-h-0">
              <TabsList className="w-full grid grid-cols-5 shrink-0 gap-1 p-1">
                <TabsTrigger value="general" className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="estilos" className="flex items-center gap-1.5">
                  <span className="text-xs">🎨</span>
                  Estilos
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

              <TabsContent value="general" className="mt-6 space-y-6 flex-1 min-h-0">
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

              <TabsContent value="estilos" className="mt-6 space-y-6 flex-1 min-h-0">
                <p className="text-sm text-gray-600">Personaliza la apariencia de tu tienda pública.</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Imagen de portada (hero)</label>
                  {coverPreview && (
                    <div className="relative inline-block mb-3">
                      <img
                        src={coverPreview}
                        alt="Portada"
                        className="max-w-full h-32 w-full object-cover rounded-lg border-2 border-gray-200 bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={removeCover}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                        aria-label="Eliminar portada"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleCoverChange}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-admin-500 hover:bg-admin-50 transition-colors">
                      <Upload className="h-5 w-5 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-700 font-medium">
                        {coverFile ? 'Cambiar imagen de portada' : 'Seleccionar imagen de portada'}
                      </span>
                    </div>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Se muestra como fondo del banner principal de la tienda. JPG, PNG o WEBP. Máximo {MAX_FILE_SIZE_MB}MB. Se recomienda 1920×600 px (relación 16:5) para mejor resultado.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color secundario</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={secondaryColor || '#8b5cf6'}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white p-1 shrink-0"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#8b5cf6"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 font-mono text-sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Color para acentos y elementos secundarios</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color de acento</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={accentColor || '#ec4899'}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white p-1 shrink-0"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      placeholder="#ec4899"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 font-mono text-sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Color para elementos destacados</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fuente principal</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 focus:border-transparent bg-white"
                  >
                    <option value="">Poppins (por defecto)</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Raleway">Raleway</option>
                    <option value="Nunito">Nunito</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Fuente para texto general</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fuente para títulos</label>
                  <select
                    value={fontHeading}
                    onChange={(e) => setFontHeading(e.target.value)}
                    className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 focus:border-transparent bg-white"
                  >
                    <option value="">Igual que fuente principal</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Raleway">Raleway</option>
                    <option value="Nunito">Nunito</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Fuente para títulos y encabezados (opcional)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Radio de bordes</label>
                  <select
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(e.target.value)}
                    className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 focus:border-transparent bg-white"
                  >
                    <option value="rounded">Redondeado pequeño</option>
                    <option value="rounded-lg">Redondeado mediano</option>
                    <option value="rounded-xl">Redondeado grande</option>
                    <option value="rounded-full">Completamente redondeado</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Estilo de bordes para elementos</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estilo de botones</label>
                  <select
                    value={buttonStyle}
                    onChange={(e) => setButtonStyle(e.target.value)}
                    className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 focus:border-transparent bg-white"
                  >
                    <option value="rounded">Redondeado</option>
                    <option value="pill">Píldora (muy redondeado)</option>
                    <option value="square">Cuadrado</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Forma de los botones en la tienda</p>
                </div>
              </TabsContent>

              <TabsContent value="formato" className="mt-6 space-y-6 flex-1 min-h-0">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Umbral por defecto de stock bajo
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={defaultLowStockThreshold}
                    onChange={(e) => setDefaultLowStockThreshold(Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Se usa como valor inicial para nuevos registros de inventario de esta organización.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="pagos" className="mt-6 flex-1 min-h-0">
                <div className="space-y-4">
                  <Input
                    label="Teléfono / WhatsApp para comprobantes"
                    value={transferContactPhone}
                    onChange={(e) => setTransferContactPhone(e.target.value)}
                    placeholder="+59898257909"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Datos de Transferencia Bancaria
                    </label>
                    <textarea
                      value={transferInstructions}
                      onChange={(e) => setTransferInstructions(e.target.value)}
                      className="w-full min-h-[140px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                      placeholder={'Ej:\nBanco: ...\nTipo de Cuenta: ...\nNúmero de Cuenta: ...\nTitular: ...\nWhatsApp comprobante: ...'}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Este texto se mostrará en la confirmación de orden cuando el método sea Transferencia.
                    </p>
                  </div>
                  <PaymentMethodsManager organizationId={organization.id} />
                </div>
              </TabsContent>

              <TabsContent value="notificaciones" className="mt-6 flex-1 min-h-0">
                <PlanGate feature="notifications_config" canUse={canUseNotifications}>
                  <div className="space-y-6">
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
              <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg shrink-0">{error}</p>
            )}
            <div className="flex gap-4 pt-5 border-t shrink-0">
              <Button type="submit" disabled={loading || uploadingLogo || uploadingCover} className="flex-1">
                {loading || uploadingLogo || uploadingCover ? 'Guardando...' : 'Guardar'}
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
