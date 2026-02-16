import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { uploadOrganizationLogo, deleteImage } from '@/lib/storage'
import { useAdminStore } from '@/store/adminStore'
import { useOrganizationStore } from '@/store/organizationStore'
import { useToastStore } from '@/store/toastStore'
import type { Organization } from '@/types/database.types'
import { Building2, Upload, X } from 'lucide-react'
import { useState, useEffect } from 'react'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_MB = 5

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
  const setHasUnsavedChanges = useAdminStore((s) => s.setHasUnsavedChanges)
  const [name, setName] = useState(organization.name)
  const [slug, setSlug] = useState(organization.slug)
  const [primaryColor, setPrimaryColor] = useState(organization.primary_color ?? '')
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
  }, [organization])

  const isDirty =
    name !== organization.name ||
    slug !== organization.slug ||
    primaryColor !== (organization.primary_color ?? '') ||
    logoFile !== null ||
    (logoPreview === null && organization.logo_url)

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

      const { data, error: updateError } = await supabase
        .from('organizations')
        .update({
          name: name.trim(),
          slug: finalSlug,
          logo_url: finalLogoUrl,
          primary_color: primaryColor.trim() || null,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
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
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo de la organización
              </label>
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
              <p className="mt-1 text-xs text-gray-500">
                Formatos: JPG, PNG, WEBP. Máximo {MAX_FILE_SIZE_MB}MB
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color primario
              </label>
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
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <div className="flex gap-3 pt-2">
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
