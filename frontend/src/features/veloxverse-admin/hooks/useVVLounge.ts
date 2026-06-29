import { useQuery } from '@tanstack/react-query'
import { vvLoungeService } from '../vvAdminService'

export function useVVLoungeVisits(params: { page?: number; limit?: number; airport?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['vv-lounge', 'visits', params],
    queryFn: () => vvLoungeService.getVisits(params),
  })
}

export function useVVLoungeMemberships() {
  return useQuery({
    queryKey: ['vv-lounge', 'memberships'],
    queryFn: () => vvLoungeService.getMemberships(),
  })
}

export function useVVLoungeStats() {
  return useQuery({
    queryKey: ['vv-lounge', 'stats'],
    queryFn: () => vvLoungeService.getStats(),
  })
}
