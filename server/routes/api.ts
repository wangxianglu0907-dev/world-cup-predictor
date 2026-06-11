import { Router } from 'express'
import { getDB } from '../db.js'

export const apiRouter = Router()

// AI 引擎运行状态锁
let aiRunning = false
let lastAction = ''
let lastActionTime = ''

function setRunning(action: string) {
  aiRunning = true
  lastAction = action
  lastActionTime = new Date().toISOString()
}
function setIdle() {
  aiRunning = false
  lastAction = ''
}

async function withLock(action: string, fn: () => Promise<void>, reply: any) {
  if (aiRunning) {
    reply.status(409).json({ error: `AI引擎正在执行"${lastAction}"，请稍后再试` })
    return
  }
  reply.json({ status: 'running', action })
  setRunning(action)
  try {
    await fn()
  } catch (e: any) {
    console.error(`${action} 失败:`, e.message)
  }
  setIdle()
}

function mapTeam(t: any) {
  if (!t) return null
  return {
    id: t.id, name: t.name, shortName: t.short_name, countryCode: t.country_code,
    fifaRanking: t.fifa_ranking, groupName: t.group_name, tournamentId: t.tournament_id,
  }
}
function mapMatch(m: any) {
  return {
    id: m.id, tournamentId: m.tournament_id, stage: m.stage, groupName: m.group_name,
    homeTeamId: m.home_team_id, awayTeamId: m.away_team_id,
    homeScore: m.home_score, awayScore: m.away_score, handicap: m.handicap,
    startTime: m.start_time, status: m.status,
    homeTeam: mapTeam(m.homeTeam), awayTeam: mapTeam(m.awayTeam),
  }
}

// 1. 赛事列表
apiRouter.get('/tournaments', (_req, res) => {
  const db = getDB()
  const status = _req.query.status as string | undefined
  let rows: any[]
  if (status) {
    rows = db.prepare('SELECT * FROM tournaments WHERE status = ? ORDER BY year DESC').all(status) as any[]
  } else {
    rows = db.prepare('SELECT * FROM tournaments ORDER BY year DESC').all() as any[]
  }
  res.json(rows.map(r => ({
    id: r.id, name: r.name, season: r.season, year: r.year,
    hostCountry: r.host_country, status: r.status, createdAt: r.created_at,
  })))
})

// 2. 赛事详情
apiRouter.get('/tournaments/:id', (req, res) => {
  const db = getDB()
  const tournament: any = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id)
  const teams = (db.prepare('SELECT * FROM teams WHERE tournament_id = ?').all(req.params.id) as any[])
  if (!tournament) return res.status(404).json({ error: 'Not found' })
  res.json({
    id: tournament.id, name: tournament.name, season: tournament.season,
    year: tournament.year, hostCountry: tournament.host_country,
    status: tournament.status, createdAt: tournament.created_at,
    teams: teams.map(mapTeam),
  })
})

// 3. 比赛列表
apiRouter.get('/matches', (req, res) => {
  const db = getDB()
  const { tournamentId, status, stage, groupName, page = '1' } = req.query
  let sql = 'SELECT * FROM matches WHERE 1=1'
  const params: any[] = []
  if (tournamentId) { sql += ' AND tournament_id = ?'; params.push(tournamentId) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (stage) { sql += ' AND stage = ?'; params.push(stage) }
  if (groupName) { sql += ' AND group_name = ?'; params.push(groupName) }
  sql += ' ORDER BY start_time ASC'
  const limit = 50
  const offset = (Number(page) - 1) * limit
  sql += ` LIMIT ${limit} OFFSET ${offset}`

  const matches = db.prepare(sql).all(...params)

  const enriched = (matches as any[]).map(m => {
    const home = db.prepare('SELECT * FROM teams WHERE id = ?').get(m.home_team_id)
    const away = db.prepare('SELECT * FROM teams WHERE id = ?').get(m.away_team_id)
    return mapMatch({ ...m, homeTeam: home, awayTeam: away })
  })

  const countSql = 'SELECT COUNT(*) as count FROM matches WHERE 1=1'
    + (tournamentId ? ' AND tournament_id = ?' : '')
    + (status ? ' AND status = ?' : '')
    + (stage ? ' AND stage = ?' : '')
  const countParams = [tournamentId, status, stage].filter(Boolean)
  const totalRow = db.prepare(countSql).get(...countParams) as any

  res.json({ matches: enriched, total: (totalRow as any)?.count || 0 })
})

// 4. 比赛详情
apiRouter.get('/matches/:id', (req, res) => {
  const db = getDB()
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id) as any
  if (!match) return res.status(404).json({ error: 'Not found' })
  const home = db.prepare('SELECT * FROM teams WHERE id = ?').get(match.home_team_id)
  const away = db.prepare('SELECT * FROM teams WHERE id = ?').get(match.away_team_id)
  res.json(mapMatch({ ...match, homeTeam: home, awayTeam: away }))
})

