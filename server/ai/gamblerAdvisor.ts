/**
 * 🎰 搏一搏 v3.0 — 时间感知智能博彩顾问
 * 
 * 核心设计:
 *   只推未来48h内的比赛（水位才有参考价值）
 *   随时间逼近分三层:
 *     🕐 48h-24h: 前瞻分析 — 水位初定，置信度打8折
 *     🕑 24h-12h: 临场推荐 — 水位稳定，主力推荐区
 *     🕒 12h-0h:  即将开赛 — 水位锁定，最高置信度
 *     ❌ >48h:     不推荐（水位波动太大）
 * 
 *   每条推荐显示: 开赛时间 + 距离开赛倒计时 + 紧迫度层级
 */

import { getDB } from '../db.js'

// ===== 动态校准缓存（赛后学习更新）=====
let _calibrationCache: any[] | null = null
let _calibrationCacheTime = 0

function getCalibration(): any[] | null {
  const now = Date.now()
  if (_calibrationCache && now - _calibrationCacheTime < 60000) return _calibrationCache
  try {
    const db = getDB()
    const row = db.prepare("SELECT weights FROM model_params WHERE version = 'calibration-latest'").get() as any
    _calibrationCache = row ? JSON.parse(row.weights) : null
    _calibrationCacheTime = now
    return _calibrationCache
  } catch { return null }
}

// ===== 类型 =====
interface SingleBet {
  matchId: number; homeTeam: string; awayTeam: string
  startTime: string; groupName: string; venue: string
  type: string; pick: string; odds: number; prob: number
  rawProb: number; calibratedProb: number; ev: number
  infoAdvantage: number; signalQuality: 'strong' | 'moderate' | 'weak'
  kellyStake: number; confidence: string; reasoning: string
  // 时间感知新增
  hoursUntilMatch: number
  urgency: 'live' | 'soon' | 'upcoming'  // 临场 / 赛前1天 / 前瞻
  urgencyLabel: string
  oddsConfidence: number  // 水位可信度 0-1
}

interface ComboBet {
  type: string; label: string; emoji: string; bets: SingleBet[]
  totalOdds: number; totalProb: number; ev: number; kellyStake: number
  riskLevel: string; tagline: string
}

interface GamblerReport {
  timestamp: string
  live: SingleBet[]       // 🕒 <12h
  soon: SingleBet[]       // 🕑 12-24h
  upcoming: SingleBet[]   // 🕐 24-48h
  combos: ComboBet[]
  summary: { totalBets: number; avgEV: string; timeRange: string; note: string }
}

// ===== 时间工具 =====
const NOW = Date.now()
const HOUR = 3600000

function hoursUntil(startTime: string): number {
  return +((new Date(startTime).getTime() - NOW) / HOUR).toFixed(1)
}

function countdown(hours: number): string {
  if (hours <= 0) return '已开赛'
  if (hours < 1) return `${Math.round(hours * 60)}分钟后`
  if (hours < 24) return `${Math.floor(hours)}小时${Math.round((hours % 1) * 60)}分后`
  return `${Math.floor(hours / 24)}天${Math.floor(hours % 24)}小时后`
}

function getUrgency(hours: number): SingleBet['urgency'] {
  if (hours <= 12) return 'live'
  if (hours <= 24) return 'soon'
  return 'upcoming'
}

function urgencyLabel(urgency: SingleBet['urgency']): string {
  return urgency === 'live' ? '🕒 即将开赛' : urgency === 'soon' ? '🕑 明日焦点' : '🕐 前瞻分析'
}

/** 水位可信度: 越接近比赛越可信 */
function oddsConfidence(hours: number, hasOddsHistory: boolean): number {
  if (hours <= 6) return 1.0       // 赛前6h，水位已锁定
  if (hours <= 12) return 0.95     // 几乎锁定
  if (hours <= 24) return 0.85     // 比较稳
  if (hours <= 48) return 0.70     // 有参考价值
  return 0.40                       // 太早，波动大
}

