import type {
  Tournament,
  Match,
  AIPrediction,
  RetrospectiveAnalysis,
  GroupPrediction,
  BracketPrediction,
  StatsBombMetrics,
  AIStatus,
  BacktestSummary,
  BacktestResult,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL || ''

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const searchParams = new URLSearchParams(params || {})
  const qs = searchParams.toString()
  const url = `${path}${qs ? '?' + qs : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// 1. 赛事列表
export function getTournaments(status?: string) {
  return get<Tournament[]>('/api/tournaments', status ? { status } : undefined)
}

// 2. 赛事详情
export function getTournamentDetail(id: number) {
  return get<Tournament & { teams: import('../types').Team[] }>(`/api/tournaments/${id}`)
}

// 3. 比赛列表
export function getMatches(params?: {
  tournamentId?: number
  status?: string
  stage?: string
  groupName?: string
  page?: number
}) {
  return get<{ matches: Match[]; total: number }>(
    '/api/matches',
    params as Record<string, string>
  )
}

// 4. 比赛详情
export function getMatchDetail(id: number) {
  return get<Match>(`/api/matches/${id}`)
}

// 5. AI预测报告
export function getMatchPrediction(id: number) {
  return get<AIPrediction>(`/api/matches/${id}/prediction`)
}

// 6. 赛后回溯
export function getMatchRetrospective(id: number) {
  return get<RetrospectiveAnalysis>(`/api/matches/${id}/retrospective`)
}

// 7. StatsBomb指标
export function getStatsBombMetrics(id: number) {
  return get<StatsBombMetrics>(`/api/matches/${id}/statsbomb-metrics`)
}

// 8. 小组出线预测
export function getGroupPrediction(tournamentId: number) {
  return get<GroupPrediction>(`/api/tournaments/${tournamentId}/group-prediction`)
}

// 9. 晋级路径预测
export function getBracketPrediction(tournamentId: number) {
  return get<BracketPrediction>(`/api/tournaments/${tournamentId}/bracket-prediction`)
}

// 10. AI状态
export function getAIStatus() {
  return get<AIStatus>('/api/ai/status')
}

// 11. 回测汇总
export function getBacktestSummary(tournamentId: number) {
  return get<BacktestSummary>(`/api/tournaments/${tournamentId}/backtest-summary`)
}

// 12. 回测历史
export function getBacktestHistory(page?: number) {
  return get<{ results: BacktestResult[]; total: number }>(
    '/api/ai/backtest-history',
    page ? { page: String(page) } : undefined
  )
}

// 13. 手动数据采集
export async function triggerDataCollect() {
  const res = await fetch('/api/ai/collect', { method: 'POST' })
  return res.json() as Promise<{ status: string; action: string } | { error: string }>
}

// 14. 手动AI预测
export async function triggerAIPredict() {
  const res = await fetch('/api/ai/predict', { method: 'POST' })
  return res.json() as Promise<{ status: string; action: string } | { error: string }>
}

// 15. 球队实力评分排名
export function getTeamRatings() {
  return get('/api/ai/ratings')
}
