import {
  LayoutDashboard,
  Users,
  Settings,
  UserCircle,
  ContactRound,
  // Future: Handshake, UserCheck
} from 'lucide-react'
import type { NavItem, UserRole } from '@/types'

export const SIDEBAR_CONFIG: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: 'Dashboard', path: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Users', path: '/dashboard/employees', icon: Users },
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'Settings', path: '/dashboard/settings', icon: Settings },
  ],

  admin: [
    { label: 'Dashboard', path: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Users', path: '/dashboard/employees', icon: Users },
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'Settings', path: '/dashboard/settings', icon: Settings },
  ],

  employee: [
    { label: 'Users', path: '/dashboard/employees', icon: Users },
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'My Profile', path: '/dashboard/me', icon: UserCircle },
  ],
  agent: [
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'My Profile', path: '/dashboard/me', icon: UserCircle },
  ],
  affiliate: [
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'My Profile', path: '/dashboard/me', icon: UserCircle },
  ],
}
