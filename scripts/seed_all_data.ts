import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'server', 'data', 'worldcup.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('🌱 开始插入模拟数据...')

// ====== 球队 A组 ======
const teams = [
  { name: 'Netherlands', short_name: '荷兰', country_code: 'NED', fifa_ranking: 8, group_name: 'A', tournament_id: 1, statsbomb_name: 'Netherlands', openligadb_name: 'Niederlande' },
  { name: 'Senegal', short_name: '塞内加尔', country_code: 'SEN', fifa_ranking: 18, group_name: 'A', tournament_id: 1, statsbomb_name: 'Senegal', openligadb_name: 'Senegal' },
  { name: 'Ecuador', short_name: '厄瓜多尔', country_code: 'ECU', fifa_ranking: 44, group_name: 'A', tournament_id: 1, statsbomb_name: 'Ecuador', openligadb_name: 'Ecuador' },
  { name: 'Qatar', short_name: '卡塔尔', country_code: 'QAT', fifa_ranking: 50, group_name: 'A', tournament_id: 1, statsbomb_name: 'Qatar', openligadb_name: 'Katar' },
  { name: 'England', short_name: '英格兰', country_code: 'ENG', fifa_ranking: 5, group_name: 'B', tournament_id: 1, statsbomb_name: 'England', openligadb_name: 'England' },
  { name: 'USA', short_name: '美国', country_code: 'USA', fifa_ranking: 16, group_name: 'B', tournament_id: 1, statsbomb_name: 'United States', openligadb_name: 'USA' },
  { name: 'Iran', short_name: '伊朗', country_code: 'IRN', fifa_ranking: 20, group_name: 'B', tournament_id: 1, statsbomb_name: 'Iran', openligadb_name: 'Iran' },
  { name: 'Wales', short_name: '威尔士', country_code: 'WAL', fifa_ranking: 19, group_name: 'B', tournament_id: 1, statsbomb_name: 'Wales', openligadb_name: 'Wales' },
  { name: 'Argentina', short_name: '阿根廷', country_code: 'ARG', fifa_ranking: 3, group_name: 'C', tournament_id: 1, statsbomb_name: 'Argentina', openligadb_name: 'Argentinien' },
  { name: 'Poland', short_name: '波兰', country_code: 'POL', fifa_ranking: 26, group_name: 'C', tournament_id: 1, statsbomb_name: 'Poland', openligadb_name: 'Polen' },
  { name: 'Mexico', short_name: '墨西哥', country_code: 'MEX', fifa_ranking: 13, group_name: 'C', tournament_id: 1, statsbomb_name: 'Mexico', openligadb_name: 'Mexiko' },
  { name: 'Saudi Arabia', short_name: '沙特', country_code: 'KSA', fifa_ranking: 51, group_name: 'C', tournament_id: 1, statsbomb_name: 'Saudi Arabia', openligadb_name: 'Saudi-Arabien' },
  { name: 'France', short_name: '法国', country_code: 'FRA', fifa_ranking: 4, group_name: 'D', tournament_id: 1, statsbomb_name: 'France', openligadb_name: 'Frankreich' },
  { name: 'Australia', short_name: '澳大利亚', country_code: 'AUS', fifa_ranking: 38, group_name: 'D', tournament_id: 1, statsbomb_name: 'Australia', openligadb_name: 'Australien' },
  { name: 'Denmark', short_name: '丹麦', country_code: 'DEN', fifa_ranking: 10, group_name: 'D', tournament_id: 1, statsbomb_name: 'Denmark', openligadb_name: 'Dänemark' },
  { name: 'Tunisia', short_name: '突尼斯', country_code: 'TUN', fifa_ranking: 30, group_name: 'D', tournament_id: 1, statsbomb_name: 'Tunisia', openligadb_name: 'Tunesien' },
  { name: 'Japan', short_name: '日本', country_code: 'JPN', fifa_ranking: 24, group_name: 'E', tournament_id: 1, statsbomb_name: 'Japan', openligadb_name: 'Japan' },
  { name: 'Spain', short_name: '西班牙', country_code: 'ESP', fifa_ranking: 7, group_name: 'E', tournament_id: 1, statsbomb_name: 'Spain', openligadb_name: 'Spanien' },
  { name: 'Germany', short_name: '德国', country_code: 'GER', fifa_ranking: 11, group_name: 'E', tournament_id: 1, statsbomb_name: 'Germany', openligadb_name: 'Deutschland' },
  { name: 'Costa Rica', short_name: '哥斯达黎加', country_code: 'CRC', fifa_ranking: 31, group_name: 'E', tournament_id: 1, statsbomb_name: 'Costa Rica', openligadb_name: 'Costa Rica' },
  { name: 'Morocco', short_name: '摩洛哥', country_code: 'MAR', fifa_ranking: 22, group_name: 'F', tournament_id: 1, statsbomb_name: 'Morocco', openligadb_name: 'Marokko' },
  { name: 'Croatia', short_name: '克罗地亚', country_code: 'CRO', fifa_ranking: 12, group_name: 'F', tournament_id: 1, statsbomb_name: 'Croatia', openligadb_name: 'Kroatien' },
  { name: 'Belgium', short_name: '比利时', country_code: 'BEL', fifa_ranking: 2, group_name: 'F', tournament_id: 1, statsbomb_name: 'Belgium', openligadb_name: 'Belgien' },
  { name: 'Canada', short_name: '加拿大', country_code: 'CAN', fifa_ranking: 41, group_name: 'F', tournament_id: 1, statsbomb_name: 'Canada', openligadb_name: 'Kanada' },
  { name: 'Brazil', short_name: '巴西', country_code: 'BRA', fifa_ranking: 1, group_name: 'G', tournament_id: 1, statsbomb_name: 'Brazil', openligadb_name: 'Brasilien' },
  { name: 'Serbia', short_name: '塞尔维亚', country_code: 'SRB', fifa_ranking: 21, group_name: 'G', tournament_id: 1, statsbomb_name: 'Serbia', openligadb_name: 'Serbien' },
  { name: 'Switzerland', short_name: '瑞士', country_code: 'SUI', fifa_ranking: 15, group_name: 'G', tournament_id: 1, statsbomb_name: 'Switzerland', openligadb_name: 'Schweiz' },
  { name: 'Cameroon', short_name: '喀麦隆', country_code: 'CMR', fifa_ranking: 43, group_name: 'G', tournament_id: 1, statsbomb_name: 'Cameroon', openligadb_name: 'Kamerun' },
  { name: 'Portugal', short_name: '葡萄牙', country_code: 'POR', fifa_ranking: 9, group_name: 'H', tournament_id: 1, statsbomb_name: 'Portugal', openligadb_name: 'Portugal' },
  { name: 'South Korea', short_name: '韩国', country_code: 'KOR', fifa_ranking: 28, group_name: 'H', tournament_id: 1, statsbomb_name: 'Korea Republic', openligadb_name: 'Südkorea' },
  { name: 'Uruguay', short_name: '乌拉圭', country_code: 'URU', fifa_ranking: 14, group_name: 'H', tournament_id: 1, statsbomb_name: 'Uruguay', openligadb_name: 'Uruguay' },
  { name: 'Ghana', short_name: '加纳', country_code: 'GHA', fifa_ranking: 61, group_name: 'H', tournament_id: 1, statsbomb_name: 'Ghana', openligadb_name: 'Ghana' },
]
const insertTeam = db.prepare('INSERT INTO teams (name, short_name, country_code, fifa_ranking, group_name, tournament_id, statsbomb_name, openligadb_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
for (const t of teams) insertTeam.run(t.name, t.short_name, t.country_code, t.fifa_ranking, t.group_name, t.tournament_id, t.statsbomb_name, t.openligadb_name)
console.log(`✅ 32 支球队已插入`)

// ====== 比赛（小组赛A组+部分淘汰赛） ======
const matches = [
  { tournament_id: 1, stage: 'GROUP', group_name: 'A', home_team_id: 1, away_team_id: 2, home_score: 2, away_score: 0, handicap: -0.5, start_time: '2022-11-21T16:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'A', home_team_id: 3, away_team_id: 4, home_score: 2, away_score: 0, handicap: -0.25, start_time: '2022-11-21T19:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'A', home_team_id: 4, away_team_id: 2, home_score: 1, away_score: 3, handicap: 0.5, start_time: '2022-11-25T13:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'A', home_team_id: 1, away_team_id: 3, home_score: 1, away_score: 1, handicap: -0.75, start_time: '2022-11-25T16:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'A', home_team_id: 1, away_team_id: 4, home_score: 2, away_score: 0, handicap: -1.5, start_time: '2022-11-29T15:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'A', home_team_id: 3, away_team_id: 2, home_score: 1, away_score: 2, handicap: 0.25, start_time: '2022-11-29T15:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'B', home_team_id: 5, away_team_id: 7, home_score: 6, away_score: 2, handicap: -1.25, start_time: '2022-11-21T13:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'B', home_team_id: 6, away_team_id: 8, home_score: 1, away_score: 1, handicap: -0.25, start_time: '2022-11-21T19:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'C', home_team_id: 9, away_team_id: 12, home_score: 1, away_score: 2, handicap: -1.5, start_time: '2022-11-22T10:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'D', home_team_id: 13, away_team_id: 14, home_score: 4, away_score: 1, handicap: -1.25, start_time: '2022-11-22T19:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'E', home_team_id: 19, away_team_id: 17, home_score: 1, away_score: 2, handicap: -0.5, start_time: '2022-11-23T13:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'F', home_team_id: 22, away_team_id: 21, home_score: 0, away_score: 0, handicap: 0, start_time: '2022-11-23T10:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'G', home_team_id: 25, away_team_id: 28, home_score: 2, away_score: 0, handicap: -1, start_time: '2022-11-24T19:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'GROUP', group_name: 'H', home_team_id: 29, away_team_id: 31, home_score: 3, away_score: 2, handicap: -0.25, start_time: '2022-11-24T19:00:00Z', status: 'FINISHED' },
  // R16
  { tournament_id: 1, stage: 'ROUND_OF_16', group_name: null, home_team_id: 1, away_team_id: 6, home_score: 3, away_score: 1, handicap: -0.5, start_time: '2022-12-03T15:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'ROUND_OF_16', group_name: null, home_team_id: 9, away_team_id: 14, home_score: 2, away_score: 1, handicap: -1, start_time: '2022-12-03T19:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'ROUND_OF_16', group_name: null, home_team_id: 13, away_team_id: 10, home_score: 3, away_score: 1, handicap: -1.25, start_time: '2022-12-04T15:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'ROUND_OF_16', group_name: null, home_team_id: 5, away_team_id: 2, home_score: 3, away_score: 0, handicap: -1, start_time: '2022-12-04T19:00:00Z', status: 'FINISHED' },
  // QF
  { tournament_id: 1, stage: 'QUARTER_FINAL', group_name: null, home_team_id: 1, away_team_id: 9, home_score: 2, away_score: 2, handicap: -0.25, start_time: '2022-12-09T15:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'QUARTER_FINAL', group_name: null, home_team_id: 13, away_team_id: 5, home_score: 2, away_score: 1, handicap: -0.25, start_time: '2022-12-10T15:00:00Z', status: 'FINISHED' },
  // SF
  { tournament_id: 1, stage: 'SEMI_FINAL', group_name: null, home_team_id: 9, away_team_id: 22, home_score: 3, away_score: 0, handicap: -0.5, start_time: '2022-12-13T19:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'SEMI_FINAL', group_name: null, home_team_id: 13, away_team_id: 21, home_score: 2, away_score: 0, handicap: -0.75, start_time: '2022-12-14T19:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'THIRD_PLACE', group_name: null, home_team_id: 22, away_team_id: 21, home_score: 2, away_score: 1, handicap: -0.25, start_time: '2022-12-17T15:00:00Z', status: 'FINISHED' },
  { tournament_id: 1, stage: 'FINAL', group_name: null, home_team_id: 9, away_team_id: 13, home_score: 3, away_score: 2, handicap: 0, start_time: '2022-12-18T15:00:00Z', status: 'FINISHED' },
]
const insertMatch = db.prepare('INSERT INTO matches (tournament_id, stage, group_name, home_team_id, away_team_id, home_score, away_score, handicap, start_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
for (const m of matches) insertMatch.run(m.tournament_id, m.stage, m.group_name, m.home_team_id, m.away_team_id, m.home_score, m.away_score, m.handicap, m.start_time, m.status)
console.log(`✅ ${matches.length} 场比赛已插入`)

// ====== AI预测 ======
const predictionTemplates = [
  { spf: { home: 0.52, draw: 0.26, away: 0.22, recommendation: 'home', confidence: 0.78 }, handicap: { home: 0.54, draw: 0.24, away: 0.22, handicap: -0.5, recommendation: 'home', confidence: 0.72 }, goals: { range0_1: 0.25, range2_3: 0.52, range4_plus: 0.23, recommendation: '2-3', confidence: 0.75 }, risk_level: 'low' },
  { spf: { home: 0.38, draw: 0.30, away: 0.32, recommendation: 'draw', confidence: 0.55 }, handicap: { home: 0.40, draw: 0.28, away: 0.32, handicap: 0.25, recommendation: 'away', confidence: 0.58 }, goals: { range0_1: 0.35, range2_3: 0.45, range4_plus: 0.20, recommendation: '2-3', confidence: 0.65 }, risk_level: 'medium' },
  { spf: { home: 0.65, draw: 0.20, away: 0.15, recommendation: 'home', confidence: 0.85 }, handicap: { home: 0.67, draw: 0.18, away: 0.15, handicap: -1.0, recommendation: 'home', confidence: 0.82 }, goals: { range0_1: 0.18, range2_3: 0.45, range4_plus: 0.37, recommendation: '4+', confidence: 0.68 }, risk_level: 'low' },
  { spf: { home: 0.30, draw: 0.28, away: 0.42, recommendation: 'away', confidence: 0.72 }, handicap: { home: 0.32, draw: 0.26, away: 0.42, handicap: 0.5, recommendation: 'away', confidence: 0.70 }, goals: { range0_1: 0.40, range2_3: 0.42, range4_plus: 0.18, recommendation: '2-3', confidence: 0.60 }, risk_level: 'medium' },
]
const scoreDist = JSON.stringify([
  { score: '2:1', probability: 0.14 }, { score: '1:0', probability: 0.12 },
  { score: '2:0', probability: 0.10 }, { score: '3:1', probability: 0.08 },
  { score: '1:1', probability: 0.10 }, { score: '0:0', probability: 0.06 },
  { score: '3:0', probability: 0.07 }, { score: '0:1', probability: 0.06 },
])
const insertPred = db.prepare('INSERT INTO ai_predictions (match_id, spf, score_distribution, handicap, goals, risk_level, analysis_report, xg_analysis, odds_analysis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
const defaultReport = `【AI综合分析报告】

基于StatsBomb xG高级指标、五大主流博彩赔率变化趋势以及球队近期状态加权分析，本场比赛预测如下：

**进攻端分析**：主队近期场均xG达1.82，领先于联赛平均水平（1.35），前场三叉戟默契度显著提升。客队防守端存在明显短板，近3场比赛场均被射正4.7次，定位球防守是主要漏洞。

**赔率走势**：主胜赔率从初盘2.10持续走低至1.85，市场资金流向主队方向。让球盘口从-0.5升盘至-0.75，显示机构对主队信心增强。大小球盘口2.5球水位稳定，预计总进球2-3球概率较大。

**关键因素**：主队主力阵容齐整，无重要伤病。客队核心中场累计黄牌停赛，将影响中场控制力。历史交锋主队3胜2平1负占优。`
const defaultXg = JSON.stringify({ homeXg: 1.82, awayXg: 1.15, homePossession: 54, awayPossession: 46, homeShots: 14, awayShots: 9, homeShotsOnTarget: 6, awayShotsOnTarget: 3, analysis: '主队xG大幅领先，进攻效率显著优于客队。预期进球差值+0.67，具备明显的场面优势。' })
const defaultOdds = JSON.stringify({ homeWin: 1.85, draw: 3.40, awayWin: 4.20, source: 'Football-Data', movement: 'home_drop', analysis: '主胜赔率持续走低（2.10→1.85），降幅11.9%，市场资金明显偏向主队。亚盘升盘至-0.75，进一步确认主队优势。' })

for (let i = 0; i < matches.length; i++) {
  const t = predictionTemplates[i % predictionTemplates.length]
  insertPred.run(i + 1, JSON.stringify(t.spf), scoreDist, JSON.stringify(t.handicap), JSON.stringify(t.goals), t.risk_level, defaultReport, defaultXg, defaultOdds)
}
console.log(`✅ ${matches.length} 条AI预测已插入`)

// ====== 赛后回溯 ======
const insertRetro = db.prepare('INSERT INTO retrospective_analyses (match_id, prediction_vs_actual, xg_review, key_events, summary) VALUES (?, ?, ?, ?, ?)')

for (let i = 0; i < matches.length; i++) {
  const m = matches[i]
  const actualResult = (m.home_score || 0) > (m.away_score || 0) ? 'home' : (m.home_score || 0) < (m.away_score || 0) ? 'away' : 'draw'
  const t = predictionTemplates[i % predictionTemplates.length]
  const spfCorrect = t.spf.recommendation === actualResult
  const totalGoals = (m.home_score || 0) + (m.away_score || 0)
  let actualGoalsRange = '0-1'
  if (totalGoals >= 2 && totalGoals <= 3) actualGoalsRange = '2-3'
  else if (totalGoals >= 4) actualGoalsRange = '4+'
  const goalsCorrect = t.goals.recommendation === actualGoalsRange

  const pva = JSON.stringify([
    { dimension: '胜平负', prediction: t.spf.recommendation === 'home' ? '主胜' : t.spf.recommendation === 'draw' ? '平局' : '客胜', actual: actualResult === 'home' ? '主胜' : actualResult === 'draw' ? '平局' : '客胜', correct: spfCorrect },
    { dimension: '比分', prediction: '2:1', actual: `${m.home_score}:${m.away_score}`, correct: `${m.home_score}:${m.away_score}` === '2:1' },
    { dimension: '让球', prediction: t.handicap.recommendation === 'home' ? '主胜' : '客胜', actual: '主胜', correct: t.handicap.recommendation === 'home' },
    { dimension: '总进球数', prediction: t.goals.recommendation, actual: actualGoalsRange, correct: goalsCorrect },
  ])
  const events = JSON.stringify([
    { minute: 10 + i * 3, type: 'goal', description: `${['主队', '客队'][i % 2]}进球`, team: `${['主队', '客队'][i % 2]}` },
  ])
  const xgR = JSON.stringify({ homeXg: 1.6 + Math.random() * 0.8, awayXg: 0.8 + Math.random() * 0.8, homePossession: 48 + Math.random() * 10, awayPossession: 42 + Math.random() * 10, homeShots: 10 + Math.floor(Math.random() * 8), awayShots: 5 + Math.floor(Math.random() * 8), analysis: '' })
  insertRetro.run(i + 1, pva, xgR, events, `AI模型在本场比赛中胜平负预测${spfCorrect ? '准确' : '未中'}，总进球预测${goalsCorrect ? '准确' : '有偏差'}。`)
}
console.log(`✅ ${matches.length} 条赛后回溯已插入`)

// ====== 小组出线预测 ======
const groupData = [
  { groupName: 'A', standings: [
    { teamId: 1, teamName: 'Netherlands', shortName: '荷兰', advanceProb: 0.92, groupRank: 1, points: 7, played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 1, goalDiff: 4 },
    { teamId: 2, teamName: 'Senegal', shortName: '塞内加尔', advanceProb: 0.68, groupRank: 2, points: 6, played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 5, goalsAgainst: 4, goalDiff: 1 },
    { teamId: 3, teamName: 'Ecuador', shortName: '厄瓜多尔', advanceProb: 0.35, groupRank: 3, points: 4, played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 3, goalDiff: 1 },
    { teamId: 4, teamName: 'Qatar', shortName: '卡塔尔', advanceProb: 0.05, groupRank: 4, points: 0, played: 3, won: 0, drawn: 0, lost: 3, goalsFor: 1, goalsAgainst: 7, goalDiff: -6 },
  ]},
  { groupName: 'B', standings: [
    { teamId: 5, teamName: 'England', shortName: '英格兰', advanceProb: 0.95, groupRank: 1, points: 7, played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 9, goalsAgainst: 2, goalDiff: 7 },
    { teamId: 6, teamName: 'USA', shortName: '美国', advanceProb: 0.72, groupRank: 2, points: 5, played: 3, won: 1, drawn: 2, lost: 0, goalsFor: 2, goalsAgainst: 1, goalDiff: 1 },
    { teamId: 7, teamName: 'Iran', shortName: '伊朗', advanceProb: 0.28, groupRank: 3, points: 3, played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 4, goalsAgainst: 7, goalDiff: -3 },
    { teamId: 8, teamName: 'Wales', shortName: '威尔士', advanceProb: 0.05, groupRank: 4, points: 1, played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 1, goalsAgainst: 6, goalDiff: -5 },
  ]},
  { groupName: 'C', standings: [
    { teamId: 9, teamName: 'Argentina', shortName: '阿根廷', advanceProb: 0.85, groupRank: 1, points: 6, played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 5, goalsAgainst: 2, goalDiff: 3 },
    { teamId: 10, teamName: 'Poland', shortName: '波兰', advanceProb: 0.60, groupRank: 2, points: 4, played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 2, goalDiff: 0 },
    { teamId: 11, teamName: 'Mexico', shortName: '墨西哥', advanceProb: 0.48, groupRank: 3, points: 4, played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, goalDiff: -1 },
    { teamId: 12, teamName: 'Saudi Arabia', shortName: '沙特', advanceProb: 0.07, groupRank: 4, points: 3, played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 3, goalsAgainst: 5, goalDiff: -2 },
  ]},
  { groupName: 'D', standings: [
    { teamId: 13, teamName: 'France', shortName: '法国', advanceProb: 0.90, groupRank: 1, points: 6, played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 6, goalsAgainst: 3, goalDiff: 3 },
    { teamId: 14, teamName: 'Australia', shortName: '澳大利亚', advanceProb: 0.55, groupRank: 2, points: 6, played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 3, goalsAgainst: 4, goalDiff: -1 },
    { teamId: 15, teamName: 'Denmark', shortName: '丹麦', advanceProb: 0.48, groupRank: 3, points: 1, played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 1, goalsAgainst: 3, goalDiff: -2 },
    { teamId: 16, teamName: 'Tunisia', shortName: '突尼斯', advanceProb: 0.07, groupRank: 4, points: 4, played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 1, goalDiff: 0 },
  ]},
]
db.prepare('INSERT INTO group_predictions (tournament_id, groups_data) VALUES (?, ?)').run(1, JSON.stringify(groupData))
console.log('✅ 小组出线预测已插入')

// ====== 晋级路径预测 ======
const bracketData = {
  rounds: {
    ROUND_OF_16: [
      { id: 'r16_1', round: 'ROUND_OF_16', homeTeam: '荷兰', awayTeam: '美国', homeProb: 0.65, awayProb: 0.35, winner: '荷兰' },
      { id: 'r16_2', round: 'ROUND_OF_16', homeTeam: '阿根廷', awayTeam: '澳大利亚', homeProb: 0.78, awayProb: 0.22, winner: '阿根廷' },
      { id: 'r16_3', round: 'ROUND_OF_16', homeTeam: '日本', awayTeam: '克罗地亚', homeProb: 0.42, awayProb: 0.58, winner: '克罗地亚' },
      { id: 'r16_4', round: 'ROUND_OF_16', homeTeam: '巴西', awayTeam: '韩国', homeProb: 0.82, awayProb: 0.18, winner: '巴西' },
      { id: 'r16_5', round: 'ROUND_OF_16', homeTeam: '英格兰', awayTeam: '塞内加尔', homeProb: 0.72, awayProb: 0.28, winner: '英格兰' },
      { id: 'r16_6', round: 'ROUND_OF_16', homeTeam: '法国', awayTeam: '波兰', homeProb: 0.76, awayProb: 0.24, winner: '法国' },
      { id: 'r16_7', round: 'ROUND_OF_16', homeTeam: '摩洛哥', awayTeam: '西班牙', homeProb: 0.25, awayProb: 0.75, winner: '摩洛哥' },
      { id: 'r16_8', round: 'ROUND_OF_16', homeTeam: '葡萄牙', awayTeam: '塞内加尔', homeProb: 0.55, awayProb: 0.45, winner: '葡萄牙' },
    ],
    QUARTER_FINAL: [
      { id: 'qf_1', round: 'QUARTER_FINAL', homeTeam: '荷兰', awayTeam: '阿根廷', homeProb: 0.38, awayProb: 0.62, winner: '阿根廷' },
      { id: 'qf_2', round: 'QUARTER_FINAL', homeTeam: '克罗地亚', awayTeam: '巴西', homeProb: 0.15, awayProb: 0.85, winner: '巴西' },
      { id: 'qf_3', round: 'QUARTER_FINAL', homeTeam: '英格兰', awayTeam: '法国', homeProb: 0.48, awayProb: 0.52, winner: '法国' },
      { id: 'qf_4', round: 'QUARTER_FINAL', homeTeam: '摩洛哥', awayTeam: '葡萄牙', homeProb: 0.40, awayProb: 0.60, winner: '葡萄牙' },
    ],
    SEMI_FINAL: [
      { id: 'sf_1', round: 'SEMI_FINAL', homeTeam: '阿根廷', awayTeam: '巴西', homeProb: 0.42, awayProb: 0.58, winner: '阿根廷' },
      { id: 'sf_2', round: 'SEMI_FINAL', homeTeam: '法国', awayTeam: '葡萄牙', homeProb: 0.55, awayProb: 0.45, winner: '法国' },
    ],
    FINAL: [
      { id: 'final', round: 'FINAL', homeTeam: '阿根廷', awayTeam: '法国', homeProb: 0.48, awayProb: 0.52, winner: '阿根廷' },
    ],
  },
}
const teamProbs = [
  { teamId: 9, teamName: 'Argentina', shortName: '阿根廷', roundOf16: 1.0, quarterFinal: 0.78, semiFinal: 0.50, final: 0.35, champion: 0.22 },
  { teamId: 25, teamName: 'Brazil', shortName: '巴西', roundOf16: 1.0, quarterFinal: 0.82, semiFinal: 0.58, final: 0.32, champion: 0.18 },
  { teamId: 13, teamName: 'France', shortName: '法国', roundOf16: 1.0, quarterFinal: 0.76, semiFinal: 0.55, final: 0.28, champion: 0.16 },
  { teamId: 5, teamName: 'England', shortName: '英格兰', roundOf16: 1.0, quarterFinal: 0.72, semiFinal: 0.30, final: 0.12, champion: 0.07 },
  { teamId: 29, teamName: 'Portugal', shortName: '葡萄牙', roundOf16: 1.0, quarterFinal: 0.55, semiFinal: 0.22, final: 0.10, champion: 0.05 },
  { teamId: 21, teamName: 'Morocco', shortName: '摩洛哥', roundOf16: 1.0, quarterFinal: 0.40, semiFinal: 0.15, final: 0.06, champion: 0.03 },
  { teamId: 22, teamName: 'Croatia', shortName: '克罗地亚', roundOf16: 1.0, quarterFinal: 0.58, semiFinal: 0.12, final: 0.05, champion: 0.02 },
  { teamId: 1, teamName: 'Netherlands', shortName: '荷兰', roundOf16: 1.0, quarterFinal: 0.65, semiFinal: 0.18, final: 0.07, champion: 0.03 },
]
db.prepare('INSERT INTO bracket_predictions (tournament_id, bracket_data, team_probabilities) VALUES (?, ?, ?)').run(1, JSON.stringify(bracketData), JSON.stringify(teamProbs))
console.log('✅ 晋级路径预测已插入')

// ====== StatsBomb指标 ======
const insertSb = db.prepare('INSERT INTO statsbomb_metrics (match_id, home_xg, away_xg, home_possession, away_possession, home_passes, away_passes, home_pass_accuracy, away_pass_accuracy, home_shots, away_shots, home_shots_on_target, away_shots_on_target, home_fouls, away_fouls, home_corners, away_corners) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
for (let i = 0; i < matches.length; i++) {
  const homeXg = +(1.2 + Math.random() * 1.5).toFixed(2)
  const awayXg = +(0.6 + Math.random() * 1.2).toFixed(2)
  const poss = 45 + Math.floor(Math.random() * 15)
  const shots = 8 + Math.floor(Math.random() * 12)
  const awayShots = 4 + Math.floor(Math.random() * 10)
  insertSb.run(i + 1, homeXg, awayXg, poss, 100 - poss, 300 + Math.floor(Math.random() * 200), 250 + Math.floor(Math.random() * 200), +(70 + Math.random() * 20).toFixed(1), +(68 + Math.random() * 22).toFixed(1), shots, awayShots, Math.ceil(shots * 0.4), Math.ceil(awayShots * 0.35), 10 + Math.floor(Math.random() * 8), 8 + Math.floor(Math.random() * 10), 4 + Math.floor(Math.random() * 5), 3 + Math.floor(Math.random() * 4))
}
console.log(`✅ ${matches.length} 条StatsBomb指标已插入`)

// ====== 回测结果 ======
for (let i = 1; i <= matches.length; i++) {
  const t = predictionTemplates[(i - 1) % predictionTemplates.length]
  const m = matches[i - 1]
  const actualResult = (m.home_score || 0) > (m.away_score || 0) ? 'home' : (m.home_score || 0) < (m.away_score || 0) ? 'away' : 'draw'
  const spfCorrect = t.spf.recommendation === actualResult ? 1 : 0
  const totalGoals = (m.home_score || 0) + (m.away_score || 0)
  let ar: string; if (totalGoals <= 1) ar = '0-1'; else if (totalGoals <= 3) ar = '2-3'; else ar = '4+'
  const gc = t.goals.recommendation === ar ? 1 : 0
  const sc = 0
  const hc = t.handicap.recommendation === 'home' ? 1 : 0
  const acc = (spfCorrect + sc + hc + gc) / 4
  db.prepare('INSERT INTO backtest_results (prediction_id, match_id, tournament_id, actual_result, spf_correct, score_correct, handicap_correct, goals_correct, accuracy_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(i, i, 1, actualResult, spfCorrect, sc, hc, gc, acc)
}
console.log(`✅ ${matches.length} 条回测结果已插入`)

console.log('\n🎉 全部模拟数据插入完成！')
db.close()
