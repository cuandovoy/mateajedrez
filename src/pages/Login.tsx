import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export function Login() {
  const navigate = useNavigate()
  const { signIn, user, canAccessAdminPanel, loading } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.add('admin-theme')
    return () => document.body.classList.remove('admin-theme')
  }, [])

  useEffect(() => {
    if (!loading && user && canAccessAdminPanel) {
      navigate('/', { replace: true })
    }
  }, [user, canAccessAdminPanel, loading, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError(null)
    try {
      await signIn(data.email, data.password)
      
      let attempts = 0
      const maxAttempts = 20
      while (attempts < maxAttempts) {
        const { profile } = useAuthStore.getState()
        if (profile !== null) {
          navigate('/')
          return
        }
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
      
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header alineado con AdminLayout */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 md:px-8 py-4">
          <div className="flex items-center space-x-3">
            <img src="/logo3.png" alt="Axios" className="h-10 w-10 object-contain" />
            <div>
              <span className="text-lg md:text-xl font-bold text-gray-900 block">Axios</span>
              <span className="text-xs text-gray-500 hidden sm:block">Panel de administración</span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido centrado */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Iniciar Sesión</h1>
            <p className="text-gray-600 mt-2">Ingresa tus credenciales para acceder al panel</p>
          </div>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <Input
                  label="Email"
                  type="email"
                  {...register('email')}
                  error={errors.email?.message}
                />
                <Input
                  label="Contraseña"
                  type="password"
                  {...register('password')}
                  error={errors.password?.message}
                />
                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Iniciar Sesión
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
