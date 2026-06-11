/**
 * StatsBomb Open Data 解析器
 * 数据源: https://github.com/statsbomb/open-data
 * 
 * 2018世界杯: competition_id=43, season_id=3
 * 2022世界杯: competition_id=43, season_id=106
 */

const RAW_BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data'

export interface StatsBombMatch {
  match_id: number
  match_date: string
  home_team: { home_team_name: string; home_team_gender: string; home_team_country: { name: string } }
  away_team: { away_team_name: string; away_team_gender: string; away_team_country: { name: string } }
  home_score: number
  away_score: number
  competition_stage: { name: string }
  stadium: { name: string; country: { name: string } }
  season: { season_name: string }
}

export interface TeamMetrics {
  teamName: string
  matchCount: number
  avgXg: number
  avgXgAgainst: number
  avgPasses: number
  avgPassAccuracy: number
  avgShots: number
  avgShotsOnTarget: number
  avgPossession: number
  avgFouls: number
  avgCorners: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
}

interface StatsBombEvent {
  type: { name: string }
  team: { name: string }
  shot?: {
    statsbomb_xg: number
    outcome: { name: string }
  }
  pass?: {
    outcome?: { name: string }
    length?: number
  }
  foul_committed?: { type: { name: string } }
  possession?: { duration: number }
  duration?: number
}

/** 获取赛事比赛列表 */
export async function fetchMatches(competitionId = 43, seasonId: number): Promise<StatsBombMatch[]> {
  const url = `${RAW_BASE}/matches/${competitionId}/${seasonId}.json`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`StatsBomb matches fetch failed: ${resp.status}`)
  return resp.json()
}

/** 获取单场比赛事件数据 */
export async function fetchEvents(matchId: number): Promise<StatsBombEvent[]> {
  const url = `${RAW_BASE}/events/${matchId}.json`
  const resp = await fetch(url)
  if (!resp.ok) {
    console.warn(`⚠ StatsBomb events not found for match ${matchId}`)
    return []
  }
  return resp.json()
}

/** 从事件数据中提取球队指标 */
export function extractTeamMetrics(events: StatsBombEvent[], teamName: string): {
  xg: number
  xgAgainst: number
  passes: number
  completedPasses: number
  shots: number
  shotsOnTarget: number
  fouls: number
  corners: number
} {
  let xg = 0, passes = 0, completedPasses = 0, shots = 0, shotsOnTarget = 0, fouls = 0, corners = 0

  for (const evt of events) {
    const isTeam = evt.team?.name === teamName

    // 射门 → xG
    if (evt.type?.name === 'Shot' && evt.shot) {
      if (isTeam) {
        shots++
        xg += evt.shot.statsbomb_xg || 0
        if (evt.shot.outcome?.name !== 'Off T' && evt.shot.outcome?.name !== 'Blocked') shotsOnTarget++
      }
    }

    // 传球
    if (evt.type?.name === 'Pass' && evt.pass) {
      if (isTeam) {
        passes++
        if (!evt.pass.outcome) completedPasses++
      }
    }

    // 犯规
    if (evt.type?.name === 'Foul Committed' && isTeam) fouls++

    // 角球 (通过球门球等反向推算也可)
    if (evt.type?.name === 'Half End') {
      // 暂不处理
    }
  }

  return { xg, xgAgainst: 0, passes, completedPasses, shots, shotsOnTarget, fouls, corners }
}

/** 汇总多场比赛的球队指标 */
export function aggregateMetrics(matchData: Array<{
  teamName: string
  isHome: boolean
  metrics: ReturnType<typeof extractTeamMetrics>
  goalsFor: number
  goalsAgainst: number
  possession: number
  won: boolean
  drawn: boolean
}>): TeamMetrics {
  const m = matchData
  if (!m.length) throw new Error('No match data')

  const sum = (fn: (d: typeof m[0]) => number) => m.reduce((s, d) => s + fn(d), 0)

  return {
    teamName: m[0].teamName,
    matchCount: m.length,
    avgXg: sum(d => d.metrics.xg) / m.length,
    avgXgAgainst: sum(d => d.metrics.xgAgainst) / m.length,
    avgPasses: sum(d => d.metrics.passes) / m.length,
    avgPassAccuracy: sum(d => d.metrics.passes > 0 ? d.metrics.completedPasses / d.metrics.passes : 0) / m.length,
    avgShots: sum(d => d.metrics.shots) / m.length,
    avgShotsOnTarget: sum(d => d.metrics.shotsOnTarget) / m.length,
    avgPossession: sum(d => d.possession) / m.length,
    avgFouls: sum(d => d.metrics.fouls) / m.length,
    avgCorners: sum(d => d.metrics.corners) / m.length,
    wins: m.filter(d => d.won).length,
    draws: m.filter(d => d.drawn).length,
    losses: m.filter(d => !d.won && !d.drawn).length,
    goalsFor: sum(d => d.goalsFor),
    goalsAgainst: sum(d => d.goalsAgainst),
  }
}

/** 解析球队列表（从比赛中提取） */
export function extractTeamsFromMatches(matches: StatsBombMatch[]): string[] {
  const teams = new Set<string>()
  for (const m of matches) {
    teams.add(m.home_team.home_team_name)
    teams.add(m.away_team.away_team_name)
  }
  return Array.from(teams)
}
