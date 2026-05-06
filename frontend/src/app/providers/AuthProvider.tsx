import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'

/**
 * AuthProvider hydrates the auth store from localStorage on mount.
 * Zustand persist middleware handles this automatically, but this
 * component is the right place to add future side-effects (e.g.
 * token refresh, session validation).
 */
interface Props {
  children: ReactNode
}

export default function AuthProvider({ children }: Props) {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    // Future: validate token with server, refresh if expired
    if (!token) return
  }, [token])

  return <>{children}</>
}
