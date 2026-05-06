import { useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeService } from '../employeeService'
import type { CreateEmployeePayload } from '@/types'

export function useCreateEmployee(onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) => employeeService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      onSuccess?.()
    },
  })
}
