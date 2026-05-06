import {
  LayoutDashboard,
  Users,
  Settings,
  UserCircle,
  // Future: Handshake, UserCheck
} from 'lucide-react'
import type { NavItem, UserRole } from '@/types'

export const SIDEBAR_CONFIG: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: 'Dashboard', path: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Employees', path: '/dashboard/employees', icon: Users },
    { label: 'Settings', path: '/dashboard/settings', icon: Settings },
  ],

  employee: [
    { label: 'My Profile', path: '/dashboard/me', icon: UserCircle },
    // Add more employee links here as features grow
  ],

  // ────────────────────────────────────────────────────────────────
  // FUTURE ROLES — add entries here, zero structural changes needed
  // affiliate: [
  //   { label: 'My Dashboard', path: '/dashboard/affiliate', icon: Handshake },
  // ],
  // agent: [
  //   { label: 'My Dashboard', path: '/dashboard/agent', icon: UserCheck },
  // ],
  // ────────────────────────────────────────────────────────────────
}
