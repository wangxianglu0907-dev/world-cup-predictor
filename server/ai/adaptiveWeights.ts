/**
 * 自适应动态权重引擎
 * 
 * 核心问题：固定权重下，赔率波动5% → 最终预测只动1.75%，完全无感
 * 解决方案：
 *   1. 信号放大 → 大变化非线性增强（sigmoid）
 *   2. 动态权重 → 哪个因子变化大，就给它更大发言权
 *   3. 突破阈值 → 某个因子变化超过阈值，自动升级为"主导因子"
 *   4. 置信度追踪 → 记录每次更新的变化幅度
 */

export interface AdaptiveResult {
  home: number
  draw: number  
  away: number
  /** 该预测的可信度 (0-1)：越高=市场越确定 */
  confidence: number
  /** 与上次相比的变化幅度 (0-1) */
  changeMagnitude: number
  /** 当前处于什么模式 */
  mode: 'stable' | 'shifting' | 'breakout'
  /** 各因子当前权重 */
  weights: {
    odds: number
    strength: number
    squad: number
    external: number
    form: number
    tactical: number
    h2h: number
  }
  /** 哪些因子触发了变化 */
  triggers: string[]
}

interface FactorInput {
  name: string
  current: { home: number; draw: number; away: number }
  previous: { home: number; draw: number; away: number } | null
  baseWeight: number
  /** 该因子的最大权重上限 */
  maxWeight: number
}

/**
 * 计算单个因子的变化幅度 (0-1)
 * 使用 KL 散度近似：sum(p * log(p/q))
 */
function factorChange(curr: FactorInput['current'], prev: FactorInput['previous'] | null): number {
  if (!prev) return 0
  let change = 0
  // 使用欧氏距离 + 方向敏感度
  const homeDiff = Math.abs(curr.home - prev.home)
  const awayDiff = Math.abs(curr.away - prev.away)
  const drawDiff = Math.abs(curr.draw - prev.draw)
  // 方向变化更敏感
  const homeDir = (curr.home - 0.5) * (prev.home - 0.5) < 0 ? 0.1 : 0
  change = Math.sqrt(homeDiff ** 2 + awayDiff ** 2 + drawDiff ** 2) * 2 + homeDir
  return Math.min(1, change)
}

/**
 * 信号放大函数：小变化线性，大变化指数级
 */
function amplify(x: number): number {
  if (x < 0.03) return x           // 微小变化：线性
  if (x < 0.08) return x * 1.5    // 中等变化：1.5x
  if (x < 0.15) return x * 2.5    // 显著变化：2.5x
  return x * 4.0                   // 剧烈变化：4x
}

/**
 * 自适应权重计算
 * @param factors 各因子当前/上次/基础权重
 * @returns 动态调整后的权重和综合预测
 */
export function adaptivePredict(factors: FactorInput[]): AdaptiveResult {
  const result: AdaptiveResult = {
    home: 0, draw: 0, away: 0, confidence: 0, changeMagnitude: 0,
    mode: 'stable', triggers: [],
    weights: { odds: 0, strength: 0, squad: 0, external: 0, form: 0, tactical: 0, h2h: 0 },
  }

  // 1. 计算每个因子的变化幅度
  const changes = factors.map(f => ({
    ...f,
    rawChange: factorChange(f.current, f.previous),
  }))

  // 2. 信号放大
  const amplified = changes.map(f => ({
    ...f,
    amplifiedChange: amplify(f.rawChange),
  }))

  // 3. 检测是否有突破性变化 (>15%)
  const maxChange = Math.max(...amplified.map(f => f.amplifiedChange))
  const totalChange = amplified.reduce((s, f) => s + f.amplifiedChange, 0)

  if (maxChange > 0.15) {
    result.mode = 'breakout'
    // 找出变化最大的因子
    const top = amplified.reduce((a, b) => a.amplifiedChange > b.amplifiedChange ? a : b)
    result.triggers.push(`${top.name}因子剧烈变化(${(top.amplifiedChange*100).toFixed(1)}%)，切换为突破模式`)
  } else if (totalChange > 0.15) {
    result.mode = 'shifting'
    result.triggers.push(`多因子同时变化，总幅度${(totalChange*100).toFixed(1)}%`)
  }

  // 4. 动态权重分配
  const weightMap: Record<string, number> = {}
  let totalWeight = 0

  for (const f of amplified) {
    if (result.mode === 'breakout') {
      // 突破模式：变化最大的因子获得 50%+ 权重
      if (f.amplifiedChange === maxChange) {
        weightMap[f.name] = f.baseWeight * (1 + f.amplifiedChange * 15)  // 大幅提升
      } else {
        weightMap[f.name] = f.baseWeight * (1 - f.amplifiedChange * 3)   // 其他因子降权
      }
    } else if (result.mode === 'shifting') {
      // 波动模式：按变化幅度等比调整
      const boost = 1 + f.amplifiedChange * 5
      weightMap[f.name] = f.baseWeight * Math.min(boost, f.maxWeight / f.baseWeight)
    } else {
      // 稳定模式：基础权重
      weightMap[f.name] = f.baseWeight
    }
    totalWeight += weightMap[f.name]
  }

  // 归一化权重
  for (const f of amplified) {
    const normalized = weightMap[f.name] / totalWeight
    const key = f.name as keyof typeof result.weights
    result.weights[key] = +normalized.toFixed(3)
  }

  // 5. 加权计算最终预测
  let home = 0, draw = 0, away = 0
  for (const f of amplified) {
    const w = result.weights[f.name as keyof typeof result.weights]
    home += f.current.home * w
    draw += f.current.draw * w
    away += f.current.away * w
  }

  // 归一化
  const total = home + draw + away
  result.home = +(home / total).toFixed(3)
  result.draw = +(draw / total).toFixed(3)
  result.away = +(away / total).toFixed(3)

  // 6. 置信度和变化幅度
  const maxP = Math.max(result.home, result.draw, result.away)
  result.confidence = +(maxP * (1 - maxChange * 0.5)).toFixed(2) // 变化越大，置信度越低
  result.changeMagnitude = +totalChange.toFixed(4)

  return result
}

