import { useQuery } from '@tanstack/react-query'
import { employeeService } from '../employeeService'

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: employeeService.getAll,
    staleTime: 30_000,
  })
}
