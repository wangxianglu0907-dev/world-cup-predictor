/**
 * Phase 2: 导入历史国家队比赛数据 (~500场)
 * 来源: OpenLigaDB — WC2018/2022, EURO2020/2024, Copa2019/21/24, NL2020/24
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(__dirname, '..', 'server', 'data', 'worldcup.db')
const db = new Database(DB)
db.pragma('journal_mode = WAL')

const BASE = 'https://api.openligadb.de'

async function fetchJSON(url: string) { const r = await fetch(url); return r.json() }

interface OLMatch { team1: { teamName: string }; team2: { teamName: string }; matchDateTimeUTC: string; matchIsFinished: boolean; matchResults: { pointsTeam1: number; pointsTeam2: number }[] }

const LEAGUES = [
  { code: 'wm_2018', season: 2018, name: 'WC2018', type: 'worldcup', weight: 0.2 },
  { code: 'wmk', season: 2022, name: 'WC2022', type: 'worldcup', weight: 0.6 },
  { code: 'em20', season: 2020, name: 'EURO2020', type: 'euro', weight: 0.5 },
  { code: 'em', season: 2024, name: 'EURO2024', type: 'euro', weight: 0.85 },
  { code: 'CA2019', season: 2019, name: 'Copa2019', type: 'copa', weight: 0.2 },
  { code: 'CA2021', season: 2021, name: 'Copa2021', type: 'copa', weight: 0.5 },
  { code: 'CA2024', season: 2024, name: 'Copa2024', type: 'copa', weight: 0.8 },
  { code: 'uefanl', season: 2020, name: 'NL2021', type: 'nations', weight: 0.3 },
  { code: 'nla', season: 2024, name: 'NL2024', type: 'nations', weight: 0.8 },
]

// 中文名映射
const CN_NAMES: Record<string, string> = { 'Germany': '德国','Deutschland':'德国','France':'法国','Frankreich':'法国','England':'英格兰','Spain':'西班牙','Spanien':'西班牙','Italy':'意大利','Italien':'意大利','Netherlands':'荷兰','Niederlande':'荷兰','Portugal':'葡萄牙','Belgium':'比利时','Belgien':'比利时','Brazil':'巴西','Brasilien':'巴西','Argentina':'阿根廷','Argentinien':'阿根廷','Uruguay':'乌拉圭','Croatia':'克罗地亚','Kroatien':'克罗地亚','Denmark':'丹麦','Dänemark':'丹麦','Switzerland':'瑞士','Schweiz':'瑞士','Serbia':'塞尔维亚','Serbien':'塞尔维亚','Morocco':'摩洛哥','Marokko':'摩洛哥','Senegal':'塞内加尔','Japan':'日本','South Korea':'韩国','Südkorea':'韩国','Iran':'伊朗','USA':'美国','Mexico':'墨西哥','Mexiko':'墨西哥','Canada':'加拿大','Kanada':'加拿大','Australia':'澳大利亚','Australien':'澳大利亚','Poland':'波兰','Polen':'波兰','Austria':'奥地利','Österreich':'奥地利','Sweden':'瑞典','Schweden':'瑞典','Norway':'挪威','Norwegen':'挪威','Scotland':'苏格兰','Schottland':'苏格兰','Wales':'威尔士','Türkei':'土耳其','Turkey':'土耳其','Greece':'希腊','Griechenland':'希腊','Slovakia':'斯洛伐克','Slowakei':'斯洛伐克','Slovenia':'斯洛文尼亚','Slowenien':'斯洛文尼亚','Czech Republic':'捷克','Tschechien':'捷克','Hungary':'匈牙利','Ungarn':'匈牙利','Romania':'罗马尼亚','Rumänien':'罗马尼亚','Bulgaria':'保加利亚','Bulgarien':'保加利亚','Albania':'阿尔巴尼亚','Albanien':'阿尔巴尼亚','Georgia':'格鲁吉亚','Georgien':'格鲁吉亚','Kosovo':'科索沃','Finland':'芬兰','Finnland':'芬兰','Ireland':'爱尔兰','Irland':'爱尔兰','Northern Ireland':'北爱尔兰','Nordirland':'北爱尔兰','Iceland':'冰岛','Luxembourg':'卢森堡','Luxemburg':'卢森堡','Colombia':'哥伦比亚','Kolumbien':'哥伦比亚','Chile':'智利','Peru':'秘鲁','Ecuador':'厄瓜多尔','Paraguay':'巴拉圭','Qatar':'卡塔尔','Katar':'卡塔尔','Saudi Arabia':'沙特阿拉伯','Saudi Arabien':'沙特阿拉伯','Egypt':'埃及','Ägypten':'埃及','Algeria':'阿尔及利亚','Algerien':'阿尔及利亚','Tunisia':'突尼斯','Tunesien':'突尼斯','Nigeria':'尼日利亚','Ghana':'加纳','Côte d\'Ivoire':'科特迪瓦','Elfenbeinküste':'科特迪瓦','Cameroon':'喀麦隆','Kamerun':'喀麦隆','South Africa':'南非','Südafrika':'南非','DR Congo':'刚果(金)','DR Kongo':'刚果(金)','Costa Rica':'哥斯达黎加','Costa Rica':'哥斯达黎加','Jamaica':'牙买加','Honduras':'洪都拉斯','Panama':'巴拿马','New Zealand':'新西兰','Neuseeland':'新西兰','Haiti':'海地','Curaçao':'库拉索','Cape Verde':'佛得角','Kap Verde':'佛得角','Uzbekistan':'乌兹别克斯坦','Usbekistan':'乌兹别克斯坦','Jordan':'约旦','Jordanien':'约旦','Iraq':'伊拉克','Irak':'伊拉克','Bosnia and Herzegovina':'波黑','Bosnien und Herzegowina':'波黑','Russia':'俄罗斯','Russland':'俄罗斯'}

function toCN(name: string): string { return CN_NAMES[name] || name }

async function main() {
  console.log('📡 Phase 2: 导入历史国家队比赛数据...\n')

  // 建训练数据表
  db.exec(`CREATE TABLE IF NOT EXISTS training_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT, home_team TEXT NOT NULL, away_team TEXT NOT NULL,
    home_score INTEGER, away_score INTEGER, match_date TEXT NOT NULL, tournament TEXT NOT NULL,
    tournament_type TEXT NOT NULL, time_weight REAL NOT NULL DEFAULT 1.0, created_at TEXT DEFAULT (datetime('now'))
  )`)

  // 建优化参数表
  db.exec(`CREATE TABLE IF NOT EXISTS model_params (
    version TEXT PRIMARY KEY, weights TEXT NOT NULL, accuracy REAL, matches_trained INTEGER,
    description TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`)

  const insert = db.prepare('INSERT OR IGNORE INTO training_matches (home_team, away_team, home_score, away_score, match_date, tournament, tournament_type, time_weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  let total = 0

  for (const lg of LEAGUES) {
    try {
      const matches: OLMatch[] = await fetchJSON(`${BASE}/getmatchdata/${lg.code}/${lg.season}`)
        let cnt = 0
        for (const m of matches) {
          if (!m.matchIsFinished || !m.matchResults?.length) continue
          const r = m.matchResults[m.matchResults.length - 1]
          insert.run(
            toCN(m.team1.teamName), toCN(m.team2.teamName),
            r.pointsTeam1, r.pointsTeam2,
            m.matchDateTimeUTC?.slice(0, 10) || `${lg.season}-01-01`,
            lg.name, lg.type, lg.weight,
          )
          cnt++
        }
        console.log(`  ✅ ${lg.name}: ${cnt} 场 (权重 x${lg.weight})`)
        total += cnt
    } catch (e: any) {
      console.log(`  ⚠ ${lg.name}: ${e.message}`)
    }
    // 限速
    await new Promise(r => setTimeout(r, 300))
  }

  // 统计
  const stats = db.prepare('SELECT tournament_type, COUNT(*) as cnt FROM training_matches GROUP BY tournament_type').all() as any[]
  console.log(`\n📊 导入完成: ${total} 场`)
  for (const s of stats) console.log(`  ${s.tournament_type}: ${s.cnt} 场`)
  console.log(`  总训练数据: ${total} 场`)

  db.close()
  console.log('\n🎉 历史数据导入完成!')
}

main().catch(e => { console.error('❌', e.message); db.close(); process.exit(1) })
