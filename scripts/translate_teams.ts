import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(__dirname, '..', 'server', 'data', 'worldcup.db')
const db = new Database(DB)

// 48支球队 德文/英文 → 中文 映射
const cnNames: Record<string, string> = {
  'Mexiko': '墨西哥', 'Südkorea': '韩国', 'Tschechien': '捷克',
  'Kanada': '加拿大', 'Bosnien und Herzegowina': '波黑',
  'USA': '美国', 'Paraguay': '巴拉圭',
  'Australien': '澳大利亚', 'Türkei': '土耳其',
  'Katar': '卡塔尔', 'Schweiz': '瑞士',
  'Brasilien': '巴西', 'Marokko': '摩洛哥',
  'Haiti': '海地', 'Schottland': '苏格兰',
  'Deutschland': '德国', 'Curaçao': '库拉索',
  'Niederlande': '荷兰', 'Japan': '日本',
  'Argentinien': '阿根廷', 'Algerien': '阿尔及利亚',
  'Jordanien': '约旦', 'Österreich': '奥地利',
  'Belgien': '比利时', 'Ägypten': '埃及',
  'Iran': '伊朗', 'Neuseeland': '新西兰',
  'Frankreich': '法国', 'Südafrika': '南非',
  'DR Kongo': '刚果(金)', 'Irak': '伊拉克',
  'England': '英格兰', 'Serbien': '塞尔维亚',
  'Spanien': '西班牙', 'Costa Rica': '哥斯达黎加',
  'Italien': '意大利', 'Chile': '智利',
  'Portugal': '葡萄牙', 'Ghana': '加纳',
  'Uruguay': '乌拉圭', 'Slowakei': '斯洛伐克',
  'Dänemark': '丹麦', 'Griechenland': '希腊',
  'Kroatien': '克罗地亚', 'Slowenien': '斯洛文尼亚',
  'Kolumbien': '哥伦比亚', 'Peru': '秘鲁',
  'Senegal': '塞内加尔', 'Tunesien': '突尼斯',
  'Schweden': '瑞典', 'Norwegen': '挪威',
  'Polen': '波兰', 'Ukraine': '乌克兰',
  'Ecuador': '厄瓜多尔', 'Saudi Arabien': '沙特阿拉伯',
  'Kap Verde': '佛得角', 'Elfenbeinküste': '科特迪瓦',
  'Usbekistan': '乌兹别克斯坦', 'Panama': '巴拿马',
}

const teams = db.prepare('SELECT * FROM teams WHERE tournament_id = 1').all() as any[]
let updated = 0

for (const t of teams) {
  const cn = cnNames[t.name]
  if (cn) {
    db.prepare('UPDATE teams SET name = ?, short_name = ? WHERE id = ?').run(cn, cn, t.id)
    console.log(`  ${t.name} → ${cn}`)
    updated++
  } else {
    console.log(`  ⚠ 无映射: ${t.name}`)
  }
}

console.log(`\n✅ 更新了 ${updated}/${teams.length} 支球队为中文名`)
db.close()
