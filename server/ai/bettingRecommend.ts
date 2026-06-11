/**
 * 胆大心细 · 博彩推荐引擎
 * 基于7因子模型 + 爆冷指数 + 专业盘口，生成不保守的推荐
 */

import type { UpsetAlert } from './multiFactorModel.js'

interface BettingPick {
  // 比分推荐
  scorePicks: { score: string; reason: string; confidence: 'high' | 'medium' | 'bold' }[]
  // 进球数推荐
  goalPicks: { goals: number; reason: string; confidence: 'high' | 'medium' | 'bold' }[]
  // 推荐摘要
  summary: string
}

/**
 * 胆大心细推荐算法
 * @param homeFavored 是否主队是热门
 * @param strengthGap 实力差距 (排名差，正=主队强)
 * @param expectedGoals 预期总进球（从大小球盘口推算）
 * @param upset 爆冷指数
 * @param oddsSignal 操盘信号分
 */
export function generateBettingPicks(
  homeTeam: string,
  awayTeam: string,
  homeFavored: boolean,
  strengthGap: number,    // 排名差（正=主队排名更高）
  expectedGoals: number,  // 大小球线
  upset: UpsetAlert,
  oddsSignal: number,     // 专业盘口信号分
  homeOdds: number,       // 主胜赔率
  drawOdds: number,
  awayOdds: number,
): BettingPick {
  const fav = homeFavored ? homeTeam : awayTeam
  const dog = homeFavored ? awayTeam : homeTeam
  const gap = Math.abs(strengthGap)
  
  // 判定比赛类型
  const isBlowout = gap > 30 && upset.score < 20 && oddsSignal > 3
  const isClose = gap < 15 || upset.score > 40
  const isUpsetRisk = upset.score >= 30
  
  const picks: BettingPick = { scorePicks: [], goalPicks: [], summary: '' }

  // ========== 比分推荐 - 胆大心细 ==========
  
  if (isBlowout) {
    // 碾压局：敢推大比分
    picks.scorePicks = [
      { score: homeFavored ? '2:0' : '0:2', reason: '实力碾压，零封可期', confidence: 'high' },
      { score: homeFavored ? '3:0' : '0:3', reason: '盘口深度支持，大胜在望', confidence: 'medium' },
    ]
    if (expectedGoals >= 3) {
      picks.scorePicks.push({ score: homeFavored ? '4:1' : '1:4', reason: '🃏 胆大之选：火力全开', confidence: 'bold' })
    }
  } else if (isClose && isUpsetRisk) {
    // 爆冷局：敢推冷门比分
    if (homeFavored) {
      picks.scorePicks = [
        { score: '1:1', reason: '僵局可能性大，平局首选', confidence: 'high' },
        { score: '1:2', reason: '⚡ 爆冷信号强烈，客胜有价值', confidence: 'medium' },
        { score: '0:1', reason: '🃏 胆大之选：客队偷鸡', confidence: 'bold' },
        { score: '0:2', reason: '🃏 极端爆冷：客队完胜', confidence: 'bold' },
      ]
    } else {
      picks.scorePicks = [
        { score: '1:1', reason: '实力接近，平局最优', confidence: 'high' },
        { score: '2:1', reason: '⚡ 主队爆冷反杀', confidence: 'medium' },
        { score: '1:0', reason: '🃏 胆大之选：主队小胜', confidence: 'bold' },
        { score: '2:0', reason: '🃏 极端剧本：主队掌控', confidence: 'bold' },
      ]
    }
  } else {
    // 标准局：偏热门但不保守
    const favScore = homeFavored ? 
      (expectedGoals >= 3 ? ['2:1', '3:1', '3:0', '2:0'] : ['1:0', '2:1', '2:0', '1:1']) :
      (expectedGoals >= 3 ? ['1:2', '1:3', '0:3', '0:2'] : ['0:1', '1:2', '0:2', '1:1'])
    
    picks.scorePicks = [
      { score: favScore[0], reason: '最可能比分', confidence: 'high' },
      { score: favScore[1], reason: '攻防均衡之选', confidence: 'medium' },
    ]
    if (upset.score > 0) {
      // 加一个保守平局做对冲
      picks.scorePicks.push({ score: favScore[3], reason: '稳妥对冲', confidence: 'medium' })
      picks.scorePicks.push({ score: fav === homeTeam ? '1:2' : '2:1', reason: '🃏 胆大之选：冷门方向', confidence: 'bold' })
    } else {
      picks.scorePicks.push({ score: favScore[2], reason: '🃏 胆大之选：热门碾压', confidence: 'bold' })
      picks.scorePicks.push({ score: favScore[3], reason: '稳妥备选', confidence: 'medium' })
    }
  }

  // ========== 进球数推荐 ==========
  
  const goalLine = expectedGoals
  const goals = Math.round(goalLine)
  
  // 概率分布：围绕盘口线展开
  if (isBlowout) {
    picks.goalPicks = [
      { goals: goals + 1, reason: '大球倾向，碾压局进球不会少', confidence: 'high' },
      { goals: goals, reason: '基准线', confidence: 'medium' },
      { goals: goals + 2, reason: '🃏 胆大之选：屠杀局', confidence: 'bold' },
    ]
  } else if (isUpsetRisk && upset.level !== 'low') {
    // 爆冷局可能有小球
    picks.goalPicks = [
      { goals: Math.max(1, goals - 1), reason: '爆冷预警，可能小球', confidence: 'high' },
      { goals: goals, reason: '盘口基准', confidence: 'medium' },
      { goals: Math.min(7, goals + 1), reason: '🃏 胆大之选：对攻爆冷', confidence: 'bold' },
    ]
  } else {
    picks.goalPicks = [
      { goals: goals, reason: '盘口基准线', confidence: 'high' },
      { goals: goals - 1, reason: '保守线', confidence: 'medium' },
      { goals: goals + 1, reason: '🃏 胆大之选', confidence: 'bold' },
    ]
    if (goals >= 3) {
      picks.goalPicks.push({ goals: goals + 2, reason: '🃏 搏冷大球', confidence: 'bold' })
    }
  }

  // ========== 推荐摘要 ==========
  const topScore = picks.scorePicks[0]
  const topGoals = picks.goalPicks[0]
  
  if (isUpsetRisk) {
    picks.summary = `⚡ 爆冷预警 ${upset.score}/100 · ${upset.level === 'high' || upset.level === 'extreme' ? '重点防范' : '保持警惕'}。首选${topScore.score}(${topGoals.goals}球)，重点关注${picks.scorePicks.find(p => p.confidence === 'bold')?.score || topScore.score}`
  } else if (isBlowout) {
    picks.summary = `🔥 碾压局 · 比分推荐${topScore.score}(高信心)，${picks.scorePicks.find(p => p.confidence === 'bold')?.score || topScore.score}(胆大)，预期${topGoals.goals}球起步`
  } else {
    picks.summary = `标准对决 · ${fav}实力占优但优势有限，首选${topScore.score}(高信心)，搏冷可选${picks.scorePicks.find(p => p.confidence === 'bold')?.score || topScore.score}`
  }

  return picks
}
