import { useQuery } from '@tanstack/vue-query'
import { getMatchPrediction, getMatchRetrospective, getStatsBombMetrics } from '../api'

export function useAIPrediction(matchId: number) {
  return useQuery({
    queryKey: ['prediction', matchId],
    queryFn: () => getMatchPrediction(matchId),
    staleTime: 120_000,
  })
}

export function useRetrospective(matchId: number) {
  return useQuery({
    queryKey: ['retrospective', matchId],
    queryFn: () => getMatchRetrospective(matchId),
    staleTime: 300_000,
    enabled: matchId > 0,
  })
}

export function useStatsBombMetrics(matchId: number) {
  return useQuery({
    queryKey: ['statsbomb', matchId],
    queryFn: () => getStatsBombMetrics(matchId),
    staleTime: 300_000,
  })
}