/** 时间格式化为中文 */
function formatTime(isoTime: string): string {
  try {
    const d = new Date(isoTime)
    return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  } catch { return isoTime?.slice(0, 16) || '待定' }
}

// ===== ① 概率校准 =====
function calibrateProb(rawProb: number, homeEloDiff: number): number {
  const calBuckets = getCalibration()
  if (calBuckets && calBuckets.length > 0) {
    for (const b of calBuckets) {
      if (rawProb >= b.modelMin && rawProb <= b.modelMax) {
        return +Math.max(0.02, Math.min(0.98, rawProb * b.calibrationFactor)).toFixed(3)
      }
    }
  }
  const gap = Math.abs(homeEloDiff) / 200
  const factor = gap > 0.8 ? 0.35 : gap > 0.4 ? 0.50 : gap > 0.2 ? 0.65 : 0.85
  return +Math.max(0.02, Math.min(0.98, 0.5 + (rawProb - 0.5) * factor)).toFixed(3)
}

// ===== ② 信息优势评分 =====
function infoAdvantageScore(match: any, pred: any): { score: number; reasons: string[] } {
  let score = 0, reasons: string[] = []
  const report = pred.analysis_report || ''
  if (report.includes('慢热')) { score += 15; reasons.push('慢热节奏') }
  if (report.includes('抢开局')) { score += 12; reasons.push('抢开局模式') }
  if (report.includes('高原')) { score += 20; reasons.push('高原影响') }
  if (report.includes('高温')) { score += 15; reasons.push('高温影响') }
  if (report.includes('旅途')) { score += 10; reasons.push('旅途消耗') }
  if (report.includes('东道主')) { score += 10; reasons.push('东道主优势') }
  if (report.includes('爆冷预警')) {
    const upsetScore = parseInt(report.match(/指数(\d+)\/100/)?.[1] || '0')
    if (upsetScore > 40) { score += 25; reasons.push('强爆冷信号') }
    else if (upsetScore > 20) { score += 12; reasons.push('中爆冷信号') }
  }
  if (report.includes('阻盘')) { score += 10; reasons.push('阻盘信号') }
  if (report.includes('诱盘')) { score -= 15; reasons.push('⚠诱盘警告') }
  if (report.includes('升盘')) { score += 8; reasons.push('盘口走强') }
  if (report.includes('降盘')) { score -= 8; reasons.push('盘口走弱') }
  if (report.includes('球风')) { score += 8; reasons.push('风格克制') }
  if (report.includes('高度一致')) { score += 10; reasons.push('多模型一致') }
  if (report.includes('分歧较大')) { score -= 20; reasons.push('⚠模型分歧') }
  return { score: Math.max(0, Math.min(100, score)), reasons }
}

// ===== ③ 计算公式 =====
function calcEV(prob: number, odds: number): number { return +(prob * odds - 1).toFixed(3) }
function kellyStake(prob: number, odds: number, quality: number): number {
  if (odds <= 1 || quality < 0.3) return 0
  return +Math.max(0, Math.min(0.08, ((odds * prob - 1) / (odds - 1)) / 4 * quality)).toFixed(3)
}

// ===== 赔率异动跟踪 =====
const oddsHistory = new Map<number, { homeWin: number; draw: number; awayWin: number; timestamp: string }>()

function oddsMovementSignal(matchId: number, currentOdds: any): { signal: string; score: number; hasHistory: boolean } {
  const prev = oddsHistory.get(matchId)
  oddsHistory.set(matchId, { homeWin: currentOdds.homeWin, draw: currentOdds.draw, awayWin: currentOdds.awayWin, timestamp: new Date().toISOString() })
  if (!prev) return { signal: '首次采集', score: 0, hasHistory: false }
  const hChange = (prev.homeWin - currentOdds.homeWin) / prev.homeWin
  const aChange = (prev.awayWin - currentOdds.awayWin) / prev.awayWin
  if (Math.abs(hChange) > 0.15 || Math.abs(aChange) > 0.15) return { signal: '⚠ 剧烈波动', score: -15, hasHistory: true }
  if (hChange < -0.05) return { signal: '📈 主胜走强', score: +10, hasHistory: true }
  if (aChange < -0.05) return { signal: '📈 客胜走强', score: -8, hasHistory: true }
  return { signal: '📊 稳定', score: 5, hasHistory: true }
}

