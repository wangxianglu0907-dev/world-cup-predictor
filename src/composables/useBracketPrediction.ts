import { useQuery } from '@tanstack/vue-query'
import { getBracketPrediction } from '../api'

export function useBracketPrediction(tournamentId: number) {
  return useQuery({
    queryKey: ['bracket-prediction', tournamentId],
    queryFn: () => getBracketPrediction(tournamentId),
    staleTime: 120_000,
    enabled: tournamentId > 0,
  })
}
