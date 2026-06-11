/**
 * 动态球队实力评分引擎
 * 
 * 核心思路：
 *   1. 初始评分基于 FIFA 排名 + 赔率隐含概率
 *   2. 赛前用评分差计算胜率（Logistic）
 *   3. 赛后用 Elo 公式更新评分
 *   4. 追踪近 3 场表现作为"近期状态"因子
 *   5. 新预测 = 评分差(35%) + 赔率(35%) + 近期状态(20%) + 历史交锋(10%)
 */

import { getDB } from '../db.js'

interface TeamRating {
  teamId: number
  rating: number
  formScore: number     // 近3场状态 [-1, 1]
  matchesPlayed: number
  goalsFor: number
  goalsAgainst: number
  lastResults: number[] // [1, 0.5, 0] 最近3场
}

const K_GROUP = 32
const K_KNOCKOUT = 48
const INITIAL_RATING = 1500

/** 初始化球队评分（基于 FIFA 排名） */
export function initRatings(): void {
  const db = getDB()
  const teams = db.prepare('SELECT * FROM teams WHERE tournament_id = 1').all() as any[]
  
  const existing = db.prepare("SELECT COUNT(*) as c FROM team_ratings WHERE team_id IN (SELECT id FROM teams WHERE tournament_id = 1)").get() as any
  if (existing.c > 0) return // 已初始化

  const insert = db.prepare('INSERT INTO team_ratings (team_id, rating, form_score, matches_played, goals_for, goals_against, last_results) VALUES (?, ?, ?, ?, ?, ?, ?)')
  for (const t of teams) {
    const rank = t.fifa_ranking || 50
    const rating = INITIAL_RATING + (50 - rank) * 8 // rank1=1892, rank50=1500
    insert.run(t.id, Math.round(rating), 0, 0, 0, 0, JSON.stringify([]))
  }
  console.log(`✅ 初始化 ${teams.length} 支球队评分`)
}

/** 获取球队评分 */
export function getTeamRating(teamId: number): TeamRating {
  const db = getDB()
  const row = db.prepare('SELECT * FROM team_ratings WHERE team_id = ?').get(teamId) as any
  if (!row) {
    return { teamId, rating: INITIAL_RATING, formScore: 0, matchesPlayed: 0, goalsFor: 0, goalsAgainst: 0, lastResults: [] }
  }
  return {
    teamId: row.team_id,
    rating: row.rating,
    formScore: row.form_score,
    matchesPlayed: row.matches_played,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    lastResults: JSON.parse(row.last_results || '[]'),
  }
}

