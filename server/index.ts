import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDB } from './db.js'
import { apiRouter } from './routes/api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const isProd = process.env.NODE_ENV === 'production'

const app = express()

app.use(cors())
app.use(express.json())

// 初始化数据库
initDB()

// API路由
app.use('/api', apiRouter)

// 健康检查
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// 生产模式：serve 前端静态文件 + SPA fallback
if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  const mode = isProd ? 'PRODUCTION' : 'DEV'
  console.log(`✅ World Cup Predictor [${mode}] on http://localhost:${PORT}`)
  // 启动定时任务引擎（北京时间 20:00采集/21:00预测/09:00回溯）
  import('./ai/scheduler.js').then(() => {
    console.log('⏰ 定时任务引擎已启动')
  })
})
