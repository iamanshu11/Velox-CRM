import { Eye, Pencil, Trash2 } from 'lucide-react'
import { Table } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import type { Customer } from '@/types'
import { formatCustomerLegalName } from '../utils'

interface Props {
  customers: Customer[]
  loading?: boolean
  onView: (customer: Customer) => void
  onEdit: (customer: Customer) => void
  onDelete?: (customer: Customer) => void
  deletingId?: number | null
}

function statusBadgeVariant(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  const s = status.toLowerCase()
  if (s === 'inactive' || s === 'archived') return 'danger'
  if (s === 'pending') return 'warning'
  if (s === 'active' || s === 'verified') return 'success'
  return 'neutral'
}

export default function CustomersTable({
  customers,
  loading,
  onView,
  onEdit,
  onDelete,
  deletingId,
}: Props) {
  return (
    <Table
      data={customers}
      keyField="id"
      loading={loading}
      emptyMessage="No customers found yet."
      columns={[
        {
          key: 'id',
          header: 'ID',
          render: (row) => <span className="text-gray-500 font-mono text-xs">#{row.id}</span>,
        },
        {
          key: 'name',
          header: 'Name',
          render: (row) => (
            <span className="font-medium text-gray-900">{formatCustomerLegalName(row)}</span>
          ),
        },
        { key: 'email', header: 'Email' },
        {
          key: 'phone',
          header: 'Phone',
          render: (row) => <span className="text-gray-600">{row.phone ?? '—'}</span>,
        },
        {
          key: 'city',
          header: 'City / Country',
          render: (row) => (
            <span className="text-gray-600">
              {[row.city, row.country].filter(Boolean).join(', ') || '—'}
            </span>
          ),
        },
        {
          key: 'status',
          header: 'Status',
          render: (row) => (
            <Badge variant={statusBadgeVariant(row.status)} dot>
              {row.status}
            </Badge>
          ),
        },
        {
          key: 'source',
          header: 'Source',
          render: (row) => (
            <div>
              <p className="text-gray-900 capitalize">{row.source.replace(/-/g, ' ')}</p>
              {row.source_ref && (
                <p className="text-xs text-gray-400 truncate max-w-[140px]" title={row.source_ref}>
                  {row.source_ref}
                </p>
              )}
            </div>
          ),
        },
        {
          key: 'services',
          header: 'Services',
          render: (row) => {
            const items = row.services ?? []
            if (items.length === 0) return <span className="text-gray-400">—</span>
            return (
              <div className="flex flex-wrap gap-1 max-w-[220px]">
                {items.slice(0, 3).map((s) => (
                  <span
                    key={s.id}
                    title={`${s.name} · ${s.status}`}
                    className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
                  >
                    {s.code}
                  </span>
                ))}
                {items.length > 3 && (
                  <span className="text-[10px] text-gray-500">+{items.length - 3}</span>
                )}
              </div>
            )
          },
        },
        {
          key: 'added_by',
          header: 'CRM user',
          render: (row) =>
            row.added_by_name ? (
              <div>
                <p className="text-gray-900 font-medium">{row.added_by_name}</p>
                <p className="text-xs text-gray-500 capitalize">{row.added_by_role?.replace(/_/g, ' ')}</p>
              </div>
            ) : (
              <span className="text-gray-400">—</span>
            ),
        },
        {
          key: 'actions',
          header: 'Actions',
          className: 'text-right',
          render: (row) => (
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => onView(row)}>
                <Eye size={14} />
                View
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(row)}>
                <Pencil size={14} />
                Edit
              </Button>
              {onDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 border-red-200"
                  onClick={() => onDelete(row)}
                  loading={deletingId === row.id}
                  aria-label={`Delete customer ${formatCustomerLegalName(row)}`}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              )}
            </div>
          ),
        },
      ]}
    />
  )
}
