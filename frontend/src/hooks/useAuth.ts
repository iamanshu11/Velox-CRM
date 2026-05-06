import { useAuthStore } from '@/store/authStore'

/**
 * Convenience hook — reads auth state from the Zustand store.
 * Use this in feature components instead of importing useAuthStore directly.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const setAuth = useAuthStore((s) => s.setAuth)

  return {
    user,
    token,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'super_admin',
    logout,
    setAuth,
  }
}
