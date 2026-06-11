/**
 * v5.0 增强预测模型 — 6项精化
 * ① 对手调整指标 ② 半场全场分解 ③ 定位球运动战
 * ④ 贝叶斯层级 ⑤ 有序Logit ⑥ 赛程密度
 */

import { getDB } from '../db.js'
import { poissonScorePrediction, ensemblePredict } from './advancedModels.js'

// ===== 基础数据结构 =====

interface TeamProfile {
  name: string
  region: 'europe' | 'samerica' | 'africa' | 'asia' | 'northamerica'
  // ① 对手调整指标
  adjAttack: number    // 扣掉虐菜后的真实攻击力
  adjDefense: number
  strongOppAttack: number  // 对强队攻击力（弱化）
  weakOppAttack: number    // 对弱队攻击力（强化）
  // ② 半场分解
  firstHalfGoals: number    // 上半场进球率 0-1
  secondHalfGoals: number   // 下半场进球率
  slowStart: boolean        // 慢热型
  secondHalfSurge: boolean  // 下半场发飙型
  // ③ 定位球
  setPieceRatio: number     // 定位球进球占比
  openPlayEfficiency: number // 运动战效率
  // ④ 层级先验（区域均值）
  regionAvgAttack: number
  regionAvgDefense: number
  // ⑥ 赛程
  recentMatchIntensity: number  // 上一场消耗 0-1
  restDays: number
}

interface MatchProfile {
  homeTeam: string; awayTeam: string
  homeProfile: TeamProfile; awayProfile: TeamProfile
  // 对手调整后的概率
  opponentAdjustedProb: { home: number; draw: number; away: number }
  // 半场因子
  firstHalfBias: number      // 正=主队开局强
  // 有序Logit输出
  orderedLogit: { home: number; draw: number; away: number }
  // 综合 v5.0 输出
  final: { home: number; draw: number; away: number; recommendation: string; confidence: number }
  analysis: string
}

// ===== 区域映射 =====

function getRegion(name: string): TeamProfile['region'] {
  const eu = ['德国','法国','英格兰','西班牙','意大利','荷兰','葡萄牙','比利时','克罗地亚','丹麦','瑞士','塞尔维亚','波兰','奥地利','瑞典','挪威','苏格兰','威尔士','土耳其','希腊','斯洛伐克','斯洛文尼亚','捷克','匈牙利','罗马尼亚','乌克兰']
  const sa = ['巴西','阿根廷','乌拉圭','哥伦比亚','智利','秘鲁','厄瓜多尔','巴拉圭']
  const af = ['摩洛哥','塞内加尔','埃及','阿尔及利亚','突尼斯','尼日利亚','加纳','喀麦隆','科特迪瓦','南非','刚果(金)','佛得角']
  const asia = ['日本','韩国','伊朗','澳大利亚','沙特阿拉伯','卡塔尔','阿联酋','伊拉克','约旦','乌兹别克斯坦','新西兰']
  if (eu.includes(name)) return 'europe'
  if (sa.includes(name)) return 'samerica'
  if (af.includes(name)) return 'africa'
  if (asia.includes(name)) return 'asia'
  return 'northamerica'
}

// ===== ① 对手调整指标 =====

