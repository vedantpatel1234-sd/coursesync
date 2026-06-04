import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import type { UserRole } from '../../types'

interface Props {
  allowedRoles: UserRole[]
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F3F0]">
        <div className="w-6 h-6 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!allowedRoles.includes(user.role)) {
    const fallback = user.role === 'admin' ? '/admin' : '/instructor'
    return <Navigate to={fallback} replace />
  }

  return <Outlet />
}