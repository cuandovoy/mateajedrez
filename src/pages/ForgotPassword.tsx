import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export function ForgotPassword() {
  const navigate = useNavigate()
  const { resetPasswordRequest, user, canAccessAdminPanel, loading } = useAuthStore()

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
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const onSubmit = async (data: ForgotForm) => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)
    try {
      await resetPasswordRequest(data.email)
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar el correo')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
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

      <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">¿Olvidaste tu contraseña?</h1>
            <p className="text-gray-600 mt-2">
              Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              {success ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                    Revisa tu correo. Si existe una cuenta con ese email, recibirás un enlace para restablecer tu
                    contraseña.
                  </div>
                  <Link
                    to="/login"
                    className="inline-block w-full text-center text-admin-600 hover:text-admin-700 font-medium text-sm"
                  >
                    Volver al inicio de sesión
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  <Input
                    label="Email"
                    type="email"
                    placeholder="tu@email.com"
                    {...register('email')}
                    error={errors.email?.message}
                  />
                  <Button type="submit" className="w-full" isLoading={isLoading}>
                    Enviar enlace
                  </Button>
                  <Link
                    to="/login"
                    className="block w-full text-center text-admin-600 hover:text-admin-700 font-medium text-sm mt-2"
                  >
                    Volver al inicio de sesión
                  </Link>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
