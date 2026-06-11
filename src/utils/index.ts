export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatPercent(val: number): string {
  return `${(val * 100).toFixed(1)}%`
}

export function riskColor(level: string): string {
  const map: Record<string, string> = { low: '#22C55E', medium: '#EAB308', high: '#EF4444' }
  return map[level] || '#E5E7EB'
}

export function riskLabel(level: string): string {
  const map: Record<string, string> = { low: '低风险', medium: '中风险', high: '高风险' }
  return map[level] || level
}

export function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    GROUP: '小组赛',
    ROUND_OF_16: '1/8决赛',
    QUARTER_FINAL: '1/4决赛',
    SEMI_FINAL: '半决赛',
    THIRD_PLACE: '三四名决赛',
    FINAL: '决赛',
  }
  return map[stage] || stage
}
