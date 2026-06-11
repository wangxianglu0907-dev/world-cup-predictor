import { useQuery } from '@tanstack/vue-query'
import { getGroupPrediction } from '../api'

export function useGroupPrediction(tournamentId: number) {
  return useQuery({
    queryKey: ['group-prediction', tournamentId],
    queryFn: () => getGroupPrediction(tournamentId),
    staleTime: 120_000,
    enabled: tournamentId > 0,
  })
}