// ===== SPF 推荐 =====
function spfBets(match: any, pred: any, hours: number): SingleBet[] {
  const bets: SingleBet[] = []
  const spf = JSON.parse(pred.spf)
  const odds = JSON.parse(pred.odds_analysis || '{}')
  const oddsMap: Record<string, number> = { home: odds.homeWin || 999, draw: odds.draw || 999, away: odds.awayWin || 999 }
  const labels: Record<string, string> = { home: '主胜', draw: '平局', away: '客胜' }
  const report = pred.analysis_report || ''
  const info = infoAdvantageScore(match, pred)
  const moveSignal = oddsMovementSignal(match.id, odds)
  const urgency = getUrgency(hours)
  const odConf = oddsConfidence(hours, moveSignal.hasHistory)

  // 时间修正: 太早的比赛置信度打折
  const timeAdj = hours > 36 ? 0.7 : hours > 24 ? 0.85 : 1.0

  for (const k of ['home', 'draw', 'away'] as const) {
    if (oddsMap[k] < 1.12 || oddsMap[k] > 8) continue
    const rawProb = spf[k]
    const calibrated = +calibrateProb(rawProb, 1500)
    const ev = calcEV(calibrated, oddsMap[k])

    let quality = 0.5 * odConf * timeAdj
    if (info.score > 30) quality += 0.15
    if (report.includes('高度一致')) quality += 0.10
    if (moveSignal.signal.includes('走强') && k === 'home') quality += 0.08
    quality = Math.max(0.15, Math.min(1.0, quality))

    if (ev > 0.015 && oddsMap[k] > 1.30 && quality > 0.20) {
      const reasonParts: string[] = []
      if (moveSignal.hasHistory) reasonParts.push(moveSignal.signal)
      reasonParts.push(`校准概率${(calibrated*100).toFixed(0)}%`)
      if (info.reasons.length > 0) reasonParts.push(info.reasons.slice(0, 2).join('|'))

      bets.push({
        matchId: match.id, homeTeam: match.home_name, awayTeam: match.away_name,
        startTime: match.start_time, groupName: match.group_name, venue: match.venue || '',
        type: 'spf', pick: labels[k], odds: oddsMap[k], prob: calibrated,
        rawProb, calibratedProb: calibrated, ev,
        infoAdvantage: info.score,
        signalQuality: quality > 0.65 ? 'strong' : quality > 0.40 ? 'moderate' : 'weak',
        kellyStake: kellyStake(calibrated, oddsMap[k], quality),
        confidence: ev > 0.08 ? 'safe' : ev > 0.04 ? 'value' : 'bold',
        reasoning: reasonParts.join(' · ') || '市场价值信号',
        hoursUntilMatch: hours, urgency,
        urgencyLabel: urgencyLabel(urgency),
        oddsConfidence: +odConf.toFixed(2),
      })
    }
  }
  return bets
}

