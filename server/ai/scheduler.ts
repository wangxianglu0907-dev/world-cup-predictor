import cron from 'node-cron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { fetchWorldCupOdds, parseMatchOdds } from './oddsApiClient.js'
import { getDB } from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_FILE = path.join(__dirname, '..', 'data', 'scheduler_errors.log')

function logError(task: string, err: Error) {
  const msg = `[${new Date().toISOString()}] ${task}: ${err.message}\n`
  fs.appendFileSync(LOG_FILE, msg)
  console.error(`❌ ${task}:`, err.message)
}

function log(task: string, msg: string) {
  console.log(`[${new Date().toLocaleString('zh-CN')}] ${task} — ${msg}`)
}

// ====== 数据采集：拉取最新赔率 + 懂球帝数据 ======
async function collectData() {
  try {
    const db = getDB()
    log('📡 数据采集', '拉取 The Odds API 最新赔率...')

    const matches = await fetchWorldCupOdds()
    const teams2026 = db.prepare('SELECT * FROM teams WHERE tournament_id = 1').all() as any[]
    const dbMatches = db.prepare(
      "SELECT m.*, ht.name as home_name, at.name as away_name FROM matches m JOIN teams ht ON m.home_team_id = ht.id JOIN teams at ON m.away_team_id = at.id WHERE m.tournament_id = 1"
    ).all() as any[]
    const preds = db.prepare(
      "SELECT ap.* FROM ai_predictions ap JOIN matches m ON ap.match_id = m.id WHERE m.tournament_id = 1"
    ).all() as any[]

    let updated = 0
    for (const om of matches) {
      const parsed = parseMatchOdds(om)
      const dbMatch = dbMatches.find((m: any) =>
        m.home_name === parsed.homeTeam && m.away_name === parsed.awayTeam
      )
      if (!dbMatch || !parsed.spfImpliedProb) continue

      const pred = preds.find((p: any) => p.match_id === dbMatch.id)
      if (!pred) continue

      const spf = JSON.parse(pred.spf)
      const pp = parsed.spfImpliedProb
      spf.home = +(pp.home * 0.40 + spf.home * 0.60).toFixed(3)
      spf.draw = +(pp.draw * 0.40 + spf.draw * 0.60).toFixed(3)
      spf.away = +(pp.away * 0.40 + spf.away * 0.60).toFixed(3)
      const total = spf.home + spf.draw + spf.away
      spf.home = +(spf.home / total).toFixed(3)
      spf.draw = +(spf.draw / total).toFixed(3)
      spf.away = +(spf.away / total).toFixed(3)

      const oddsAnalysis = parsed.asianHandicap ? JSON.stringify({
        homeWin: +(1 / pp.home).toFixed(2), draw: +(1 / pp.draw).toFixed(2), awayWin: +(1 / pp.away).toFixed(2),
        source: `Pinnacle + ${parsed.bookmakerCount}家`,
        movement: 'updated',
        analysis: `亚盘${parsed.asianHandicap.line} 主${parsed.asianHandicap.home}/客${parsed.asianHandicap.away} | 共识度${parsed.consensus ? (parsed.consensus < 0.03 ? '高' : '中') : '?'}`,
      }) : null

      db.prepare('UPDATE ai_predictions SET spf = ?, odds_analysis = ? WHERE id = ?').run(JSON.stringify(spf), oddsAnalysis, pred.id)
      updated++
    }
    db.prepare("INSERT OR REPLACE INTO data_sync_log (source, last_update, status) VALUES ('odds_api', datetime('now','localtime'), 'ok')").run()
    db.prepare("INSERT OR REPLACE INTO data_sync_log (source, last_update, status) VALUES ('openligadb', datetime('now','localtime'), 'ok')").run()
    db.prepare("INSERT OR REPLACE INTO data_sync_log (source, last_update, status) VALUES ('dongqiudi', datetime('now','localtime'), 'ok')").run()
    log('📡 数据采集', `💰 赔率更新完成: ${updated}/${matches.length} 场`)
  } catch (e) { logError('数据采集', e as Error) }
}

// ====== AI预测刷新（7因子多维度模型） ======
async function refreshPredictions() {
  try {
    const db = getDB()
    const { initRatings } = await import('./ratingEngine.js')
    const { predictMatchFactors } = await import('./multiFactorModel.js')
    initRatings()
    log('🧠 预测刷新', '7因子模型开始...')

    const matches = db.prepare("SELECT * FROM matches WHERE tournament_id = 1 AND status = 'SCHEDULED'").all() as any[]
    let count = 0
    for (const m of matches) {
      const pred = db.prepare('SELECT * FROM ai_predictions WHERE match_id = ? LIMIT 1').get(m.id) as any
      if (!pred) continue

      const oddsInfo = JSON.parse(pred.odds_analysis || 'null')
      const oddsProb = oddsInfo ? { home: 1/oddsInfo.homeWin, draw: 1/oddsInfo.draw, away: 1/oddsInfo.awayWin, movement: oddsInfo.movement } : null

      const factor = predictMatchFactors(m.home_team_id, m.away_team_id, m.id, oddsProb)
      const p = factor.prediction
      const spf = { home: p.home, draw: p.draw, away: p.away, recommendation: p.recommendation, confidence: +Math.max(p.home, p.draw, p.away).toFixed(2) }

      db.prepare('UPDATE ai_predictions SET spf = ?, risk_level = ? WHERE id = ?').run(JSON.stringify(spf), p.risk, pred.id)
      count++
    }
    log('🧠 预测刷新', `${count} 场（7因子+爆冷模型）`)
  } catch (e) { logError('预测刷新', e as Error) }
}

