import { ContactRound, Smartphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CustomerSourceId, UserRole } from '@/types'
import { canViewVeloxEsim } from './roles'

export interface CustomerSourceConfig {
  id: CustomerSourceId
  label: string
  icon: LucideIcon
  /** Tailwind classes for the inline service badge in the table. */
  badgeClass: string
  canAccess: (role: UserRole | undefined | null) => boolean
  /**
   * CRM service catalog code (e.g. 'ESIM') that maps this source to CRM customer
   * service assignments. When set, filtering by this source will include CRM customers
   * who have this service code assigned — in addition to any external platform rows.
   *
   * Leave undefined for the 'crm' entry (it shows all CRM customers regardless).
   * Future integrations: set this to the service catalog code that represents the service.
   */
  crmServiceCode?: string
}

/**
 * Registry of all customer data sources the CRM can display.
 *
 * To add a new service:
 *   1. Append an entry here.
 *   2. Add its id literal to `CustomerSourceId` in types/index.ts.
 *   3. Wire its data-fetching hook in CustomersPage.tsx.
 * No other structural changes are needed.
 */
export const CUSTOMER_SOURCES_CONFIG: CustomerSourceConfig[] = [
  {
    id: 'crm',
    label: 'CRM',
    icon: ContactRound,
    badgeClass: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
    canAccess: () => true,
    // No crmServiceCode — 'crm' filter shows every CRM customer.
  },
  {
    id: 'velox-esim',
    label: 'Velox eSIM',
    icon: Smartphone,
    badgeClass: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200',
    canAccess: canViewVeloxEsim,
    // CRM customers assigned the ESIM service appear alongside eSIM platform customers.
    crmServiceCode: 'ESIM',
  },
]
