import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useEmployees } from '@/features/employees/hooks/useEmployees'
import StatsCards from './components/StatsCards'
import RecentEmployees from './components/RecentEmployees'
import { Card, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import CreateEmployeeModal from '@/features/employees/components/CreateEmployeeModal'

export default function SuperAdminDashboard() {
  const { user } = useAuthStore()
  const { data: employees = [], isLoading } = useEmployees()
  const [showCreate, setShowCreate] = useState(false)

  const active = employees.filter((e) => e.is_active).length
  const inactive = employees.filter((e) => !e.is_active).length

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
          Add Employee
        </Button>
      </div>

      {/* Stats */}
      <StatsCards
        total={employees.length}
        active={active}
        inactive={inactive}
        loading={isLoading}
      />

      {/* Recent employees */}
      <Card>
        <CardHeader
          title="Recent Employees"
          description="Latest team members added to the system"
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
        {isLoading ? (
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
          <RecentEmployees employees={employees} />
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
