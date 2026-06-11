import axios from 'axios'

const BASE = 'https://api.openligadb.de'

interface OLTeam { teamId: number; teamName: string; shortName: string; teamIconUrl: string; teamGroupName: string | null }
interface OLGroup { groupName: string; groupOrderID: number; groupID: number }
interface OLMatchResult { resultID: number; resultName: string; pointsTeam1: number; pointsTeam2: number }
interface OLGoal { goalID: number; scoreTeam1: number; scoreTeam2: number; matchMinute: number; goalGetterName: string; isPenalty: boolean; isOwnGoal: boolean; comment: string }

interface OLMatch {
  matchID: number
  matchDateTime: string
  matchDateTimeUTC: string
  matchIsFinished: boolean
  team1: OLTeam
  team2: OLTeam
  group: OLGroup
  matchResults: OLMatchResult[]
  goals: OLGoal[]
  location?: { locationStadium: string; locationCity: string }
}

/** 获取所有可用的联赛 */
export async function getAvailableLeagues(): Promise<any[]> {
  const { data } = await axios.get(`${BASE}/getavailableleagues`)
  return data
}

/** 获取联赛全部比赛 */
export async function getMatches(league: string, season: number | string): Promise<OLMatch[]> {
  const { data } = await axios.get(`${BASE}/getmatchdata/${league}/${season}`)
  return data
}

/** 获取联赛全部球队 */
export async function getTeams(league: string, season: number | string): Promise<OLTeam[]> {
  const { data } = await axios.get(`${BASE}/getavailableteams/${league}/${season}`)
  return data
}

/** 解析比赛阶段 */
export function parseStage(groupName: string): string {
  const g = groupName.toLowerCase()
  if (g.includes('vorrunde') || g.includes('gruppe')) return 'GROUP'
  if (g.includes('achtelfinale') || g.includes('round of 16')) return 'ROUND_OF_16'
  if (g.includes('viertelfinale') || g.includes('quarter')) return 'QUARTER_FINAL'
  if (g.includes('halbfinale') || g.includes('semi')) return 'SEMI_FINAL'
  if (g.includes('platz 3') || g.includes('third')) return 'THIRD_PLACE'
  if (g.includes('finale')) return 'FINAL'
  return 'GROUP'
}

/** 从 groupName 提取小组名 "A"-"H"，仅小组赛有效 */
export function parseGroupName(groupName: string): string | null {
  const g = groupName.toLowerCase()
  if (!g.includes('vorrunde') && !g.includes('gruppe')) return null
  // OpenLigaDB 2022: "Vorrunde Spieltag 1" — teamGroupName 才有小组字母
  return null
}
