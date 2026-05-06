import type { LucideIcon } from 'lucide-react'

// ── Auth ─────────────────────────────────────────────────────────
export type UserRole = 'super_admin' | 'employee'
// Future: | 'affiliate' | 'agent'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
}

export interface AuthResponse {
  token: string
  user: User
}

// ── Navigation ───────────────────────────────────────────────────
export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

// ── Employees ────────────────────────────────────────────────────
export interface Employee {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface CreateEmployeePayload {
  name: string
  email: string
  password: string
}

// ── API responses ────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}
