import { chromium } from 'playwright'
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(__dirname, '..', 'server', 'data', 'worldcup.db')
const db = new Database(DB)

async function main() {
  console.log('🤖 启动浏览器抓取懂球帝数据...\n')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // 1. 抓取首页国际友谊赛
  console.log('📡 1. 抓取今日赛事...')
  await page.goto('https://www.dongqiudi.com/', { waitUntil: 'networkidle', timeout: 30000 })

  // 提取友谊赛数据
  const friendlies = await page.evaluate(() => {
    const results: Array<{ home: string; away: string; score: string; type: string }> = []
    // 查找"今日重要赛事"区域的按钮
    const buttons = document.querySelectorAll('button')
    for (const btn of buttons) {
      const text = btn.textContent || ''
      // 匹配格式: "友谊赛 FT 秘鲁 1 - 3 西班牙" 或 "友谊赛 中国 19:30 泰国"
      const match = text.match(/友谊赛(?:\s*FT\s*)?(\S+)\s+(\d+)\s*-\s*(\d+)\s+(\S+)/)
      if (match) {
        results.push({ home: match[1], away: match[4], score: `${match[2]}:${match[3]}`, type: 'friendly' })
      }
    }
    return results
  })

  console.log(`   发现 ${friendlies.length} 场友谊赛:`)
  for (const f of friendlies) console.log(`     ${f.home} ${f.score} ${f.away}`)

  // 2. 抓取世界杯专题页的赛程/积分榜
  console.log('\n📡 2. 抓取世界杯数据页...')
  await page.goto('https://www.dongqiudi.com/data?cid=61&tab=standings', { waitUntil: 'networkidle', timeout: 30000 })

  // 提取积分榜
  const standings = await page.evaluate(() => {
    const rows: Array<{ rank: string; team: string; played: string; points: string }> = []
    const table = document.querySelector('table')
    if (!table) return rows
    const trs = table.querySelectorAll('tr')
    for (const tr of trs) {
      const cells = tr.querySelectorAll('td, th')
      if (cells.length >= 4) {
        const texts = Array.from(cells).map(c => c.textContent?.trim() || '')
        if (/^\d+$/.test(texts[0])) {
          rows.push({ rank: texts[0], team: texts[1], played: texts[2], points: texts[3] })
        }
      }
    }
    return rows
  })

  if (standings.length > 0) {
    console.log(`   发现 ${standings.length} 队积分榜:`)
    for (const s of standings.slice(0, 10)) console.log(`     ${s.rank}. ${s.team} ${s.played}场 ${s.points}分`)
  } else {
    console.log('   ⚠ 未找到积分榜数据')
  }

  // 3. 抓取赛程
  console.log('\n📡 3. 抓取世界杯赛程...')
  await page.goto('https://www.dongqiudi.com/data?cid=61&tab=schedule', { waitUntil: 'networkidle', timeout: 30000 })

  const scheduleMatches = await page.evaluate(() => {
    const matches: Array<{ home: string; away: string; date: string; status: string }> = []
    const items = document.querySelectorAll('[class*="match"], [class*="schedule"], .match-item')
    for (const item of items) {
      const text = item.textContent || ''
      const teams = text.match(/(\S+)\s+(\d+:\d+|\d+-\d+|vs)\s+(\S+)/)
      if (teams) matches.push({ home: teams[1], away: teams[3], date: '', status: 'upcoming' })
    }
    return matches
  })

  console.log(`   发现 ${scheduleMatches.length} 场`)
  for (const m of scheduleMatches.slice(0, 8)) console.log(`     ${m.home} vs ${m.away}`)

  await browser.close()

  // 4. 中英队名映射表
  const cnToEn: Record<string, string> = {
    '沙特阿拉伯': 'Saudi-Arabien', '沙特': 'Saudi-Arabien',
    '塞内加尔': 'Senegal',
    '墨西哥': 'Mexiko',
    '韩国': 'Südkorea', '韩国': 'Südkorea',
    '南非': 'Südafrika',
    '捷克': 'Tschechien',
    '中国': 'China',
    '泰国': 'Thailand',
    '俄罗斯': 'Russland',
    '西班牙': 'Spanien',
    '秘鲁': 'Peru',
    '日本': 'Japan',
    '巴西': 'Brasilien',
    '阿根廷': 'Argentinien',
    '德国': 'Deutschland',
    '法国': 'Frankreich',
    '英格兰': 'England',
    '荷兰': 'Niederlande',
    '葡萄牙': 'Portugal',
    '克罗地亚': 'Kroatien',
    '摩洛哥': 'Marokko',
    '加拿大': 'Kanada',
    '美国': 'USA',
    '卡塔尔': 'Katar',
    '瑞士': 'Schweiz',
    '澳大利亚': 'Australien',
    '土耳其': 'Türkei',
    '伊朗': 'Iran',
    '乌拉圭': 'Uruguay',
    '比利时': 'Belgien',
    '丹麦': 'Dänemark',
    '波兰': 'Polen',
    '埃及': 'Ägypten',
    '阿尔及利亚': 'Algerien',
    '尼日利亚': 'Nigeria',
    '加纳': 'Ghana',
    '科特迪瓦': 'Elfenbeinküste',
    '喀麦隆': 'Kamerun',
    '塞尔维亚': 'Serbien',
    '哥伦比亚': 'Kolumbien',
    '智利': 'Chile',
    '厄瓜多尔': 'Ecuador',
    '巴拉圭': 'Paraguay',
    '哥斯达黎加': 'Costa Rica',
    '苏格兰': 'Schottland',
    '威尔士': 'Wales',
    '匈牙利': 'Ungarn',
    '奥地利': 'Österreich',
    '瑞典': 'Schweden',
    '挪威': 'Norwegen',
    '意大利': 'Italien',
    '乌克兰': 'Ukraine',
    '罗马尼亚': 'Rumänien',
    '希腊': 'Griechenland',
    '斯洛伐克': 'Slowakei',
    '斯洛文尼亚': 'Slowenien',
    '保加利亚': 'Bulgarien',
    '爱尔兰': 'Irland',
  }

  function matchTeamName(cn: string, teams: any[]): any {
    const de = cnToEn[cn] || cn
    return teams.find((t: any) => {
      const n = (t.name || '').toLowerCase()
      const d = de.toLowerCase()
      return n === d || n.includes(d) || d.includes(n)
    })
  }

  // 5. 用友谊赛数据更新预测
  if (friendlies.length > 0) {
    console.log('\n💾 用友谊赛数据更新2026预测...')

    const teams2026 = db.prepare('SELECT * FROM teams WHERE tournament_id = 1').all() as any[]
    const preds = db.prepare("SELECT ap.* FROM ai_predictions ap JOIN matches m ON ap.match_id = m.id WHERE m.tournament_id = 1").all() as any[]

    let updatedCount = 0

    for (const f of friendlies) {
      const homeTeam = matchTeamName(f.home, teams2026)
      const awayTeam = matchTeamName(f.away, teams2026)

      if (!homeTeam && !awayTeam) {
        console.log(`   ⏭ ${f.home} vs ${f.away} → 不是2026参赛队`)
        continue
      }

      const [hs, as] = f.score.split(':').map(Number)
      const result = hs > as ? 'home_win' : hs < as ? 'away_win' : 'draw'

      for (const p of preds) {
        const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(p.match_id) as any
        if (homeTeam && m.home_team_id === homeTeam.id) {
          const spf = JSON.parse(p.spf)
          const adj = result === 'home_win' ? 0.06 : result === 'away_win' ? -0.04 : 0.01
          spf.home = Math.max(0.1, Math.min(0.85, +(spf.home + adj).toFixed(3)))
          spf.away = Math.max(0.1, Math.min(0.85, +(spf.away - adj).toFixed(3)))
          const total = spf.home + spf.draw + spf.away
          spf.home = +(spf.home / total).toFixed(3); spf.draw = +(spf.draw / total).toFixed(3); spf.away = +(spf.away / total).toFixed(3)
          const report = (p.analysis_report || '') + `\n【懂球帝友谊赛】${homeTeam.name} ${f.score} ${awayTeam?.name || f.away}`
          db.prepare('UPDATE ai_predictions SET spf = ?, analysis_report = ? WHERE id = ?').run(JSON.stringify(spf), report, p.id)
          updatedCount++
        }
        if (awayTeam && m.away_team_id === awayTeam.id) {
          const spf = JSON.parse(p.spf)
          const adj = result === 'away_win' ? 0.06 : result === 'home_win' ? -0.04 : 0.01
          spf.away = Math.max(0.1, Math.min(0.85, +(spf.away + adj).toFixed(3)))
          spf.home = Math.max(0.1, Math.min(0.85, +(spf.home - adj).toFixed(3)))
          const total = spf.home + spf.draw + spf.away
          spf.home = +(spf.home / total).toFixed(3); spf.draw = +(spf.draw / total).toFixed(3); spf.away = +(spf.away / total).toFixed(3)
          const report = (p.analysis_report || '') + `\n【懂球帝友谊赛】${homeTeam?.name || f.home} ${f.score} ${awayTeam.name}`
          db.prepare('UPDATE ai_predictions SET spf = ?, analysis_report = ? WHERE id = ?').run(JSON.stringify(spf), report, p.id)
          updatedCount++
        }
      }
      console.log(`   ✅ ${f.home} ${f.score} ${f.away}`)
    }

    console.log(`   共更新 ${updatedCount} 条预测`)
  }

  db.close()
  console.log('\n🎉 懂球帝数据对接完成！')
}

main().catch(e => { console.error('❌', e.message); db.close(); process.exit(1) })