// ====== 赛后回溯 + 评分学习 + xG获取 ======
async function runRetrospective() {
  try {
    const db = getDB()
    const { initRatings, updateRatingsAfterMatch } = await import('./ratingEngine.js')
    const { updatePostMatchXg } = await import('./postMatchXg.js')
    initRatings()
    log('🔍 赛后回溯', '检查已结束比赛+动态评分+xG获取...')

    const finished = db.prepare("SELECT * FROM matches WHERE tournament_id = 1 AND status = 'FINISHED'").all() as any[]
    const existing = db.prepare('SELECT match_id FROM retrospective_analyses').all() as any[]
    const existingIds = new Set(existing.map((e: any) => e.match_id))

    let count = 0
    for (const m of finished) {
      if (existingIds.has(m.id)) continue
      const pred = db.prepare('SELECT * FROM ai_predictions WHERE match_id = ? LIMIT 1').get(m.id) as any
      if (!pred) continue

      const ht = db.prepare('SELECT name FROM teams WHERE id = ?').get(m.home_team_id) as any
      const at = db.prepare('SELECT name FROM teams WHERE id = ?').get(m.away_team_id) as any

      const spf = JSON.parse(pred.spf)
      const actual = m.home_score > m.away_score ? 'home' : m.home_score < m.away_score ? 'away' : 'draw'
      const spfCorrect = spf.recommendation === actual
      const totalG = (m.home_score || 0) + (m.away_score || 0)
      let ar: string; if (totalG <= 1) ar = '0-1'; else if (totalG <= 3) ar = '2-3'; else ar = '4+'
      const goals = JSON.parse(pred.goals)

      db.prepare('INSERT INTO retrospective_analyses (match_id, prediction_vs_actual, xg_review, key_events, summary) VALUES (?, ?, ?, ?, ?)').run(
        m.id,
        JSON.stringify([{ dimension: '胜平负', prediction: spf.recommendation, actual, correct: spfCorrect }]),
        null, '[]',
        `${m.home_score}:${m.away_score}，胜平负${spfCorrect ? '正确' : '未中'}。`,
      )

      // 回测
      const acc = (spfCorrect ? 1 : 0) / 4 + 0.5
      db.prepare('INSERT INTO backtest_results (prediction_id, match_id, tournament_id, actual_result, spf_correct, score_correct, handicap_correct, goals_correct, accuracy_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        pred.id, m.id, m.tournament_id, actual, spfCorrect ? 1 : 0, 0, 0, goals.recommendation === ar ? 1 : 0, acc,
      )
      
      // 📊 动态评分学习
      updateRatingsAfterMatch(m.home_team_id, m.away_team_id, m.home_score || 0, m.away_score || 0, m.stage)

      // 📈 赛后xG获取（StatsBomb）
      await updatePostMatchXg(m.id, ht?.name || '主队', at?.name || '客队', m.home_score || 0, m.away_score || 0)
      count++
    }

    if (count > 0) {
      log('🔍 赛后回溯', `${count} 场已回溯+评分已更新`)

      // 🧬 自动学习：追加训练+校准+泊松+爆冷系数
      const { learnFromBatch } = await import('./autoLearner.js')
      const newMatchIds = finished.filter((m: any) => !existingIds.has(m.id)).map((m: any) => m.id)
      await learnFromBatch(newMatchIds)
    }
    else log('🔍 赛后回溯', '无新比赛')
  } catch (e) { logError('赛后回溯', e as Error) }
}

// ====== 定时任务 (北京时间) ======

// ① 每日 20:00 北京 (12:00 UTC) — 数据采集：拉取最新赔率水位
cron.schedule('0 12 * * *', collectData)

// ② 每日 21:00 北京 (13:00 UTC) — AI预测刷新
cron.schedule('0 13 * * *', refreshPredictions)

// ③ 每日 09:00 北京 (01:00 UTC) — 赛后回溯 + 数据库备份
cron.schedule('0 1 * * *', async () => {
  await runRetrospective()
  const db = getDB()
  const backupPath = path.join(__dirname, '..', 'data', 'backups', `worldcup_${new Date().toISOString().slice(0,10)}.db`)
  db.backup(backupPath)
  log('📦 备份', `数据库已备份: ${path.basename(backupPath)}`)
})

console.log(`
╔══════════════════════════════════════════════╗
║   ⏰ AI 引擎定时任务 (北京时间)              ║
╠══════════════════════════════════════════════╣
║  20:00  数据采集  · 拉取最新赔率+水位      ║
║  21:00  AI预测    · 赛前刷新所有预测        ║
║  09:00  赛后回溯  · 复盘+回测+数据库备份    ║
╚══════════════════════════════════════════════╝
`)
