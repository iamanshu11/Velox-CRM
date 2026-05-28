import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/store/authStore'
import { canViewVeloxEsim } from '@/config/roles'
import { CUSTOMER_SOURCES_CONFIG } from '@/config/customerSources'
import type { Customer, CustomerSourceId, UnifiedCustomerRow, VeloxEsimCustomer } from '@/types'
import { formatCustomerLegalName } from '../utils'
import { useCustomers, useDeleteCustomer } from '../hooks/useCustomers'
import {
  useVeloxEsimCustomers,
  useVeloxEsimCustomer,
  useVeloxEsimHealth,
} from '@/features/velox-esim/hooks/useVeloxEsim'
import CustomersTable from '../components/CustomersTable'
import CustomerFormModal from '../components/CustomerFormModal'
import CustomerDetailsModal from '../components/CustomerDetailsModal'
import VeloxEsimCustomerDetailModal from '@/features/velox-esim/components/VeloxEsimCustomerDetailModal'

const PAGE_SIZE = 20

/**
 * 'all'              → every accessible source in one table
 * A specific source id → narrow to that service
 *
 * Adding a new service: register it in customerSources.ts (with crmServiceCode if it
 * maps to a CRM service catalog entry) and add its id to CustomerSourceId in types/index.ts.
 * The dropdown and row filtering update automatically.
 */
type ServiceFilter = 'all' | CustomerSourceId