// ===== 让球 / 比分 / 总进球 / 半全场 =====
function handicapBets(match: any, pred: any, hours: number): SingleBet[] {
  const bets: SingleBet[] = []
  const handicap = JSON.parse(pred.handicap)
  const odds = JSON.parse(pred.odds_analysis || '{}')
  const line = odds.asianLine || handicap.handicap
  const homePrice = odds.asianHomePrice || 1.9, awayPrice = odds.asianAwayPrice || 1.9
  const info = infoAdvantageScore(match, pred)
  if (info.score < 15) return bets

  const urgency = getUrgency(hours)
  const hProb = calibrateProb(handicap.home, 1500), aProb = calibrateProb(handicap.away, 1500)
  const hEV = calcEV(hProb, homePrice), aEV = calcEV(aProb, awayPrice)
  const quality = 0.45 * oddsConfidence(hours, true) + (info.score > 25 ? 0.15 : 0)

  if (hEV > 0.02 && homePrice > 1.5 && quality > 0.25) {
    bets.push({ matchId: match.id, homeTeam: match.home_name, awayTeam: match.away_name, startTime: match.start_time, groupName: match.group_name, venue: '', type: 'handicap', pick: `主${line>0?'+':''}${line} @${homePrice}`, odds: homePrice, prob: hProb, rawProb: handicap.home, calibratedProb: hProb, ev: hEV, infoAdvantage: info.score, signalQuality: quality > 0.5 ? 'moderate' : 'weak', kellyStake: kellyStake(hProb, homePrice, quality), confidence: 'value', reasoning: `过盘率${(hProb*100).toFixed(0)}% · ${info.reasons.join('|')}`, hoursUntilMatch: hours, urgency, urgencyLabel: urgencyLabel(urgency), oddsConfidence: +oddsConfidence(hours, true).toFixed(2) })
  }
  if (aEV > 0.02 && awayPrice > 1.5 && quality > 0.25) {
    bets.push({ matchId: match.id, homeTeam: match.home_name, awayTeam: match.away_name, startTime: match.start_time, groupName: match.group_name, venue: '', type: 'handicap', pick: `客${-line>0?'+':''}${-line} @${awayPrice}`, odds: awayPrice, prob: aProb, rawProb: handicap.away, calibratedProb: aProb, ev: aEV, infoAdvantage: info.score, signalQuality: quality > 0.5 ? 'moderate' : 'weak', kellyStake: kellyStake(aProb, awayPrice, quality), confidence: 'value', reasoning: `过盘率${(aProb*100).toFixed(0)}% · ${info.reasons.join('|')}`, hoursUntilMatch: hours, urgency, urgencyLabel: urgencyLabel(urgency), oddsConfidence: +oddsConfidence(hours, true).toFixed(2) })
  }
  return bets
}

function scoreBets(match: any, pred: any, hours: number): SingleBet[] {
  const bets: SingleBet[] = []
  const scores = JSON.parse(pred.score_distribution || '[]')
  const info = infoAdvantageScore(match, pred)
  if (info.score < 15 || hours > 36) return bets  // <36h才推比分

  const urgency = getUrgency(hours)
  for (const s of scores.slice(0, 4)) {
    const calProb = +calibrateProb(s.probability, 1500)
    const estOdds = Math.max(4, Math.min(25, 3 / Math.max(s.probability, 0.04)))
    const ev = calcEV(calProb, estOdds)
    if (ev > 0.03 && estOdds > 4 && info.score > 15) {
      bets.push({ matchId: match.id, homeTeam: match.home_name, awayTeam: match.away_name, startTime: match.start_time, groupName: match.group_name, venue: '', type: 'score', pick: s.score, odds: +estOdds.toFixed(1), prob: calProb, rawProb: s.probability, calibratedProb: calProb, ev, infoAdvantage: info.score, signalQuality: 'weak', kellyStake: kellyStake(calProb, estOdds, 0.25), confidence: 'bold', reasoning: `泊松${(s.probability*100).toFixed(1)}%→校准${(calProb*100).toFixed(0)}%`, hoursUntilMatch: hours, urgency, urgencyLabel: urgencyLabel(urgency), oddsConfidence: +oddsConfidence(hours, true).toFixed(2) })
    }
  }
  return bets
}

