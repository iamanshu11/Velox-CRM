import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  CreditCard,
  DollarSign,
  PlaneTakeoff,
  Users,
  Utensils,
  Wifi,
} from 'lucide-react'
import Skeleton from '@/components/ui/Skeleton'
import Badge from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { LineChart, BarChart } from '../components/Charts'
import { formatUsd, statusBadgeVariant } from '../utils'
import {
  useVVOverview,
  useVVRevenue,
  useVVGrowth,
  useVVPopularPackages,
  useVVRecentOrders,
  useVVOrderStats,
  useVVCustomerSpending,
} from '../hooks/useVVAnalytics'
import type { CustomerSpending } from '../types'

const PERIODS = ['7d', '30d', '90d']

function StatCard({
  icon,
  label,
  value,
  tint,
  sub,
}: {
  icon: ReactNode
  label: string
  value: string
  tint: string
  sub?: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tint}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

export default function VVAnalyticsPage() {
  const [period, setPeriod] = useState('30d')
  const overview = useVVOverview()
  const revenue = useVVRevenue(period)
  const growth = useVVGrowth(period)
  const popular = useVVPopularPackages(10)
  const recent = useVVRecentOrders(15)
  const orderStats = useVVOrderStats()
  const spending = useVVCustomerSpending(20)

  const spendingColumns = [
    {
      key: 'customer',
      header: 'Customer',
      render: (c: CustomerSpending) => (
        <div>
          <p className="font-medium text-gray-900">{c.name}</p>
          <p className="text-xs text-gray-500">{c.email}</p>
        </div>
      ),
    },
    {
      key: 'esim',
      header: 'eSIM',
      render: (c: CustomerSpending) => <span className="text-gray-500">{formatUsd(c.esimSpendUsd)}</span>,
    },
    {
      key: 'lounge',
      header: 'Lounge',
      render: (c: CustomerSpending) => <span className="text-gray-500">{formatUsd(c.loungeSpendUsd)}</span>,
    },
    {
      key: 'benefits',
      header: 'Benefits',
      render: (c: CustomerSpending) => <span className="text-gray-500">{formatUsd(c.benefitSpendUsd)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (c: CustomerSpending) => <span className="font-semibold text-gray-900">{formatUsd(c.totalSpendUsd)}</span>,
    },
    {
      key: 'orders',
      header: 'Orders',
      render: (c: CustomerSpending) => <span className="text-gray-500">{c.orderCount}</span>,
    },
  ]

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
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500">Revenue, growth, and customer spending across all services.</p>
          </div>
        </div>
      </div>

      {/* Overview — top row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overview.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : (
          <>
            <StatCard
              icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
              tint="bg-emerald-50"
              label="Total revenue"
              value={formatUsd(overview.data?.totalRevenueUsd ?? 0)}
              sub={`${overview.data?.totalOrders ?? 0} orders`}
            />
            <StatCard
              icon={<Users className="h-5 w-5 text-fuchsia-500" />}
              tint="bg-fuchsia-50"
              label="Active users"
              value={String(overview.data?.activeUsers ?? 0)}
            />
            <StatCard
              icon={<Wifi className="h-5 w-5 text-amber-500" />}
              tint="bg-amber-50"
              label="Active eSIMs"
              value={String(overview.data?.activeEsims ?? 0)}
            />
            <StatCard
              icon={<CreditCard className="h-5 w-5 text-sky-500" />}
              tint="bg-sky-50"
              label="Wallet top-ups"
              value={formatUsd(overview.data?.totalWalletTopUpsUsd ?? 0)}
            />
          </>
        )}
      </div>

      {/* Revenue breakdown by service */}
      {!overview.isLoading && overview.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Wifi className="h-5 w-5 text-blue-500" />}
            tint="bg-blue-50"
            label="eSIM revenue"
            value={formatUsd(overview.data.esimRevenueUsd)}
            sub={`${overview.data.esimOrders} orders`}
          />
          <StatCard
            icon={<PlaneTakeoff className="h-5 w-5 text-violet-500" />}
            tint="bg-violet-50"
            label="Lounge revenue"
            value={formatUsd(overview.data.loungeRevenueUsd)}
            sub={`${overview.data.loungeBookings} bookings`}
          />
          <StatCard
            icon={<Utensils className="h-5 w-5 text-teal-500" />}
            tint="bg-teal-50"
            label="Benefit revenue"
            value={formatUsd(overview.data.benefitRevenueUsd)}
            sub={`${overview.data.benefitBookings} bookings`}
          />
        </div>
      )}

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Period:</span>
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              period === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Revenue — All Services (USD)</h2>
          {revenue.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <LineChart
              valuePrefix="$"
              points={(revenue.data?.points ?? []).map((p) => ({ label: p.date, value: p.amount }))}
            />
          )}
        </Card>
        <Card padding="sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">New signups</h2>
          {growth.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <BarChart points={(growth.data?.points ?? []).map((p) => ({ label: p.date, value: p.count }))} />
          )}
        </Card>
      </div>

      {/* Order status breakdown */}
      {orderStats.data && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Order & booking status</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(orderStats.data.byStatus).map(([status, count]) => (
              <div key={status} className="rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
                <span className="text-xs text-gray-500">{status.replace(/_/g, ' ')}</span>
                <p className="text-lg font-semibold text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Spending Table */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Customer spending (top 20)</h2>
        <Card padding="none">
          <Table
            columns={spendingColumns}
            data={spending.data ?? []}
            keyField="userId"
            loading={spending.isLoading}
            emptyMessage="No customer spending data yet."
          />
        </Card>
      </div>

      {/* Top packages + recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Top eSIM packages</h2>
          {popular.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (popular.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No sales yet.</p>
          ) : (
            <ul className="space-y-2">
              {popular.data!.map((p) => (
                <li key={p.packageCode} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-gray-900">{p.packageName ?? p.packageCode}</span>
                  <span className="shrink-0 text-gray-500">
                    {p.count} sold · {formatUsd(p.revenueUsd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent activity</h2>
          {recent.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (recent.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.data!.map((o) => (
                <li key={o.orderNo} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={statusBadgeVariant(o.status)}>{o.type}</Badge>
                      <p className="truncate text-gray-900">{o.description}</p>
                    </div>
                    <p className="truncate text-xs text-gray-500">{o.customer?.email ?? '—'}</p>
                  </div>
                  <span className="shrink-0 font-medium text-gray-500">{formatUsd(o.amountUsd)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