/** 计算预期胜率 (Logistic) */
export function expectedWinRate(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

/** 赛后更新两支球队的评分 */
export function updateRatingsAfterMatch(teamAId: number, teamBId: number, scoreA: number, scoreB: number, stage: string): void {
  const db = getDB()
  const a = getTeamRating(teamAId)
  const b = getTeamRating(teamBId)

  // 实际得分
  let actualA: number, actualB: number
  if (scoreA > scoreB) { actualA = 1; actualB = 0 }
  else if (scoreA < scoreB) { actualA = 0; actualB = 1 }
  else { actualA = 0.5; actualB = 0.5 }

  // 预期得分
  const expectedA = expectedWinRate(a.rating, b.rating)
  const expectedB = 1 - expectedA

  // 净胜球加成 (最多2倍)
  const gd = Math.abs(scoreA - scoreB)
  const goalMult = Math.min(1 + gd * 0.2, 2.0)

  // K 因子
  const K = stage === 'GROUP' ? K_GROUP : K_KNOCKOUT

  // 新评分
  const newRatingA = Math.round(a.rating + K * goalMult * (actualA - expectedA))
  const newRatingB = Math.round(b.rating + K * goalMult * (actualB - expectedB))

  // 近期状态更新
  const newResultsA = [...a.lastResults, actualA].slice(-3)
  const newResultsB = [...b.lastResults, actualB].slice(-3)
  const formA = computeForm(newResultsA)
  const formB = computeForm(newResultsB)

  // 写入
  const update = db.prepare('UPDATE team_ratings SET rating=?, form_score=?, matches_played=?, goals_for=?, goals_against=?, last_results=? WHERE team_id=?')
  update.run(newRatingA, +formA.toFixed(3), a.matchesPlayed + 1, a.goalsFor + scoreA, a.goalsAgainst + scoreB, JSON.stringify(newResultsA), teamAId)
  update.run(newRatingB, +formB.toFixed(3), b.matchesPlayed + 1, b.goalsFor + scoreB, b.goalsAgainst + scoreA, JSON.stringify(newResultsB), teamBId)

  console.log(`  📊 评分更新: 队${teamAId} ${a.rating}→${newRatingA}(${actualA > expectedA ? '+' : ''}${(actualA - expectedA > 0 ? '+' : '') + (actualA - expectedA).toFixed(3)}) | 队${teamBId} ${b.rating}→${newRatingB}`)
}

/** 计算近期状态 [-1, 1] */
function computeForm(results: number[]): number {
  if (!results.length) return 0
  let score = 0, weight = 0
  for (let i = 0; i < results.length; i++) {
    const w = i + 1 // 越近权重越高
    score += (results[i] === 1 ? 1 : results[i] === 0.5 ? 0 : -1) * w
    weight += w
  }
  return weight > 0 ? score / weight : 0
}

/** 综合预测：评分差(35%) + 赔率(35%) + 近期状态(20%) + 历史交锋(10%) */
export function compositePrediction(teamAId: number, teamBId: number, oddsProb: { home: number; draw: number; away: number } | null): {
  home: number; draw: number; away: number; factors: any
} {
  const a = getTeamRating(teamAId)
  const b = getTeamRating(teamBId)

  // 1. 评分差 → 主胜概率 (40%)
  const ratingHome = expectedWinRate(a.rating, b.rating)
  const ratingAway = 1 - ratingHome

  // 2. 赔率隐含概率 (35%)
  const oddsHome = oddsProb?.home || 0.35
  const oddsDraw = oddsProb?.draw || 0.28
  const oddsAway = oddsProb?.away || 0.37

  // 3. 近期状态 (15%)
  const formDiff = a.formScore - b.formScore
  const formHome = 0.5 + formDiff * 0.15 // 0.35~0.65
  const formAway = 1 - formHome

  // 4. 历史交锋 (10%) — 暂时用评分差替代
  const histHome = ratingHome
  const histAway = ratingAway

  // 综合加权
  let home = ratingHome * 0.40 + oddsHome * 0.35 + formHome * 0.15 + histHome * 0.10
  let away = ratingAway * 0.40 + oddsAway * 0.35 + formAway * 0.15 + histAway * 0.10
  let draw = oddsDraw * 0.35 + 0.25 * 0.30 // 平局主要来自赔率

  // 归一化
  const total = home + draw + away
  home = +(home / total).toFixed(3)
  draw = +(draw / total).toFixed(3)
  away = +(away / total).toFixed(3)

  return {
    home, draw, away,
    factors: {
      rating: { home: +ratingHome.toFixed(3), away: +ratingAway.toFixed(3) },
      form: { home: +formHome.toFixed(3), away: +formAway.toFixed(3) },
      teamARating: a.rating, teamBRating: b.rating,
      teamAForm: a.formScore, teamBForm: b.formScore,
      teamAMatches: a.matchesPlayed, teamBMatches: b.matchesPlayed,
    },
  }
}

/** 获取全部球队评分排名（用于展示） */
export function getAllRatings() {
  const db = getDB()
  const rows = db.prepare(`
    SELECT tr.*, t.name, t.short_name, t.group_name
    FROM team_ratings tr JOIN teams t ON tr.team_id = t.id
    WHERE t.tournament_id = 1
    ORDER BY tr.rating DESC
  `).all() as any[]
  return rows.map(r => ({
    teamId: r.team_id, name: r.name, shortName: r.short_name,
    group: r.group_name, rating: r.rating, formScore: r.form_score,
    matchesPlayed: r.matches_played, goalsFor: r.goals_for, goalsAgainst: r.goals_against,
  }))
}
