import type { LucideIcon } from 'lucide-react'

// ── Auth ─────────────────────────────────────────────────────────
export type UserRole = 'super_admin' | 'admin' | 'employee' | 'agent' | 'affiliate'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
}

// Login response: backend sets the JWT as an httpOnly cookie and only
// returns the user profile in the body.
export interface AuthResponse {
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
  role: UserRole
}

// ── Services (master catalog) ────────────────────────────────────
export const SERVICE_CODES = [
  'FLIGHTS',
  'LOUNGE',
  'ASSIST',
  'ESIM',
  'EGIFT',
  'MTO',
] as const
export type ServiceCode = (typeof SERVICE_CODES)[number]

export interface ServiceCatalogItem {
  id: number
  code: ServiceCode
  name: string
  description: string | null
  vendor: string | null
  is_enabled: boolean
  created_at: string
}

// ── Customers (end-customer personal info) ───────────────────────
export const CUSTOMER_SOURCES = ['manual', 'veloxpays-sync'] as const
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number]

// Mirrors backend customerService.CUSTOMER_STATUSES — keep in sync.
export const CUSTOMER_STATUSES = [
  'active',
  'inactive',
  'pending',
  'verified',
  'suspended',
  'archived',
] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export interface CustomerServiceAssignment {
  id: number
  service_id: number
  code: ServiceCode
  name: string
  vendor: string | null
  status: string
  enabled_at: string
  source: CustomerSource
  notes: string | null
  created_at: string
  modified_at: string
}

export interface CustomerServiceAssignmentInput {
  code: ServiceCode
  status?: string
  source?: CustomerSource
  notes?: string | null
}

export interface Customer {
  id: number
  first_name: string
  middle_name: string | null
  last_name: string
  dob: string | null
  email: string
  phone: string | null
  address_line1: string | null
  city: string | null
  country: string | null
  status: string
  source: CustomerSource
  source_ref: string | null
  created_by: number | null
  created_at: string
  modified_at: string
  deleted_at: string | null
  added_by_name?: string | null
  added_by_email?: string | null
  added_by_role?: UserRole | null
  services: CustomerServiceAssignment[]
}

export interface CustomerPayload {
  first_name: string
  middle_name?: string | null
  last_name: string
  dob?: string | null
  email: string
  phone?: string | null
  address_line1?: string | null
  city?: string | null
  country?: string | null
  status: string
  source: CustomerSource
  source_ref?: string | null
  services?: CustomerServiceAssignmentInput[]
}

// ── API responses ────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

/** Standard envelope for paginated list endpoints. */
export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

/** Aggregate user counts used by the dashboard cards. */
export interface UserStats {
  total: number
  active: number
  inactive: number
}