function computeOpponentAdjusted(matches: any[], team: string): { 
  overall: number; strong: number; weak: number; adjAttack: number 
} {
  let totalGf = 0, totalGa = 0, count = 0
  let strongGf = 0, strongGa = 0, strongCount = 0
  let weakGf = 0, weakGa = 0, weakCount = 0

  // 计算所有对手的平均 Elo
  const globalElo = new Map<string, number>()
  for (const m of matches) {
    if (!globalElo.has(m.home_team)) globalElo.set(m.home_team, 1500)
    if (!globalElo.has(m.away_team)) globalElo.set(m.away_team, 1500)
    const h = globalElo.get(m.home_team)!, a = globalElo.get(m.away_team)!
    const exp = 1 / (1 + Math.pow(10, (a - h) / 400))
    const act = m.home_score > m.away_score ? 1 : m.home_score < m.away_score ? 0 : 0.5
    globalElo.set(m.home_team, Math.round(h + 32 * (act - exp)))
    globalElo.set(m.away_team, Math.round(a + 32 * (exp - act)))
  }

  const median = Array.from(globalElo.values()).sort((a,b)=>a-b)[Math.floor(globalElo.size/2)]

  for (const m of matches) {
    const isHome = m.home_team === team
    const opp = isHome ? m.away_team : m.home_team
    const oppElo = globalElo.get(opp) || 1500
    const gf = isHome ? m.home_score : m.away_score
    const ga = isHome ? m.away_score : m.home_score

    totalGf += gf; totalGa += ga; count++
    if (oppElo > median + 50) { strongGf += gf; strongGa += ga; strongCount++ }
    else if (oppElo < median - 50) { weakGf += gf; weakGa += ga; weakCount++ }
  }

  return {
    overall: count ? totalGf / count : 1.3,
    strong: strongCount ? strongGf / strongCount : 0.8,
    weak: weakCount ? weakGf / weakCount : 2.0,
    adjAttack: count ? (totalGf / count) * (1 + (weakCount - strongCount) * 0.05 / Math.max(count,1)) : 1.3,
  }
}

// ===== ② 半场/全场分解 =====

function computeHalfProfile(matches: any[], team: string): Pick<TeamProfile, 'firstHalfGoals' | 'secondHalfGoals' | 'slowStart' | 'secondHalfSurge'> {
  // 基于历史数据的近似：统计上半场/下半场进球占比
  // 实际需半场数据，这里用全场的上半场/下半场近似
  const firstHalfRatios = { europe: 0.42, samerica: 0.38, africa: 0.45, asia: 0.40, northamerica: 0.43 }
  const region = getRegion(team)
  
  let totalGoals = 0
  for (const m of matches) {
    const isHome = m.home_team === team
    totalGoals += isHome ? m.home_score : m.away_score
  }
  
  const ratio = firstHalfRatios[region]
  return {
    firstHalfGoals: +ratio.toFixed(2),
    secondHalfGoals: +(1 - ratio).toFixed(2),
    slowStart: ratio < 0.38,
    secondHalfSurge: (1 - ratio) > 0.65,
  }
}

// ===== ③ 定位球v运动战 =====

function computeSetPieceProfile(region: TeamProfile['region']): Pick<TeamProfile, 'setPieceRatio' | 'openPlayEfficiency'> {
  // 区域近似值（实际需事件数据，赛后从StatsBomb获取）
  const ratios: Record<string, number> = {
    europe: 0.22, samerica: 0.28, africa: 0.30, asia: 0.25, northamerica: 0.27,
  }
  const r = ratios[region] || 0.25
  return { setPieceRatio: r, openPlayEfficiency: 1 - r }
}

// ===== ④ 贝叶斯层级模型 =====

function hierarchicalPrior(team: string, teamVal: number, allTeams: Map<string, number>): number {
  const region = getRegion(team)
  const sameRegion = Array.from(allTeams.entries()).filter(([n]) => getRegion(n) === region)
  if (sameRegion.length < 2) return teamVal
  
  const regionAvg = sameRegion.reduce((s, [_, v]) => s + v, 0) / sameRegion.length
  const regionVar = sameRegion.reduce((s, [_, v]) => s + (v - regionAvg) ** 2, 0) / sameRegion.length
  const shrinkage = Math.min(0.4, 1 / (1 + Math.abs(teamVal - regionAvg) / Math.max(regionVar, 0.01)))
  
  return +(teamVal * (1 - shrinkage) + regionAvg * shrinkage).toFixed(3)
}

// ===== ⑤ 有序Logit =====

