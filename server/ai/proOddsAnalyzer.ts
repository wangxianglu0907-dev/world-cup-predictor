/**
 * 专业盘口分析引擎
 * 
 * 9大操盘信号:
 * 1. 欧赔初终对比    — 初盘vs即时盘偏离度
 * 2. 亚盘水位分析    — 高低水判断+水位变化速率
 * 3. 阻盘信号        — 逆市场操作的盘口调整
 * 4. 诱盘信号        — 深盘高水/浅盘低水诱饵
 * 5. 拉力盘识别      — 单边资金持续性+方向
 * 6. 交叉盘联动      — 欧赔/亚盘/大小球一致性
 * 7. 升盘信号        — 让球深度增加的含义
 * 8. 降盘信号        — 让球深度减小的含义
 * 9. 凯利指数        — 博彩公司盈亏平衡点
 */

interface OddsSnapshot {
  timestamp: string
  homeWin: number
  draw: number
  awayWin: number
  asianLine: number
  asianHomePrice: number
  asianAwayPrice: number
  overUnderLine: number
  overPrice: number
  underPrice: number
}

export interface ProOddsAnalysis {
  // 1. 欧赔初终
  openingOdds: { home: number; draw: number; away: number } | null
  currentOdds: { home: number; draw: number; away: number } | null
  oddsChange: { homeChange: number; drawChange: number; awayChange: number; direction: string }

  // 2. 亚盘水位
  asianWater: { line: number; homeWater: number; awayWater: number; waterSignal: string }

  // 3. 阻盘分析
  blockingSignal: { detected: boolean; strength: 'none' | 'mild' | 'strong'; reason: string }

  // 4. 诱盘分析
  trapSignal: { detected: boolean; trapType: string; trapTarget: string; reason: string }

  // 5. 拉力盘
  momentumSignal: { direction: string; strength: number; continuous: boolean }

  // 6. 交叉盘联动
  crossMarket: { consistency: 'high' | 'medium' | 'low'; divergence: string }

  // 7. 升盘
  upgradeSignal: { detected: boolean; from: number; to: number; meaning: string }

  // 8. 降盘
  downgradeSignal: { detected: boolean; from: number; to: number; meaning: string }

  // 9. 凯利指数
  kelly: { homeKelly: number; drawKelly: number; awayKelly: number; interpretation: string }

  // 综合操盘解读
  overallSignal: string
  signalScore: number   // -10 到 +10, 正=看好主队, 负=看好客队
}

/**
 * 从单次 Odds API 数据生成专业分析
 * 首次调用记录为"初盘"，后续调用对比
 */
