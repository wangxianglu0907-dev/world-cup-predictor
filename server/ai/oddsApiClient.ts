/**
 * The Odds API 客户端 - 2026世界杯实时赔率
 * 博彩公司: Pinnacle(精明基准), Betfair Exchange(无抽水概率), 及20+家
 */

const API_KEY = 'c9e96f5a784804af7cd43a46b172e1e6'
const BASE = 'https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup'

export interface Bookmaker {
  key: string
  title: string
  markets: Market[]
}

export interface Market {
  key: string
  outcomes: Outcome[]
}

export interface Outcome {
  name: string
  price: number
  point?: number
}

export interface OddsMatch {
  id: string
  home_team: string
  away_team: string
  commence_time: string
  bookmakers: Bookmaker[]
}

export interface ParsedOdds {
  matchId: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  /** 1X2 隐含概率 (去抽水后) */
  spfImpliedProb: { home: number; draw: number; away: number } | null
  /** Pinnacle 亚盘水位 */
  asianHandicap: { line: number; home: number; away: number } | null
  /** Pinnacle 大小球 */
  overUnder: { line: number; over: number; under: number } | null
  /** 市场共识度 (主胜方向的标准差, 越小越一致) */
  consensus: number | null
  /** 博彩公司数量 */
  bookmakerCount: number
}

/** 获取2026世界杯全部赔率 */
export async function fetchWorldCupOdds(): Promise<OddsMatch[]> {
  const url = `${BASE}/odds?apiKey=${API_KEY}&regions=eu,uk&markets=h2h,spreads,totals&oddsFormat=decimal`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Odds API: HTTP ${resp.status}`)
  return resp.json()
}

/** 去抽水: 将博彩公司赔率转为无偏隐含概率 (margin-weighed) */
function removeOverround(prices: number[]): number[] {
  const implied = prices.map(p => 1 / p)
  const total = implied.reduce((s, v) => s + v, 0)
  return implied.map(v => v / total)
}

/** 解析单场比赛的赔率，提取关键指标 */
export function parseMatchOdds(match: OddsMatch): ParsedOdds {
  const result: ParsedOdds = {
    matchId: match.id,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    commenceTime: match.commence_time,
    spfImpliedProb: null,
    asianHandicap: null,
    overUnder: null,
    consensus: null,
    bookmakerCount: match.bookmakers.length,
  }

  // 1. 从 Pinnacle 提取 1X2 隐含概率
  const pinnacle = match.bookmakers.find(b => b.key === 'pinnacle')
  if (pinnacle) {
    const h2h = pinnacle.markets.find(m => m.key === 'h2h')
    if (h2h) {
      const homeOut = h2h.outcomes.find(o => o.name === match.home_team)
      const awayOut = h2h.outcomes.find(o => o.name === match.away_team)
      const drawOut = h2h.outcomes.find(o => o.name === 'Draw')
      if (homeOut && awayOut && drawOut) {
        const [h, d, a] = removeOverround([homeOut.price, drawOut.price, awayOut.price])
        result.spfImpliedProb = { home: +h.toFixed(3), draw: +d.toFixed(3), away: +a.toFixed(3) }
      }
    }

    // 2. Pinnacle 亚盘 (spreads)
    const spreads = pinnacle.markets.find(m => m.key === 'spreads')
    if (spreads && spreads.outcomes.length >= 2) {
      const o1 = spreads.outcomes[0], o2 = spreads.outcomes[1]
      result.asianHandicap = {
        line: o1.point || 0,
        home: o1.point! < 0 ? o1.price : o2.price,
        away: o1.point! < 0 ? o2.price : o1.price,
      }
    }

    // 3. Pinnacle 大小球 (totals)
    const totals = pinnacle.markets.find(m => m.key === 'totals')
    if (totals && totals.outcomes.length >= 2) {
      const over = totals.outcomes.find(o => o.name === 'Over')
      const under = totals.outcomes.find(o => o.name === 'Under')
      if (over && under) {
        result.overUnder = { line: over.point || 2.5, over: over.price, under: under.price }
      }
    }
  }

  // 4. 如果没有 Pinnacle，尝试 Betfair Exchange
  if (!result.spfImpliedProb) {
    const betfair = match.bookmakers.find(b => b.key === 'betfair_ex_eu')
    if (betfair) {
      const h2h = betfair.markets.find(m => m.key === 'h2h')
      if (h2h) {
        const homeOut = h2h.outcomes.find(o => o.name === match.home_team)
        const awayOut = h2h.outcomes.find(o => o.name === match.away_team)
        const drawOut = h2h.outcomes.find(o => o.name === 'Draw')
        if (homeOut && awayOut && drawOut) {
          // Betfair 抽水极低，直接转概率
          result.spfImpliedProb = {
            home: +(1 / homeOut.price).toFixed(3),
            draw: +(1 / drawOut.price).toFixed(3),
            away: +(1 / awayOut.price).toFixed(3),
          }
        }
      }
    }
  }

  // 5. 计算市场共识度（所有博彩公司主胜概率的标准差）
  const allHomeProbs: number[] = []
  for (const bk of match.bookmakers) {
    const h2h = bk.markets.find(m => m.key === 'h2h')
    if (h2h) {
      const ho = h2h.outcomes.find(o => o.name === match.home_team)
      if (ho) allHomeProbs.push(1 / ho.price)
    }
  }
  if (allHomeProbs.length >= 3) {
    const mean = allHomeProbs.reduce((s, v) => s + v, 0) / allHomeProbs.length
    const variance = allHomeProbs.reduce((s, v) => s + (v - mean) ** 2, 0) / allHomeProbs.length
    result.consensus = +Math.sqrt(variance).toFixed(4)
  }

  return result
}
