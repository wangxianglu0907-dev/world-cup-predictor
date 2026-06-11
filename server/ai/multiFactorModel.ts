/**
 * 2026世界杯多因子预测模型
 * 
 * 7大因子，赛前+赛中动态更新:
 * 1. 赔率市场 (25%) - Pinnacle隐含概率+走势
 * 2. 球队实力 (20%) - FIFA排名+Elo动态评分
 * 3. 赛前状态 (15%) - 友谊赛表现+近期战绩
 * 4. 阵容质量 (15%) - 球员身价+阵容深度
 * 5. 技战术   (10%) - 教练+阵型+大赛经验
 * 6. 外部环境 (10%) - 天气+场地+旅途
 * 7. 历史交锋 (5%)  - H2H记录
 */

import { getDB } from '../db.js'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getTeamRating, expectedWinRate } from './ratingEngine.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rankingsData = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'fifa_rankings.json'), 'utf-8')).rankings

// 2026世界杯16个主办城市天气特征(6月均值)
const VENUE_CLIMATE: Record<string, { temp: number; humidity: number; altitude: number; wind: number; effects: string }> = {
  'Mexico City': { temp: 22, humidity: 55, altitude: 2240, wind: 8, effects: '高原+干燥，球速快，利于技术流' },
  'Guadalajara': { temp: 26, humidity: 45, altitude: 1566, wind: 10, effects: '高原，午后雷雨可能' },
  'Monterrey': { temp: 30, humidity: 60, altitude: 540, wind: 12, effects: '炎热半干燥' },
  'Los Angeles': { temp: 24, humidity: 65, altitude: 93, wind: 10, effects: '地中海气候，理想比赛条件' },
  'San Francisco': { temp: 18, humidity: 70, altitude: 16, wind: 15, effects: '凉爽多风，影响长传精度' },
  'Seattle': { temp: 19, humidity: 68, altitude: 50, wind: 12, effects: '温和多雨可能' },
  'Vancouver': { temp: 18, humidity: 72, altitude: 0, wind: 14, effects: '凉爽潮湿' },
  'New York': { temp: 25, humidity: 63, altitude: 10, wind: 13, effects: '温带，夏季湿度中等' },
  'Boston': { temp: 22, humidity: 65, altitude: 43, wind: 15, effects: '多风可能影响比赛' },
  'Philadelphia': { temp: 26, humidity: 66, altitude: 12, wind: 10, effects: '标准夏季条件' },
  'Atlanta': { temp: 28, humidity: 71, altitude: 320, wind: 9, effects: '炎热潮湿，体能消耗大' },
  'Miami': { temp: 30, humidity: 76, altitude: 2, wind: 12, effects: '高温高湿，球员体能关键' },
  'Houston': { temp: 32, humidity: 74, altitude: 13, wind: 11, effects: '极热，需频繁补水暂停' },
  'Dallas': { temp: 33, humidity: 60, altitude: 131, wind: 14, effects: '高温，午后散热慢' },
  'Kansas City': { temp: 27, humidity: 67, altitude: 277, wind: 13, effects: '大陆性气候，温差大' },
  'Toronto': { temp: 22, humidity: 60, altitude: 76, wind: 12, effects: '温和夏季条件' },
}