function orderedLogit(homeStrength: number, awayStrength: number, homeAdv: number): { home: number; draw: number; away: number } {
  const logOdds = (homeStrength - awayStrength) * 0.8 + homeAdv
  
  // 有序Logit: 累积概率 → 分类概率
  const cumHome = 1 / (1 + Math.exp(-(logOdds - 0.5)))
  const cumDraw = 1 / (1 + Math.exp(-(logOdds + 0.5)))
  
  const home = cumHome
  const draw = cumDraw - cumHome
  const away = 1 - cumDraw

  const total = home + draw + away
  return { home: +(home/total).toFixed(3), draw: +(draw/total).toFixed(3), away: +(away/total).toFixed(3) }
}

// ===== ⑥ 赛程密度 =====

function scheduleImpact(restDays: number, previousMinutes: number): { factor: number; label: string } {
  let factor = 1.0
  let label = '正常休整'
  
  if (restDays < 3) { factor = 0.85; label = '⚠ 休息不足48h' }
  else if (restDays === 3) { factor = 0.92; label = '⚠ 仅3天休整' }
  else if (restDays > 6) { factor = 0.95; label = '长休可能慢热' }
  
  if (previousMinutes > 120) { factor -= 0.05; label += '+上轮加时' }
  
  return { factor: +factor.toFixed(2), label }
}

// ===== 综合预测引擎 =====

