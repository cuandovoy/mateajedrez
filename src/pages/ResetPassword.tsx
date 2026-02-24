import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'

const resetSchema = z
  .object({
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type ResetForm = z.infer<typeof resetSchema>

function getHashParams(): Record<string, string> {
  const hash = window.location.hash?.slice(1) || ''
  return hash.split('&').reduce((acc, pair) => {
    const [k, v] = pair.split('=')
    if (k && v) acc[decodeURIComponent(k)] = decodeURIComponent(v)
    return acc
  }, {} as Record<string, string>)
}

export function ResetPassword() {
  const navigate = useNavigate()
  const [hasValidRecovery, setHasValidRecovery] = useState<boolean | null>(null)

  useEffect(() => {
    document.body.classList.add('admin-theme')
    return () => document.body.classList.remove('admin-theme')
  }, [])

  useEffect(() => {
    const params = getHashParams()
    const type = params.type
    setHasValidRecovery(type === 'recovery')
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (data: ResetForm) => {
    setIsLoading(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: data.password })
      if (updateError) throw updateError
      await supabase.auth.signOut()
      navigate('/login', { replace: true, state: { passwordReset: true } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la contraseña')
    } finally {
      setIsLoading(false)
    }
  }

  if (hasValidRecovery === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600" />
      </div>
    )
  }

  if (!hasValidRecovery) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 md:px-8 py-4">
            <div className="flex items-center space-x-3">
              <img src="/logo3.png" alt="Axios" className="h-10 w-10 object-contain" />
              <span className="text-lg md:text-xl font-bold text-gray-900">Axios</span>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <p className="text-gray-700 mb-4">
                Este enlace no es válido o ya expiró. Solicita uno nuevo para restablecer tu contraseña.
              </p>
              <Link to="/forgot-password" className="text-admin-600 hover:text-admin-700 font-medium text-sm">
                Solicitar nuevo enlace
              </Link>
              <span className="text-gray-400 mx-2">|</span>
              <Link to="/login" className="text-admin-600 hover:text-admin-700 font-medium text-sm">
                Volver al inicio de sesión
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 md:px-8 py-4">
          <div className="flex items-center space-x-3">
            <img src="/logo3.png" alt="Axios" className="h-10 w-10 object-contain" />
            <span className="text-lg md:text-xl font-bold text-gray-900">Axios</span>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Nueva contraseña</h1>
            <p className="text-gray-600 mt-2">Elige una contraseña segura de al menos 6 caracteres.</p>
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
                  label="Nueva contraseña"
                  type="password"
                  {...register('password')}
                  error={errors.password?.message}
                />
                <Input
                  label="Confirmar contraseña"
                  type="password"
                  {...register('confirmPassword')}
                  error={errors.confirmPassword?.message}
                />
                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Guardar contraseña
                </Button>
                <Link
                  to="/login"
                  className="block w-full text-center text-gray-600 hover:text-gray-900 text-sm mt-2"
                >
                  Volver al inicio de sesión
                </Link>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
