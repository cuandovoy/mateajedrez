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
import { Bell, Building2, CreditCard, Globe, Upload, X, ShoppingCart, AlertTriangle, RefreshCw } from 'lucide-react'
import React, { useState, useEffect, useRef } from 'react'
import { NOTIFICATION_TYPES, parseInappConfig, type InappNotificationsConfig, type NotificationType } from '@/lib/notification-types'

const INAPP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
}

type Organization = Tables<'organizations'>
export type OrganizationSettings = Record<string, unknown>

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_MB = 5
const STORE_LOGO_MINIMAL_KEY = 'store_logo_minimal_url'
const STORE_COVER_IMAGES_KEY = 'store_cover_image_urls'

type CoverImageItem = {
  id: string
  previewUrl: string
  sourceUrl: string | null
  file: File | null
}

const buildInitialCoverUrls = (
  settings: Record<string, unknown>,
  fallbackCoverUrl: string | null
): string[] => {
  const settingsCoverImages = settings[STORE_COVER_IMAGES_KEY]
  if (Array.isArray(settingsCoverImages)) {
    const parsed = settingsCoverImages.filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    )
    if (parsed.length > 0) return parsed
  }
  return fallbackCoverUrl ? [fallbackCoverUrl] : []
}

const makeCoverItem = (url: string): CoverImageItem => ({
  id: `cover-existing-${url}`,
  previewUrl: url,
  sourceUrl: url,
  file: null,
})