function goalsBets(match: any, pred: any, hours: number): SingleBet[] {
  const bets: SingleBet[] = []
  const info = infoAdvantageScore(match, pred)
  if (info.score < 10) return bets
  const urgency = getUrgency(hours)
  const goals = JSON.parse(pred.goals)
  const ranges = [{ k: 'range0_1', l: '0-1球', o: 3.5 }, { k: 'range2_3', l: '2-3球', o: 1.7 }, { k: 'range4_plus', l: '4+球', o: 4.5 }]
  for (const r of ranges) {
    const cal = +calibrateProb(goals[r.k], 1500)
    const ev = calcEV(cal, r.o)
    if (ev > 0.02 && r.o > 1.5) {
      bets.push({ matchId: match.id, homeTeam: match.home_name, awayTeam: match.away_name, startTime: match.start_time, groupName: match.group_name, venue: '', type: 'goals', pick: r.l, odds: r.o, prob: cal, rawProb: goals[r.k], calibratedProb: cal, ev, infoAdvantage: info.score, signalQuality: 'moderate', kellyStake: kellyStake(cal, r.o, 0.35), confidence: 'value', reasoning: `校准概率${(cal*100).toFixed(0)}% · ${info.reasons.join('|')}`, hoursUntilMatch: hours, urgency, urgencyLabel: urgencyLabel(urgency), oddsConfidence: +oddsConfidence(hours, true).toFixed(2) })
    }
  }
  return bets
}

function halfFullBets(match: any, pred: any, hours: number): SingleBet[] {
  const bets: SingleBet[] = []
  const report = pred.analysis_report || ''
  const info = infoAdvantageScore(match, pred)
  if (info.score < 20 || hours > 36) return bets
  const urgency = getUrgency(hours)
  const spf = JSON.parse(pred.spf)

  if (report.includes('慢热') && spf.home > 0.4) {
    const cal = +calibrateProb(spf.home * 0.28, 1500)
    bets.push({ matchId: match.id, homeTeam: match.home_name, awayTeam: match.away_name, startTime: match.start_time, groupName: match.group_name, venue: '', type: 'halffull', pick: '平/主胜', odds: 4.5, prob: cal, rawProb: spf.home * 0.28, calibratedProb: cal, ev: calcEV(cal, 4.5), infoAdvantage: info.score, signalQuality: 'weak', kellyStake: kellyStake(cal, 4.5, 0.20), confidence: 'bold', reasoning: '慢热型 · 半场僵持/全场发力', hoursUntilMatch: hours, urgency, urgencyLabel: urgencyLabel(urgency), oddsConfidence: +oddsConfidence(hours, true).toFixed(2) })
  }
  if (report.includes('抢开局') && spf.home > 0.45) {
    const cal = +calibrateProb(spf.home * 0.32, 1500)
    bets.push({ matchId: match.id, homeTeam: match.home_name, awayTeam: match.away_name, startTime: match.start_time, groupName: match.group_name, venue: '', type: 'halffull', pick: '主/主胜', odds: 3.8, prob: cal, rawProb: spf.home * 0.32, calibratedProb: cal, ev: calcEV(cal, 3.8), infoAdvantage: info.score, signalQuality: 'weak', kellyStake: kellyStake(cal, 3.8, 0.20), confidence: 'bold', reasoning: '抢开局型 · 半场领先', hoursUntilMatch: hours, urgency, urgencyLabel: urgencyLabel(urgency), oddsConfidence: +oddsConfidence(hours, true).toFixed(2) })
  }
  return bets
}

// ===== 串关生成 v3 =====
// 铁律: 每场比赛最多1条腿 | 各腿来自不同比赛 | 腿之间无因果关联

function pickFromDifferentMatches(
  candidates: SingleBet[],
  count: number,
  excludeMatchIds: Set<number> = new Set(),
): SingleBet[] {
  const picked: SingleBet[] = []
  const used = new Set(excludeMatchIds)
  for (const b of candidates) {
    if (used.has(b.matchId)) continue
    picked.push(b)
    used.add(b.matchId)
    if (picked.length >= count) break
  }
  return picked
}