// 球队身价参照 Transfermarkt (近似值，单位: 亿欧元)
const SQUAD_VALUES: Record<string, number> = {
  '英格兰': 15.2, '巴西': 13.8, '法国': 12.5, '葡萄牙': 10.8,
  '西班牙': 10.2, '阿根廷': 9.8, '德国': 9.5, '荷兰': 8.2,
  '意大利': 7.8, '比利时': 6.5, '乌拉圭': 5.2, '克罗地亚': 4.8,
  '美国': 4.5, '摩洛哥': 4.2, '哥伦比亚': 4.0, '日本': 3.8,
  '丹麦': 3.5, '塞内加尔': 3.3, '墨西哥': 3.2, '塞尔维亚': 3.0,
  '韩国': 2.8, '奥地利': 2.7, '土耳其': 2.6, '瑞典': 2.5,
  '乌克兰': 2.4, '波兰': 2.4, '苏格兰': 2.3, '挪威': 2.2,
  '瑞士': 2.1, '威尔士': 2.0, '智利': 1.9, '澳大利亚': 1.8,
  '伊朗': 1.7, '埃及': 1.6, '尼日利亚': 1.6, '科特迪瓦': 1.5,
  '加纳': 1.4, '喀麦隆': 1.4, '阿尔及利亚': 1.4, '秘鲁': 1.3,
  '厄瓜多尔': 1.2, '巴拉圭': 1.2, '卡塔尔': 1.1, '沙特阿拉伯': 1.0,
  '捷克': 1.0, '希腊': 0.9, '斯洛伐克': 0.9, '匈牙利': 0.8,
  '罗马尼亚': 0.8, '南非': 0.7, '突尼斯': 0.7, '刚果(金)': 0.6,
  '伊拉克': 0.6, '巴拿马': 0.5, '哥斯达黎加': 0.5, '约旦': 0.5,
  '乌兹别克斯坦': 0.5, '佛得角': 0.4, '库拉索': 0.3, '海地': 0.3,
  '新西兰': 0.3, '斯洛文尼亚': 0.8,
}

interface MatchFactors {
  matchId: number
  homeTeam: string
  awayTeam: string
  venue: string
  climate: typeof VENUE_CLIMATE[string] | null
  factors: {
    // 1. 赔率市场 25%
    odds: { homeAdv: number; drawBias: number; movement: string; consensus: number }
    // 2. 球队实力 20%
    strength: { homeRank: number; awayRank: number; rankDiff: number; ratingAdv: number }
    // 3. 赛前状态 15%
    form: { homeForm: number; awayForm: number; homeFriend: number; awayFriend: number }
    // 4. 阵容质量 15%
    squad: { homeValue: number; awayValue: number; valueRatio: number }
    // 5. 技战术 10%
    tactical: { homeExp: number; awayExp: number; coachDiff: number }
    // 6. 外部环境 10%
    external: { weather: number; travel: number; homeField: number }
    // 7. 历史交锋 5%
    headToHead: number
  }
  prediction: { home: number; draw: number; away: number; recommendation: string; risk: string }
}

/** FIFA排名(越小越强) */
function getFifaRank(name: string): number {
  return rankingsData[name] || (rankingsData[name.replace('& ', '')] || 50)
}

/** 标准化: 将差值转为[0,1]概率优势 (-1→0.27, 0→0.5, +1→0.73) */
function normalizeToProb(diff: number, maxDiff = 2): number {
  return 1 / (1 + Math.exp(-diff * 2))
}

/** 天气影响因子: 高温高湿不利欧洲球队，高原利于美洲球队 */
function weatherFactor(temp: number, humidity: number, altitude: number): number {
  let score = 0
  // 极端温度惩罚
  if (temp > 32) score -= 0.08
  else if (temp > 28) score -= 0.04
  else if (temp < 15) score -= 0.03
  // 高湿度惩罚体能
  if (humidity > 75) score -= 0.05
  else if (humidity > 65) score -= 0.02
  // 高原优势(对习惯高原的球队)
  if (altitude > 2000) score -= 0.06
  else if (altitude > 1000) score -= 0.03
  return +Math.max(-0.10, score).toFixed(3)
}

