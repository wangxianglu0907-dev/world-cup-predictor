/**
 * 权重优化: 基于历史Elo预测准确率
 * 方法: 用前80%比赛建Elo -> 后20%比赛验证 -> 找最优权重
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(__dirname, '..', 'server', 'data', 'worldcup.db')
const db = new Database(DB)

interface W { odds: number; strength: number; squad: number; external: number; form: number; tactical: number; h2h: number }
const DW: W = { odds: 0.35, strength: 0.20, squad: 0.15, external: 0.10, form: 0.10, tactical: 0.05, h2h: 0.05 }

// 从数据建立Elo
function buildElo(matches: any[]): Map<string, number> {
  const e = new Map<string, number>()
  for (const m of matches) {
    if (!e.has(m.home_team)) e.set(m.home_team, 1500)
    if (!e.has(m.away_team)) e.set(m.away_team, 1500)
    const h = e.get(m.home_team)!, a = e.get(m.away_team)!
    const exp = 1 / (1 + Math.pow(10, (a - h) / 400))
    const act = m.home_score > m.away_score ? 1 : m.home_score < m.away_score ? 0 : 0.5
    e.set(m.home_team, Math.round(h + 32 * m.time_weight * (act - exp)))
    e.set(m.away_team, Math.round(a + 32 * m.time_weight * (exp - act)))
  }
  return e
}

// 用Elo + 权重预测
function predictWithElo(home: string, away: string, elo: Map<string, number>, w: W): number {
  const hElo = elo.get(home) || 1500
  const aElo = elo.get(away) || 1500
  const eloProb = 1 / (1 + Math.pow(10, (aElo - hElo) / 400))
  const homeField = 0.54
  return eloProb * w.strength + homeField * w.external + 0.38 * w.odds
}

const allMatches = db.prepare('SELECT * FROM training_matches ORDER BY match_date ASC').all() as any[]
console.log(`📊 训练数据: ${allMatches.length} 场`)

// 搜索最优权重
let bestAcc = 0, bestW: W = { ...DW }
const results: { w: W; acc: number }[] = []

for (let strength = 0.15; strength <= 0.45; strength += 0.05) {
  for (let odds = 0.20; odds <= 0.45; odds += 0.05) {
    const external = +(0.10 + Math.random() * 0.10).toFixed(2)
    const form = +(0.05 + Math.random() * 0.10).toFixed(2)
    const squad = +(0.05 + Math.random() * 0.10).toFixed(2)
    const tactical = +(0.05).toFixed(2)
    const h2h = +(1 - strength - odds - external - form - squad - tactical).toFixed(2)
    if (strength + odds > 0.7 || h2h < 0) continue

    const w: W = { odds: +odds.toFixed(2), strength: +strength.toFixed(2), squad, external, form, tactical, h2h: Math.max(0, +h2h.toFixed(2)) }
    let correct = 0, total = 0

    // 5折交叉验证
    for (let fold = 0; fold < 5; fold++) {
      const start = Math.floor((fold * allMatches.length) / 5)
      const end = Math.floor(((fold + 1) * allMatches.length) / 5)
      const train = [...allMatches.slice(0, start), ...allMatches.slice(end)]
      const elo = buildElo(train)

      for (const m of allMatches.slice(start, end)) {
        const prob = predictWithElo(m.home_team, m.away_team, elo, w)
        const pred = prob > 0.38 ? 'home' : prob < 0.28 ? 'away' : 'draw'
        const actual = m.home_score > m.away_score ? 'home' : m.home_score < m.away_score ? 'away' : 'draw'
        if (pred === actual) correct++
        total++
      }
    }
    const acc = +(correct / total).toFixed(3)
    results.push({ w, acc })
    if (acc > bestAcc) { bestAcc = acc; bestW = w }
  }
}

results.sort((a, b) => b.acc - a.acc)

// 默认权重准确率
console.log('\n对比分析:')
let defCorrect = 0, defTotal = 0
for (let fold = 0; fold < 5; fold++) {
  const start = Math.floor((fold * allMatches.length) / 5)
  const end = Math.floor(((fold + 1) * allMatches.length) / 5)
  const train = [...allMatches.slice(0, start), ...allMatches.slice(end)]
  const elo = buildElo(train)
  for (const m of allMatches.slice(start, end)) {
    const prob = predictWithElo(m.home_team, m.away_team, elo, DW)
    const pred = prob > 0.38 ? 'home' : prob < 0.28 ? 'away' : 'draw'
    const actual = m.home_score > m.away_score ? 'home' : m.home_score < m.away_score ? 'away' : 'draw'
    if (pred === actual) defCorrect++
    defTotal++
  }
}
const defAcc = +(defCorrect / defTotal).toFixed(3)

console.log(`  默认权重: ${(defAcc * 100).toFixed(1)}%`)
console.log(`  最优权重: ${(bestAcc * 100).toFixed(1)}% (${bestAcc > defAcc ? '+' : ''}${((bestAcc - defAcc) * 100).toFixed(1)}%)`)
console.log(`\n最优权重: 赔率${bestW.odds} 实力${bestW.strength} 身价${bestW.squad} 环境${bestW.external} 状态${bestW.form}`)

// 保存
db.prepare('INSERT OR REPLACE INTO model_params (version, weights, accuracy, matches_trained, description) VALUES (?, ?, ?, ?, ?)').run(
  'v2.0-elo-optimized', JSON.stringify(bestW), bestAcc, allMatches.length, '5折交叉验证 — 基于405场历史Elo'
)
console.log('\n✅ 已保存 v2.0-elo-optimized')
db.close()
