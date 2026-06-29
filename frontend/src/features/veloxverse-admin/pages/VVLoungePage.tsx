import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Sofa,
  DollarSign,
  BadgeCheck,
  CalendarClock,
  XCircle,
} from 'lucide-react'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import {
  useVVLoungeVisits,
  useVVLoungeMemberships,
  useVVLoungeStats,
} from '../hooks/useVVLounge'
import { formatCents, formatDate, statusBadgeVariant } from '../utils'
import type { LoungeVisit, LoungeVisitStatus, AdminLoungeMembership } from '../types'

const PAGE_SIZE = 20

const STATUS_OPTIONS: ('' | LoungeVisitStatus)[] = [
  '',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]

const selectClass =
  'h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string
  value: string | number
  icon: ReactNode
  tint: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function VisitsTab() {
  const [page, setPage] = useState(1)
  const [airport, setAirport] = useState('')
  const [status, setStatus] = useState<'' | LoungeVisitStatus>('')

  const { data, isLoading } = useVVLoungeVisits({
    page,
    limit: PAGE_SIZE,
    airport: airport || undefined,
    status: status || undefined,
  })

  const columns = [
    {
      key: 'lounge',
      header: 'Lounge',
      render: (v: LoungeVisit) => <span className="font-medium text-gray-900">{v.loungeName}</span>,
    },
    { key: 'airport', header: 'Airport', render: (v: LoungeVisit) => v.airportCode },
    { key: 'date', header: 'Date', render: (v: LoungeVisit) => formatDate(v.visitDate) },
    { key: 'guests', header: 'Guests', render: (v: LoungeVisit) => v.guestCount },
    {
      key: 'status',
      header: 'Status',
      render: (v: LoungeVisit) => <Badge variant={statusBadgeVariant(v.status)}>{v.status}</Badge>,
    },
    { key: 'cost', header: 'Cost', render: (v: LoungeVisit) => formatCents(v.costCents) },
    {
      key: 'created',
      header: 'Created',
      render: (v: LoungeVisit) => <span className="text-gray-500">{formatDate(v.createdAt)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-[220px]">
          <Input
            placeholder="Airport code (e.g. LHR)"
            value={airport}
            onChange={(e) => {
              setPage(1)
              setAirport(e.target.value.toUpperCase())
            }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value as '' | LoungeVisitStatus)
          }}
          className={selectClass}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s || 'all'} value={s}>
              {s ? s : 'All statuses'}
            </option>
          ))}
        </select>
      </div>

      <Card padding="none">
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyField="id"
          loading={isLoading}
          emptyMessage="No visits found."
        />
      </Card>

      {data && data.total > PAGE_SIZE && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

function MembershipsTab() {
  const { data: memberships, isLoading } = useVVLoungeMemberships()

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (m: AdminLoungeMembership) => (
        <span className="font-medium text-gray-900">{m.user?.name ?? '—'}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (m: AdminLoungeMembership) => <span className="text-gray-500">{m.user?.email ?? '—'}</span>,
    },
    { key: 'tier', header: 'Tier', render: (m: AdminLoungeMembership) => m.tier },
    {
      key: 'visitsRemaining',
      header: 'Visits left',
      render: (m: AdminLoungeMembership) => (m.visitsRemaining === -1 ? '∞' : m.visitsRemaining),
    },
    {
      key: 'status',
      header: 'Status',
      render: (m: AdminLoungeMembership) => <Badge variant={statusBadgeVariant(m.status)}>{m.status}</Badge>,
    },
    {
      key: 'validTo',
      header: 'Valid until',
      render: (m: AdminLoungeMembership) => formatDate(m.validTo),
    },
    {
      key: 'created',
      header: 'Created',
      render: (m: AdminLoungeMembership) => <span className="text-gray-500">{formatDate(m.createdAt)}</span>,
    },
  ]

  return (
    <Card padding="none">
      <Table
        columns={columns}
        data={memberships ?? []}
        keyField="id"
        loading={isLoading}
        emptyMessage="No memberships yet."
      />
    </Card>
  )
}

export default function VVLoungePage() {
  const { data: stats, isLoading } = useVVLoungeStats()

  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
            <Sofa className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lounge Management</h1>
            <p className="text-sm text-gray-500">Visits, memberships and revenue across VeloxLounge.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Total revenue"
              value={formatCents(stats?.totalRevenueCents ?? 0)}
              icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
              tint="bg-emerald-50"
            />
            <StatCard
              label="Active memberships"
              value={stats?.activeMemberships ?? 0}
              icon={<BadgeCheck className="h-5 w-5 text-indigo-500" />}
              tint="bg-indigo-50"
            />
            <StatCard
              label="Upcoming visits"
              value={stats?.upcomingVisits ?? 0}
              icon={<CalendarClock className="h-5 w-5 text-amber-500" />}
              tint="bg-amber-50"
            />
            <StatCard
              label="Cancelled visits"
              value={stats?.cancelledVisits ?? 0}
              icon={<XCircle className="h-5 w-5 text-red-500" />}
              tint="bg-red-50"
            />
          </>
        )}
      </div>

      <Tabs defaultValue="visits">
        <TabsList>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="memberships">Memberships</TabsTrigger>
        </TabsList>
        <TabsContent value="visits">
          <VisitsTab />
        </TabsContent>
        <TabsContent value="memberships">
          <MembershipsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
