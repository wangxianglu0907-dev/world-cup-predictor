/**
 * 赛前 xG 预估引擎
 * xG = Expected Goals，实际比赛后才从 StatsBomb 获取精确值
 * 赛前基于赔率、排名、天气等推算预估 xG
 */

/** 2022世界杯场均xG参考（基于 StatsBomb Open Data） */
const HISTORICAL_XG: Record<string, { gf: number; ga: number; xg: number; xga: number }> = {
  '阿根廷': { gf: 2.14, ga: 0.57, xg: 1.85, xga: 0.72 },
  '法国': { gf: 2.29, ga: 1.14, xg: 1.78, xga: 0.95 },
  '巴西': { gf: 1.80, ga: 0.60, xg: 1.62, xga: 0.68 },
  '英格兰': { gf: 2.60, ga: 0.80, xg: 2.10, xga: 0.85 },
  '西班牙': { gf: 2.25, ga: 0.75, xg: 1.90, xga: 0.70 },
  '葡萄牙': { gf: 2.40, ga: 0.80, xg: 2.05, xga: 0.78 },
  '荷兰': { gf: 2.00, ga: 0.80, xg: 1.70, xga: 0.75 },
  '德国': { gf: 2.00, ga: 1.33, xg: 2.10, xga: 1.15 },
  '克罗地亚': { gf: 1.14, ga: 1.00, xg: 1.05, xga: 0.92 },
  '摩洛哥': { gf: 0.86, ga: 0.71, xg: 0.82, xga: 0.88 },
  '日本': { gf: 1.25, ga: 1.00, xg: 1.10, xga: 0.95 },
  '韩国': { gf: 1.25, ga: 1.75, xg: 1.15, xga: 1.50 },
  '美国': { gf: 0.75, ga: 0.75, xg: 0.82, xga: 0.78 },
  '墨西哥': { gf: 0.67, ga: 1.00, xg: 0.75, xga: 0.90 },
  '塞内加尔': { gf: 1.25, ga: 1.75, xg: 1.20, xga: 1.45 },
  '澳大利亚': { gf: 1.00, ga: 1.25, xg: 0.90, xga: 1.10 },
  '卡塔尔': { gf: 0.33, ga: 2.33, xg: 0.45, xga: 1.95 },
  '瑞士': { gf: 1.25, ga: 0.75, xg: 1.10, xga: 0.82 },
  '丹麦': { gf: 0.33, ga: 1.00, xg: 0.68, xga: 0.95 },
  '波兰': { gf: 0.75, ga: 1.25, xg: 0.72, xga: 1.10 },
  '比利时': { gf: 0.33, ga: 1.00, xg: 0.55, xga: 1.10 },
  '乌拉圭': { gf: 0.67, ga: 0.67, xg: 0.82, xga: 0.72 },
  '加拿大': { gf: 0.67, ga: 2.33, xg: 0.78, xga: 1.85 },
  '加纳': { gf: 1.67, ga: 2.33, xg: 1.45, xga: 1.90 },
  '喀麦隆': { gf: 1.33, ga: 1.33, xg: 1.20, xga: 1.25 },
  '塞尔维亚': { gf: 1.67, ga: 2.67, xg: 1.40, xga: 2.10 },
  '哥斯达黎加': { gf: 1.00, ga: 3.67, xg: 0.85, xga: 2.80 },
  '突尼斯': { gf: 0.33, ga: 0.67, xg: 0.42, xga: 0.68 },
  '威尔士': { gf: 0.33, ga: 2.00, xg: 0.55, xga: 1.65 },
  '厄瓜多尔': { gf: 1.33, ga: 1.00, xg: 1.15, xga: 0.95 },
  '伊朗': { gf: 1.33, ga: 2.33, xg: 1.10, xga: 1.80 },
  '沙特阿拉伯': { gf: 1.00, ga: 1.67, xg: 0.72, xga: 1.35 },
}

export interface XgEstimate {
  homeXg: number
  awayXg: number
  homePossession: number
  awayPossession: number
  homeShots: number
  awayShots: number
  homeShotsOnTarget: number
  awayShotsOnTarget: number
  analysis: string
  source: string
}

/**
 * 赛前预估 xG
 * @param homeTeam 主队名
 * @param awayTeam 客队名  
 * @param homeWinProb 主胜概率
 * @param expectedTotalGoals 预期总进球（大小球盘口）
 */
export function estimateXg(
  homeTeam: string, awayTeam: string,
  homeWinProb: number, expectedTotalGoals: number,
  altitude: number, temperature: number,
): XgEstimate {
  const homeHist = HISTORICAL_XG[homeTeam] || { gf: 1.5, ga: 1.5, xg: 1.3, xga: 1.3 }
  const awayHist = HISTORICAL_XG[awayTeam] || { gf: 1.5, ga: 1.5, xg: 1.3, xga: 1.3 }

  // 基于历史 xG + 概率 + 盘口推算
  const homeProb = Math.max(0.1, homeWinProb)
  const awayProb = Math.max(0.1, 1 - homeWinProb - 0.25)

  // 基础 xG = 历史场均 xG + 概率修正
  let homeXg = homeHist.xg * 0.6 + (homeProb * expectedTotalGoals) * 0.4
  let awayXg = awayHist.xg * 0.6 + (awayProb * expectedTotalGoals) * 0.4

  // 高原修正
  if (altitude > 1500) {
    homeXg *= 0.90
    awayXg *= 0.85
  }

  // 高温修正
  if (temperature > 30) {
    homeXg *= 0.92
    awayXg *= 0.88
  } else if (temperature > 25) {
    // warm -> slightly higher scoring
    homeXg *= 1.03
    awayXg *= 1.03
  }

  // 确保总 xG 接近盘口线
  const totalXg = homeXg + awayXg
  if (Math.abs(totalXg - expectedTotalGoals) > 0.5) {
    const scale = expectedTotalGoals / totalXg
    homeXg *= scale
    awayXg *= scale
  }

  // 推算控球率
  const homePossession = Math.round(45 + homeProb * 15)
  const awayPossession = 100 - homePossession

  // 射门次数 (xG * 8~10)
  const homeShots = Math.round(homeXg * 9 + Math.random() * 3)
  const awayShots = Math.round(awayXg * 9 + Math.random() * 3)

  return {
    homeXg: +homeXg.toFixed(2),
    awayXg: +awayXg.toFixed(2),
    homePossession,
    awayPossession,
    homeShots,
    awayShots,
    homeShotsOnTarget: Math.round(homeShots * 0.35),
    awayShotsOnTarget: Math.round(awayShots * 0.32),
    analysis: `赛前预估：${homeTeam} 预期进球 ${homeXg.toFixed(2)}，${awayTeam} ${awayXg.toFixed(2)}。基于2022世界杯历史xG数据+当前赔率推算，赛后将从StatsBomb获取精确xG。`,
    source: '2022世界杯历史数据 + 赔率推算',
  }
}
