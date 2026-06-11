// ===== 基础类型 =====

export type TournamentStatus = 'UPCOMING' | 'ONGOING' | 'FINISHED'
export type MatchStage =
  | 'GROUP'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL'
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED'
export type RiskLevel = 'low' | 'medium' | 'high'

// ===== 赛事 =====

export interface Tournament {
  id: number
  name: string
  season: string
  year: number
  hostCountry: string
  status: TournamentStatus
  createdAt: string
}

// ===== 球队 =====

export interface Team {
  id: number
  name: string
  shortName: string
  countryCode: string
  fifaRanking: number | null
  groupName: string | null
  tournamentId: number
}

// ===== 比赛 =====

export interface Match {
  id: number
  tournamentId: number
  stage: MatchStage
  groupName: string | null
  homeTeamId: number
  awayTeamId: number
  homeScore: number | null
  awayScore: number | null
  handicap: number | null
  startTime: string
  status: MatchStatus
  homeTeam?: Team
  awayTeam?: Team
}

// ===== AI预测 =====

export interface SpfPrediction {
  home: number
  draw: number
  away: number
  recommendation: 'home' | 'draw' | 'away'
  confidence: number
}

export interface ScoreDistribution {
  score: string
  probability: number
}

export interface HandicapPrediction {
  home: number
  draw: number
  away: number
  handicap: number
  recommendation: 'home' | 'away'
  confidence: number
}

export interface GoalsPrediction {
  range0_1: number
  range2_3: number
  range4_plus: number
  recommendation: '0-1' | '2-3' | '4+'
  confidence: number
}

export interface AIPrediction {
  id: number
  matchId: number
  spf: SpfPrediction
  scoreDistribution: ScoreDistribution[]
  handicap: HandicapPrediction
  goals: GoalsPrediction
  riskLevel: RiskLevel
  analysisReport: string
  xgAnalysis: XgSummary | null
  oddsAnalysis: OddsSummary | null
  createdAt: string
}

export interface XgSummary {
  homeXg: number
  awayXg: number
  homePossession: number
  awayPossession: number
  homeShots: number
  awayShots: number
  analysis: string
}

export interface OddsSummary {
  homeWin: number
  draw: number
  awayWin: number
  source: string
  movement: 'stable' | 'home_drop' | 'away_drop' | 'draw_drop'
  analysis: string
}

// ===== 赛后回溯 =====

export interface PredictionVsActual {
  dimension: string
  prediction: string
  actual: string
  correct: boolean
}

export interface KeyEvent {
  minute: number
  type: 'goal' | 'red_card' | 'penalty' | 'substitution' | 'var' | 'injury'
  description: string
  team: string
}

export interface RetrospectiveAnalysis {
  id: number
  matchId: number
  predictionVsActual: PredictionVsActual[]
  xgReview: XgSummary
  keyEvents: KeyEvent[]
  summary: string
  createdAt: string
}

// ===== 小组出线 =====

export interface TeamAdvanceProb {
  teamId: number
  teamName: string
  shortName: string
  advanceProb: number
  groupRank: number
  points: number
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
}

export interface GroupPrediction {
  id: number
  tournamentId: number
  groupsData: {
    groupName: string
    standings: TeamAdvanceProb[]
  }[]
  createdAt: string
}

// ===== 晋级路径 =====

export interface BracketMatch {
  id: string
  round: 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'FINAL' | 'THIRD_PLACE'
  homeTeam: string | null
  awayTeam: string | null
  homeProb: number | null
  awayProb: number | null
  winner: string | null
}

export interface TeamKnockoutProb {
  teamId: number
  teamName: string
  shortName: string
  roundOf16: number
  quarterFinal: number
  semiFinal: number
  final: number
  champion: number
}

export interface BracketPrediction {
  id: number
  tournamentId: number
  bracketData: {
    rounds: Record<string, BracketMatch[]>
  }
  teamProbabilities: TeamKnockoutProb[]
  createdAt: string
}

// ===== 回测 =====

export interface BacktestResult {
  id: number
  predictionId: number
  matchId: number
  actualResult: string
  spfCorrect: boolean
  scoreCorrect: boolean
  handicapCorrect: boolean
  goalsCorrect: boolean
  accuracyScore: number
  createdAt: string
}

export interface BacktestSummary {
  tournamentId: number
  totalMatches: number
  spfAccuracy: number
  scoreAccuracy: number
  handicapAccuracy: number
  goalsAccuracy: number
  overallAccuracy: number
  trend: { date: string; accuracy: number }[]
}

// ===== StatsBomb =====

export interface StatsBombMetrics {
  id: number
  matchId: number
  homeXg: number
  awayXg: number
  homePossession: number
  awayPossession: number
  homePasses: number
  awayPasses: number
  homePassAccuracy: number
  awayPassAccuracy: number
  homeShots: number
  awayShots: number
  homeShotsOnTarget: number
  awayShotsOnTarget: number
  homeFouls: number
  awayFouls: number
  homeCorners: number
  awayCorners: number
}

// ===== AI状态 =====

export interface AIStatus {
  status: 'idle' | 'running' | 'error'
  lastRunAt: string | null
  nextRunAt: string | null
  dataSources: {
    statsbomb: { status: 'ok' | 'error'; lastSync: string | null }
    openligadb: { status: 'ok' | 'error'; lastSync: string | null }
  }
  latestBacktestAccuracy: number | null
}