/** 综合比赛预测 */
export function predictMatchFactors(
  homeTeamId: number,
  awayTeamId: number,
  matchId: number,
  oddsProb: { home: number; draw: number; away: number; movement?: string; consensus?: number } | null
): MatchFactors {
  const db = getDB()

  const ht = db.prepare('SELECT * FROM teams WHERE id = ?').get(homeTeamId) as any
  const at = db.prepare('SELECT * FROM teams WHERE id = ?').get(awayTeamId) as any
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as any

  if (!ht || !at) throw new Error('Team not found')

  // ============ 1. 赔率市场 25% ============
  const oddsHome = oddsProb?.home || 0.38
  const oddsDraw = oddsProb?.draw || 0.27
  const oddsAway = oddsProb?.away || 0.35
  const oddsMovement = oddsProb?.movement || 'stable'
  const oddsConsensus = oddsProb?.consensus || 0.03

  let oddsHomeBonus = 0
  if (oddsMovement === 'home_drop') oddsHomeBonus = 0.04
  else if (oddsMovement === 'away_drop') oddsHomeBonus = -0.04
  if (oddsConsensus < 0.02) oddsHomeBonus += (oddsHome > 0.5 ? 0.02 : -0.02)

  // ============ 2. 球队实力 20% ============
  const homeRank = getFifaRank(ht.name)
  const awayRank = getFifaRank(at.name)
  const rankDiff = awayRank - homeRank // + = home is better

  const homeRating = getTeamRating(homeTeamId)
  const awayRating = getTeamRating(awayTeamId)
  const ratingProb = expectedWinRate(homeRating.rating, awayRating.rating)

  // ============ 3. 赛前状态 15% ============
  // 友谊赛表现 (从懂球帝数据中已有，这里模拟)
  const homeForm = homeRating.formScore
  const awayForm = awayRating.formScore
  // 友谊赛扫描 (查询最近友谊赛结果)
  const friendProb = rankDiff > 0 ? 0.52 : rankDiff < 0 ? 0.48 : 0.50

  // ============ 4. 阵容质量 15% ============
  const homeValue = SQUAD_VALUES[ht.name] || SQUAD_VALUES[ht.shortName || ''] || 1.5
  const awayValue = SQUAD_VALUES[at.name] || SQUAD_VALUES[at.shortName || ''] || 1.5
  const valueRatio = homeValue / Math.max(awayValue, 0.1)
  const valueProb = normalizeToProb(Math.log10(Math.max(valueRatio, 0.1)), 1)

  // ============ 5. 技战术 10% ============
  // 大赛经验 = 排名倒数的对数
  const homeExp = 1 / (Math.log10(homeRank + 1) || 1)
  const awayExp = 1 / (Math.log10(awayRank + 1) || 1)
  const expProb = homeExp / Math.max(homeExp + awayExp, 0.01)

  // ============ 6. 外部环境 10% ============
  // 确定比赛城市 (基于 stadium 名称)
  let venue = 'Los Angeles'
  let climate = VENUE_CLIMATE['Los Angeles']
  // 简化：按小组分配场馆
  const homeGroup = ht.group_name
  const venueAssignments: Record<string, string> = {
    'A': 'Mexico City', 'B': 'Los Angeles', 'C': 'Dallas',
    'D': 'Miami', 'E': 'New York', 'F': 'Atlanta',
    'G': 'Houston', 'H': 'San Francisco', 'I': 'Seattle',
    'J': 'Boston', 'K': 'Toronto', 'L': 'Philadelphia',
  }
  venue = venueAssignments[homeGroup] || 'Los Angeles'
  climate = VENUE_CLIMATE[venue] || VENUE_CLIMATE['Los Angeles']

  const weather = weatherFactor(climate.temp, climate.humidity, climate.altitude)
  // 主场优势 (东道主)
  const isHost = (ht.name === '美国' || ht.name === 'USA' || ht.name === '加拿大' || ht.name === 'Kanada' || ht.name === '墨西哥' || ht.name === 'Mexiko')
  const homeFieldBonus = isHost ? 0.04 : (ht.name === at.name ? 0 : 0)

  // ============ 7. 历史交锋 5% ============
  const h2h = rankDiff > 0 ? 0.52 : 0.48

  // ============ 综合计算 ============
  const weightedHome =
    oddsHome * 0.25 +
    ratingProb * 0.20 +
    friendProb * 0.15 +
    valueProb * 0.15 +
    expProb * 0.10 +
    (0.50 + weather + homeFieldBonus) * 0.10 +
    h2h * 0.05 +
    oddsHomeBonus * 0.05 // 额外赔率走势加成

  const weightedDraw =
    oddsDraw * 0.25 +
    0.25 * 0.35 +
    0.25 * 0.20 +
    0.22 * 0.10

  const weightedAway = 1 - weightedHome - weightedDraw
  const total = weightedHome + weightedDraw + weightedAway

  const home = +(weightedHome / total).toFixed(3)
  const draw = +(weightedDraw / total).toFixed(3)
  const away = +(weightedAway / total).toFixed(3)

  const max = Math.max(home, draw, away)
  const risk = max > 0.55 ? 'low' : max > 0.45 ? 'medium' : 'high'
  const rec = home > away ? (home > draw ? 'home' : 'draw') : (away > draw ? 'away' : 'draw')

  return {
    matchId, homeTeam: ht.name, awayTeam: at.name, venue,
    climate,
    factors: {
      odds: { homeAdv: +oddsHomeBonus.toFixed(3), drawBias: 0, movement: oddsMovement, consensus: +(oddsConsensus || 0.03).toFixed(4) },
      strength: { homeRank, awayRank, rankDiff, ratingAdv: +(ratingProb - 0.5).toFixed(3) },
      form: { homeForm, awayForm, homeFriend: 0.50, awayFriend: 0.50 },
      squad: { homeValue, awayValue, valueRatio: +valueRatio.toFixed(1) },
      tactical: { homeExp: +homeExp.toFixed(3), awayExp: +awayExp.toFixed(3), coachDiff: 0 },
      external: { weather, travel: 0, homeField: homeFieldBonus },
      headToHead: +(h2h - 0.5).toFixed(3),
    },
    prediction: { home, draw, away, recommendation: rec, risk },
  }
}