export default function CustomersPage() {
  const user = useAuthStore((s) => s.user)
  const userRole = user?.role
  const canSeeEsim = canViewVeloxEsim(userRole)

  const availableSources = CUSTOMER_SOURCES_CONFIG.filter((s) => s.canAccess(userRole))
  const multiSource = availableSources.length > 1

  // ── Shared filter / pagination / search ──────────────────────────
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => { setPage(1) }, [serviceFilter, debouncedSearch])

  // ── Modal state ──────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [viewCrmCustomer, setViewCrmCustomer] = useState<Customer | null>(null)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [selectedEsimId, setSelectedEsimId] = useState<string | null>(null)

  // ── Which external sources are active given the current filter ───
  // CRM is always fetched (primary source, cheap to keep warm in cache).
  // eSIM external API is only called when the filter includes it.
  const esimActive =
    canSeeEsim && (serviceFilter === 'all' || serviceFilter === 'velox-esim')

  // ── Data fetching ────────────────────────────────────────────────
  const {
    data: crmData,
    isLoading: crmLoading,
    isError: crmError,
    isFetching: crmFetching,
  } = useCustomers({ page, pageSize: PAGE_SIZE })

  const deleteCustomer = useDeleteCustomer(() => setDeleteTarget(null))

  const { data: esimHealth } = useVeloxEsimHealth(esimActive)
  const {
    data: esimData,
    isLoading: esimLoading,
    isError: esimError,
    error: esimRawError,
  } = useVeloxEsimCustomers(
    { page, limit: PAGE_SIZE, search: debouncedSearch || undefined },
    { enabled: esimActive }
  )
  const { data: esimDetail, isLoading: esimDetailLoading } = useVeloxEsimCustomer(selectedEsimId)

  // ── Build CRM rows ───────────────────────────────────────────────
  const crmRows = useMemo((): UnifiedCustomerRow[] => {
    let customers = crmData?.items ?? []

    // When filtering by a specific service (not 'all' / 'crm'), check whether
    // that source maps to a CRM service catalog code. If it does, keep only
    // CRM customers who have that service assigned. If it doesn't, CRM
    // contributes no rows for this filter (the external source owns that view).
    if (serviceFilter !== 'all' && serviceFilter !== 'crm') {
      const srcConfig = CUSTOMER_SOURCES_CONFIG.find((s) => s.id === serviceFilter)
      if (!srcConfig?.crmServiceCode) return []
      const code = srcConfig.crmServiceCode
      customers = customers.filter((c) =>
        (c.services ?? []).some((s) => s.code === code)
      )
    }

    // Client-side text search (applies to the current page only)
    const keyword = debouncedSearch.toLowerCase()
    if (keyword) {
      customers = customers.filter((c) => {
        const legal = formatCustomerLegalName(c).toLowerCase()
        return (
          legal.includes(keyword) ||
          c.email.toLowerCase().includes(keyword) ||
          String(c.id).includes(keyword) ||
          (c.phone ?? '').toLowerCase().includes(keyword) ||
          (c.city ?? '').toLowerCase().includes(keyword) ||
          (c.country ?? '').toLowerCase().includes(keyword) ||
          c.status.toLowerCase().includes(keyword) ||
          (c.source ?? '').toLowerCase().includes(keyword) ||
          (c.source_ref ?? '').toLowerCase().includes(keyword) ||
          (c.added_by_name ?? '').toLowerCase().includes(keyword) ||
          (c.services ?? []).some((s) =>
            `${s.code} ${s.name} ${s.status}`.toLowerCase().includes(keyword)
          )
        )
      })
    }

    return customers.map((c) => ({ _source: 'crm', _key: `crm-${c.id}`, data: c }))
  }, [crmData, debouncedSearch, serviceFilter])

  // ── Build eSIM rows ──────────────────────────────────────────────
  const esimRows = useMemo((): UnifiedCustomerRow[] => {
    if (!esimActive) return []
    return (esimData?.customers ?? []).map((c) => ({
      _source: 'velox-esim',
      _key: `esim-${c.id}`,
      data: c,
    }))
  }, [esimData, esimActive])

  // CRM rows first (tagged CRM or tagged-to-service), then external platform rows
  const activeRows = useMemo(() => [...crmRows, ...esimRows], [crmRows, esimRows])

  // ── Pagination ───────────────────────────────────────────────────
  // In 'all' mode: page count is driven by the larger source so no dead pages appear.
  // In a specific-source mode: use that source's total.
  const crmTotal = crmData?.total ?? 0
  const esimTotal = esimActive ? (esimData?.pagination?.total ?? 0) : 0

  const paginationTotal = useMemo(() => {
    if (serviceFilter === 'all') return Math.max(crmTotal, esimTotal)
    if (serviceFilter === 'crm') return crmTotal
    // For service-specific filters that blend CRM + external rows:
    // drive pagination off whichever side has more records.
    return Math.max(crmTotal, esimTotal)
  }, [serviceFilter, crmTotal, esimTotal])

  // ── Derived flags ────────────────────────────────────────────────
  const isLoading = crmLoading || crmFetching || (esimActive && esimLoading)
  const anyError = crmError || (esimActive && esimError)

  const esimErrMsg =
    (esimRawError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    'Failed to load eSIM customers.'

  // ── Row action handlers ──────────────────────────────────────────
  const handleView = (row: UnifiedCustomerRow) => {
    if (row._source === 'crm') setViewCrmCustomer(row.data)
    else setSelectedEsimId(row.data.id)
  }

  const handleEdit = (row: UnifiedCustomerRow) => {
    if (row._source === 'crm') setEditCustomer(row.data)
  }

  const handleDelete = (row: UnifiedCustomerRow) => {
    if (row._source === 'crm') setDeleteTarget(row.data)
  }

  // Fall back to list-level data while full detail is fetching
  const esimModalCustomer: VeloxEsimCustomer | null =
    esimDetail ??
    (selectedEsimId
      ? ((esimRows.find((r) => r._key === `esim-${selectedEsimId}`)
            ?.data as VeloxEsimCustomer | undefined) ?? null)
      : null)

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Unified view of customers across all connected services.
          </p>
        </div>
        {(serviceFilter === 'all' || serviceFilter === 'crm') && (
          <Button onClick={() => setShowCreate(true)} size="sm" className="shrink-0">
            <Plus size={15} />
            Add Customer
          </Button>
        )}
      </div>

      {/* ── Controls row: service filter dropdown + search ──────────── */}
      <div className="flex flex-wrap items-end gap-4">

        {/* Service filter — shown only when more than one source is available.
            A <select> scales cleanly to any number of services. */}
        {multiSource && (
          <div className="flex flex-col gap-1">
            <label htmlFor="service-filter" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Service
            </label>
            <select
              id="service-filter"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value as ServiceFilter)}
              className="rounded-lg border border-gray-300 bg-white pl-3 pr-8 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
            >
              <option value="all">All services</option>
              {availableSources.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        <div className="flex-1 min-w-[240px] max-w-sm">
          {multiSource && (
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Search
            </p>
          )}
          <Input
            placeholder="Search by name, email, phone, city, service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>
      </div>

      {debouncedSearch && (
        <p className="text-xs text-gray-400 -mt-3">
          CRM results are filtered on the current page.
          {esimActive && ' eSIM search applies across all records.'}
        </p>
      )}

      {/* ── eSIM connectivity banner ────────────────────────────────── */}
      {esimActive && esimHealth && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            esimHealth.reachable
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <p className="font-medium">
            {esimHealth.reachable ? 'Velox API connected' : 'Velox API unavailable'}
          </p>
          <p className="opacity-80 mt-0.5">{esimHealth.message}</p>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────────── */}
      {anyError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 space-y-1">
          {crmError && (
            <p className="text-sm text-red-600">
              Failed to load CRM customers. Please refresh the page.
            </p>
          )}
          {esimActive && esimError && (
            <p className="text-sm text-red-600">{esimErrMsg}</p>
          )}
          {esimActive && esimHealth && !esimHealth.configured && (
            <p className="text-sm text-red-600">
              Set <code className="text-xs">VELOX_API_URL</code> and{' '}
              <code className="text-xs">VELOX_API_KEY</code> on the CRM backend, then restart.
            </p>
          )}
        </div>
      )}

      {/* ── Unified table ──────────────────────────────────────────── */}
      <CustomersTable
        rows={activeRows}
        loading={isLoading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        deletingKey={
          deleteCustomer.isPending && deleteTarget ? `crm-${deleteTarget.id}` : null
        }
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={paginationTotal}
        onPageChange={setPage}
      />

      {!isLoading && !anyError && activeRows.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          {debouncedSearch
            ? `No customers match "${debouncedSearch}" on this page.`
            : 'No customers found.'}
        </p>
      )}

      {/* ── CRM modals ─────────────────────────────────────────────── */}
      <CustomerFormModal open={showCreate} onClose={() => setShowCreate(false)} />

      <CustomerDetailsModal
        open={!!viewCrmCustomer}
        customer={viewCrmCustomer}
        onClose={() => setViewCrmCustomer(null)}
        onEdit={() => {
          setEditCustomer(viewCrmCustomer)
          setViewCrmCustomer(null)
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

      {/* ── eSIM detail modal ──────────────────────────────────────── */}
      <VeloxEsimCustomerDetailModal
        open={!!selectedEsimId}
        onClose={() => setSelectedEsimId(null)}
        customer={esimModalCustomer}
        isLoading={esimDetailLoading && !!selectedEsimId}
      />
    </div>
  )
}
