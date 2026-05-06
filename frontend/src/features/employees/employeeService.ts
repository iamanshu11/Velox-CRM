import api from '@/lib/axios'
import type { ApiResponse, Employee, CreateEmployeePayload } from '@/types'

export const employeeService = {
  getAll: async (): Promise<Employee[]> => {
    const res = await api.get<ApiResponse<Employee[]>>('/users/employees')
    return res.data.data
  },

  create: async (payload: CreateEmployeePayload): Promise<Employee> => {
    const res = await api.post<ApiResponse<Employee>>('/users/employees', payload)
    return res.data.data
  },

  toggleStatus: async (id: number): Promise<Employee> => {
    const res = await api.patch<ApiResponse<Employee>>(`/users/${id}/toggle-status`)
    return res.data.data
  },
}
