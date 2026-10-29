import type { LucideIcon } from 'lucide-react'
import { Sparkles, Menu, PanelLeft, ContactRound, UserRound, CreditCard, ScrollText, Users, UserCircle, Bell, BookOpen } from 'lucide-react'
import { canAccess } from '@/config/routeAccess'
import type { UserRole } from '@/types'
import { navTarget } from './targets'

export interface TourStep {
  id: string
  /** `data-tour` id to spotlight; none = a centred card. */
  target?: string
  /** Only for roles that can open this page (canAccess). */
  page?: string
  icon: LucideIcon
  title: string
  body: string
}

const ALL_STEPS: TourStep[] = [
  {
    id: 'welcome',
    icon: Sparkles,
    title: 'Welcome to Velox CRM',
    body: 'A quick look around — about a minute. You can skip at any time and find everything again in the Quick Guide.',
  },
  {
    id: 'menu-button',
    target: 'menu-button',
    icon: Menu,
    title: 'Open the menu',
    body: 'Tap here to open the menu with every page you can use.',
  },
  {
    id: 'sidebar',
    target: 'sidebar',
    icon: PanelLeft,
    title: 'Your menu',
    body: 'Every page you can use is here. You only see the pages your role allows.',
  },
  {
    id: 'customers',
    target: navTarget('/dashboard/customers'),
    page: '/dashboard/customers',
    icon: ContactRound,
    title: 'Customers',
    body: 'Find, add and edit customer records. Search by name, email, phone or city.',
  },
  {
    id: 'vv-users',
    target: navTarget('/dashboard/veloxverse/users'),
    page: '/dashboard/veloxverse/users',
    icon: UserRound,
    title: 'App Users',
    body: 'VeloxVerse customers and guests. Open one to see their spending, bookings and support tickets, block them, or correct their country.',
  },
  {
    id: 'payments',
    target: navTarget('/dashboard/veloxverse/payments'),
    page: '/dashboard/veloxverse/payments',
    icon: CreditCard,
    title: 'Payments & refunds',
    body: 'Every payment and refund, with filters and CSV export. Refunds and Reconciliation sit just below.',
  },
  {
    id: 'audit-logs',
    target: navTarget('/dashboard/veloxverse/audit-logs'),
    page: '/dashboard/veloxverse/audit-logs',
    icon: ScrollText,
    title: 'Audit Logs',
    body: 'Look up what happened to a customer: search by support reference, email or payment id, and follow their journey step by step.',
  },
  {
    id: 'employees',
    target: navTarget('/dashboard/employees'),
    page: '/dashboard/employees',
    icon: Users,
    title: 'Users',
    body: 'Your team. Add a user and choose their role here.',
  },
  {
    id: 'me',
    target: navTarget('/dashboard/me'),
    page: '/dashboard/me',
    icon: UserCircle,
    title: 'My Profile',
    body: 'Your own dashboard and an overview of your work.',
  },
  {
    id: 'notifications',
    target: 'notifications',
    icon: Bell,
    title: 'Notifications',
    body: 'Updates for you land here. A number shows how many are unread.',
  },
  {
    id: 'user-menu',
    target: 'user-menu',
    icon: BookOpen,
    title: 'Quick Guide',
    body: 'Open your name here for the Quick Guide — short how-tos for every page — or to replay this tour. Sign out lives here too.',
  },
]

/** The steps `role` may see, in order. Steps whose target isn't on screen are dropped later (at start). */
export function tourStepsForRole(role: UserRole): TourStep[] {
  return ALL_STEPS.filter((step) => !step.page || canAccess(role, step.page))
}
