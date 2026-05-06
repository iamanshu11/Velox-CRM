import api from '@/lib/axios'
import type { ApiResponse, AuthResponse, User } from '@/types'

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
      email,
      password,
    })
    return res.data.data
  },

  getMe: async (): Promise<User> => {
    const res = await api.get<ApiResponse<User>>('/auth/me')
    return res.data.data
  },
}
