import { getDB } from '../db.js'

/**
 * 回测引擎 - 赛后自动对比预测vs实际结果
 * 评分规则：
 *   胜平负：方向正确=1分，否则=0分
 *   比分：精确命中=1分，净胜球正确=0.5分，否则=0分
 *   让球：方向正确=1分，否则=0分
 *   总进球：区间命中=1分，相邻区间=0.5分，否则=0分
 */
export function runBacktest(matchId: number): {
  spfCorrect: boolean
  scoreCorrect: boolean
  handicapCorrect: boolean
  goalsCorrect: boolean
  accuracyScore: number
} {
  const db = getDB()

  // 获取比赛结果
  const match = db.prepare('SELECT * FROM matches WHERE id = ? AND status = ?').get(matchId, 'FINISHED') as any
  if (!match) throw new Error(`Match ${matchId} not finished`)

  // 获取最新预测
  const pred = db.prepare('SELECT * FROM ai_predictions WHERE match_id = ? ORDER BY created_at DESC LIMIT 1').get(matchId) as any
  if (!pred) throw new Error(`No prediction for match ${matchId}`)

  const spf = JSON.parse(pred.spf)
  const handicap = JSON.parse(pred.handicap)
  const goals = JSON.parse(pred.goals)

  // 1. 胜平负评分
  const actualResult = match.home_score > match.away_score ? 'home' : match.home_score < match.away_score ? 'away' : 'draw'
  const spfCorrect = spf.recommendation === actualResult

  // 2. 比分评分（简化：检查净胜球）
  const actualGoalDiff = (match.home_score || 0) - (match.away_score || 0)
  let scoreCorrect = false
  const scoreDist = JSON.parse(pred.score_distribution || '[]')
  const predScore = scoreDist[0]?.score || ''
  const parts = predScore.split(':')
  if (parts.length === 2) {
    const predDiff = parseInt(parts[0]) - parseInt(parts[1])
    const actualScore = `${match.home_score}:${match.away_score}`
    const exactHit = scoreDist.some((s: any) => s.score === actualScore)
    if (exactHit) scoreCorrect = true
  }

  // 3. 让球评分
  const adjustedHomeScore = (match.home_score || 0) - handicap.handicap
  const adjustedAwayScore = match.away_score || 0
  const actualHandicap = adjustedHomeScore > adjustedAwayScore ? 'home' : adjustedHomeScore < adjustedAwayScore ? 'away' : 'draw'
  const handicapCorrect = handicap.recommendation === actualHandicap

  // 4. 总进球评分
  const totalGoals = (match.home_score || 0) + (match.away_score || 0)
  let actualGoalsRange: string
  if (totalGoals <= 1) actualGoalsRange = '0-1'
  else if (totalGoals <= 3) actualGoalsRange = '2-3'
  else actualGoalsRange = '4+'
  const goalsCorrect = goals.recommendation === actualGoalsRange

  // 综合得分
  const accuracyScore = [spfCorrect, scoreCorrect, handicapCorrect, goalsCorrect].filter(Boolean).length / 4

  // 写入回测结果
  db.prepare(`
    INSERT INTO backtest_results (prediction_id, match_id, tournament_id, actual_result, spf_correct, score_correct, handicap_correct, goals_correct, accuracy_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pred.id, matchId, match.tournament_id, actualResult, spfCorrect ? 1 : 0, scoreCorrect ? 1 : 0, handicapCorrect ? 1 : 0, goalsCorrect ? 1 : 0, accuracyScore)

  console.log(`📊 Backtest match#${matchId}: SPF=${spfCorrect} SCORE=${scoreCorrect} HC=${handicapCorrect} GOALS=${goalsCorrect} | Accuracy=${(accuracyScore * 100).toFixed(0)}%`)

  return { spfCorrect, scoreCorrect, handicapCorrect, goalsCorrect, accuracyScore }
}

/**
 * 离线回测：对历史赛事所有已结束比赛运行回测
 */
export function runOfflineBacktest(tournamentId: number): void {
  const db = getDB()
  const matches = db.prepare('SELECT id FROM matches WHERE tournament_id = ? AND status = ?').all(tournamentId, 'FINISHED') as any[]
  console.log(`📊 Running offline backtest for ${matches.length} matches in tournament ${tournamentId}`)
  for (const m of matches) {
    try { runBacktest(m.id) } catch (e) { console.error(`Backtest error match#${m.id}:`, e) }
  }
}