export function analyzeProfessional(
  current: OddsSnapshot,
  opening: OddsSnapshot | null,
): ProOddsAnalysis {
  const result: ProOddsAnalysis = {
    openingOdds: null, currentOdds: null,
    oddsChange: { homeChange: 0, drawChange: 0, awayChange: 0, direction: 'stable' },
    asianWater: { line: current.asianLine, homeWater: current.asianHomePrice, awayWater: current.asianAwayPrice, waterSignal: 'unknown' },
    blockingSignal: { detected: false, strength: 'none', reason: '' },
    trapSignal: { detected: false, trapType: '', trapTarget: '', reason: '' },
    momentumSignal: { direction: 'neutral', strength: 0, continuous: false },
    crossMarket: { consistency: 'medium', divergence: '' },
    upgradeSignal: { detected: false, from: 0, to: 0, meaning: '' },
    downgradeSignal: { detected: false, from: 0, to: 0, meaning: '' },
    kelly: { homeKelly: 0, drawKelly: 0, awayKelly: 0, interpretation: '' },
    overallSignal: '', signalScore: 0,
  }

  // ========== 1. 欧赔初终对比 ==========
  const curHome = current.homeWin, curDraw = current.draw, curAway = current.awayWin
  result.currentOdds = { home: curHome, draw: curDraw, away: curAway }

  if (opening) {
    result.openingOdds = { home: opening.homeWin, draw: opening.draw, away: opening.awayWin }
    
    const hc = (opening.homeWin - curHome) / opening.homeWin  // 降赔 = 正
    const dc = (opening.draw - curDraw) / opening.draw
    const ac = (opening.awayWin - curAway) / opening.awayWin

    result.oddsChange = {
      homeChange: +hc.toFixed(3), drawChange: +dc.toFixed(3), awayChange: +ac.toFixed(3),
      direction: hc > 0.05 ? '主胜赔率大幅下降' : ac > 0.05 ? '客胜赔率大幅下降'
        : hc > 0.02 ? '主胜赔率下降' : ac > 0.02 ? '客胜赔率下降'
        : Math.abs(hc) < 0.02 && Math.abs(ac) < 0.02 ? '稳定' : '波动中',
    }
  }

  // ========== 2. 亚盘水位分析 ==========
  const { line, homeWater, awayWater } = current
  // 水位判断: <1.80=低水, 1.80-1.95=中水, >1.95=高水
  const hwl = homeWater < 1.80 ? '低水' : homeWater < 1.95 ? '中水' : '高水'
  const awl = awayWater < 1.80 ? '低水' : awayWater < 1.95 ? '中水' : '高水'
  result.asianWater.waterSignal = `主队${hwl}(${homeWater}) / 客队${awl}(${awayWater})`

  // ========== 3. 阻盘分析 ==========
  // 阻盘特征: 让球方赔率不降反升 OR 受让方赔率异常低
  if (line < -1 && homeWater > 2.0) {
    result.blockingSignal = { detected: true, strength: 'strong', reason: '深盘高水阻上，主队让球过深但水位过高，可能是阻盘信号' }
  } else if (line < -0.5 && homeWater > 1.95) {
    result.blockingSignal = { detected: true, strength: 'mild', reason: '让球方水位偏高，存在阻买意图' }
  }

  // ========== 4. 诱盘分析 ==========
  // 诱盘特征1: 浅盘低水 + 赔率走热 = 诱上
  if (line < -0.25 && line > -0.5) {
    if (homeWater < 1.80 && result.oddsChange.homeChange > 0.03) {
      result.trapSignal = { detected: true, trapType: '浅盘低水诱上', trapTarget: '主队', reason: '让球偏浅但水位过低+赔率走热，典型的诱上盘' }
    }
  }
  // 诱盘特征2: 深盘高水 = 诱上
  if (line < -1.5 && homeWater > 2.05) {
    result.trapSignal = { detected: true, trapType: '深盘高水诱上', trapTarget: '主队', reason: '让球过深但水位超过2.05，诱使投注主队' }
  }
  // 诱盘特征3: 平手盘高水一方
  if (line === 0 && (homeWater > 2.0 || awayWater > 2.0)) {
    result.trapSignal = { detected: true, trapType: '平手盘高水诱饵', trapTarget: homeWater > 2.0 ? '主队' : '客队', reason: '平手盘异常高水，可能是诱盘' }
  }

  // ========== 5. 拉力盘 ==========
  if (result.oddsChange.homeChange > 0.05) {
    result.momentumSignal = { direction: '主队', strength: Math.min(result.oddsChange.homeChange * 10, 10), continuous: result.oddsChange.homeChange > 0.08 }
  } else if (result.oddsChange.awayChange > 0.05) {
    result.momentumSignal = { direction: '客队', strength: Math.min(result.oddsChange.awayChange * 10, 10), continuous: result.oddsChange.awayChange > 0.08 }
  } else if (result.oddsChange.homeChange > 0.02) {
    result.momentumSignal = { direction: '主队偏强', strength: 5, continuous: false }
  } else if (result.oddsChange.awayChange > 0.02) {
    result.momentumSignal = { direction: '客队偏强', strength: 5, continuous: false }
  }

  // ========== 6. 交叉盘联动 ==========
  // 欧赔主胜方向 与 亚盘让球方向 是否一致
  const oddsFavorHome = curHome < curAway && curHome < curDraw
  const asianFavorHome = line < 0
  
  if (oddsFavorHome === asianFavorHome) {
    result.crossMarket = { consistency: 'high', divergence: '' }
  } else if (line === 0) {
    result.crossMarket = { consistency: 'medium', divergence: '平手盘，欧亚市场等待方向确认' }
  } else {
    result.crossMarket = { consistency: 'low', divergence: `欧赔${oddsFavorHome ? '看好主队' : '主队不占优'}但亚盘${asianFavorHome ? '主队让球' : '主队受让'}，存在矛盾` }
  }

  // ========== 7. 升盘信号 ==========
  if (opening && opening.asianLine < current.asianLine) {
    // 让球增加 = 升盘
    const diff = current.asianLine - opening.asianLine
    result.upgradeSignal = {
      detected: true, from: opening.asianLine, to: current.asianLine,
      meaning: diff >= 0.5 ? `大幅升盘${diff}球，机构对让球方信心显著增强`
        : `小幅升盘${diff}球，市场方向确认`,
    }
  }

  // ========== 8. 降盘信号 ==========
  if (opening && opening.asianLine > current.asianLine) {
    const diff = opening.asianLine - current.asianLine
    result.downgradeSignal = {
      detected: true, from: opening.asianLine, to: current.asianLine,
      meaning: diff >= 0.5 ? `大幅降盘${diff}球，机构对让球方信心减弱，警惕爆冷`
        : `小幅降盘${diff}球，上盘热度可能不足`,
    }
  }

  // ========== 9. 凯利指数 ==========
  // K = (赔率 × 预估概率 - 1) / (赔率 - 1)
  // 简易版：用隐含概率替代预测概率
  const impHome = 1 / curHome, impDraw = 1 / curDraw, impAway = 1 / curAway
  const totalImp = impHome + impDraw + impAway
  const fairHome = impHome / totalImp, fairDraw = impDraw / totalImp, fairAway = impAway / totalImp

  result.kelly = {
    homeKelly: +((curHome * fairHome - 1) / (curHome - 1)).toFixed(4),
    drawKelly: +((curDraw * fairDraw - 1) / (curDraw - 1)).toFixed(4),
    awayKelly: +((curAway * fairAway - 1) / (curAway - 1)).toFixed(4),
    interpretation: '',
  }
  const maxK = Math.max(result.kelly.homeKelly, result.kelly.drawKelly, result.kelly.awayKelly)
  result.kelly.interpretation = maxK > 0.05 ? '凯利指数显示存在正向价值' : maxK > 0 ? '微弱正向' : '凯利指数为负，博彩公司利润锁定'

  // ========== 综合操盘解读 ==========
  let signalScore = 0
  const signals: string[] = []

  // 欧赔走势
  if (result.oddsChange.homeChange > 0.03) { signalScore += 2; signals.push('欧赔主胜降') }
  else if (result.oddsChange.homeChange < -0.03) { signalScore -= 2; signals.push('欧赔主胜升') }
  if (result.oddsChange.awayChange > 0.03) { signalScore -= 2; signals.push('欧赔客胜降') }

  // 亚盘升降
  if (result.upgradeSignal.detected) { signalScore += 2; signals.push('升盘') }
  if (result.downgradeSignal.detected) { signalScore -= 2; signals.push('降盘') }

  // 水位
  if (homeWater < 1.85) { signalScore += 1; signals.push('主低水') }
  if (awayWater < 1.85) { signalScore -= 1; signals.push('客低水') }

  // 诱盘/阻盘
  if (result.trapSignal.detected) {
    if (result.trapSignal.trapTarget === '主队') { signalScore -= 3; signals.push('诱主') }
    else { signalScore += 3; signals.push('诱客') }
  }
  if (result.blockingSignal.detected) {
    signalScore -= 2; signals.push('阻盘')
  }

  // 交叉盘不一致
  if (result.crossMarket.consistency === 'low') {
    signalScore += (signalScore > 0 ? -2 : 2) // 朝向中立修正
    signals.push('交叉盘矛盾')
  }

  result.signalScore = Math.max(-10, Math.min(10, signalScore))

  if (result.signalScore >= 5) result.overallSignal = '🟢 多项信号一致看好主队'
  else if (result.signalScore >= 2) result.overallSignal = '🟢 操盘信号偏主队'
  else if (result.signalScore <= -5) result.overallSignal = '🔴 多项信号一致看衰主队，警惕爆冷'
  else if (result.signalScore <= -2) result.overallSignal = '🔴 操盘信号偏客队'
  else result.overallSignal = '⚪ 信号中性，盘口无明显倾向'

  return result
}