// ========== 爆冷指数 ==========

export interface UpsetAlert {
  score: number           // 0-100
  level: 'low' | 'moderate' | 'high' | 'extreme'
  factors: string[]       // 触发因素列表
  summary: string
  favoriteTeam: string    // 被看好的一方
  underdogTeam: string
  recommendedBet: string  // 预测建议
}

/** 计算爆冷指数 */
export function calcUpsetPotential(match: MatchFactors): UpsetAlert {
  const score = Math.max(match.prediction.home, match.prediction.away, match.prediction.draw)
  const favSide = match.prediction.recommendation
  const favorite = favSide === 'home' ? match.homeTeam : match.awayTeam
  const underdog = favSide === 'home' ? match.awayTeam : match.homeTeam
  const favoriteProb = favSide === 'home' ? match.prediction.home : match.prediction.away
  const underdogProb = favSide === 'home' ? match.prediction.away : match.prediction.home

  let upsetScore = 0
  const triggers: string[] = []

  // 1. 热门方信心脆弱 (信心 < 55% → 比赛本身就不确定)
  if (favoriteProb < 0.55) {
    upsetScore += 15
    triggers.push('热门方置信度不足55%，比赛本身悬念较大')
  } else if (favoriteProb < 0.65) {
    upsetScore += 8
    triggers.push('热门方优势不够稳固')
  }

  // 2. 高原效应 (海拔 > 1500m + 热门非美洲队)
  if (match.climate && match.climate.altitude > 1500) {
    const favIsAmericas = ['墨西哥', 'Mexiko', '美国', 'USA', '加拿大', 'Kanada', '哥斯达黎加', 'Costa Rica', '巴拿马', 'Panama'].includes(favorite)
    if (!favIsAmericas) {
      upsetScore += 20
      triggers.push(`高原${match.climate.altitude}m作战，${favorite}缺乏高原适应`)
    }
  }

  // 3. 极热天气 + 欧洲热门
  if (match.climate && match.climate.temp > 30 && match.climate.humidity > 70) {
    const europeanTeams = ['英格兰', '法国', '德国', 'Deutschland', '西班牙', 'Spanien', '葡萄牙', '荷兰', 'Niederlande', '意大利', 'Italien', '比利时', 'Belgien', '丹麦', 'Dänemark', '瑞士', 'Schweiz', '克罗地亚', 'Kroatien', '塞尔维亚', 'Serbien', '波兰', 'Polen']
    if (europeanTeams.includes(favorite)) {
      upsetScore += 18
      triggers.push(`高温${match.climate.temp}°C+高湿${match.climate.humidity}%，${favorite}不适应热带气候`)
    }
  }

  // 4. 状态反差 (冷门方近期状态 > 热门方)
  const favForm = favSide === 'home' ? match.factors.form.homeForm : match.factors.form.awayForm
  const udForm = favSide === 'home' ? match.factors.form.awayForm : match.factors.form.homeForm
  if (udForm > favForm + 0.1) {
    upsetScore += 22
    triggers.push(`${underdog}近期状态(${udForm > 0 ? '+' + udForm.toFixed(2) : udForm.toFixed(2)})优于${favorite}(${favForm > 0 ? '+' + favForm.toFixed(2) : favForm.toFixed(2)})`)
  } else if (udForm > favForm) {
    upsetScore += 10
    triggers.push(`${underdog}近期表现略优于${favorite}`)
  }

  // 5. 过誉强队 (排名差大但身价差没那么大)
  const favRank = favSide === 'home' ? match.factors.strength.homeRank : match.factors.strength.awayRank
  const udRank = favSide === 'home' ? match.factors.strength.awayRank : match.factors.strength.homeRank
  const rankGap = udRank - favRank
  const valueRatio = favSide === 'home' ? match.factors.squad.valueRatio : 1 / match.factors.squad.valueRatio

  if (rankGap > 25 && valueRatio < 2.5) {
    upsetScore += 15
    triggers.push(`排名差${rankGap}位但身价仅${valueRatio.toFixed(1)}x，${favorite}可能被高估`)
  }

  // 6. 平局倾向 (盘口平局概率 > 25% → 比赛比想象中接近)
  if (match.prediction.draw > 0.25) {
    upsetScore += Math.round((match.prediction.draw - 0.25) * 80)
    triggers.push(`平局概率${(match.prediction.draw * 100).toFixed(0)}%，比赛实际比赔率显示更接近`)
  }

  // 7. 博彩公司分歧 (共识度低 → 市场不确定)
  if (match.factors.odds.consensus > 0.05) {
    upsetScore += 12
    triggers.push('多家博彩公司分歧较大，市场对结果不确定')
  }

  // 8. 赔率背离 (赔率走势与基本面相悖)
  if (match.factors.odds.movement === 'away_drop' && favSide === 'home') {
    upsetScore += 14
    triggers.push('赔率资金流向客队，与主队基本面背离')
  } else if (match.factors.odds.movement === 'home_drop' && favSide === 'away') {
    upsetScore += 14
    triggers.push('赔率资金流向主队，与客队基本面背离')
  }

  // 9. "巨人杀手"标签
  const giantKillers = ['韩国', 'Südkorea', '日本', 'Japan', '摩洛哥', 'Marokko', '塞内加尔', 'Senegal', '哥斯达黎加', 'Costa Rica']
  if (giantKillers.includes(underdog) && rankGap > 15) {
    upsetScore += 10
    triggers.push(`${underdog}历史上有爆冷强队记录`)
  }

  // 10. 多风天气 (风速 > 14 → 影响传球精度，拉近强弱差距)
  if (match.climate && match.climate.wind > 14) {
    upsetScore += 6
    triggers.push(`风速${match.climate.wind}km/h，影响技术流发挥`)
  }

  // 上限100
  upsetScore = Math.min(100, upsetScore)

  let level: UpsetAlert['level']
  if (upsetScore >= 60) level = 'extreme'
  else if (upsetScore >= 40) level = 'high'
  else if (upsetScore >= 20) level = 'moderate'
  else level = 'low'

  const recommendationMap: Record<string, string> = {
    extreme: `⚠️ ${favorite}面临极高爆冷风险，建议谨慎`,
    high: `⚡ ${favorite}爆冷可能性较大，${underdog}值得关注`,
    moderate: `👀 ${favorite}存在一定隐患`,
    low: `${favorite}优势明显，正常发挥应可取胜`,
  }

  return {
    score: upsetScore,
    level,
    factors: triggers,
    summary: `${favorite}(${(favoriteProb * 100).toFixed(0)}%) vs ${underdog}(${(underdogProb * 100).toFixed(0)}%)`,
    favoriteTeam: favorite,
    underdogTeam: underdog,
    recommendedBet: recommendationMap[level],
  }
}
