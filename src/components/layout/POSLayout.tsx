import { useAuthStore } from '@/store/authStore'
import { useOrganizationStore } from '@/store/organizationStore'
import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { ToastContainer } from './ToastContainer'

export function POSLayout() {
  const { user, canAccessAdminPanel, loading } = useAuthStore()
  const { fetchOrganizations } = useOrganizationStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) fetchOrganizations()
  }, [user, fetchOrganizations])

  useEffect(() => {
    if (!loading) {
      if (!user || !canAccessAdminPanel) navigate('/login')
    }
  }, [user, canAccessAdminPanel, loading, navigate])

  useEffect(() => {
    document.body.classList.add('admin-theme')
    return () => document.body.classList.remove('admin-theme')
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-600" />
      </div>
    )
  }

  if (!user || !canAccessAdminPanel) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex flex-col w-full max-w-sm mx-auto lg:border-x lg:border-gray-200 lg:shadow-lg min-h-screen">
        <Outlet />
      </div>
      <ToastContainer />
    </div>
  )
}
