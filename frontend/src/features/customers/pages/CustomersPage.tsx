import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import type { Customer } from '@/types'
import { formatCustomerLegalName } from '../utils'
import { useCustomers, useDeleteCustomer } from '../hooks/useCustomers'
import CustomersTable from '../components/CustomersTable'
import CustomerFormModal from '../components/CustomerFormModal'
import CustomerDetailsModal from '../components/CustomerDetailsModal'

const PAGE_SIZE = 20

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  const debouncedSearch = useDebounce(search, 250)
  const { data, isLoading, isError, isFetching } = useCustomers({ page, pageSize: PAGE_SIZE })
  const deleteCustomer = useDeleteCustomer(() => setDeleteTarget(null))

  const customers = data?.items ?? []
  const total = data?.total ?? 0

  // Reset to page 1 whenever the search term changes — otherwise the user could
  // be looking at "page 3 of all customers" while typing a query that has zero
  // matches on that specific page and be confused.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const filtered = useMemo(() => {
    const keyword = debouncedSearch.toLowerCase()
    if (!keyword) return customers
    return customers.filter((customer) => {
      const legal = formatCustomerLegalName(customer).toLowerCase()
      const added = customer.added_by_name?.toLowerCase() ?? ''
      const ref = customer.source_ref?.toLowerCase() ?? ''
      const src = customer.source?.toLowerCase() ?? ''
      const services = (customer.services ?? [])
        .map((s) => `${s.code} ${s.name} ${s.status}`.toLowerCase())
        .join(' ')
      return (
        legal.includes(keyword) ||
        customer.email.toLowerCase().includes(keyword) ||
        String(customer.id).includes(keyword) ||
        (customer.phone ?? '').toLowerCase().includes(keyword) ||
        (customer.city ?? '').toLowerCase().includes(keyword) ||
        (customer.country ?? '').toLowerCase().includes(keyword) ||
        customer.status.toLowerCase().includes(keyword) ||
        src.includes(keyword) ||
        ref.includes(keyword) ||
        added.includes(keyword) ||
        services.includes(keyword)
      )
    })
  }, [customers, debouncedSearch])

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            End-customer records — personal info, source (manual / VeloxPays sync), and CRM attribution.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="shrink-0">
          <Plus size={15} />
          Add Customer
        </Button>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Search by name, email, phone, city, status, source, service…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
        />
        {debouncedSearch && (
          <p className="text-xs text-gray-400 mt-1.5">
            Search applies to the current page only.
          </p>
        )}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4">
          <p className="text-sm text-red-600">Failed to load customers. Please refresh the page.</p>
        </div>
      )}

      <CustomersTable
        customers={filtered}
        loading={isLoading || isFetching}
        onView={(customer) => setViewCustomer(customer)}
        onEdit={(customer) => setEditCustomer(customer)}
        onDelete={(customer) => setDeleteTarget(customer)}
        deletingId={deleteCustomer.isPending ? deleteTarget?.id ?? null : null}
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {!isLoading && !isError && filtered.length === 0 && debouncedSearch && (
        <p className="text-sm text-gray-500 text-center py-4">
          No customers on this page match "<strong>{debouncedSearch}</strong>"
        </p>
      )}

      <CustomerFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      <CustomerDetailsModal
        open={!!viewCustomer}
        customer={viewCustomer}
        onClose={() => setViewCustomer(null)}
        onEdit={() => {
          setEditCustomer(viewCustomer)
          setViewCustomer(null)
        }}
      />
      <CustomerFormModal
        open={!!editCustomer}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => {
          if (!deleteCustomer.isPending) setDeleteTarget(null)
        }}
        title="Delete customer?"
        description="This soft-deletes the record. You can restore it from the database if needed, but it will no longer appear in the CRM."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteCustomer.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteCustomer.isPending}
              onClick={() => {
                if (deleteTarget) deleteCustomer.mutate(deleteTarget.id)
              }}
            >
              Yes, delete
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <p className="text-sm text-gray-700">
            You're about to delete{' '}
            <strong>{formatCustomerLegalName(deleteTarget)}</strong> ({deleteTarget.email}).
          </p>
        )}
      </Modal>
    </div>
  )
}