const createCoverFileItem = (file: File): CoverImageItem => ({
  id: `cover-new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  previewUrl: URL.createObjectURL(file),
  sourceUrl: null,
  file,
})

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
  const [checkoutFulfillmentMode, setCheckoutFulfillmentMode] = useState<'auto' | 'main'>(
    (rawSettings.checkout_fulfillment_mode as string) === 'main' ? 'main' : 'auto'
  )
  const [checkoutExcludeIsolatedWarehouses, setCheckoutExcludeIsolatedWarehouses] = useState(
    (rawSettings.checkout_exclude_isolated_warehouses as boolean) !== false
  )
  const [checkoutStockAllocationMode, setCheckoutStockAllocationMode] = useState<'immediate' | 'manual'>(
    (rawSettings.checkout_stock_allocation_mode as string) === 'manual' ? 'manual' : 'immediate'
  )
  const [inventoryTransferCompletionMode, setInventoryTransferCompletionMode] = useState<'manual' | 'automatic'>(
    (rawSettings.inventory_transfer_completion_mode as string) === 'automatic' ? 'automatic' : 'manual'
  )
  const [consignmentEnabled, setConsignmentEnabled] = useState((rawSettings.consignment_enabled as boolean) ?? false)
  const [consignmentAllowSellerToSeller, setConsignmentAllowSellerToSeller] = useState(
    (rawSettings.consignment_allow_seller_to_seller as boolean) ?? false
  )
  const [consignmentDefaultWarehouseBranchId, setConsignmentDefaultWarehouseBranchId] = useState(
    (rawSettings.consignment_default_warehouse_branch_id as string) ?? ''
  )
  const [transferContactPhone, setTransferContactPhone] = useState((rawSettings.transfer_contact_phone as string) ?? '')
  const [orgBranches, setOrgBranches] = useState<
    Array<{ id: string; name: string; kind: string; is_active: boolean | null; is_isolated_warehouse: boolean }>
  >([])
  const [notificationEmail, setNotificationEmail] = useState((rawSettings.notification_email as string) ?? '')
  const [newOrderNotify, setNewOrderNotify] = useState((rawSettings.new_order_notify as boolean) ?? false)
  const [lowStockNotify, setLowStockNotify] = useState((rawSettings.low_stock_notify as boolean) ?? false)
  const [orderStatusNotifyCustomer, setOrderStatusNotifyCustomer] = useState(
    (rawSettings.order_status_notify_customer as boolean) ?? false
  )
  const [inappNotifications, setInappNotifications] = useState<InappNotificationsConfig>(
    parseInappConfig(rawSettings.inapp_notifications)
  )
  const [inappLowStockThreshold, setInappLowStockThreshold] = useState(
    parseInappConfig(rawSettings.inapp_notifications).low_stock_threshold ?? 5
  )
  const [transferMethodId, setTransferMethodId] = useState<string | null>(null)
  const [transferMethodConfig, setTransferMethodConfig] = useState<Record<string, unknown>>({})
  const [transferInstructions, setTransferInstructions] = useState('')
  const [initialTransferInstructions, setInitialTransferInstructions] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(organization.logo_url ?? null)
  const [minimalLogoFile, setMinimalLogoFile] = useState<File | null>(null)
  const [minimalLogoPreview, setMinimalLogoPreview] = useState<string | null>(
    typeof rawSettings[STORE_LOGO_MINIMAL_KEY] === 'string' ? (rawSettings[STORE_LOGO_MINIMAL_KEY] as string) : null
  )
  const [coverItems, setCoverItems] = useState<CoverImageItem[]>(
    buildInitialCoverUrls(rawSettings, organization.cover_image_url ?? null).map(makeCoverItem)
  )
  const coverItemsRef = useRef<CoverImageItem[]>(coverItems)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingMinimalLogo, setUploadingMinimalLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(organization.name)
    setSlug(organization.slug)
    setLogoPreview(organization.logo_url ?? null)
    setMinimalLogoPreview(
      typeof ((organization.settings as Record<string, unknown>)?.[STORE_LOGO_MINIMAL_KEY]) === 'string'
        ? ((organization.settings as Record<string, unknown>)[STORE_LOGO_MINIMAL_KEY] as string)
        : null
    )
    setMinimalLogoFile(null)
    setPrimaryColor(organization.primary_color ?? '')
    setSecondaryColor(organization.secondary_color ?? '')
    setAccentColor(organization.accent_color ?? '')
    setFontFamily(organization.font_family ?? '')
    setFontHeading(organization.font_heading ?? '')
    setBorderRadius(organization.border_radius ?? 'rounded-lg')
    setButtonStyle(organization.button_style ?? 'rounded')
    setLogoFile(null)
    setCoverItems((prev) => {
      prev.forEach((item) => {
        if (item.file && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl)
        }
      })
      return buildInitialCoverUrls(
        (organization.settings as Record<string, unknown>) ?? {},
        organization.cover_image_url ?? null
      ).map(makeCoverItem)
    })
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
    setCheckoutFulfillmentMode((s.checkout_fulfillment_mode as string) === 'main' ? 'main' : 'auto')
    setCheckoutExcludeIsolatedWarehouses((s.checkout_exclude_isolated_warehouses as boolean) !== false)
    setCheckoutStockAllocationMode((s.checkout_stock_allocation_mode as string) === 'manual' ? 'manual' : 'immediate')
    setInventoryTransferCompletionMode(
      (s.inventory_transfer_completion_mode as string) === 'automatic' ? 'automatic' : 'manual'
    )
    setConsignmentEnabled((s.consignment_enabled as boolean) ?? false)
    setConsignmentAllowSellerToSeller((s.consignment_allow_seller_to_seller as boolean) ?? false)
    setConsignmentDefaultWarehouseBranchId((s.consignment_default_warehouse_branch_id as string) ?? '')
    setTransferContactPhone((s.transfer_contact_phone as string) ?? '')
    setNotificationEmail((s.notification_email as string) ?? '')
    setNewOrderNotify((s.new_order_notify as boolean) ?? false)
    setLowStockNotify((s.low_stock_notify as boolean) ?? false)
    setOrderStatusNotifyCustomer((s.order_status_notify_customer as boolean) ?? false)
    const parsedInapp = parseInappConfig(s.inapp_notifications)
    setInappNotifications(parsedInapp)
    setInappLowStockThreshold(parsedInapp.low_stock_threshold ?? 5)
    setTransferMethodId(null)
    setTransferMethodConfig({})
    setTransferInstructions('')
    setInitialTransferInstructions('')
  }, [organization])

  useEffect(() => {
    coverItemsRef.current = coverItems
  }, [coverItems])

  useEffect(() => {
    return () => {
      coverItemsRef.current.forEach((item) => {
        if (item.file && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl)
        }
      })
    }
  }, [])

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

  useEffect(() => {
    let mounted = true
    const fetchOrganizationBranches = async () => {
      const { data } = await supabase
        .from('branches')
        .select('id, name, kind, is_active, is_isolated_warehouse')
        .eq('organization_id', organization.id)
        .order('name')

      if (!mounted) return
      setOrgBranches(
        ((data || []) as Array<{ id: string; name: string; kind: string; is_active: boolean | null; is_isolated_warehouse: boolean }>)
      )
    }

    fetchOrganizationBranches()
    return () => {
      mounted = false
    }
  }, [organization.id])

  const prevSettings = (organization.settings as Record<string, unknown>) ?? {}
  const prevInapp = parseInappConfig(prevSettings.inapp_notifications)
  const prevMinimalLogoUrl =
    typeof prevSettings[STORE_LOGO_MINIMAL_KEY] === 'string' ? (prevSettings[STORE_LOGO_MINIMAL_KEY] as string) : null
  const prevCoverUrls = buildInitialCoverUrls(prevSettings, organization.cover_image_url ?? null)
  const persistedCoverUrls = coverItems
    .filter((item) => item.sourceUrl)
    .map((item) => item.sourceUrl as string)
  const hasNewCoverUploads = coverItems.some((item) => item.file !== null)
  const didRemoveCoverImage = prevCoverUrls.some((url) => !persistedCoverUrls.includes(url))
  const warehouseBranches = orgBranches.filter((branch) => branch.is_active && branch.kind === 'warehouse')
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
    minimalLogoFile !== null ||
    minimalLogoPreview !== prevMinimalLogoUrl ||
    hasNewCoverUploads ||
    didRemoveCoverImage ||
    currency !== (prevSettings.currency ?? 'ARS') ||
    locale !== (prevSettings.locale ?? 'es-AR') ||
    timezone !== (prevSettings.timezone ?? 'America/Argentina/Buenos_Aires') ||
    allowNegativeStock !== ((prevSettings.allow_negative_stock as boolean) !== false) ||
    defaultLowStockThreshold !==
      (Number.isFinite(prevSettings.default_low_stock_threshold as number)
        ? Number(prevSettings.default_low_stock_threshold)
        : 10) ||
    checkoutFulfillmentMode !== (((prevSettings.checkout_fulfillment_mode as string) === 'main' ? 'main' : 'auto')) ||
    checkoutExcludeIsolatedWarehouses !== ((prevSettings.checkout_exclude_isolated_warehouses as boolean) !== false) ||
    checkoutStockAllocationMode !== (((prevSettings.checkout_stock_allocation_mode as string) === 'manual' ? 'manual' : 'immediate')) ||
    inventoryTransferCompletionMode !==
      (((prevSettings.inventory_transfer_completion_mode as string) === 'automatic' ? 'automatic' : 'manual')) ||
    consignmentEnabled !== ((prevSettings.consignment_enabled as boolean) ?? false) ||
    consignmentAllowSellerToSeller !== ((prevSettings.consignment_allow_seller_to_seller as boolean) ?? false) ||
    consignmentDefaultWarehouseBranchId !== ((prevSettings.consignment_default_warehouse_branch_id as string) ?? '') ||
    transferContactPhone !== ((prevSettings.transfer_contact_phone as string) ?? '') ||
    transferInstructions !== initialTransferInstructions ||
    notificationEmail !== ((prevSettings.notification_email as string) ?? '') ||
    newOrderNotify !== ((prevSettings.new_order_notify as boolean) ?? false) ||
    lowStockNotify !== ((prevSettings.low_stock_notify as boolean) ?? false) ||
    orderStatusNotifyCustomer !== ((prevSettings.order_status_notify_customer as boolean) ?? false) ||
    inappNotifications.new_order !== prevInapp.new_order ||
    inappNotifications.low_stock !== prevInapp.low_stock ||
    inappNotifications.order_status_change !== prevInapp.order_status_change ||
    inappLowStockThreshold !== (prevInapp.low_stock_threshold ?? 5)

  useEffect(() => {
    setHasUnsavedChanges(Boolean(isDirty))
    return () => setHasUnsavedChanges(false)
  }, [isDirty, setHasUnsavedChanges])

  useEffect(() => {
    if (!consignmentEnabled) {
      setConsignmentAllowSellerToSeller(false)
      setConsignmentDefaultWarehouseBranchId('')
    }
  }, [consignmentEnabled])

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
    if (logoFile && logoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview)
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const removeLogo = () => {
    if (logoFile && logoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview)
    }
    setLogoFile(null)
    setLogoPreview(null)
  }

  const handleMinimalLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (minimalLogoFile && minimalLogoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(minimalLogoPreview)
    }
    setMinimalLogoFile(file)
    setMinimalLogoPreview(URL.createObjectURL(file))
  }

  const removeMinimalLogo = () => {
    if (minimalLogoFile && minimalLogoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(minimalLogoPreview)
    }
    setMinimalLogoFile(null)
    setMinimalLogoPreview(null)
  }

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const acceptedFiles: File[] = []
    files.forEach((file) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        show(`"${file.name}" no es válido. Usa JPG, PNG o WEBP`, 'error')
        return
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        show(`"${file.name}" supera ${MAX_FILE_SIZE_MB}MB`, 'error')
        return
      }
      acceptedFiles.push(file)
    })

    if (acceptedFiles.length === 0) return
    setCoverItems((prev) => [...prev, ...acceptedFiles.map((file) => createCoverFileItem(file))])
    e.target.value = ''
  }

  const removeCoverItem = (itemId: string) => {
    setCoverItems((prev) => {
      const itemToRemove = prev.find((item) => item.id === itemId)
      if (itemToRemove?.file && itemToRemove.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(itemToRemove.previewUrl)
      }
      return prev.filter((item) => item.id !== itemId)
    })
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
        } finally {
          setUploadingLogo(false)
        }
      } else if (!logoPreview && organization.logo_url?.includes('organization-logos')) {
        finalLogoUrl = null
        await deleteImage(organization.logo_url, 'organization-logos')
      }

      const existingSettings = (organization.settings as Record<string, unknown>) ?? {}
      const previousMinimalLogoUrl =
        typeof existingSettings[STORE_LOGO_MINIMAL_KEY] === 'string'
          ? (existingSettings[STORE_LOGO_MINIMAL_KEY] as string)
          : null

      let finalMinimalLogoUrl: string | null =
        minimalLogoPreview && !minimalLogoFile ? minimalLogoPreview : null

      if (minimalLogoFile) {
        setUploadingMinimalLogo(true)
        try {
          if (previousMinimalLogoUrl?.includes('organization-logos')) {
            await deleteImage(previousMinimalLogoUrl, 'organization-logos')
          }
          finalMinimalLogoUrl = await uploadOrganizationLogo(minimalLogoFile, organization.id)
        } finally {
          setUploadingMinimalLogo(false)
        }
      } else if (!minimalLogoPreview && previousMinimalLogoUrl?.includes('organization-logos')) {
        finalMinimalLogoUrl = null
        await deleteImage(previousMinimalLogoUrl, 'organization-logos')
      }

      const previousCoverUrls = buildInitialCoverUrls(existingSettings, organization.cover_image_url ?? null)
      const existingCoverUrls = coverItems
        .filter((item) => item.sourceUrl)
        .map((item) => item.sourceUrl as string)
      const newCoverItems = coverItems.filter((item) => item.file)

      let uploadedCoverUrls: string[] = []
      if (newCoverItems.length > 0) {
        setUploadingCover(true)
        try {
          uploadedCoverUrls = await Promise.all(
            newCoverItems.map((item) => uploadOrganizationCover(item.file as File, organization.id))
          )
        } finally {
          setUploadingCover(false)
        }
      }

      const finalCoverUrls = [...existingCoverUrls, ...uploadedCoverUrls]
      const finalCoverUrl = finalCoverUrls[0] ?? null

      const removedCoverUrls = previousCoverUrls.filter((url) => !existingCoverUrls.includes(url))
      for (const removedCoverUrl of removedCoverUrls) {
        if (removedCoverUrl.includes('organization-logos')) {
          await deleteImage(removedCoverUrl, 'organization-logos')
        }
      }

      const settingsUpdate: OrganizationSettings = {
        currency: currency.trim() || 'ARS',
        locale: locale.trim() || 'es-AR',
        timezone: timezone.trim() || 'America/Argentina/Buenos_Aires',
        allow_negative_stock: allowNegativeStock,
        default_low_stock_threshold: Math.max(0, Math.trunc(defaultLowStockThreshold || 0)),
        checkout_fulfillment_mode: checkoutFulfillmentMode,
        checkout_exclude_isolated_warehouses: checkoutExcludeIsolatedWarehouses,
        checkout_stock_allocation_mode: checkoutStockAllocationMode,
        inventory_transfer_completion_mode: inventoryTransferCompletionMode,
        consignment_enabled: consignmentEnabled,
        consignment_allow_seller_to_seller: consignmentEnabled ? consignmentAllowSellerToSeller : false,
        consignment_default_warehouse_branch_id:
          consignmentEnabled && consignmentDefaultWarehouseBranchId
            ? consignmentDefaultWarehouseBranchId
            : null,
        transfer_contact_phone: transferContactPhone.trim() || undefined,
        notification_email: notificationEmail.trim() || undefined,
        new_order_notify: newOrderNotify,
        low_stock_notify: lowStockNotify,
        order_status_notify_customer: orderStatusNotifyCustomer,
        inapp_notifications: {
          new_order: inappNotifications.new_order,
          low_stock: inappNotifications.low_stock,
          low_stock_threshold: Math.max(1, Math.trunc(inappLowStockThreshold || 5)),
          order_status_change: inappNotifications.order_status_change,
        },
        [STORE_LOGO_MINIMAL_KEY]: finalMinimalLogoUrl,
        [STORE_COVER_IMAGES_KEY]: finalCoverUrls,
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Logo completo (desktop)</label>
                    {logoPreview && (
                      <div className="relative inline-block mb-3">
                        <img
                          src={logoPreview}
                          alt="Logo completo"
                          className="w-24 h-24 object-contain rounded-lg border-2 border-gray-200 bg-gray-50"
                        />
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                          aria-label="Eliminar logo completo"
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
                          {logoFile ? 'Cambiar logo completo' : 'Seleccionar logo completo'}
                        </span>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Logo mínimo (mobile)</label>
                    {minimalLogoPreview && (
                      <div className="relative inline-block mb-3">
                        <img
                          src={minimalLogoPreview}
                          alt="Logo mínimo"
                          className="w-20 h-20 object-contain rounded-lg border-2 border-gray-200 bg-gray-50"
                        />
                        <button
                          type="button"
                          onClick={removeMinimalLogo}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                          aria-label="Eliminar logo mínimo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleMinimalLogoChange}
                        className="hidden"
                      />
                      <div className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-admin-500 hover:bg-admin-50 transition-colors">
                        <Upload className="h-5 w-5 mr-2 text-gray-400" />
                        <span className="text-sm text-gray-700 font-medium">
                          {minimalLogoFile ? 'Cambiar logo mínimo' : 'Seleccionar logo mínimo'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Formatos: JPG, PNG, WEBP. Máximo {MAX_FILE_SIZE_MB}MB por imagen.
                </p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Imágenes de portada (hero/carrusel)</label>
                  {coverItems.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      {coverItems.map((item, index) => (
                        <div key={item.id} className="relative">
                          <img
                            src={item.previewUrl}
                            alt={`Portada ${index + 1}`}
                            className="h-28 w-full object-cover rounded-lg border-2 border-gray-200 bg-gray-50"
                          />
                          <button
                            type="button"
                            onClick={() => removeCoverItem(item.id)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                            aria-label={`Eliminar portada ${index + 1}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[11px] text-white">
                            {index === 0 ? 'Principal' : `Slide ${index + 1}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleCoverChange}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-admin-500 hover:bg-admin-50 transition-colors">
                      <Upload className="h-5 w-5 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-700 font-medium">
                        Agregar imagen{coverItems.length === 1 ? '' : 'es'} de portada
                      </span>
                    </div>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Puedes subir una o varias imágenes para carrusel. La primera será la portada principal. JPG, PNG o WEBP. Máximo {MAX_FILE_SIZE_MB}MB por imagen. Se recomienda 1920×600 px (16:5).
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
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-medium text-gray-700">Checkout eCommerce</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estrategia de asignación de sucursal
                    </label>
                    <select
                      value={checkoutFulfillmentMode}
                      onChange={(e) => setCheckoutFulfillmentMode(e.target.value === 'main' ? 'main' : 'auto')}
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    >
                      <option value="auto">Automática (recomendada)</option>
                      <option value="main">Sucursal principal (MAIN)</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Automática busca una sucursal operativa con stock suficiente para toda la orden.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Momento de descuento de stock
                    </label>
                    <select
                      value={checkoutStockAllocationMode}
                      onChange={(e) =>
                        setCheckoutStockAllocationMode(e.target.value === 'manual' ? 'manual' : 'immediate')
                      }
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    >
                      <option value="immediate">Inmediato (al crear orden)</option>
                      <option value="manual">Manual (al confirmar en backoffice)</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Manual crea la orden en espera de asignación de stock y se confirma luego desde administración.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkoutExcludeIsolatedWarehouses}
                      onChange={(e) => setCheckoutExcludeIsolatedWarehouses(e.target.checked)}
                      className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Excluir depósitos aislados en checkout
                    </span>
                  </label>
                </div>
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-medium text-gray-700">Transferencias de inventario</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmación de recepción
                    </label>
                    <select
                      value={inventoryTransferCompletionMode}
                      onChange={(e) =>
                        setInventoryTransferCompletionMode(e.target.value === 'automatic' ? 'automatic' : 'manual')
                      }
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    >
                      <option value="manual">Manual (pendiente + confirmar recepción)</option>
                      <option value="automatic">Automática (se completa al crear)</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Define si la sucursal destino debe confirmar la recepción o si se acredita automáticamente.
                    </p>
                  </div>
                </div>
                <div className="space-y-3 border-t pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consignmentEnabled}
                      onChange={(e) => setConsignmentEnabled(e.target.checked)}
                      className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Habilitar módulo de consignación (vendedoras/depósito)
                    </span>
                  </label>
                  <p className="text-xs text-gray-500">
                    Activa flujos de retiro/rendición entre sucursales tipo depósito y vendedora.
                  </p>

                  {consignmentEnabled && (
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consignmentAllowSellerToSeller}
                          onChange={(e) => setConsignmentAllowSellerToSeller(e.target.checked)}
                          className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                        />
                        <span className="text-sm text-gray-700">Permitir transferencias entre vendedoras</span>
                      </label>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Depósito por defecto
                        </label>
                        <select
                          value={consignmentDefaultWarehouseBranchId}
                          onChange={(e) => setConsignmentDefaultWarehouseBranchId(e.target.value)}
                          className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                        >
                          <option value="">Sin depósito por defecto</option>
                          {warehouseBranches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                              {branch.is_isolated_warehouse ? ' (Aislado)' : ''}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          Se usará como destino sugerido para rendiciones de vendedoras.
                        </p>
                      </div>
                    </div>
                  )}
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
                  <div className="space-y-8">

                    {/* Notificaciones por email */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">Notificaciones por email</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Recibirás un email en la dirección configurada cuando ocurran estos eventos.
                        </p>
                      </div>
                      <Input
                        label="Email para notificaciones"
                        type="email"
                        value={notificationEmail}
                        onChange={(e) => setNotificationEmail(e.target.value)}
                        placeholder="admin@mitienda.com"
                      />
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newOrderNotify}
                            onChange={(e) => setNewOrderNotify(e.target.checked)}
                            className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                          />
                          <span className="text-sm text-gray-700">Nuevo pedido</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lowStockNotify}
                            onChange={(e) => setLowStockNotify(e.target.checked)}
                            className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                          />
                          <span className="text-sm text-gray-700">Stock bajo</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={orderStatusNotifyCustomer}
                            onChange={(e) => setOrderStatusNotifyCustomer(e.target.checked)}
                            className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                          />
                          <span className="text-sm text-gray-700">
                            Notificar al cliente al cambiar estado de la orden
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Notificaciones in-app (campanita) */}
                    <div className="space-y-4 border-t pt-6">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">Notificaciones en el panel</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Aparecen en la campanita del panel de administración en tiempo real.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {NOTIFICATION_TYPES.map((notifType) => {
                          const Icon = INAPP_ICONS[notifType.icon]
                          const enabled = inappNotifications[notifType.type as NotificationType]
                          return (
                            <div key={notifType.type} className="rounded-lg border border-gray-200 p-4 space-y-3">
                              <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={(e) =>
                                    setInappNotifications((prev) => ({
                                      ...prev,
                                      [notifType.type]: e.target.checked,
                                    }))
                                  }
                                  className="mt-0.5 rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                                />
                                <div className="flex items-center gap-2 min-w-0">
                                  {Icon && (
                                    <Icon className={`h-4 w-4 shrink-0 ${notifType.color}`} />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">{notifType.label}</p>
                                    <p className="text-xs text-gray-500">{notifType.description}</p>
                                  </div>
                                </div>
                              </label>

                              {/* Umbral configurable (solo low_stock) */}
                              {notifType.hasThreshold && enabled && (
                                <div className="ml-7 flex items-center gap-3">
                                  <label className="text-xs text-gray-600 shrink-0">
                                    {notifType.thresholdLabel}:
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={9999}
                                    value={inappLowStockThreshold}
                                    onChange={(e) =>
                                      setInappLowStockThreshold(Math.max(1, parseInt(e.target.value) || 1))
                                    }
                                    className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-admin-500 focus:ring-1 focus:ring-admin-500"
                                  />
                                  <span className="text-xs text-gray-500">unidades</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                  </div>
                </PlanGate>
              </TabsContent>
            </Tabs>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg shrink-0">{error}</p>
            )}
            <div className="flex gap-4 pt-5 border-t shrink-0">
              <Button type="submit" disabled={loading || uploadingLogo || uploadingMinimalLogo || uploadingCover} className="flex-1">
                {loading || uploadingLogo || uploadingMinimalLogo || uploadingCover ? 'Guardando...' : 'Guardar'}
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