function generateCombos(allBets: SingleBet[]): ComboBet[] {
  const combos: ComboBet[] = []

  // 可用池: 24h内的比赛，排除weak信号
  const pool = allBets.filter(b => b.urgency !== 'upcoming' && b.signalQuality !== 'weak')
  if (pool.length < 2) return combos

  // ===== ① 单场闯关: 最强信号的SPF =====
  const strongSpf = pool.filter(b => b.type === 'spf' && b.signalQuality === 'strong')
  for (const bet of strongSpf.slice(0, 2)) {
    combos.push({
      type: 'single', bets: [bet], totalOdds: bet.odds, totalProb: bet.prob, ev: bet.ev, kellyStake: bet.kellyStake,
      riskLevel: '稳健单场', label: `${bet.homeTeam} vs ${bet.awayTeam}`, emoji: '⚽',
      tagline: `信号强 · EV${(bet.ev > 0 ? '+' : '')}${(bet.ev * 100).toFixed(1)}% · 仓位${(bet.kellyStake * 100).toFixed(1)}%`,
    })
  }

  // ===== ② 稳中带搏 2串1: SPF稳胆 + 让球/总进球中赔 =====
  const safeLeg = strongSpf[0]
  if (safeLeg) {
    const secondCandidates = pool.filter(b =>
      b.matchId !== safeLeg.matchId &&
      b.odds >= 1.60 && b.odds <= 4.0 &&
      b.signalQuality !== 'weak' &&
      ['handicap', 'goals'].includes(b.type)
    ).sort((a, b) => b.ev - a.ev)

    if (secondCandidates.length > 0) {
      const b2 = secondCandidates[0]
      const tO = +(safeLeg.odds * b2.odds).toFixed(1)
      const tP = +(safeLeg.prob * b2.prob).toFixed(3)
      const ev = calcEV(tP, tO)
      if (ev > 0.02) {
        combos.push({
          type: 'safe2x1', bets: [safeLeg, b2], totalOdds: tO, totalProb: tP, ev,
          kellyStake: +Math.min(0.03, ev * 0.012).toFixed(3),
          riskLevel: '稳中带搏', label: `稳胆+中赔 2串1`, emoji: '🎯',
          tagline: `总赔${tO}倍 · 1稳+1搏 · 仓位${(Math.min(0.03, ev * 0.012) * 100).toFixed(1)}%`,
        })
      }
    }
  }

  // ===== ③ 冷门猎手 3串1: 3场不同比赛"被低估"方向各一条 =====
  const coldCandidates = pool.filter(b =>
    b.infoAdvantage >= 15 &&
    b.odds >= 2.5 &&
    b.odds <= 8.0 &&
    b.signalQuality !== 'weak'
  ).sort((a, b) => b.infoAdvantage - a.infoAdvantage)

  const coldLegs = pickFromDifferentMatches(coldCandidates, 3)
  if (coldLegs.length >= 2) {
    const n = coldLegs.length
    const tO = +coldLegs.reduce((a, b) => a * b.odds, 1).toFixed(1)
    const tP = +coldLegs.reduce((a, b) => a * b.prob, 1).toFixed(4)
    combos.push({
      type: 'cold', bets: coldLegs, totalOdds: tO, totalProb: tP, ev: calcEV(tP, tO),
      kellyStake: +Math.max(0.001, tP * 0.008).toFixed(3),
      riskLevel: '冷门猎手', label: `被低估${n}串1`, emoji: '🔮',
      tagline: `总赔${tO}倍 · ${n}场均有信息优势 · 仓位${(Math.max(0.001, tP * 0.008) * 100).toFixed(1)}%`,
    })
  }

  // ===== ④ 比分神单 3串1: 3场不同比赛的最可能比分 =====
  const scorePool = allBets.filter(b =>
    b.type === 'score' &&
    b.urgency !== 'upcoming' &&
    b.prob >= 0.03  // 泊松概率>3%才有意义
  ).sort((a, b) => b.prob - a.prob)

  // 每场比赛只取Top1比分
  const seenMatches = new Set<number>()
  const uniqueScores: SingleBet[] = []
  for (const b of scorePool) {
    if (seenMatches.has(b.matchId)) continue
    uniqueScores.push(b)
    seenMatches.add(b.matchId)
  }

  const scoreLegs = uniqueScores.slice(0, 3)
  if (scoreLegs.length >= 2) {
    const n = scoreLegs.length
    const tO = +scoreLegs.reduce((a, b) => a * b.odds, 1).toFixed(1)
    const tP = +scoreLegs.reduce((a, b) => a * b.prob, 1).toFixed(4)
    combos.push({
      type: 'score', bets: scoreLegs, totalOdds: tO, totalProb: tP, ev: calcEV(tP, tO),
      kellyStake: +Math.max(0.0005, tP * 0.005).toFixed(4),
      riskLevel: '比分神单', label: `比分${n}串1`, emoji: '🚀',
      tagline: `总赔${tO}倍!!! 泊松精选·小仓搏天`,
    })
  }

  return combos
}