// 5. AI预测报告
apiRouter.get('/matches/:id/prediction', (req, res) => {
  const db = getDB()
  const pred = db.prepare('SELECT * FROM ai_predictions WHERE match_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.id)
  if (!pred) return res.status(404).json({ error: 'No prediction yet' })
  const parsed: any = { ...(pred as any) }
  parsed.spf = JSON.parse(parsed.spf)
  parsed.scoreDistribution = JSON.parse(parsed.score_distribution)
  parsed.handicap = JSON.parse(parsed.handicap)
  parsed.goals = JSON.parse(parsed.goals)
  parsed.riskLevel = parsed.risk_level
  parsed.analysisReport = parsed.analysis_report
  parsed.xgAnalysis = parsed.xg_analysis ? JSON.parse(parsed.xg_analysis) : null
  parsed.oddsAnalysis = parsed.odds_analysis ? JSON.parse(parsed.odds_analysis) : null
  delete parsed.score_distribution; delete parsed.risk_level; delete parsed.analysis_report
  delete parsed.xg_analysis; delete parsed.odds_analysis
  res.json(parsed)
})

// 6. 赛后回溯
apiRouter.get('/matches/:id/retrospective', (req, res) => {
  const db = getDB()
  const retro = db.prepare('SELECT * FROM retrospective_analyses WHERE match_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.id)
  if (!retro) return res.status(404).json({ error: 'No retrospective yet' })
  const parsed = { ...(retro as any) }
  parsed.predictionVsActual = JSON.parse(parsed.prediction_vs_actual)
  parsed.xgReview = parsed.xg_review ? JSON.parse(parsed.xg_review) : null
  parsed.keyEvents = parsed.key_events ? JSON.parse(parsed.key_events) : []
  res.json(parsed)
})

// 7. StatsBomb指标
apiRouter.get('/matches/:id/statsbomb-metrics', (req, res) => {
  const db = getDB()
  const metrics = db.prepare('SELECT * FROM statsbomb_metrics WHERE match_id = ? LIMIT 1').get(req.params.id)
  if (!metrics) return res.status(404).json({ error: 'No metrics yet' })
  res.json(metrics)
})

// 8. 小组出线预测
apiRouter.get('/tournaments/:id/group-prediction', (req, res) => {
  const db = getDB()
  const groupPred = db.prepare('SELECT * FROM group_predictions WHERE tournament_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.id)
  if (!groupPred) return res.status(404).json({ error: 'No group prediction yet' })
  const parsed = { ...(groupPred as any) }
  parsed.groupsData = JSON.parse(parsed.groups_data)
  res.json(parsed)
})

// 9. 晋级路径预测
apiRouter.get('/tournaments/:id/bracket-prediction', (req, res) => {
  const db = getDB()
  const bracketPred = db.prepare('SELECT * FROM bracket_predictions WHERE tournament_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.id)
  if (!bracketPred) return res.status(404).json({ error: 'No bracket prediction yet' })
  const parsed = { ...(bracketPred as any) }
  parsed.bracketData = JSON.parse(parsed.bracket_data)
  parsed.teamProbabilities = JSON.parse(parsed.team_probabilities)
  res.json(parsed)
})

// 10. AI状态
apiRouter.get('/ai/status', (_req, res) => {
  const db = getDB()
  const lastPred = db.prepare('SELECT created_at FROM ai_predictions ORDER BY created_at DESC LIMIT 1').get() as any
  // 创建更新日志表
  db.exec(`CREATE TABLE IF NOT EXISTS data_sync_log (
    source TEXT PRIMARY KEY, last_update TEXT, status TEXT DEFAULT 'ok'
  )`)

  const backtest = db.prepare("SELECT AVG(accuracy_score) as avg_acc FROM backtest_results WHERE created_at > datetime('now', '-7 days')").get() as any
  const logs = db.prepare('SELECT * FROM data_sync_log').all() as any[]
  const logMap: Record<string, { lastUpdate: string | null; status: string }> = {}
  for (const l of logs) logMap[l.source] = { lastUpdate: l.last_update, status: l.status }

  res.json({
    status: aiRunning ? 'running' : 'idle',
    lastAction: aiRunning ? lastAction : null,
    lastActionTime: aiRunning ? lastActionTime : null,
    lastRunAt: lastPred?.created_at || null,
    nextRunAt: '每日 20:00采集 / 21:00预测 / 09:00回溯',
    dataSources: {
      odds_api: { status: logMap['odds_api']?.status || 'ok', lastSync: logMap['odds_api']?.lastUpdate || null, label: 'The Odds API (Pinnacle+25家)' },
      openligadb: { status: logMap['openligadb']?.status || 'ok', lastSync: logMap['openligadb']?.lastUpdate || null, label: 'OpenLigaDB (赛程数据)' },
      dongqiudi: { status: logMap['dongqiudi']?.status || 'ok', lastSync: logMap['dongqiudi']?.lastUpdate || null, label: '懂球帝 (友谊赛)' },
    },
    aiPredictLastRun: logMap['ai_predict']?.lastUpdate || lastPred?.created_at || null,
    latestBacktestAccuracy: backtest?.avg_acc ? Number(backtest.avg_acc.toFixed(3)) : null,
  })
})

// 13. 手动数据采集
apiRouter.post('/ai/collect', async (_req, res) => {
  await withLock('数据采集', async () => {
    const { fetchWorldCupOdds, parseMatchOdds } = await import('../ai/oddsApiClient.js')
    const { analyzeProfessional, formatProReport } = await import('../ai/proOddsAnalyzer.js')
    const db = getDB()
    logRun('📡 手动数据采集开始（追踪初盘+即时盘）')

    db.exec(`CREATE TABLE IF NOT EXISTS odds_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER NOT NULL REFERENCES matches(id),
      timestamp TEXT DEFAULT (datetime('now')), opening_odds TEXT, current_odds TEXT,
      asian_line REAL, asian_home_price REAL, asian_away_price REAL, over_under_line REAL
    )`)

    // 加载名字映射
    const { readFileSync } = await import('fs')
    const { fileURLToPath } = await import('url')
    const { default: pathModule } = await import('path')
    const rankingsPath = pathModule.join(pathModule.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'fifa_rankings.json')
    const rankingsData = JSON.parse(readFileSync(rankingsPath, 'utf-8')).rankings

    const odMatches = await fetchWorldCupOdds()
    // 用 team_id 而不是名字来匹配
    const allTeams = db.prepare('SELECT * FROM teams WHERE tournament_id = 1').all() as any[]
    const dbMatches = db.prepare("SELECT m.* FROM matches m WHERE m.tournament_id = 1").all() as any[]
    const preds = db.prepare("SELECT ap.* FROM ai_predictions ap JOIN matches m ON ap.match_id = m.id WHERE m.tournament_id = 1").all() as any[]

    let updated = 0
    for (const om of odMatches) {
      const parsed = parseMatchOdds(om)
      if (!parsed.spfImpliedProb) continue

      // 通过排名数据匹配中英德文名
      const homeRank = rankingsData[parsed.homeTeam]
      const awayRank = rankingsData[parsed.awayTeam]
      if (!homeRank || !awayRank) continue

      // 在 DB 中找相同排名的球队（排名唯一）
      const ht = allTeams.find((t: any) => t.fifa_ranking === homeRank)
      const at = allTeams.find((t: any) => t.fifa_ranking === awayRank)
      const dbMatch = dbMatches.find((m: any) => m.home_team_id === ht?.id && m.away_team_id === at?.id)
      if (!dbMatch) continue
      const pred = preds.find((p: any) => p.match_id === dbMatch.id)
      if (!pred) continue

      // 检查是否有历史快照（初盘）
      const lastSnapshot = db.prepare('SELECT * FROM odds_snapshots WHERE match_id = ? ORDER BY id DESC LIMIT 1').get(dbMatch.id) as any
      const opening = lastSnapshot ? JSON.parse(lastSnapshot.opening_odds) : null

      const pp = parsed.spfImpliedProb
      const curOdds = { home: +(1/pp.home).toFixed(2), draw: +(1/pp.draw).toFixed(2), away: +(1/pp.away).toFixed(2) }
      const asianLine = parsed.asianHandicap?.line || 0
      const asianHome = parsed.asianHandicap?.home || 1.90
      const asianAway = parsed.asianHandicap?.away || 1.90
      const ouLine = parsed.overUnder?.line || 2.5

      // 保存当前快照（第一次为初盘，后续为对比）
      const isFirst = !lastSnapshot
      db.prepare('INSERT INTO odds_snapshots (match_id, opening_odds, current_odds, asian_line, asian_home_price, asian_away_price, over_under_line) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        dbMatch.id,
        isFirst ? JSON.stringify(curOdds) : (lastSnapshot!.opening_odds),
        JSON.stringify(curOdds),
        asianLine, asianHome, asianAway, ouLine,
      )

      // 专业盘口分析
      const snapshot = { timestamp: new Date().toISOString(), homeWin: curOdds.home, draw: curOdds.draw, awayWin: curOdds.away, asianLine, asianHomePrice: asianHome, asianAwayPrice: asianAway, overUnderLine: ouLine, overPrice: 1.90, underPrice: 1.90 }
      
      const proAnalysis = analyzeProfessional(snapshot, opening ? {
        ...snapshot,
        homeWin: opening.home, draw: opening.draw, awayWin: opening.away,
        asianLine: lastSnapshot!.asian_line, asianHomePrice: lastSnapshot!.asian_home_price, asianAwayPrice: lastSnapshot!.asian_away_price,
      } : null)
      
      const proReport = formatProReport(proAnalysis)

      const spf = JSON.parse(pred.spf)
      // 专业信号修正预测
      const signalAdj = proAnalysis.signalScore * 0.005
      spf.home = Math.max(0.05, Math.min(0.95, +(pp.home * 0.35 + spf.home * 0.60 + signalAdj).toFixed(3)))
      spf.away = Math.max(0.05, Math.min(0.95, +(pp.away * 0.35 + spf.away * 0.60 - signalAdj).toFixed(3)))
      const total = spf.home + spf.draw + spf.away
      spf.home = +(spf.home / total).toFixed(3); spf.draw = +(spf.draw / total).toFixed(3); spf.away = +(spf.away / total).toFixed(3)

      const oddsAnalysis = JSON.stringify({
        homeWin: curOdds.home, draw: curOdds.draw, awayWin: curOdds.away,
        source: `Pinnacle + ${parsed.bookmakerCount}家`,
        movement: proAnalysis.oddsChange.direction,
        consensus: parsed.consensus,
        asianLine, asianHomePrice: asianHome, asianAwayPrice: asianAway,
        overUnderLine: ouLine,
        // 新增加：操盘信号
        proSignal: { score: proAnalysis.signalScore, summary: proAnalysis.overallSignal, trapDetected: proAnalysis.trapSignal.detected, blockDetected: proAnalysis.blockingSignal.detected },
      })

      const report = (pred.analysis_report || '').split('【专业盘口分析')[0].trim()
      const enhanced = `${report}\n\n${proReport}`

      db.prepare('UPDATE ai_predictions SET spf = ?, odds_analysis = ?, analysis_report = ? WHERE id = ?').run(JSON.stringify(spf), oddsAnalysis, enhanced, pred.id)
      updated++
    }
    db.prepare("INSERT OR REPLACE INTO data_sync_log (source, last_update, status) VALUES ('odds_api', datetime('now','localtime'), 'ok')").run()
    db.prepare("INSERT OR REPLACE INTO data_sync_log (source, last_update, status) VALUES ('openligadb', datetime('now','localtime'), 'ok')").run()
    db.prepare("INSERT OR REPLACE INTO data_sync_log (source, last_update, status) VALUES ('dongqiudi', datetime('now','localtime'), 'ok')").run()
    logRun(`📡 数据采集完成: ${updated}/${odMatches.length} 场`)
  }, res)
})

// 14. 手动AI预测刷新（7因子多维度模型）
apiRouter.post('/ai/predict', async (_req, res) => {
  await withLock('AI预测', async () => {
    const db = getDB()
    const { initRatings } = await import('../ai/ratingEngine.js')
    const { predictMatchFactors, calcUpsetPotential } = await import('../ai/multiFactorModel.js')
    const { generateBettingPicks } = await import('../ai/bettingRecommend.js')
    const { adaptivePredict, formatWeightReport, applyExternalEvents, collectExternalEvents } = await import('../ai/adaptiveWeights.js')
    const { estimateXg } = await import('../ai/xgEstimator.js')
    const { poissonScorePrediction, ensemblePredict, getAllAttackDefense } = await import('../ai/advancedModels.js')
    const { v5Predict } = await import('../ai/v5_enhancedModel.js')
    const { v6Predict, trainBooster, travelImpact, styleMatchup, tdCorrection } = await import('../ai/v6_fullModel.js')
    const booster = { splits: { length: 0 } }  // 占位
    initRatings()
    trainBooster()  // 启动时训练提升树

    const adRatings = getAllAttackDefense()
    const trainingData = db.prepare('SELECT * FROM training_matches').all() as any[]
    logRun('🧠 自适应预测刷新（动态权重+突破检测）')

    const matches = db.prepare("SELECT * FROM matches WHERE tournament_id = 1 AND status = 'SCHEDULED'").all() as any[]
    // 加载 v3.0 分层权重
    const v3Row = db.prepare("SELECT * FROM model_params WHERE version = 'v3.0-tiered' LIMIT 1").get() as any
    const tierWeights: Record<string, any> = v3Row ? JSON.parse(v3Row.weights) : null
    logRun(`🧠 权重: ${tierWeights ? `v3.0分层(准确率${(v3Row.accuracy * 100).toFixed(0)}%)` : 'v2.0'}`)

    // 获取所有球队的Elo用于分类
    const teamRatings = db.prepare('SELECT * FROM team_ratings').all() as any[]
    const ratingMap = new Map(teamRatings.map((t: any) => [t.team_id, t.rating]))

    let count = 0, shiftedCount = 0, breakoutCount = 0
    for (const m of matches) {
      const pred = db.prepare('SELECT * FROM ai_predictions WHERE match_id = ? LIMIT 1').get(m.id) as any
      if (!pred) continue

      const oddsInfo = JSON.parse(pred.odds_analysis || 'null')
      const oddsProb = oddsInfo ? { home: 1/oddsInfo.homeWin, draw: 1/oddsInfo.draw, away: 1/oddsInfo.awayWin, movement: oddsInfo.movement, consensus: oddsInfo.consensus } : null

      const factor = predictMatchFactors(m.home_team_id, m.away_team_id, m.id, oddsProb)
      const upset = calcUpsetPotential(factor)
      const f = factor.factors

      // ① 按实力差分类 → 选择对应层级的优化权重
      const hElo = ratingMap.get(m.home_team_id) || 1500
      const aElo = ratingMap.get(m.away_team_id) || 1500
      const rankDiff = Math.abs(hElo - aElo) / 10
      const tier = rankDiff > 30 ? 'blowout' : rankDiff < 15 ? 'close' : 'competitive'

      const tWeights = (tierWeights && tierWeights[tier]) ? tierWeights[tier].weights : null
      const baseOdds = tWeights?.odds || 0.35
      const baseStr = tWeights?.strength || 0.20
      const baseSqd = tWeights?.squad || 0.15
      const baseExt = tWeights?.external || 0.10
      const baseFrm = tWeights?.form || 0.10
      const baseTac = tWeights?.tactical || 0.05
      const baseH2h = tWeights?.h2h || 0.05

      // ⑥ 反向验证: 模型预测 vs 赔率偏差 > 阈值 → 记录为爆冷潜信号
      if (oddsProb) {
        const oddsFavorite = oddsProb.home > oddsProb.away ? 'home' : 'away'
        const modelDiff = Math.abs(oddsProb.home - (0.5 + f.strength.ratingAdv))
        if (modelDiff > 0.12) f.odds.movement = modelDiff > 0.20 ? 'strong_divergence' : 'divergence'
      }

      // ===== 自适应动态权重（v3.0分层+反向验证）=====
      const adaptiveResult = adaptivePredict([
        { name: 'odds', current: { home: oddsProb?.home || 0.38, draw: oddsProb?.draw || 0.27, away: oddsProb?.away || 0.35 }, previous: null, baseWeight: baseOdds, maxWeight: 0.65 },
        { name: 'strength', current: { home: 0.5 + f.strength.ratingAdv, draw: 0.25, away: 0.5 - f.strength.ratingAdv }, previous: null, baseWeight: baseStr, maxWeight: 0.45 },
        { name: 'squad', current: { home: f.squad.valueRatio > 2 ? 0.6 : 0.5, draw: 0.25, away: f.squad.valueRatio > 2 ? 0.15 : 0.25 }, previous: null, baseWeight: baseSqd, maxWeight: 0.25 },
        { name: 'external', current: { home: 0.50 + f.external.weather + (f.external.homeField || 0), draw: 0.28, away: 0.50 - f.external.weather - (f.external.homeField || 0) }, previous: null, baseWeight: baseExt, maxWeight: 0.25 },
        { name: 'form', current: { home: 0.5 + f.form.homeForm * 0.15, draw: 0.25, away: 0.5 - f.form.homeForm * 0.15 }, previous: null, baseWeight: baseFrm, maxWeight: 0.20 },
        { name: 'tactical', current: { home: f.tactical.homeExp, draw: 0.25, away: f.tactical.awayExp }, previous: null, baseWeight: baseTac, maxWeight: 0.15 },
        { name: 'h2h', current: { home: 0.5 + f.headToHead, draw: 0.25, away: 0.5 - f.headToHead }, previous: null, baseWeight: baseH2h, maxWeight: 0.15 },
      ])

      if (adaptiveResult.mode === 'breakout') breakoutCount++
      else if (adaptiveResult.mode === 'shifting') shiftedCount++

      // ===== 外部事件驱动（伤病/天气/海拔/时差） =====
      const externalEvents = collectExternalEvents(
        factor.homeTeam, factor.awayTeam,
        factor.climate?.altitude || 0, factor.climate?.temp || 25, factor.climate?.humidity || 55,
      )
      const weatherDelta = null // TODO: 对接实时天气API对比赛前预测
      const p = applyExternalEvents(adaptiveResult, externalEvents, weatherDelta)
      if (p.eventOverrides.length > 0) {
        p.triggers.push(...p.eventOverrides)
      }

      // ① 泊松比分预测 + ③ 集成学习
      const ht = db.prepare('SELECT name FROM teams WHERE id = ?').get(m.home_team_id) as any
      const at = db.prepare('SELECT name FROM teams WHERE id = ?').get(m.away_team_id) as any
      const homeAD = adRatings.get(ht?.name || '') || { attack: 1.0, defense: 1.0, overall: 1500 }
      const awayAD = adRatings.get(at?.name || '') || { attack: 1.0, defense: 1.0, overall: 1500 }

      const poisson = poissonScorePrediction(
        ht?.name || '', at?.name || '',
        homeAD.attack, homeAD.defense, awayAD.attack, awayAD.defense,
        factor.climate?.altitude && factor.climate.altitude > 1500 ? 1.10 : 1.05,
      )

      // v5 + v6 增强预测
      const v5Result = v5Predict(ht?.name || '', at?.name || '', trainingData)
      const v6Result = v6Predict(
        ht?.name || '', at?.name || '', factor.venue,
        match?.groupName ? (match.groupName.includes('3') ? 3 : 2) : 1,
        match?.stage || 'GROUP', false, false,
      )

      // 集成: 泊松+Elo+赔率+v5 四模型投票
      const ensemble = ensemblePredict(
        poisson.mostLikely,
        p.home, p.draw, p.away,
        oddsProb?.home || null, oddsProb?.draw || null, oddsProb?.away || null,
      )
      // v5+v6 增强修正: v5(12%) + v6(8%) + 四模型(80%)
      const v5Home = (ensemble.home * 0.80 + v5Result.final.home * 0.12 + v6Result.prob.home * 0.08)
      const v5Draw = (ensemble.draw * 0.80 + v5Result.final.draw * 0.12 + v6Result.prob.draw * 0.08)
      const v5Away = (ensemble.away * 0.80 + v5Result.final.away * 0.12 + v6Result.prob.away * 0.08)
      const v5Total = v5Home + v5Draw + v5Away
      ensemble.home = +(v5Home / v5Total).toFixed(3)
      ensemble.draw = +(v5Draw / v5Total).toFixed(3)
      ensemble.away = +(v5Away / v5Total).toFixed(3)

      const spf = {
        home: ensemble.home, draw: ensemble.draw, away: ensemble.away,
        recommendation: ensemble.home > ensemble.away ? (ensemble.home > ensemble.draw ? 'home' : 'draw') : (ensemble.away > ensemble.draw ? 'away' : 'draw'),
        confidence: ensemble.confidence,
      }

      // ② 用泊松输出更新比分分布
      const scoreDist = poisson.scoreDistribution
      db.prepare('UPDATE ai_predictions SET score_distribution = ? WHERE id = ?').run(JSON.stringify(scoreDist), pred.id)

      // 赛前xG预估（基于泊松λ值）
      const xgEstimate = {
        homeXg: poisson.homeLambda, awayXg: poisson.awayLambda,
        homePossession: Math.round(45 + (homeAD.attack - awayAD.attack) * 10),
        awayPossession: Math.round(55 - (homeAD.attack - awayAD.attack) * 10),
        homeShots: Math.round(poisson.homeLambda * 8),
        awayShots: Math.round(poisson.awayLambda * 8),
        homeShotsOnTarget: Math.round(poisson.homeLambda * 3),
        awayShotsOnTarget: Math.round(poisson.awayLambda * 3),
        analysis: `泊松模型: ${ht?.name} λ=${poisson.homeLambda} ${at?.name} λ=${poisson.awayLambda} | 预期总进球 ${poisson.expectedGoals}`,
        source: '泊松回归 + 攻防分解',
      }

      // 博彩推荐
      const homeFav = spf.recommendation === 'home'
      const expectedGoals = oddsInfo?.overUnderLine || 2.5
      const proSignal = oddsInfo?.proSignal?.score || 0
      const weightReport = formatWeightReport(adaptiveResult)

      const picks = generateBettingPicks(
        factor.homeTeam, factor.awayTeam, homeFav, f.strength.rankDiff, expectedGoals, upset, proSignal,
        oddsInfo?.homeWin || 2.0, oddsInfo?.draw || 3.5, oddsInfo?.awayWin || 3.5,
      )

      // 构建博彩推荐栏
      const scorePicksStr = picks.scorePicks.map(s => {
        const icon = s.confidence === 'high' ? '⭐' : s.confidence === 'medium' ? '📌' : '🃏'
        return `${icon} ${s.score} · ${s.reason}`
      }).join('\n')
      const goalPicksStr = picks.goalPicks.map(g => {
        const icon = g.confidence === 'high' ? '⭐' : g.confidence === 'medium' ? '📌' : '🃏'
        return `${icon} ${g.goals}球 · ${g.reason}`
      }).join('\n')

      const maxProb = Math.max(ensemble.home, ensemble.draw, ensemble.away)
      const riskLevel = maxProb > 0.55 ? 'low' : maxProb > 0.45 ? 'medium' : 'high'
      const agreementLabel = ensemble.agreement === 'strong' ? '✅ 高度一致' : ensemble.agreement === 'moderate' ? '⚠ 基本一致' : '❌ 分歧较大'
      const report = `【AI v5.0 集成预测 · ${factor.venue}】
四模型共识: ${agreementLabel} (泊松25%/Elo30%/赔率45%/v5增强20%)
${factor.homeTeam}(FIFA#${f.strength.homeRank}) vs ${factor.awayTeam}(FIFA#${f.strength.awayRank})

【v5.0 6项精化分析】
${v5Result.analysis}

【v6.0 新增分析】
${v6Result.analysis.length > 0 ? v6Result.analysis.join('\n') : '· 无明显特殊信号（第1/2轮标准比赛）'}
① 提升树: ${booster ? '已训练' + booster.splits.length + '次分裂' : '未训练'}

泊松λ: ${factor.homeTeam} λ=${poisson.homeLambda} | ${factor.awayTeam} λ=${poisson.awayLambda} | 预期总进球 ${poisson.expectedGoals}
攻防: ${factor.homeTeam} 攻${homeAD.attack}/防${homeAD.defense} | ${factor.awayTeam} 攻${awayAD.attack}/防${awayAD.defense}

【${adaptiveResult.mode === 'breakout' ? '🔴 突破模式' : adaptiveResult.mode === 'shifting' ? '🟡 波动模式' : '🟢 稳定模式'} · 变化幅度 ${(adaptiveResult.changeMagnitude*100).toFixed(1)}%】

🔹 赔率市场 (${(p.weights.odds*100).toFixed(0)}%): Pinnacle走势 ${f.odds.movement} | 共识度 ${f.odds.consensus < 0.03 ? '高' : f.odds.consensus < 0.06 ? '中' : '低'}
🔹 球队实力 (${(p.weights.strength*100).toFixed(0)}%): 排名差 ${f.strength.rankDiff > 0 ? '+' : ''}${f.strength.rankDiff} | Elo优势 ${f.strength.ratingAdv > 0 ? '+' + f.strength.ratingAdv.toFixed(3) : f.strength.ratingAdv.toFixed(3)}
🔹 赛前状态 (${(p.weights.form*100).toFixed(0)}%): 近期表现 ${factor.homeTeam}(${f.form.homeForm > 0 ? '+' + f.form.homeForm.toFixed(2) : f.form.homeForm.toFixed(2)}) / ${factor.awayTeam}(${f.form.awayForm > 0 ? '+' + f.form.awayForm.toFixed(2) : f.form.awayForm.toFixed(2)})
🔹 阵容质量 (${(p.weights.squad*100).toFixed(0)}%): 身价比 ${f.squad.valueRatio}x | ${factor.homeTeam} €${f.squad.homeValue}亿 vs ${factor.awayTeam} €${f.squad.awayValue}亿
🔹 技战术 (${(p.weights.tactical*100).toFixed(0)}%): 大赛经验差 ${f.tactical.homeExp > f.tactical.awayExp ? '主队占优' : '客队占优'}
🔹 外部环境 (${(p.weights.external*100).toFixed(0)}%): ${factor.climate?.effects || '标准'} | 温度${factor.climate?.temp}°C 湿度${factor.climate?.humidity}% 海拔${factor.climate?.altitude}m
🔹 历史交锋 (${(p.weights.h2h*100).toFixed(0)}%): 参考数据 ${f.headToHead > 0 ? '主队占优' : f.headToHead < 0 ? '客队占优' : '均势'}

${weightReport}

${f.external.homeField > 0 ? '⚡ 主队享东道主优势\n' : ''}集成预测: 主胜${(spf.home*100).toFixed(1)}% / 平局${(spf.draw*100).toFixed(1)}% / 客胜${(spf.away*100).toFixed(1)}%
风险: ${riskLevel === 'low' ? '🟢 低' : riskLevel === 'medium' ? '🟡 中' : '🔴 高'}

【爆冷预警 · 指数${upset.score}/100 · ${upset.level === 'extreme' ? '🔴极高' : upset.level === 'high' ? '🟠较高' : upset.level === 'moderate' ? '🟡中等' : '🟢较低'}】
${upset.factors.length > 0 ? upset.factors.map(t => '· ' + t).join('\n') : '· 未发现显著爆冷信号'}
${upset.recommendedBet}

【博彩推荐 · 胆大心细】
━━━ 比分推荐 ━━━
${scorePicksStr}
━━━ 进球数推荐 ━━━
${goalPicksStr}
📝 ${picks.summary}`
      db.prepare('UPDATE ai_predictions SET spf = ?, analysis_report = ?, risk_level = ?, xg_analysis = ?, score_distribution = ? WHERE id = ?').run(JSON.stringify(spf), report, riskLevel, JSON.stringify(xgEstimate), JSON.stringify(scoreDist), pred.id)
      count++
    }
    db.prepare("INSERT OR REPLACE INTO data_sync_log (source, last_update, status) VALUES ('ai_predict', datetime('now','localtime'), 'ok')").run()
    logRun(`🧠 自适应预测完成: ${count} 场 (突破:${breakoutCount} 波动:${shiftedCount})`)
  }, res)
})

// 15. 手动赛后xG获取（单场）
apiRouter.post('/ai/post-xg/:matchId', async (req, res) => {
  const db = getDB()
  const match = db.prepare('SELECT * FROM matches WHERE id = ? AND status = ?').get(req.params.matchId, 'FINISHED') as any
  if (!match) return res.status(400).json({ error: '比赛未结束' })
  const { updatePostMatchXg } = await import('../ai/postMatchXg.js')
  const ht = db.prepare('SELECT name FROM teams WHERE id = ?').get(match.home_team_id) as any
  const at = db.prepare('SELECT name FROM teams WHERE id = ?').get(match.away_team_id) as any
  await updatePostMatchXg(match.id, ht?.name || '', at?.name || '', match.home_score || 0, match.away_score || 0)
  res.json({ status: 'ok', match: match.id })
})

// 17. 搏一搏博彩推荐
// 18. 自动学习状态
apiRouter.get('/ai/learn-status', (_req, res) => {
  const db = getDB()
  const total = (db.prepare('SELECT COUNT(*) as c FROM training_matches').get() as any).c
  const versions = db.prepare("SELECT version, accuracy, matches_trained, description FROM model_params ORDER BY accuracy DESC").all()
  const cal = db.prepare("SELECT weights FROM model_params WHERE version = 'calibration-latest'").get() as any
  res.json({
    trainingMatches: total,
    newMatches: total - 405,
    versions,
    calibration: cal ? JSON.parse(cal.weights) : null,
    nextRetrainTrigger: Math.ceil((total - 405) / 24) * 24 + 405,
  })
})

// 19. 手动触发自动学习（调试用）
apiRouter.post('/ai/learn', async (_req, res) => {
  res.json({ status: 'running' })
  const db = getDB()
  const finished = db.prepare("SELECT id FROM matches WHERE tournament_id = 1 AND status = 'FINISHED'").all() as any[]
  const existing = db.prepare('SELECT match_id FROM retrospective_analyses').all() as any[]
  const existingIds = new Set(existing.map((e: any) => e.match_id))
  const newIds = finished.filter((m: any) => !existingIds.has(m.id)).map((m: any) => m.id)
  const { learnFromBatch, countTraining, updateCalibration, updateUpsetFactors, updatePoissonLambda } = await import('../ai/autoLearner.js')
  await learnFromBatch(newIds)
  // 额外触发全面校准
  updateCalibration()
  updateUpsetFactors()
  updatePoissonLambda()
  console.log(`[手动学习] 完成: ${countTraining()}场训练集`)
})

apiRouter.get('/ai/gambler', async (_req, res) => {
  const { generateGamblerReport } = await import('../ai/gamblerAdvisor.js')
  res.json(generateGamblerReport())
})

// 16. 球队评分排名
apiRouter.get('/ai/ratings', async (_req, res) => {
  const { getAllRatings, initRatings } = await import('../ai/ratingEngine.js')
  initRatings()
  res.json(getAllRatings())
})

// 16. 爆冷预警（列出高爆冷风险的比赛）
apiRouter.get('/ai/upset-alerts', async (_req, res) => {
  const db = getDB()
  const { predictMatchFactors, calcUpsetPotential } = await import('../ai/multiFactorModel.js')
  const { initRatings } = await import('../ai/ratingEngine.js')
  initRatings()

  const matches = db.prepare("SELECT * FROM matches WHERE tournament_id = 1 AND status = 'SCHEDULED'").all() as any[]
  const alerts: any[] = []

  for (const m of matches) {
    const pred = db.prepare('SELECT * FROM ai_predictions WHERE match_id = ? LIMIT 1').get(m.id) as any
    const oddsInfo = pred ? JSON.parse(pred.odds_analysis || 'null') : null
    const oddsProb = oddsInfo ? { home: 1/oddsInfo.homeWin, draw: 1/oddsInfo.draw, away: 1/oddsInfo.awayWin, movement: oddsInfo.movement } : null

    const factor = predictMatchFactors(m.home_team_id, m.away_team_id, m.id, oddsProb)
    const upset = calcUpsetPotential(factor)

    if (upset.level !== 'low') {
      alerts.push({
        matchId: m.id,
        homeTeam: factor.homeTeam,
        awayTeam: factor.awayTeam,
        venue: factor.venue,
        startTime: m.start_time,
        groupName: m.group_name,
        ...upset,
      })
    }
  }

  alerts.sort((a, b) => b.score - a.score)
  res.json({ total: alerts.length, alerts })
})

function logRun(msg: string) { console.log(`[${new Date().toLocaleString('zh-CN')}] ${msg}`) }

// 11. 回测汇总
apiRouter.get('/tournaments/:id/backtest-summary', (req, res) => {
  const db = getDB()
  const tournamentId = req.params.id
  const results = db.prepare('SELECT * FROM backtest_results WHERE tournament_id = ?').all(tournamentId) as any[]

  if (!results.length) return res.json({
    tournamentId: Number(tournamentId),
    totalMatches: 0,
    spfAccuracy: 0, scoreAccuracy: 0, handicapAccuracy: 0, goalsAccuracy: 0, overallAccuracy: 0,
    trend: [],
  })

  const total = results.length
  const spfCorrect = results.filter(r => r.spf_correct).length
  const scoreCorrect = results.filter(r => r.score_correct).length
  const handicapCorrect = results.filter(r => r.handicap_correct).length
  const goalsCorrect = results.filter(r => r.goals_correct).length

  res.json({
    tournamentId: Number(tournamentId),
    totalMatches: total,
    spfAccuracy: +(spfCorrect / total).toFixed(3),
    scoreAccuracy: +(scoreCorrect / total).toFixed(3),
    handicapAccuracy: +(handicapCorrect / total).toFixed(3),
    goalsAccuracy: +(goalsCorrect / total).toFixed(3),
    overallAccuracy: +(results.reduce((s: number, r: any) => s + r.accuracy_score, 0) / total / total).toFixed(3),
    trend: results.map((r: any) => ({ date: r.created_at?.split(' ')[0] || '', accuracy: r.accuracy_score })),
  })
})

// 12. 回测历史
apiRouter.get('/ai/backtest-history', (req, res) => {
  const db = getDB()
  const page = Number(req.query.page) || 1
  const limit = 20
  const offset = (page - 1) * limit
  const results = db.prepare('SELECT * FROM backtest_results ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset)
  const total = db.prepare('SELECT COUNT(*) as count FROM backtest_results').get() as any
  res.json({ results, total: total?.count || 0 })
})
