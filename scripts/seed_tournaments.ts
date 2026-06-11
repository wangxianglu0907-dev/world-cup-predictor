import { getDB } from '../server/db.js'

/**
 * 种子数据脚本：初始化2022卡塔尔世界杯基础数据
 * 后续通过API/爬虫自动补充完整数据
 */
export function seedTournaments(): void {
  const db = getDB()

  const existing = db.prepare('SELECT COUNT(*) as count FROM tournaments').get() as any
  if (existing.count > 0) {
    console.log('📋 Tournaments data already exists, skipping seed...')
    return
  }

  console.log('🌱 Seeding tournament data...')

  // 插入赛事
  db.prepare("INSERT INTO tournaments (name, season, year, host_country, status) VALUES (?, ?, ?, ?, ?)").run('FIFA World Cup 2022', '2022', 2022, 'Qatar', 'FINISHED')
  db.prepare("INSERT INTO tournaments (name, season, year, host_country, status) VALUES (?, ?, ?, ?, ?)").run('FIFA World Cup 2018', '2018', 2018, 'Russia', 'FINISHED')

  console.log('✅ Seed data inserted')
}

// CLI 直接运行
seedTournaments()
