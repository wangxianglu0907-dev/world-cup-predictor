import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { fetchWorldCupOdds, parseMatchOdds, type ParsedOdds } from '../server/ai/oddsApiClient.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(__dirname, '..', 'server', 'data', 'worldcup.db')
const db = new Database(DB)

// 队名映射：Odds API用英文名，OpenLigaDB用德文名
const NAME_MAP: Record<string, string> = {
  'Mexico': 'Mexiko', 'South Korea': 'Südkorea', 'Czech Republic': 'Tschechien',
  'Canada': 'Kanada', 'Bosnia and Herzegovina': 'Bosnien und Herzegowina', 'Bosnia & Herzegovina': 'Bosnien und Herzegowina',
  'USA': 'USA', 'Paraguay': 'Paraguay',
  'Australia': 'Australien', 'Turkey': 'Türkei',
  'Qatar': 'Katar', 'Switzerland': 'Schweiz',
  'Brazil': 'Brasilien', 'Morocco': 'Marokko',
  'Haiti': 'Haiti', 'Scotland': 'Schottland',
  'Germany': 'Deutschland', 'Curaçao': 'Curaçao',
  'Netherlands': 'Niederlande', 'Japan': 'Japan',
  'Argentina': 'Argentinien', 'Algeria': 'Algerien',
  'Jordan': 'Jordanien', 'Austria': 'Österreich',
  'Belgium': 'Belgien', 'Egypt': 'Ägypten',
  'Iran': 'Iran', 'New Zealand': 'Neuseeland',
  'France': 'Frankreich', 'South Africa': 'Südafrika',
  'DR Congo': 'DR Kongo', 'Iraq': 'Irak',
  'England': 'England', 'Serbia': 'Serbien',
  'Spain': 'Spanien', 'Costa Rica': 'Costa Rica',
  'Italy': 'Italien', 'Chile': 'Chile',
  'Portugal': 'Portugal', 'Ghana': 'Ghana',
  'Uruguay': 'Uruguay', 'Slovakia': 'Slowakei',
  'Denmark': 'Dänemark', 'Greece': 'Griechenland',
  'Croatia': 'Kroatien', 'Slovenia': 'Slowenien',
  'Colombia': 'Kolumbien', 'Peru': 'Peru',
  'Senegal': 'Senegal', 'Tunisia': 'Tunesien',
  'Sweden': 'Schweden', 'Norway': 'Norwegen',
  'Poland': 'Polen', 'Ukraine': 'Ukraine',
  'Ecuador': 'Ecuador',
  // 新增缺失映射
  'Ivory Coast': 'Elfenbeinküste', 'Saudi Arabia': 'Saudi Arabien',
  'Cape Verde': 'Kap Verde', 'Uzbekistan': 'Usbekistan',
}

function toDBName(en: string): string {
  // 精确映射
  if (NAME_MAP[en]) return NAME_MAP[en]
  // 处理 & 符号
  const cleaned = en.replace(' & ', ' and ').replace('& ', 'and ').replace(' &', ' and')
  if (NAME_MAP[cleaned]) return NAME_MAP[cleaned]
  return en
}