/**
 * 输出人类可读的权重变化报告
 */
export function formatWeightReport(result: AdaptiveResult): string {
  const lines: string[] = []
  
  const modeLabels: Record<string, string> = {
    stable: '🟢 稳定模式 — 所有因子按基础权重运行',
    shifting: '🟡 波动模式 — 检测到多因子变化，权重动态调整',
    breakout: '🔴 突破模式 — 某因子出现剧烈变化，已自动升级为决策主导',
  }
  lines.push(modeLabels[result.mode])
  lines.push('')
  
  lines.push('当前权重分配:')
  for (const [k, v] of Object.entries(result.weights)) {
    const label: Record<string, string> = {
      odds: '赔率市场', strength: '球队实力', squad: '阵容身价',
      external: '外部环境', form: '赛前状态', tactical: '技战术', h2h: '历史交锋',
    }
    const bar = '█'.repeat(Math.round(v * 30))
    lines.push(`  ${label[k] || k}: ${bar} ${(v*100).toFixed(0)}%`)
  }
  
  if (result.triggers.length > 0) {
    lines.push('')
    lines.push('触发信号:')
    for (const t of result.triggers) lines.push(`  ⚡ ${t}`)
  }

  if (result.changeMagnitude > 0.05) {
    lines.push('')
    lines.push(`⚠️ 预测较上次变动 ${(result.changeMagnitude * 100).toFixed(1)}%，建议关注`)
  }

  return lines.join('\n')
}

// ============ 外部事件驱动重权重 ============

export interface EventAdjustedResult extends AdaptiveResult {
  /** 外部事件覆盖标记 */
  eventOverrides: string[]
  /** 事件导致的额外权重偏移 */
  eventWeightShift: number
}

/**
 * 应用外部事件到自适应结果
 * 伤病/天气/海拔/时差等事件强制修改权重和预测
 */
