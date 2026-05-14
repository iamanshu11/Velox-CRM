import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  useEmployees,
  useEmployeeStats,
} from '@/features/employees/hooks/useEmployees'
import StatsCards from './components/StatsCards'
import RecentEmployees from './components/RecentEmployees'
import { Card, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import CreateEmployeeModal from '@/features/employees/components/CreateEmployeeModal'

export default function SuperAdminDashboard() {
  const user = useAuthStore((s) => s.user)
  // Stats card values come from a cheap aggregate endpoint so they stay
  // accurate even after pagination was introduced on the list endpoint.
  const { data: stats, isLoading: statsLoading } = useEmployeeStats()
  // Recent users list only needs the first page; default page size of 20
  // is plenty for the "latest 5" slice rendered below.
  const { data: recent, isLoading: recentLoading } = useEmployees({
    page: 1,
    pageSize: 5,
  })
  const [showCreate, setShowCreate] = useState(false)

  const total = stats?.total ?? 0
  const active = stats?.active ?? 0
  const inactive = stats?.inactive ?? 0
  const recentItems = recent?.items ?? []

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Dashboard
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Here's an overview of your team, {user?.name?.split(' ')[0]}.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          size="sm"
          className="shrink-0"
        >
          <Plus size={15} />
          Add User
        </Button>
      </div>

      {/* Stats */}
      <StatsCards
        total={total}
        active={active}
        inactive={inactive}
        loading={statsLoading}
      />

      {/* Recent users */}
      <Card>
        <CardHeader
          title="Recent Users"
          description="Latest CRM users added to the system"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={14} />
              New
            </Button>
          }
        />
        {recentLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-100 rounded w-1/3 mb-1.5" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <RecentEmployees employees={recentItems} total={total} />
        )}
      </Card>

      {/* Create modal */}
      <CreateEmployeeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  )
}
