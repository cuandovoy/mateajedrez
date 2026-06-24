import { useEffect, useState, useMemo } from 'react'
import { useOrganization } from '@/hooks/useOrganization'
import { usePermission } from '@/hooks/usePermission'
import { Plus, Edit, Trash2, Upload, X, Grid3x3, List, Search, ArrowUpDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { categorySchema } from '@/lib/schemas'
import type { CategoryForm } from '@/lib/schemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { uploadCategoryImage, deleteImage } from '@/lib/storage'
import { CategoryTable } from '@/components/admin/CategoryTable'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import type { Category, CategoryInsert, CategoryUpdate } from '@/types'

type ViewMode = 'grid' | 'list'
type CategorySortBy = 'name' | 'slug' | 'created_at'
type SortDirection = 'asc' | 'desc'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

function AdminCategoriesContent() {
  const { organizationId } = useOrganization()
  const { can, loading: permLoading } = usePermission()
  const canManage = can('catalogo:gestionar')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<CategorySortBy>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  })

  useEffect(() => {
    if (organizationId) fetchCategories()
  }, [organizationId])

  const fetchCategories = async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const getParentCategories = () => {
    return categories.filter((cat) => !cat.parent_id)
  }

  const getSubcategories = (parentId: string) => {
    return categories.filter((cat) => cat.parent_id === parentId)
  }

  // Filter categories by search term
  const filteredCategories = useMemo(() => {
    const searchLower = search.toLowerCase().trim()
    const filtered = !searchLower
      ? categories
      : categories.filter(
          (category) =>
            category.name.toLowerCase().includes(searchLower) ||
            category.slug.toLowerCase().includes(searchLower) ||
            category.description?.toLowerCase().includes(searchLower)
        )

    const direction = sortDirection === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'es') * direction
      if (sortBy === 'slug') return a.slug.localeCompare(b.slug, 'es') * direction
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      return (aTime - bTime) * direction
    })
  }, [categories, search, sortBy, sortDirection])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      alert('Tipo de archivo no permitido. Use JPG, PNG o WEBP')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      alert('La imagen es demasiado grande. Máximo 5MB')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const onSubmit = async (data: CategoryForm) => {
    if (!organizationId) return
    try {
      setUploadingImage(true)
      let imageUrl = data.image_url || null

      // Upload image if a new file was selected
      if (imageFile) {
        imageUrl = await uploadCategoryImage(imageFile, editingCategory?.id, organizationId ?? undefined)
      }

      const categoryData: CategoryInsert | CategoryUpdate = {
        ...data,
        image_url: imageUrl,
        parent_id: data.parent_id || null,
        ...(editingCategory ? {} : { organization_id: organizationId }),
      }

      if (editingCategory) {
        // Delete old image if it was replaced
        if (imageFile && editingCategory.image_url && editingCategory.image_url !== imageUrl) {
          try {
            await deleteImage(editingCategory.image_url, 'category-images')
          } catch (error) {
            console.error('Error deleting old image:', error)
          }
        }

        const { error } = await supabase
          .from('categories')
          .update(categoryData as never)
          .eq('id', editingCategory.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('categories')
          .insert(categoryData as never)

        if (error) throw error
      }

      setIsModalOpen(false)
      setEditingCategory(null)
      setImageFile(null)
      setImagePreview(null)
      reset()
      fetchCategories()
    } catch (error) {
      console.error('Error saving category:', error)
      alert('Error al guardar la categoría')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setImagePreview(category.image_url)
    setImageFile(null)
    reset({
      name: category.name,
      description: category.description || '',
      slug: category.slug,
      image_url: category.image_url || '',
      parent_id: category.parent_id || '',
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Error al eliminar la categoría')
    }
  }

  const handleNew = () => {
    setEditingCategory(null)
    setImageFile(null)
    setImagePreview(null)
    reset()
    setIsModalOpen(true)
  }

  if (permLoading) return <Card><CardContent className="p-6"><SkeletonTable rows={5} /></CardContent></Card>
  if (!can('catalogo:ver')) return null

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Organiza tus productos en categorías y subcategorías</p>
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
          {canManage && (
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Categoría
            </Button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar categorías..."
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
          onChange={(e) => setSortBy(e.target.value as CategorySortBy)}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${sortBy !== 'name' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
        >
          <option value="name">Nombre</option>
          <option value="slug">Slug</option>
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
          {filteredCategories.length} de {categories.length}
        </span>
      </div>

      {/* Categories Display */}
      {loading && (
        <Card>
          <CardContent className="p-6">
            <SkeletonTable rows={5} />
          </CardContent>
        </Card>
      )}
      {!loading && (viewMode === 'grid' ? (
        <div className="space-y-6">
          {getParentCategories()
            .filter((cat) => filteredCategories.includes(cat))
            .map((parentCategory) => {
              const subcategories = getSubcategories(parentCategory.id).filter((sub) =>
                filteredCategories.includes(sub)
              )
              return (
                <div key={parentCategory.id}>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        {parentCategory.image_url && (
                          <img
                            src={parentCategory.image_url}
                            alt={parentCategory.name}
                            className="w-32 h-32 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {parentCategory.name}
                            </h3>
                            <ActionsMenu
                              actions={[
                                {
                                  label: 'Editar',
                                  icon: <Edit className="h-4 w-4" />,
                                  onClick: () => handleEdit(parentCategory),
                                },
                                {
                                  label: 'Eliminar',
                                  icon: <Trash2 className="h-4 w-4" />,
                                  onClick: () => handleDelete(parentCategory.id),
                                  variant: 'danger',
                                },
                              ]}
                            />
                          </div>
                          <p className="text-gray-600 text-sm mb-2">
                            {parentCategory.description || 'Sin descripción'}
                          </p>
                          <p className="text-xs text-gray-500 mb-4">Slug: {parentCategory.slug}</p>
                          
                          {subcategories.length > 0 && (
                            <div className="mt-4 pl-4 border-l-2 border-gray-200">
                              <p className="text-sm font-medium text-gray-700 mb-2">Subcategorías:</p>
                              <div className="space-y-2">
                                {subcategories.map((subcategory) => (
                                  <Card key={subcategory.id} className="bg-gray-50">
                                    <CardContent className="p-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                          {subcategory.image_url && (
                                            <img
                                              src={subcategory.image_url}
                                              alt={subcategory.name}
                                              className="w-16 h-16 object-cover rounded"
                                            />
                                          )}
                                          <div>
                                            <h4 className="text-sm font-semibold text-gray-900">
                                              {subcategory.name}
                                            </h4>
                                            <p className="text-xs text-gray-500">
                                              {subcategory.description || 'Sin descripción'}
                                            </p>
                                          </div>
                                        </div>
                                        <ActionsMenu
                                          actions={[
                                            {
                                              label: 'Editar',
                                              icon: <Edit className="h-4 w-4" />,
                                              onClick: () => handleEdit(subcategory),
                                            },
                                            {
                                              label: 'Eliminar',
                                              icon: <Trash2 className="h-4 w-4" />,
                                              onClick: () => handleDelete(subcategory.id),
                                              variant: 'danger',
                                            },
                                          ]}
                                        />
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <CategoryTable
              categories={filteredCategories}
              onEdit={canManage ? handleEdit : undefined}
              onDelete={canManage ? handleDelete : undefined}
            />
          </CardContent>
        </Card>
      ))}

      {!loading && filteredCategories.length === 0 && (
        <EmptyState
          icon={Grid3x3}
          title={search ? 'No se encontraron categorías' : 'No hay categorías'}
          description={search ? 'Probá ajustar el término de búsqueda.' : 'Creá tu primera categoría para organizar los productos.'}
          action={search ? { label: 'Limpiar búsqueda', onClick: () => setSearch('') } : undefined}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <CardTitle>
                  {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingCategory(null)
                    setImageFile(null)
                    setImagePreview(null)
                    reset()
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
                      label="Nombre"
                      {...register('name')}
                      error={errors.name?.message}
                      placeholder="Ej: Electrónica"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descripción
                      </label>
                      <textarea
                        {...register('description')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 resize-none"
                        rows={3}
                        placeholder="Descripción de la categoría (opcional)"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Slug"
                        {...register('slug')}
                        error={errors.slug?.message}
                        placeholder="ej: electronica"
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Categoría Padre
                        </label>
                        <select
                          {...register('parent_id')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 bg-white"
                        >
                          <option value="">Sin categoría padre (principal)</option>
                          {getParentCategories()
                            .filter((cat) => !editingCategory || cat.id !== editingCategory.id)
                            .map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          Opcional: Selecciona una categoría padre para crear una subcategoría
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Imagen */}
                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Imagen de la Categoría
                  </h3>
                  <div className="space-y-4">
                    {imagePreview && (
                      <div className="relative inline-block">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-48 h-48 object-cover rounded-lg border-2 border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                          aria-label="Eliminar imagen"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Subir Imagen
                        </label>
                        <label className="cursor-pointer block">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                          <div className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-admin-500 hover:bg-admin-50 transition-colors">
                            <Upload className="h-5 w-5 mr-2 text-gray-400" />
                            <span className="text-sm text-gray-700 font-medium">
                              {imageFile ? 'Cambiar imagen' : 'Seleccionar archivo'}
                            </span>
                          </div>
                        </label>
                        <p className="mt-2 text-xs text-gray-500">
                          Formatos: JPG, PNG, WEBP. Máximo 5MB
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          O usar URL
                        </label>
                        <Input
                          type="url"
                          {...register('image_url')}
                          error={errors.image_url?.message}
                          placeholder="https://ejemplo.com/imagen.jpg"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                          Ingresa una URL de imagen externa
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-4 pt-4 border-t border-gray-200">
                  <Button type="submit" className="flex-1" isLoading={uploadingImage}>
                    {editingCategory ? 'Actualizar Categoría' : 'Crear Categoría'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingCategory(null)
                      setImageFile(null)
                      setImagePreview(null)
                      reset()
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

export function AdminCategories() {
  return <AdminCategoriesContent />
}