/** 生成专业盘口解读报告 */
export function formatProReport(analysis: ProOddsAnalysis): string {
  const lines: string[] = ['【专业盘口分析 · 9维度操盘解读】', '']

  // 欧赔
  if (analysis.openingOdds && analysis.currentOdds) {
    lines.push(`📊 欧赔初终: 初盘主${analysis.openingOdds.home}平${analysis.openingOdds.draw}客${analysis.openingOdds.away} → 即时主${analysis.currentOdds.home}平${analysis.currentOdds.draw}客${analysis.currentOdds.away}`)
    lines.push(`  走势: ${analysis.oddsChange.direction} (主${analysis.oddsChange.homeChange > 0 ? '↓' : '↑'}${Math.abs(analysis.oddsChange.homeChange)*100}% 客${analysis.oddsChange.awayChange > 0 ? '↓' : '↑'}${Math.abs(analysis.oddsChange.awayChange)*100}%)`)
    lines.push('')
  }

  // 亚盘
  lines.push(`🌊 亚盘水位: 让球${analysis.asianWater.line} | ${analysis.asianWater.waterSignal}`)
  if (analysis.upgradeSignal.detected) lines.push(`  ⬆ ${analysis.upgradeSignal.meaning}`)
  if (analysis.downgradeSignal.detected) lines.push(`  ⬇ ${analysis.downgradeSignal.meaning}`)
  lines.push('')

  // 诱盘/阻盘
  if (analysis.trapSignal.detected) lines.push(`⚠️ 诱盘预警: ${analysis.trapSignal.reason}`)
  if (analysis.blockingSignal.detected) lines.push(`🛑 阻盘信号: ${analysis.blockingSignal.reason}`)
  if (analysis.trapSignal.detected || analysis.blockingSignal.detected) lines.push('')

  // 拉力
  if (analysis.momentumSignal.strength > 0) {
    lines.push(`💪 拉力分析: ${analysis.momentumSignal.direction}方向拉力 ${analysis.momentumSignal.strength}/10 ${analysis.momentumSignal.continuous ? '(持续性)' : ''}`)
    lines.push('')
  }

  // 交叉盘
  lines.push(`🔗 交叉盘联动: 欧亚一致性${analysis.crossMarket.consistency === 'high' ? '✅高' : analysis.crossMarket.consistency === 'medium' ? '⚠中' : '❌低'}${analysis.crossMarket.divergence ? ' - ' + analysis.crossMarket.divergence : ''}`)
  lines.push('')

  // 凯利
  lines.push(`📐 凯利指数: 主${analysis.kelly.homeKelly > 0 ? '+' : ''}${(analysis.kelly.homeKelly*100).toFixed(2)}% 平${(analysis.kelly.drawKelly*100).toFixed(2)}% 客${(analysis.kelly.awayKelly*100).toFixed(2)}% | ${analysis.kelly.interpretation}`)
  lines.push('')

  // 综合
  lines.push(`🎯 综合操盘解读: ${analysis.overallSignal} (信号分: ${analysis.signalScore > 0 ? '+' : ''}${analysis.signalScore})`)

  return lines.join('\n')
}
