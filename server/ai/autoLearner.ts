/**
 * 赛后自动学习引擎
 *
 * 6项全闭环：
 *  ① 训练集自动追加
 *  ② 每24场触发重训练
 *  ③ 概率校准更新
 *  ④ 爆冷系数校准
 *  ⑤ 泊松λ参数更新
 *  ⑥ 版本自动切换
 */

import { getDB } from '../db.js'

// ========== ① 训练集自动追加 ==========

/** 将已结束比赛追加到训练集 */
export function appendToTraining(matchId: number): void {
  const db = getDB()
  const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as any
  if (!m || m.status !== 'FINISHED') return

  // 检查是否已存在
  const exists = db.prepare('SELECT id FROM training_matches WHERE match_id = ?').get(matchId)
  if (exists) return

  const ht = db.prepare('SELECT name, fifa_ranking FROM teams WHERE id = ?').get(m.home_team_id) as any
  const at = db.prepare('SELECT name, fifa_ranking FROM teams WHERE id = ?').get(m.away_team_id) as any

  const pred = db.prepare('SELECT * FROM ai_predictions WHERE match_id = ? LIMIT 1').get(matchId) as any
  const spf = pred ? JSON.parse(pred.spf) : null

  const isDraw = m.home_score === m.away_score ? 1 : 0
  db.prepare(`INSERT INTO training_matches (
    match_id, home_team, away_team, home_score, away_score,
    match_date, time_weight, is_draw, tournament, tournament_type_old,
    home_rank, away_rank, home_odds, draw_odds, away_odds,
    home_model_prob, draw_model_prob, away_model_prob,
    stage, group_name
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    m.id, ht?.name || '', at?.name || '', m.home_score, m.away_score,
    m.start_time, 1.0, isDraw, 'WC2026', 'world_cup',
    ht?.fifa_ranking || 1500, at?.fifa_ranking || 1500,
    null, null, null,
    spf?.home || 0.5, spf?.draw || 0.25, spf?.away || 0.25,
    m.stage || 'GROUP', m.group_name || '',
  )

  console.log(`[自动学习] 训练集 +1: ${ht?.name} ${m.home_score}:${m.away_score} ${at?.name} (累计 ${countTraining()} 场)`)
}

export function countTraining(): number {
  const db = getDB()
  return (db.prepare('SELECT COUNT(*) as c FROM training_matches').get() as any).c
}

// ========== ② 自动重训练触发 ==========

/** 检查是否需要重训练（每24场触发一次） */
export function checkRetrain(newCount: number): boolean {
  const prevCount = (getDB().prepare("SELECT matches_trained FROM model_params WHERE version = 'current-auto' LIMIT 1").get() as any)?.matches_trained || 405
  const db = getDB()
  const trained = db.prepare("SELECT COUNT(DISTINCT matches_trained) as c FROM model_params WHERE version LIKE 'v%-auto%'").get() as any
  const retrainCount = trained?.c || 0

  // 每积累 24 场新数据，或首次达到 429 场
  const milestone = 405 + (retrainCount + 1) * 24
  return newCount >= milestone
}

/** 在最新训练集上重新运行网格搜索 */
export function retrainAndSave(): { version: string; accuracy: number; improvement: number } {
  const db = getDB()
  const matches = db.prepare('SELECT * FROM training_matches ORDER BY match_date ASC').all() as any[]
  const total = matches.length

  // 简化版网格搜索（针对3层实力差各自优化）
  const tiers = ['close', 'competitive', 'blowout'] as const
  const step = 0.05
  const allWeights: Record<string, any> = {}
  let bestGlobalAcc = 0

  for (const tier of tiers) {
    // 按实力差筛数据
    const tierMatches = matches.filter((m: any) => {
      const diff = Math.abs((m.home_rank || 1500) - (m.away_rank || 1500))
      if (tier === 'close') return diff <= 150
      if (tier === 'competitive') return diff > 150 && diff <= 350
      return diff > 350
    })

    if (tierMatches.length < 5) {
      allWeights[tier] = { weights: { odds: 0.35, strength: 0.20, squad: 0.15, external: 0.10, form: 0.10, tactical: 0.05, h2h: 0.05 }, accuracy: 0 }
      continue
    }

    // 网格搜索
    let bestW: any = null, bestAcc = 0
    for (let odds = 0.15; odds <= 0.45; odds += step) {
      for (let strength = 0.10; strength <= 0.35; strength += step) {
        for (let h2h = 0.03; h2h <= 0.25; h2h += step) {
          const rem = 1 - odds - strength - h2h
          if (rem < 0.15) continue
          const squad = +(rem * 0.30).toFixed(2)
          const external = +(rem * 0.30).toFixed(2)
          const form = +(rem * 0.25).toFixed(2)
          const tactical = +(1 - odds - strength - h2h - squad - external - form).toFixed(2)
          if (tactical <= 0) continue

          const w = { odds, strength, squad, external, form, tactical, h2h }
          let correct = 0
          for (const m of tierMatches) {
            const homeAdv = w.odds * (m.home_model_prob || 0.4) + w.strength * 0.5 + w.form * 0.5
            const actual = m.home_score > m.away_score ? 1 : m.home_score < m.away_score ? -1 : 0
            const predicted = homeAdv > 0.42 ? 1 : homeAdv < 0.38 ? -1 : 0
            if (actual === predicted) correct++
          }
          const acc = correct / tierMatches.length
          if (acc > bestAcc) { bestAcc = acc; bestW = w }
        }
      }
    }
    allWeights[tier] = { weights: bestW, accuracy: +(bestAcc).toFixed(3) }
    bestGlobalAcc = Math.max(bestGlobalAcc, bestAcc)
  }

  // 确定版本号
  const prevVersions = db.prepare("SELECT version FROM model_params WHERE version LIKE 'v%-auto%'").all() as any[]
  const vNum = prevVersions.length + 1
  const version = `v3.${vNum}-auto`

  // 保存
  db.prepare('INSERT OR REPLACE INTO model_params (version, weights, accuracy, matches_trained, description) VALUES (?, ?, ?, ?, ?)').run(
    version, JSON.stringify(allWeights), +bestGlobalAcc.toFixed(3), total,
    `自动学习 ${total}场 (405+${total - 405}新)`
  )
  db.prepare('INSERT OR REPLACE INTO model_params (version, weights, accuracy, matches_trained, description) VALUES (?, ?, ?, ?, ?)').run(
    'current-auto', JSON.stringify(allWeights), +bestGlobalAcc.toFixed(3), total,
    `当前活跃自动版本`
  )

  // 与上版本对比
  const prevBest = db.prepare("SELECT accuracy FROM model_params WHERE version = 'v3.0-tiered'").get() as any
  const improvement = prevBest ? +((bestGlobalAcc - prevBest.accuracy) * 100).toFixed(1) : 0

  console.log(`[自动学习] 重训练完成 ${version}: ${(bestGlobalAcc*100).toFixed(1)}% (提升${improvement > 0 ? '+' + improvement : improvement}%)`)
  return { version, accuracy: +bestGlobalAcc.toFixed(3), improvement }
}

// ========== ③ 概率校准更新 ==========

interface CalibrationBucket {
  bucket: string      // e.g. "model_40-50pct"
  modelMin: number
  modelMax: number
  modelAvg: number
  actualRate: number
  count: number
  calibrationFactor: number
}

/** 按实力差分桶计算"模型概率 vs 实际频率" */
export function updateCalibration(): CalibrationBucket[] {
  const db = getDB()
  const finished = db.prepare("SELECT m.*, ap.spf FROM matches m JOIN ai_predictions ap ON ap.match_id = m.id WHERE m.status = 'FINISHED'").all() as any[]

  if (finished.length < 5) {
    console.log('[自动学习] 已完场比赛不足5场，跳过校准')
    return []
  }

  interface BucketAcc { sum: number; count: number; hits: number }
  const buckets = new Map<string, BucketAcc>()

  // 按模型概率分桶
  for (const m of finished) {
    const spf = JSON.parse(m.spf)
    const favProb = Math.max(spf.home, spf.draw, spf.away)
    const fav = spf.home > spf.away ? (spf.home > spf.draw ? 'home' : 'draw') : (spf.away > spf.draw ? 'away' : 'draw')
    const actual = m.home_score > m.away_score ? 'home' : m.home_score < m.away_score ? 'away' : 'draw'

    // 5个概率桶
    let bucket: string
    if (favProb <= 0.40) bucket = '30-40%'
    else if (favProb <= 0.50) bucket = '40-50%'
    else if (favProb <= 0.60) bucket = '50-60%'
    else if (favProb <= 0.70) bucket = '60-70%'
    else bucket = '70%+'

    if (!buckets.has(bucket)) buckets.set(bucket, { sum: 0, count: 0, hits: 0 })
    const b = buckets.get(bucket)!
    b.sum += favProb
    b.count++
    if (fav === actual) b.hits++
  }

  // 计算校准因子
  const results: CalibrationBucket[] = []
  for (const [bucket, acc] of buckets) {
    const modelAvg = acc.sum / acc.count
    const actualRate = acc.hits / acc.count
    const [min, max] = bucket.split('-').map(s => parseFloat(s) / 100)
    const cf = modelAvg > 0 ? +(actualRate / modelAvg).toFixed(3) : 1.0

    results.push({
      bucket, modelMin: min, modelMax: max || 0.99,
      modelAvg: +modelAvg.toFixed(3), actualRate: +actualRate.toFixed(3),
      count: acc.count, calibrationFactor: cf,
    })
  }

  // 存入 DB
  db.prepare("INSERT OR REPLACE INTO model_params (version, weights, accuracy, matches_trained, description) VALUES (?, ?, ?, ?, ?)").run(
    'calibration-latest',
    JSON.stringify(results),
    0,
    finished.length,
    `概率校准 — ${finished.length}场完赛`
  )

  console.log(`[自动学习] 概率校准: ${results.length}个桶, ${finished.length}场完赛`)
  for (const r of results) {
    const cfLabel = r.calibrationFactor > 1.05 ? '模型低估' : r.calibrationFactor < 0.95 ? '模型高估' : '校准良好'
    console.log(`  ${r.bucket}: 模型${(r.modelAvg*100).toFixed(0)}% → 实际${(r.actualRate*100).toFixed(0)}% | ${r.count}场 | ${cfLabel}(×${r.calibrationFactor})`)
  }

  return results
}

/** 获取当前校准因子（用于下游预测） */
export function getCalibrationFactor(modelProb: number): number {
  const db = getDB()
  const cal = db.prepare("SELECT weights FROM model_params WHERE version = 'calibration-latest'").get() as any
  if (!cal) return 1.0

  const buckets = JSON.parse(cal.weights) as CalibrationBucket[]
  for (const b of buckets) {
    if (modelProb >= b.modelMin && modelProb <= b.modelMax) {
      return b.calibrationFactor
    }
  }
  return 1.0
}

// ========== ④ 爆冷系数校准 ==========

/** 统计爆冷信号触发 vs 实际爆冷率，更新系数 */
export function updateUpsetFactors(): void {
  const db = getDB()
  const finished = db.prepare("SELECT * FROM matches WHERE tournament_id = 1 AND status = 'FINISHED'").all() as any[]
  if (finished.length < 8) return

  interface UpsetAcc { triggers: number; upsets: number; label: string }
  const factors = new Map<string, UpsetAcc>()

  for (const m of finished) {
    const pred = db.prepare('SELECT analysis_report, spf FROM ai_predictions WHERE match_id = ? LIMIT 1').get(m.id) as any
    if (!pred) continue

    const spf = JSON.parse(pred.spf)
    const fav = spf.recommendation
    const actual = m.home_score > m.away_score ? 'home' : m.home_score < m.away_score ? 'away' : 'draw'
    const isUpset = fav !== actual

    const report: string = pred.analysis_report || ''
    const triggerMap: Record<string, string> = {
      '高原': 'altitude', '高温': 'heat', '赔率背离': 'odds_diverge',
      '状态反': 'form_reversal', '博彩公司分歧': 'consensus_low',
      '巨人杀手': 'giant_killer', '大风': 'wind',
    }

    for (const [cn, key] of Object.entries(triggerMap)) {
      if (report.includes(cn)) {
        if (!factors.has(key)) factors.set(key, { triggers: 0, upsets: 0, label: cn })
        const f = factors.get(key)!
        f.triggers++
        if (isUpset) f.upsets++
      }
    }
  }

  console.log('[自动学习] 爆冷系数校准:')
  for (const [key, acc] of factors) {
    const rate = acc.triggers > 0 ? (acc.upsets / acc.triggers * 100).toFixed(0) : '0'
    console.log(`  ${acc.label}: ${acc.upsets}/${acc.triggers} = ${rate}%`)
  }

  // 存 DB 供 gamblerAdvisor 使用
  const factorData = Array.from(factors.entries()).map(([k, v]) => ({
    key: k,
    triggers: v.triggers,
    upsets: v.upsets,
    rate: v.triggers > 0 ? +(v.upsets / v.triggers).toFixed(3) : 0,
  }))

  db.prepare("INSERT OR REPLACE INTO model_params (version, weights, accuracy, matches_trained, description) VALUES (?, ?, ?, ?, ?)").run(
    'upset-factors-latest',
    JSON.stringify(factorData),
    0, finished.length,
    `爆冷系数 — ${finished.length}场完赛`
  )
}

// ========== ⑤ 泊松λ参数更新 ==========

/** 赛后更新球队真实进球期望 */
export function updatePoissonLambda(): void {
  const db = getDB()
  const finished = db.prepare("SELECT * FROM matches WHERE tournament_id = 1 AND status = 'FINISHED'").all() as any[]
  if (finished.length === 0) return

  interface TeamStats { goals: number; games: number; conceded: number; recent: number[] }
  const stats = new Map<string, TeamStats>()

  for (const m of finished) {
    const ht = db.prepare('SELECT name FROM teams WHERE id = ?').get(m.home_team_id) as any
    const at = db.prepare('SELECT name FROM teams WHERE id = ?').get(m.away_team_id) as any
    if (!ht || !at) continue

    for (const [team, gf, ga] of [[ht.name, m.home_score, m.away_score], [at.name, m.away_score, m.home_score]] as [string, number, number][]) {
      if (!stats.has(team)) stats.set(team, { goals: 0, games: 0, conceded: 0, recent: [] })
      const s = stats.get(team)!
      s.goals += gf; s.games++; s.conceded += ga
      s.recent.push(gf)
      if (s.recent.length > 3) s.recent.shift()
    }
  }

  // 更新 team_ratings 表: form_score = 近期场均进球期望
  let updated = 0
  for (const [name, stat] of stats) {
    const t = db.prepare("SELECT id FROM teams WHERE name = ? AND tournament_id = 1").get(name) as any
    if (!t) continue

    const avgG = +(stat.goals / stat.games).toFixed(2)
    const avgC = +(stat.conceded / stat.games).toFixed(2)
    const recentAvg = stat.recent.length > 0 ? +(stat.recent.reduce((a, b) => a + b) / stat.recent.length).toFixed(2) : avgG

    // form_score = 近期进球期望（泊松λ近似）
    // matches_played / goals_for / goals_against 更新
    db.prepare(`UPDATE team_ratings SET form_score = ?, matches_played = ?, goals_for = ?, goals_against = ?, updated_at = datetime('now','localtime') WHERE team_id = ?`).run(
      recentAvg, stat.games, stat.goals, stat.conceded, t.id,
    )
    updated++
  }

  console.log(`[自动学习] 泊松λ更新: ${updated}队 | ${finished.length}场完赛`)
}

// ========== ⑥ 版本自动切换 ==========

/** 自动对比新旧版本，选择最优 */
export function autoSwitchVersion(): { activated: string | null; reason: string } {
  const db = getDB()
  const versions = db.prepare("SELECT * FROM model_params WHERE version LIKE 'v%-auto%' ORDER BY accuracy DESC LIMIT 2").all() as any[]
  if (versions.length < 2) return { activated: null, reason: '不足2个版本，无法对比' }

  const current = db.prepare("SELECT * FROM model_params WHERE version = 'current-auto'").get() as any
  const best = versions[0]

  if (current && best.accuracy > current.accuracy + 0.02) {
    db.prepare("UPDATE model_params SET accuracy = ?, matches_trained = ?, description = ? WHERE version = 'current-auto'").run(
      best.accuracy, best.matches_trained, `自动切换自 ${best.version}`
    )
    console.log(`[自动学习] 🔄 版本切换: ${current.version}(${(current.accuracy*100).toFixed(1)}%) → ${best.version}(${(best.accuracy*100).toFixed(1)}%)`)
    return { activated: best.version, reason: `准确率提升 ${((best.accuracy - current.accuracy) * 100).toFixed(1)}%` }
  }

  return { activated: null, reason: `当前最优: ${best.version}(${(best.accuracy*100).toFixed(1)}%)` }
}

// ========== 一站式：赛后全部学习 ==========

/** 每场比赛结束后调用 */
export async function learnFromMatch(matchId: number): Promise<void> {
  // ① 加入训练集
  appendToTraining(matchId)

  const total = countTraining()
  const newCount = total - 405  // 2026新数据

  // 更新进度
  console.log(`[自动学习] 训练集: 405+${newCount}=${total}场 (${newCount > 0 ? '本轮' + newCount + '场' : '无新数据'})`)

  // ② 每24场触发重训练
  if (checkRetrain(total)) {
    console.log('[自动学习] 🚀 达到重训练阈值，开始网格搜索...')
    retrainAndSave()
    autoSwitchVersion()
  }

  // ③④⑤ 每场比赛后更新校准（每5场打印一次日志）
  if (total % 5 === 0 || newCount <= 3) {
    updateCalibration()
    updateUpsetFactors()
    updatePoissonLambda()
  }
}

/** 一站式：回溯完成后调用（批量学习） */
export async function learnFromBatch(matchIds: number[]): Promise<void> {
  for (const id of matchIds) await learnFromMatch(id)
}
