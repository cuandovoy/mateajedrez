import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { uploadOrganizationLogo } from '@/lib/storage'
import { useAdminStore } from '@/store/adminStore'
import { useAuthStore } from '@/store/authStore'
import { useOrganizationStore } from '@/store/organizationStore'
import { useToastStore } from '@/store/toastStore'
import type { Organization, OrganizationInsert } from '@/types/database.types'
import { Building2, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'

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
  onClose: () => void
}

export function CreateOrganizationModal({ onClose }: Props) {
  const { user } = useAuthStore()
  const { fetchOrganizations, setCurrentOrganization } = useOrganizationStore()
  const { show } = useToastStore()
  const setHasUnsavedChanges = useAdminStore((s) => s.setHasUnsavedChanges)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const isDirty = name.trim() !== '' || slug.trim() !== '' || logoFile !== null

  useEffect(() => {
    setHasUnsavedChanges(isDirty)
    return () => setHasUnsavedChanges(false)
  }, [isDirty, setHasUnsavedChanges])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      show('Debes iniciar sesión para crear una organización', 'error')
      return
    }
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
      const orgData: OrganizationInsert = {
        name: name.trim(),
        slug: finalSlug,
        subscription_tier: 'starter',
        subscription_status: 'active',
      }

      const { data: newOrg, error: insertError } = await supabase
        .from('organizations')
        .insert(orgData as never)
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Ya existe una organización con ese slug. Elige otro.')
        }
        throw insertError
      }

      const orgId = (newOrg as { id: string })?.id
      if (!orgId) throw new Error('No se pudo crear la organización')

      // Add current user as admin of the new org
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgId,
          user_id: user.id,
          role: 'admin',
        } as never)

      if (memberError) throw memberError

      let logoUrl: string | null = null
      if (logoFile) {
        setUploadingLogo(true)
        try {
          logoUrl = await uploadOrganizationLogo(logoFile, orgId)
          await supabase
            .from('organizations')
            .update({ logo_url: logoUrl } as never)
            .eq('id', orgId)
        } finally {
          setUploadingLogo(false)
        }
      }

      show('Organización creada correctamente', 'success')
      await fetchOrganizations()
      const orgWithLogo = logoUrl
        ? { ...(newOrg as Record<string, unknown>), id: orgId, logo_url: logoUrl }
        : { ...(newOrg as Record<string, unknown>), id: orgId }
      setCurrentOrganization(orgWithLogo as Organization)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear la organización'
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
            Crear Organización
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
                Logo (opcional)
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
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading || uploadingLogo} className="flex-1">
                {loading || uploadingLogo ? 'Creando...' : 'Crear'}
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
