import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { uploadCategoryImage, deleteImage } from '@/lib/storage'
import type { Category, CategoryInsert, CategoryUpdate } from '@/types'

const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  slug: z.string().min(1, 'El slug es requerido'),
  image_url: z.string().url().optional().or(z.literal('')),
  parent_id: z.string().optional().or(z.literal('')),
})

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

type CategoryForm = z.infer<typeof categorySchema>

function AdminCategoriesContent() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
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
    try {
      setUploadingImage(true)
      let imageUrl = data.image_url || null

      // Upload image if a new file was selected
      if (imageFile) {
        imageUrl = await uploadCategoryImage(imageFile, editingCategory?.id)
      }

      const categoryData: CategoryInsert | CategoryUpdate = {
        ...data,
        image_url: imageUrl,
        parent_id: data.parent_id || null,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-600 mt-2">Organiza tus productos en categorías y subcategorías</p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Categoría
        </Button>
      </div>

      <div className="space-y-6">
        {getParentCategories().map((parentCategory) => (
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
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(parentCategory)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(parentCategory.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">
                      {parentCategory.description || 'Sin descripción'}
                    </p>
                    <p className="text-xs text-gray-500 mb-4">Slug: {parentCategory.slug}</p>
                    
                    {getSubcategories(parentCategory.id).length > 0 && (
                      <div className="mt-4 pl-4 border-l-2 border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">Subcategorías:</p>
                        <div className="space-y-2">
                          {getSubcategories(parentCategory.id).map((subcategory) => (
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
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEdit(subcategory)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => handleDelete(subcategory.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
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
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Nombre"
                  {...register('name')}
                  error={errors.name?.message}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    {...register('description')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                  />
                </div>
                <Input
                  label="Slug"
                  {...register('slug')}
                  error={errors.slug?.message}
                  placeholder="ej: electronica"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría Padre (opcional)
                  </label>
                  <select
                    {...register('parent_id')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Sin categoría padre (categoría principal)</option>
                    {getParentCategories()
                      .filter((cat) => !editingCategory || cat.id !== editingCategory.id)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Selecciona una categoría padre para crear una subcategoría
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Imagen de la Categoría
                  </label>
                  {imagePreview && (
                    <div className="relative mb-4">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center space-x-4">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <div className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Upload className="h-5 w-5 mr-2" />
                        <span className="text-sm text-gray-700">
                          {imageFile ? 'Cambiar imagen' : 'Subir imagen'}
                        </span>
                      </div>
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    O ingresa una URL de imagen
                  </p>
                  <Input
                    label="URL de Imagen (opcional)"
                    type="url"
                    {...register('image_url')}
                    error={errors.image_url?.message}
                    className="mt-2"
                    placeholder="https://ejemplo.com/imagen.jpg"
                  />
                </div>
                <div className="flex space-x-4">
                  <Button type="submit" className="flex-1" isLoading={uploadingImage}>
                    {editingCategory ? 'Actualizar' : 'Crear'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingCategory(null)
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
