import { useQuery } from '@tanstack/vue-query'
import { getBacktestSummary, getBacktestHistory } from '../api'

export function useBacktest(tournamentId: number) {
  const summary = useQuery({
    queryKey: ['backtest-summary', tournamentId],
    queryFn: () => getBacktestSummary(tournamentId),
    staleTime: 300_000,
    enabled: tournamentId > 0,
  })

  return { summary }
}

export function useBacktestHistory(page = 1) {
  return useQuery({
    queryKey: ['backtest-history', page],
    queryFn: () => getBacktestHistory(page),
    staleTime: 300_000,
  })
}
