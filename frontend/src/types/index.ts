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

// ── Approvals (workflow) ───────────────────────────────────────────
// Mirrors backend approvalService.APPROVAL_KINDS / APPROVAL_STATUSES.
export const APPROVAL_KINDS = ['user_onboarding', 'generic'] as const
export type ApprovalRequestKind = (typeof APPROVAL_KINDS)[number]

export const APPROVAL_STATUSES = [
  'pending',
  'in_review',
  'approved',
  'completed',
  'rejected',
  'cancelled',
] as const
export type ApprovalRequestStatus = (typeof APPROVAL_STATUSES)[number]

export const TERMINAL_APPROVAL_STATUSES: readonly ApprovalRequestStatus[] = [
  'completed',
  'rejected',
  'cancelled',
] as const

export function isTerminalApprovalStatus(status: ApprovalRequestStatus): boolean {
  return (TERMINAL_APPROVAL_STATUSES as readonly string[]).includes(status)
}

export interface ApprovalRequest {
  id: number
  kind: ApprovalRequestKind
  status: ApprovalRequestStatus
  title: string
  body: Record<string, unknown> | null
  requester_id: number
  subject_user_id: number | null
  assigned_to_id: number | null
  decided_by_id: number | null
  decision_note: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  subject_user_role?: UserRole | null
  subject_user_role_snapshot?: UserRole | null
  subject_user_current_role?: UserRole | null
  requester_name?: string | null
  requester_email?: string | null
}

export interface ApprovalAction {
  id: number
  request_id: number
  actor_id: number
  from_status: ApprovalRequestStatus | null
  to_status: ApprovalRequestStatus
  note: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor_name: string
  actor_email: string
  actor_role: UserRole
}

export interface ApprovalRequestDetail extends ApprovalRequest {
  actions: ApprovalAction[]
}

export interface CreateApprovalRequestPayload {
  kind: ApprovalRequestKind
  title: string
  body?: Record<string, unknown> | null
  subject_user_id?: number | null
  assigned_to_id?: number | null
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