async function main() {
  console.log('📡 从 The Odds API 拉取 2026 世界杯实时赔率...\n')

  // 1. 获取全部赔率
  const matches = await fetchWorldCupOdds()
  console.log(`   获取到 ${matches.length} 场比赛\n`)

  // 2. 解析并匹配数据库
  const teams2026 = db.prepare('SELECT * FROM teams WHERE tournament_id = 1').all() as any[]
  const dbMatches = db.prepare('SELECT m.*, ht.name as home_name, at.name as away_name FROM matches m JOIN teams ht ON m.home_team_id = ht.id JOIN teams at ON m.away_team_id = at.id WHERE m.tournament_id = 1').all() as any[]
  const preds = db.prepare("SELECT ap.* FROM ai_predictions ap JOIN matches m ON ap.match_id = m.id WHERE m.tournament_id = 1").all() as any[]

  let matched = 0
  let updated = 0

  for (const om of matches) {
    const parsed = parseMatchOdds(om)

    // 匹配数据库比赛
    const homeDB = toDBName(parsed.homeTeam)
    const awayDB = toDBName(parsed.awayTeam)

    const dbMatch = dbMatches.find((m: any) =>
      m.home_name === homeDB && m.away_name === awayDB
    )

    if (!dbMatch) {
      console.log(`   ⚠ 未匹配: ${parsed.homeTeam} vs ${parsed.awayTeam} (${homeDB} vs ${awayDB})`)
      continue
    }
    matched++

    // 3. 用 Pinnacle 隐含概率更新 AI 预测
    if (parsed.spfImpliedProb) {
      const pred = preds.find((p: any) => p.match_id === dbMatch.id)
      if (pred) {
        const spf = JSON.parse(pred.spf)

        // 赔率权重40% + 原有预测60%
        const pp = parsed.spfImpliedProb
        spf.home = +(pp.home * 0.40 + spf.home * 0.60).toFixed(3)
        spf.draw = +(pp.draw * 0.40 + spf.draw * 0.60).toFixed(3)
        spf.away = +(pp.away * 0.40 + spf.away * 0.60).toFixed(3)
        // 归一化
        const total = spf.home + spf.draw + spf.away
        spf.home = +(spf.home / total).toFixed(3)
        spf.draw = +(spf.draw / total).toFixed(3)
        spf.away = +(spf.away / total).toFixed(3)

        // 更新推荐
        spf.recommendation = spf.home > spf.away ? (spf.home > spf.draw ? 'home' : 'draw') : (spf.away > spf.draw ? 'away' : 'draw')
        spf.confidence = +Math.max(spf.home, spf.draw, spf.away).toFixed(2)

        // 生成赔率分析
        const oddsAnalysis = parsed.asianHandicap ? {
          homeWin: Math.round(1 / pp.home * 100) / 100,
          draw: Math.round(1 / pp.draw * 100) / 100,
          awayWin: Math.round(1 / pp.away * 100) / 100,
          source: `Pinnacle + ${parsed.bookmakerCount - 1}家博彩公司`,
          movement: parsed.consensus && parsed.consensus < 0.03 ? 'stable'
            : parsed.consensus && parsed.consensus < 0.06 ? 'home_drop' : 'away_drop',
          analysis: `Pinnacle亚盘${parsed.asianHandicap.line > 0 ? '+' : ''}${parsed.asianHandicap.line}，主队水位${parsed.asianHandicap.home}客队${parsed.asianHandicap.away}。${parsed.bookmakerCount}家公司主胜均价${(1/pp.home).toFixed(2)}，共识度${parsed.consensus ? (parsed.consensus < 0.03 ? '高' : parsed.consensus < 0.06 ? '中' : '低') : '未知'}。${parsed.overUnder ? `大小球${parsed.overUnder.line}球 大${parsed.overUnder.over}/小${parsed.overUnder.under}` : ''}`,
        } : null

        const report = (pred.analysis_report || '').split('【懂球帝')[0].trim() // 保留原有报告去掉旧懂球帝部分
        const enhancedReport = `${report}
【博彩水位分析 · Pinnacle基准】
主胜隐含概率: ${(pp.home * 100).toFixed(1)}% (赔率 ${(1/pp.home).toFixed(2)})
平局隐含概率: ${(pp.draw * 100).toFixed(1)}% (赔率 ${(1/pp.draw).toFixed(2)})
客胜隐含概率: ${(pp.away * 100).toFixed(1)}% (赔率 ${(1/pp.away).toFixed(2)})
亚盘: ${parsed.asianHandicap ? `${parsed.asianHandicap.line}球 主${parsed.asianHandicap.home}/客${parsed.asianHandicap.away}` : '无'}
${parsed.overUnder ? `大小球: ${parsed.overUnder.line}球 大${parsed.overUnder.over}/小${parsed.overUnder.under}` : ''}
共识度: ${parsed.consensus ? (parsed.consensus < 0.03 ? '✅ 市场高度一致' : parsed.consensus < 0.06 ? '⚠ 存在分歧' : '❌ 分歧较大') : '未知'}
博彩公司数: ${parsed.bookmakerCount}家`

        const oddsAnalysisJson = oddsAnalysis ? JSON.stringify(oddsAnalysis) : null

        db.prepare('UPDATE ai_predictions SET spf = ?, analysis_report = ?, odds_analysis = ? WHERE id = ?').run(
          JSON.stringify(spf), enhancedReport, oddsAnalysisJson, pred.id,
        )
        updated++
      }
    }
  }

  console.log(`\n📊 匹配: ${matched}/${matches.length} 场, 更新预测: ${updated} 条`)
  console.log('🎉 博彩水位数据对接完成！')

  db.close()
}

main().catch(e => { console.error('❌', e.message || e); db.close(); process.exit(1) })
