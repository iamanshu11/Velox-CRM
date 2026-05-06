import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useEmployees } from '../hooks/useEmployees'
import EmployeeTable from '../components/EmployeeTable'
import CreateEmployeeModal from '../components/CreateEmployeeModal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useDebounce } from '@/hooks/useDebounce'

export default function EmployeesPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)

  const { data: employees = [], isLoading, isError } = useEmployees()

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      e.email.toLowerCase().includes(debouncedSearch.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Employees</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your team — {employees.length} member
            {employees.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="shrink-0">
          <Plus size={15} />
          Add Employee
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
        />
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4">
          <p className="text-sm text-red-600">
            Failed to load employees. Please refresh the page.
          </p>
        </div>
      )}

      {/* Table */}
      <EmployeeTable employees={filtered} loading={isLoading} />

      {/* Empty search result */}
      {!isLoading && !isError && filtered.length === 0 && debouncedSearch && (
        <p className="text-sm text-gray-500 text-center py-4">
          No employees match "<strong>{debouncedSearch}</strong>"
        </p>
      )}

      {/* Create modal */}
      <CreateEmployeeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  )
}
