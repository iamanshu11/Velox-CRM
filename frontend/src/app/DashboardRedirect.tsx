import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const ROLE_HOME: Record<string, string> = {
  super_admin: '/dashboard/admin',
  employee: '/dashboard/me',
  // Future: affiliate: '/dashboard/affiliate', agent: '/dashboard/agent'
}

export default function DashboardRedirect() {
  const role = useAuthStore((s) => s.user?.role ?? 'employee')
  return <Navigate to={ROLE_HOME[role] ?? '/login'} replace />
}
