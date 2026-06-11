import { useQuery } from '@tanstack/vue-query'
import { getMatches, getMatchDetail } from '../api'
import { computed } from 'vue'

export function useMatches(params?: {
  tournamentId?: number
  status?: string
  stage?: string
  groupName?: string
  page?: number
}) {
  const queryKey = computed(() => ['matches', params])
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => getMatches(params),
    staleTime: 60_000,
  })

  return {
    matches: computed(() => data.value?.matches || []),
    total: computed(() => data.value?.total || 0),
    isLoading,
    error,
  }
}

export function useMatchDetail(id: number) {
  return useQuery({
    queryKey: ['match', id],
    queryFn: () => getMatchDetail(id),
    staleTime: 60_000,
  })
}
