/**
 * 高级预测模型 v4.0
 * ① 泊松回归比分预测 ② 攻防分解 ③ 集成学习
 */

import { getDB } from '../db.js'

// ===== ① 泊松回归 =====

interface PoissonResult {
  homeLambda: number
  awayLambda: number
  scoreDistribution: { score: string; probability: number }[]
  mostLikely: string
  expectedGoals: number
}

/** 泊松概率: P(X=k) = λ^k * e^(-λ) / k! */
function poissonProb(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k)
}

const factCache = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800]
function factorial(n: number): number {
  if (n < factCache.length) return factCache[n]
  let r = factCache[factCache.length - 1]
  for (let i = factCache.length; i <= n; i++) r *= i
  return r
}

/**
 * 泊松比分预测
 * 基于进攻/防守评分 + 主客场优势 → 两队λ → 比分分布
 */
export function poissonScorePrediction(
  homeTeam: string, awayTeam: string,
  homeAttackRating: number, homeDefenseRating: number,
  awayAttackRating: number, awayDefenseRating: number,
  venueFactor: number = 1.05,
): PoissonResult {
  // λ_home = exp(主场优势 × 主队进攻 / 客队防守)
  const baseHome = Math.log(1.2) // 平均进球基数
  const baseAway = Math.log(1.05)

  const homeLambda = Math.exp(baseHome + venueFactor * (homeAttackRating / Math.max(awayDefenseRating, 0.1)))
  const awayLambda = Math.exp(baseAway + 1.0 * (awayAttackRating / Math.max(homeDefenseRating, 0.1)))

  // 比分分布 (0:0 到 5:5)
  const scores: { score: string; probability: number }[] = []
  for (let i = 0; i <= 5; i++) {
    for (let j = 0; j <= 5; j++) {
      const prob = poissonProb(homeLambda, i) * poissonProb(awayLambda, j)
      if (prob > 0.005) scores.push({ score: `${i}:${j}`, probability: +prob.toFixed(4) })
    }
  }
  scores.sort((a, b) => b.probability - a.probability)

  return {
    homeLambda: +homeLambda.toFixed(2),
    awayLambda: +awayLambda.toFixed(2),
    scoreDistribution: scores.slice(0, 15),
    mostLikely: scores[0]?.score || '1:0',
    expectedGoals: +(homeLambda + awayLambda).toFixed(2),
  }
}

// ===== ② 攻防分解 =====

export interface AttackDefenseRating {
  attack: number   // 进攻能力 0.5-2.5
  defense: number  // 防守能力 0.5-2.5
  overall: number  // 综合 Elo
}

/**
 * 从历史比赛数据计算攻防评分
 * 方法: 基于场均进球/失球 vs 对手平均
 */
export function computeAttackDefense(
  team: string,
  matches: Array<{ home_team: string; away_team: string; home_score: number; away_score: number; time_weight: number }>,
  globalAvgGoals: number,
): AttackDefenseRating {
  let goalsFor = 0, goalsAgainst = 0, count = 0
  let weightedGF = 0, weightedGA = 0

  for (const m of matches) {
    const isHome = m.home_team === team
    const gf = isHome ? m.home_score : m.away_score
    const ga = isHome ? m.away_score : m.home_score
    const w = m.time_weight

    goalsFor += gf; goalsAgainst += ga
    weightedGF += gf * w; weightedGA += ga * w
    count++
  }

  if (count === 0) return { attack: 1.0, defense: 1.0, overall: 1500 }

  const avgGF = weightedGF / count
  const avgGA = weightedGA / count

  // 攻击力 = 场均进球 / 全局场均进球
  const attack = Math.max(0.3, Math.min(2.5, avgGF / Math.max(globalAvgGoals, 0.1)))
  const defense = Math.max(0.3, Math.min(2.5, globalAvgGoals / Math.max(avgGA, 0.1)))

  return { attack: +attack.toFixed(2), defense: +defense.toFixed(2), overall: Math.round(1500 + (attack - defense) * 200) }
}

// ===== ③ 集成学习 =====

export interface EnsembleResult {
  home: number; draw: number; away: number
  models: {
    poisson: { home: number; draw: number; away: number; weight: number }
    elo: { home: number; draw: number; away: number; weight: number }
    odds: { home: number; draw: number; away: number; weight: number }
  }
  agreement: 'strong' | 'moderate' | 'divided'  // 三模型一致性
  confidence: number
}