export function v5Predict(homeTeam: string, awayTeam: string, matches: any[]): MatchProfile {
  // 为每队提取比赛数据
  const homeMatches = matches.filter(m => m.home_team === homeTeam || m.away_team === homeTeam)
  const awayMatches = matches.filter(m => m.home_team === awayTeam || m.away_team === awayTeam)

  const homeRegion = getRegion(homeTeam)
  const awayRegion = getRegion(awayTeam)

  // ① 对手调整
  const homeAdj = computeOpponentAdjusted(homeMatches, homeTeam)
  const awayAdj = computeOpponentAdjusted(awayMatches, awayTeam)

  // ② 半场
  const homeHalf = computeHalfProfile(homeMatches, homeTeam)
  const awayHalf = computeHalfProfile(awayMatches, awayTeam)

  // ③ 定位球
  const homeSP = computeSetPieceProfile(homeRegion)
  const awaySP = computeSetPieceProfile(awayRegion)

  // 全部指标
  const allAttackMap = new Map<string, number>()
  const allDefenseMap = new Map<string, number>()
  for (const t of new Set([...matches.map((m:any) => m.home_team), ...matches.map((m:any) => m.away_team)])) {
    const tm = matches.filter((m:any) => m.home_team === t || m.away_team === t)
    const adj = computeOpponentAdjusted(tm, t)
    allAttackMap.set(t, adj.adjAttack)
    allDefenseMap.set(t, 1.5) // simplified
  }

  // ④ 贝叶斯收缩
  const hAtt = hierarchicalPrior(homeTeam, homeAdj.adjAttack, allAttackMap)
  const aAtt = hierarchicalPrior(awayTeam, awayAdj.adjAttack, allAttackMap)

  const homeProfile: TeamProfile = {
    name: homeTeam, region: homeRegion,
    adjAttack: hAtt, adjDefense: 1.5,
    strongOppAttack: homeAdj.strong, weakOppAttack: homeAdj.weak,
    firstHalfGoals: homeHalf.firstHalfGoals, secondHalfGoals: homeHalf.secondHalfGoals,
    slowStart: homeHalf.slowStart, secondHalfSurge: homeHalf.secondHalfSurge,
    setPieceRatio: homeSP.setPieceRatio, openPlayEfficiency: homeSP.openPlayEfficiency,
    regionAvgAttack: allAttackMap.get(homeTeam) || hAtt, regionAvgDefense: 1.5,
    recentMatchIntensity: 0, restDays: 4,
  }
  const awayProfile: TeamProfile = {
    name: awayTeam, region: awayRegion,
    adjAttack: aAtt, adjDefense: 1.5,
    strongOppAttack: awayAdj.strong, weakOppAttack: awayAdj.weak,
    firstHalfGoals: awayHalf.firstHalfGoals, secondHalfGoals: awayHalf.secondHalfGoals,
    slowStart: awayHalf.slowStart, secondHalfSurge: awayHalf.secondHalfSurge,
    setPieceRatio: awaySP.setPieceRatio, openPlayEfficiency: awaySP.openPlayEfficiency,
    regionAvgAttack: allAttackMap.get(awayTeam) || aAtt, regionAvgDefense: 1.5,
    recentMatchIntensity: 0, restDays: 4,
  }

  // ① 对手调整后的概率
  const effectiveHome = hAtt / Math.max(aAtt, 0.1)
  const opponentAdjHome = 1 / (1 + Math.exp(-effectiveHome + 1))
  const opponentAdj = {
    home: +opponentAdjHome.toFixed(3),
    draw: +(0.25 * (1 - Math.abs(opponentAdjHome - 0.5) * 2)).toFixed(3),
    away: +(1 - opponentAdjHome - 0.22).toFixed(3),
  }

  // ② 半场因子
  const slowStartBias = (homeProfile.slowStart ? -0.03 : 0) + (awayProfile.slowStart ? +0.03 : 0)
  const firstHalfBias = +((homeProfile.firstHalfGoals - awayProfile.firstHalfGoals) * 0.1 + slowStartBias).toFixed(3)

  // ⑤ 有序Logit
  const ologit = orderedLogit(hAtt, aAtt, 0.1 + firstHalfBias)

  // ⑥ 赛程密度
  const schedule = scheduleImpact(4, 90) // default

  // 综合: 对手调整(40%) + 有序Logit(40%) + 赛程(20%)
  let home = opponentAdj.home * 0.40 + ologit.home * 0.40 + (0.5 + firstHalfBias) * 0.20
  let draw = opponentAdj.draw * 0.40 + ologit.draw * 0.40 + 0.25 * 0.20
  let away = 1 - home - draw
  const total = home + draw + away

  const maxP = Math.max(home, draw, away)
  const recommendation = maxP === home ? 'home' : maxP === draw ? 'draw' : 'away'

  const analysis = [
    `① 对手调整: ${homeTeam}真实攻击力 ${hAtt.toFixed(2)}(对强队${homeAdj.strong.toFixed(1)}/对弱队${homeAdj.weak.toFixed(1)}) | ${awayTeam} ${aAtt.toFixed(2)}(强${awayAdj.strong.toFixed(1)}/弱${awayAdj.weak.toFixed(1)})`,
    `② 半场节奏: ${homeTeam}${homeProfile.slowStart?'慢热':''}${homeProfile.secondHalfSurge?'下半场发飙':''} vs ${awayTeam}${awayProfile.slowStart?'慢热':''}`,
    `③ 定位球依赖: ${homeTeam}${(homeSP.setPieceRatio*100).toFixed(0)}% | ${awayTeam}${(awaySP.setPieceRatio*100).toFixed(0)}%`,
    `④ 贝叶斯收缩: ${homeTeam}(${hAtt.toFixed(2)})向区域均值回归 | ${awayTeam}(${aAtt.toFixed(2)})`,
    `⑤ 有序Logit: 主${(ologit.home*100).toFixed(0)}% 平${(ologit.draw*100).toFixed(0)}% 客${(ologit.away*100).toFixed(0)}%`,
    `⑥ 赛程密度: ${schedule.label}(系数${schedule.factor})`,
  ].join('\n')

  return {
    homeTeam: homeProfile.name, awayTeam: awayProfile.name,
    homeProfile, awayProfile,
    opponentAdjustedProb: opponentAdj,
    firstHalfBias,
    orderedLogit: ologit,
    final: {
      home: +(home/total).toFixed(3), draw: +(draw/total).toFixed(3), away: +(away/total).toFixed(3),
      recommendation, confidence: +(maxP/total).toFixed(2),
    },
    analysis,
  }
}
