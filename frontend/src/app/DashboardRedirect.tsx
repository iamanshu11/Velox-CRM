import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getRoleHome } from '@/config/roles'

export default function DashboardRedirect() {
  const role = useAuthStore((s) => s.user?.role)
  return <Navigate to={getRoleHome(role)} replace />
}