// ===== 主入口 =====
export function generateGamblerReport(): GamblerReport {
  const db = getDB()

  // 时间过滤: 只取未来48h内的比赛（按开赛时间排序）
  const cutoffTime = new Date(NOW + 48 * HOUR).toISOString()
  const matches = db.prepare(
    `SELECT m.*, ht.name as home_name, at.name as away_name 
     FROM matches m 
     JOIN teams ht ON m.home_team_id = ht.id 
     JOIN teams at ON m.away_team_id = at.id 
     WHERE m.tournament_id = 1 AND m.status = 'SCHEDULED' AND m.start_time <= ?
     ORDER BY m.start_time ASC`,
  ).all(cutoffTime) as any[]

  if (matches.length === 0) {
    return {
      timestamp: new Date().toISOString(),
      live: [], soon: [], upcoming: [], combos: [],
      summary: { totalBets: 0, avgEV: '0%', timeRange: '无', note: '未来48小时内没有比赛，请稍后再来' },
    }
  }

  const allBets: SingleBet[] = []

  for (const m of matches) {
    const pred = db.prepare('SELECT * FROM ai_predictions WHERE match_id = ? LIMIT 1').get(m.id) as any
    if (!pred) continue
    const hours = hoursUntil(m.start_time)
    if (hours < 0) continue  // 已开赛

    allBets.push(...spfBets(m, pred, hours))
    allBets.push(...handicapBets(m, pred, hours))
    allBets.push(...scoreBets(m, pred, hours))
    allBets.push(...goalsBets(m, pred, hours))
    allBets.push(...halfFullBets(m, pred, hours))
  }

  // 按紧迫度 + 信号质量分层排序
  const sortBets = (bets: SingleBet[]) => bets.sort((a, b) => {
    const qDiff = (b.signalQuality === 'strong' ? 3 : b.signalQuality === 'moderate' ? 2 : 1) -
                  (a.signalQuality === 'strong' ? 3 : a.signalQuality === 'moderate' ? 2 : 1)
    return qDiff !== 0 ? qDiff : b.ev - a.ev
  })

  const live = sortBets(allBets.filter(b => b.urgency === 'live'))
  const soon = sortBets(allBets.filter(b => b.urgency === 'soon'))
  const upcoming = sortBets(allBets.filter(b => b.urgency === 'upcoming'))

  const combos = generateCombos(allBets)

  const totalBets = live.length + soon.length + upcoming.length
  const allEvs = [...live, ...soon, ...upcoming].map(b => b.ev)
  const avgEV = allEvs.length > 0 ? (allEvs.reduce((a, b) => a + b, 0) / allEvs.length * 100).toFixed(1) : '0'

  const firstMatch = matches[0]
  const lastMatch = matches[matches.length - 1]
  const timeRange = firstMatch && lastMatch
    ? `${formatTime(firstMatch.start_time)} ~ ${formatTime(lastMatch.start_time)}`
    : '无'

  const note = matches.length < 72
    ? `共${matches.length}场比赛在未来48h内，${72 - matches.length}场超过48h不推荐（水位未稳定）`
    : '全部72场比赛在未来48h内'

  return {
    timestamp: new Date().toISOString(),
    live, soon, upcoming, combos,
    summary: { totalBets, avgEV: avgEV + '%', timeRange, note },
  }
}
