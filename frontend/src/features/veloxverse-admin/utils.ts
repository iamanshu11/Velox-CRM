import type { BadgeVariant } from '@/components/ui/Badge'

/**
 * Maps a status string (any service) to a CRM Badge variant.
 * Shared across all VeloxVerse admin pages.
 */
export function statusBadgeVariant(status: string): BadgeVariant {
  const s = status.toUpperCase()
  if (['ACTIVE', 'COMPLETED', 'PUBLISHED', 'RESOLVED'].includes(s)) return 'success'
  if (['PENDING', 'DRAFT', 'OPEN', 'CONFIRMED'].includes(s)) return 'warning'
  if (['CANCELLED', 'FAILED', 'ARCHIVED', 'CLOSED', 'EXPIRED'].includes(s)) return 'danger'
  if (['IN_PROGRESS', 'APPROVED', 'SUSPENDED'].includes(s)) return 'info'
  return 'neutral'
}

/** Format a dollar float (e.g. analytics revenue, eSIM cost) as $X.XX */
export function formatUsd(value: number): string {
  return `$${(value ?? 0).toFixed(2)}`
}

/** Format integer cents (e.g. lounge cost, transfer amount) as $X.XX */
export function formatCents(cents: number): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`
}

/** Format an ISO date string to a readable local date/time. */
export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Format an ISO date string to a readable local date + time. */
export function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