export function applyExternalEvents(
  base: AdaptiveResult,
  events: ExternalEvent[],
  weather: WeatherDelta | null,
): EventAdjustedResult {
  const result: EventAdjustedResult = { ...base, eventOverrides: [], eventWeightShift: 0 }

  for (const evt of events) {
    const impact = evt.severity / 10 // 0-1

    switch (evt.type) {
      case 'injury':
      case 'suspension': {
        // 核心球员伤病 → 降低该队实力因子，提升赔率因子（市场反应最快）
        const label = evt.type === 'injury' ? '伤病' : '停赛'
        result.weights.strength *= (1 - impact * 0.4)
        result.weights.odds *= (1 + impact * 0.3)
        result.weights.form *= (1 - impact * 0.2)
        result.eventWeightShift += impact * 0.15
        result.triggers.push(`${label}: ${evt.description} (影响等级${evt.severity}/10)`)
        result.eventOverrides.push(`${label}→降低实力权重+提升赔率权重`)
        // 若目标队是热门方，降低其胜率
        if (evt.target === 'home') {
          result.home = Math.max(0.05, +(result.home - impact * 0.08).toFixed(3))
          result.away = Math.min(0.95, +(result.away + impact * 0.05).toFixed(3))
        } else {
          result.away = Math.max(0.05, +(result.away - impact * 0.08).toFixed(3))
          result.home = Math.min(0.95, +(result.home + impact * 0.05).toFixed(3))
        }
        break
      }

      case 'weather_alert': {
        // 极端天气 → 外部环境因子权重翻倍，赔率因子降权
        result.weights.external *= (1 + impact * 0.5)
        result.weights.odds *= (1 - impact * 0.2)
        result.eventWeightShift += impact * 0.10
        result.triggers.push(`天气预警: ${evt.description}`)
        result.eventOverrides.push('极端天气→外部环境权重提升')
        break
      }

      case 'altitude_impact': {
        // 高原 → 外部环境因子大幅提升
        result.weights.external *= (1 + impact * 0.6)
        result.weights.strength *= (1 - impact * 0.2)
        result.weights.squad *= (1 - impact * 0.1)
        result.eventWeightShift += impact * 0.12
        result.triggers.push(`高原影响: ${evt.description}`)
        result.eventOverrides.push('高原场地→外部环境权重显著提升')
        break
      }

      case 'jet_lag':
      case 'travel_fatigue': {
        // 时差+旅途 → 降低状态因子，提升外部环境
        result.weights.form *= (1 - impact * 0.3)
        result.weights.external *= (1 + impact * 0.3)
        result.eventWeightShift += impact * 0.08
        result.triggers.push(`旅途影响: ${evt.description}`)
        result.eventOverrides.push('时差/旅途→状态因子降权+环境升权')
        if (evt.target === 'home') result.home = Math.max(0.05, +(result.home - impact * 0.04).toFixed(3))
        else result.away = Math.max(0.05, +(result.away - impact * 0.04).toFixed(3))
        break
      }

      case 'coach_change': {
        result.weights.tactical *= (1 + impact * 0.4)
        result.eventWeightShift += impact * 0.06
        result.triggers.push(`教练变动: ${evt.description}`)
        result.eventOverrides.push('教练变动→技战术权重提升')
        break
      }
    }
  }

  // 天气变化检测
  if (weather) {
    if (weather.hasWarning) {
      result.triggers.push(`⚠️ 极端天气预警: 温度变化${weather.tempChange > 0 ? '+' : ''}${weather.tempChange}°C，降雨概率${weather.rainProbability}%`)
      result.eventOverrides.push('极端天气→自动提升外部环境因子')
      result.weights.external *= 1.2
    } else if (Math.abs(weather.tempChange) > 8) {
      result.triggers.push(`温度显著变化 ${weather.tempChange > 0 ? '+' : ''}${weather.tempChange}°C`)
      result.weights.external *= 1.1
    }
    if (weather.windChange > 5) {
      result.triggers.push(`风速增大 +${weather.windChange}km/h，影响技术流球队`)
      result.weights.external *= 1.05
    }
  }

  // 重新归一化权重
  const total = Object.values(result.weights as Record<string, number>).reduce((s, v) => s + Math.max(0, v), 0)
  const keys = Object.keys(result.weights) as (keyof typeof result.weights)[]
  for (const k of keys) {
    result.weights[k] = +Math.max(0.01, (result.weights[k] / total)).toFixed(3)
  }

  // 重新归一化预测
  const pt = result.home + result.draw + result.away
  result.home = +(result.home / pt).toFixed(3)
  result.draw = +(result.draw / pt).toFixed(3)
  result.away = +(result.away / pt).toFixed(3)

  // 模式升级：如果事件权重偏移 > 0.15，升级为突破模式
  if (result.eventWeightShift > 0.15 && result.mode !== 'breakout') {
    result.mode = 'breakout'
    result.triggers.push('外部事件触发突破模式')
  }

  return result
}

/** 获取当前比赛的外部事件（模拟-待对接真实数据源） */
export function collectExternalEvents(
  homeTeam: string, awayTeam: string,
  altitude: number, temperature: number, humidity: number,
): ExternalEvent[] {
  const events: ExternalEvent[] = []

  // 高原检测
  if (altitude > 2000) {
    const nonAmericas = ['英格兰','法国','德国','西班牙','意大利','葡萄牙','荷兰','比利时','丹麦','瑞典','挪威','波兰','瑞士','克罗地亚','塞尔维亚']
    if (nonAmericas.includes(homeTeam)) {
      events.push({ type: 'altitude_impact', target: 'home', severity: 6, description: `${homeTeam}在${altitude}m高原作战`, timestamp: new Date().toISOString() })
    }
    if (nonAmericas.includes(awayTeam)) {
      events.push({ type: 'altitude_impact', target: 'away', severity: 6, description: `${awayTeam}在${altitude}m高原作战`, timestamp: new Date().toISOString() })
    }
  }

  // 高温检测
  if (temperature > 30 && humidity > 70) {
    const nonTropical = ['英格兰','法国','德国','西班牙','意大利','荷兰','波兰','瑞典','挪威','丹麦']
    if (nonTropical.includes(homeTeam)) {
      events.push({ type: 'weather_alert', target: 'home', severity: 4, description: `${homeTeam}面临高温${temperature}°C+高湿${humidity}%`, timestamp: new Date().toISOString() })
    }
    if (nonTropical.includes(awayTeam)) {
      events.push({ type: 'weather_alert', target: 'away', severity: 4, description: `${awayTeam}面临高温${temperature}°C+高湿${humidity}%`, timestamp: new Date().toISOString() })
    }
  }

  // 东道主旅途优势
  const hosts = ['美国', '加拿大', '墨西哥']
  const nonHosts = [homeTeam, awayTeam].filter(t => !hosts.includes(t))
  if (nonHosts.length > 0) {
    events.push({
      type: 'travel_fatigue', target: nonHosts.length === 2 ? 'both' : (nonHosts[0] === homeTeam ? 'home' : 'away'),
      severity: 2, description: `${nonHosts.join('、')}长途跋涉赴美参赛`,
      timestamp: new Date().toISOString(),
    })
  }

  return events
}