/**
 * 三模型集成投票
 */
export function ensemblePredict(
  poissonScore: string,      // 泊松最可能比分
  eloHomeProb: number,       // Elo模型主胜概率
  eloDrawProb: number,
  eloAwayProb: number,
  oddsHomeProb: number | null,
  oddsDrawProb: number | null,
  oddsAwayProb: number | null,
): EnsembleResult {
  // 泊松 → 胜负平
  const [phs, pas] = poissonScore.split(':').map(Number)
  let poissonHome = 0.40, poissonDraw = 0.28, poissonAway = 0.32
  if (phs > pas) { poissonHome = 0.45; poissonDraw = 0.25; poissonAway = 0.30 }
  else if (phs < pas) { poissonHome = 0.30; poissonDraw = 0.25; poissonAway = 0.45 }
  else { poissonHome = 0.30; poissonDraw = 0.40; poissonAway = 0.30 }

  // 赔率 → 概率（如果有）
  const oddsHome = oddsHomeProb || poissonHome
  const oddsDraw = oddsDrawProb || poissonDraw
  const oddsAway = oddsAwayProb || poissonAway

  // 动态权重（基于赔率可用性）
  const hasOdds = oddsHomeProb !== null
  const poissonWeight = 0.25
  const eloWeight = 0.30
  const oddsWeight = hasOdds ? 0.45 : 0.35

  // 三模型加权
  const home = poissonHome * poissonWeight + eloHomeProb * eloWeight + oddsHome * oddsWeight
  const draw = poissonDraw * poissonWeight + eloDrawProb * eloWeight + oddsDraw * oddsWeight
  const away = poissonAway * poissonWeight + eloAwayProb * eloWeight + oddsAway * oddsWeight

  const total = home + draw + away

  // 一致性检测
  const maxModel = Math.max(poissonHome, eloHomeProb, oddsHome)
  const predictions = [
    poissonHome > 0.35 ? 'home' : poissonAway > 0.35 ? 'away' : 'draw',
    eloHomeProb > 0.35 ? 'home' : eloAwayProb > 0.35 ? 'away' : 'draw',
    oddsHome > 0.35 ? 'home' : oddsAway > 0.35 ? 'away' : 'draw',
  ]
  const unique = new Set(predictions).size
  const agreement = unique === 1 ? 'strong' : unique === 2 ? 'moderate' : 'divided'

  return {
    home: +(home / total).toFixed(3),
    draw: +(draw / total).toFixed(3),
    away: +(away / total).toFixed(3),
    models: {
      poisson: { home: +poissonHome.toFixed(3), draw: +poissonDraw.toFixed(3), away: +poissonAway.toFixed(3), weight: poissonWeight },
      elo: { home: +eloHomeProb.toFixed(3), draw: +eloDrawProb.toFixed(3), away: +eloAwayProb.toFixed(3), weight: eloWeight },
      odds: { home: +oddsHome.toFixed(3), draw: +oddsDraw.toFixed(3), away: +oddsAway.toFixed(3), weight: oddsWeight },
    },
    agreement,
    confidence: +(Math.max(home, draw, away) / total).toFixed(2),
  }
}

/** 获取全部球队攻防评分 */
export function getAllAttackDefense(): Map<string, AttackDefenseRating> {
  const db = getDB()
  const matches = db.prepare('SELECT * FROM training_matches').all() as any[]
  const allTeams = new Set<string>()
  const teamMatches = new Map<string, any[]>()

  for (const m of matches) {
    allTeams.add(m.home_team); allTeams.add(m.away_team)
    if (!teamMatches.has(m.home_team)) teamMatches.set(m.home_team, [])
    if (!teamMatches.has(m.away_team)) teamMatches.set(m.away_team, [])
    teamMatches.get(m.home_team)!.push(m)
    teamMatches.get(m.away_team)!.push(m)
  }

  // 全局场均进球
  let totalGoals = 0, totalMatches = 0
  for (const m of matches) { totalGoals += m.home_score + m.away_score; totalMatches++ }
  const globalAvg = totalMatches > 0 ? totalGoals / (totalMatches * 2) : 1.3

  const result = new Map<string, AttackDefenseRating>()
  for (const team of allTeams) {
    result.set(team, computeAttackDefense(team, teamMatches.get(team) || [], globalAvg))
  }
  return result
}
