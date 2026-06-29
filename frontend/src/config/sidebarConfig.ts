import {
  LayoutDashboard,
  Users,
  Settings,
  UserCircle,
  ContactRound,
  ShieldCheck,
  FormInput,
} from 'lucide-react'
import type { NavItem, UserRole } from '@/types'

export const SIDEBAR_CONFIG: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: 'Dashboard',     path: '/dashboard/admin',               icon: LayoutDashboard },
    { label: 'Users',         path: '/dashboard/employees',           icon: Users },
    { label: 'Customers',     path: '/dashboard/customers',           icon: ContactRound },
    { label: 'Verification',  path: '/dashboard/verification-review', icon: ShieldCheck },
    { label: 'Form Builder',  path: '/dashboard/forms',               icon: FormInput },
    { label: 'Settings',      path: '/dashboard/settings',            icon: Settings },
  ],

  admin: [
    { label: 'Dashboard',     path: '/dashboard/admin',               icon: LayoutDashboard },
    { label: 'Users',         path: '/dashboard/employees',           icon: Users },
    { label: 'Customers',     path: '/dashboard/customers',           icon: ContactRound },
    { label: 'Verification',  path: '/dashboard/verification-review', icon: ShieldCheck },
    { label: 'Form Builder',  path: '/dashboard/forms',               icon: FormInput },
    { label: 'Settings',      path: '/dashboard/settings',            icon: Settings },
  ],

  employee: [
    { label: 'Verification', path: '/dashboard/verification', icon: ShieldCheck },
    { label: 'Users', path: '/dashboard/employees', icon: Users },
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'My Profile', path: '/dashboard/me', icon: UserCircle },
  ],
  agent: [
    { label: 'Verification', path: '/dashboard/verification', icon: ShieldCheck },
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'My Profile', path: '/dashboard/me', icon: UserCircle },
  ],
  affiliate: [
    { label: 'Verification', path: '/dashboard/verification', icon: ShieldCheck },
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'My Profile', path: '/dashboard/me', icon: UserCircle },
  ],
}
