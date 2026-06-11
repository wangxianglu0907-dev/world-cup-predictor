<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'

interface SingleBet {
  matchId: number; homeTeam: string; awayTeam: string
  startTime: string; groupName: string; venue: string
  type: string; pick: string; odds: number; prob: number; ev: number
  kellyStake: number; confidence: string; reasoning: string
  signalQuality: string; infoAdvantage: number
  hoursUntilMatch: number; urgency: string; urgencyLabel: string
  oddsConfidence: number
}
interface ComboBet {
  type: string; label: string; emoji: string; bets: SingleBet[]
  totalOdds: number; ev: number; kellyStake: number
  riskLevel: string; tagline: string
}
interface GamblerReport {
  live: SingleBet[]; soon: SingleBet[]; upcoming: SingleBet[]
  combos: ComboBet[]; summary: { totalBets: number; avgEV: string; timeRange: string; note: string }
}

const data = ref<GamblerReport | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch('/api/ai/gambler')
    data.value = await res.json()
  } catch { data.value = null }
  loading.value = false
})

const typeLabels: Record<string, string> = { spf: '胜平负', handicap: '让球', score: '比分', goals: '总进球', halffull: '半全场' }
const confColors: Record<string, string> = { safe: 'bg-green-100 text-green-700', value: 'bg-blue-100 text-blue-700', bold: 'bg-amber-100 text-amber-700' }

function countdown(h: number): string {
  if (h <= 0) return '已开赛'
  if (h < 1) return `${Math.round(h * 60)}分钟后`
  if (h < 24) return `${Math.floor(h)}时${Math.round((h % 1) * 60)}分后`
  return `${Math.floor(h / 24)}天${Math.floor(h % 24)}时后`
}
function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return '待定' }
}

const noData = computed(() => !loading.value && !data.value?.live?.length && !data.value?.soon?.length && !data.value?.upcoming?.length)
</script>

<template>
  <div class="space-y-6">
    <!-- 标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-apple-gray-dark">🎰 搏一搏，单车变摩托</h1>
        <p class="text-xs text-apple-gray mt-1">只推未来48h内比赛 · 水位稳定才出手 · 紧迫度越高越可靠</p>
      </div>
      <div v-if="data" class="text-right text-[11px] text-apple-gray-light">
        <div>{{ data.summary.totalBets }}条推荐</div>
        <div>平均EV {{ data.summary.avgEV }}</div>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-apple-gray text-sm">AI 正在分析赔率市场...</div>

    <div v-if="noData" class="text-center py-12">
      <p class="text-apple-gray text-sm">{{ data?.summary?.note || '暂无高价值推荐' }}</p>
      <p class="text-xs text-apple-gray-light mt-2">未来48h内没有比赛，水位还不够稳定。请稍后重试。</p>
    </div>

    <!-- 🔴 临场 -->
    <section v-if="data?.live?.length" class="rounded-apple bg-white shadow-apple border-l-2 border-red-400 overflow-hidden">
      <div class="px-5 py-3 bg-red-50 border-b border-red-100">
        <span class="text-sm font-semibold text-red-700">🕒 即将开赛 · 12小时内</span>
        <span class="text-[11px] text-red-500 ml-2">{{ data.live.length }}条 · 水位锁定 · 最可信</span>
      </div>
      <div class="divide-y divide-gray-50">
        <div v-for="b in data.live.slice(0, 12)" :key="b.matchId +'-'+ b.type" class="px-5 py-3 hover:bg-gray-50/50">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="rounded px-1.5 py-0.5 text-[10px] font-medium" :class="confColors[b.confidence]">{{ typeLabels[b.type] }}</span>
            <span class="text-[13px] font-medium text-apple-gray-dark">{{ b.homeTeam }} vs {{ b.awayTeam }}</span>
            <span class="text-[11px] text-apple-gray-light">{{ b.groupName }}组</span>
          </div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[11px] text-apple-gray">📅 {{ fmtTime(b.startTime) }}</span>
            <span class="text-[11px] font-medium text-red-600">⏱ {{ countdown(b.hoursUntilMatch) }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm font-bold text-amber-600">{{ b.pick }} @{{ b.odds }}</span>
            <span class="text-[12px] font-medium" :class="b.ev > 0.05 ? 'text-green-600' : 'text-apple-gray-dark'">EV{{ (b.ev > 0 ? '+' : '') }}{{ (b.ev * 100).toFixed(1) }}%</span>
            <span class="text-[11px] text-apple-gray-light">水位{{ (b.oddsConfidence * 100).toFixed(0) }}% · 仓位{{ (b.kellyStake * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 🕑 明日 -->
    <section v-if="data?.soon?.length" class="rounded-apple bg-white shadow-apple border-l-2 border-apple-blue overflow-hidden">
      <div class="px-5 py-3 bg-blue-50 border-b border-blue-100">
        <span class="text-sm font-semibold text-blue-700">🕑 明日焦点 · 12-24小时内</span>
        <span class="text-[11px] text-blue-500 ml-2">{{ data.soon.length }}条 · 水位较稳 · 主力推荐区</span>
      </div>
      <div class="divide-y divide-gray-50">
        <div v-for="b in data.soon.slice(0, 15)" :key="b.matchId +'-soon-'+ b.type" class="px-5 py-3 hover:bg-gray-50/50">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="rounded px-1.5 py-0.5 text-[10px] font-medium" :class="confColors[b.confidence]">{{ typeLabels[b.type] }}</span>
            <span class="text-[13px] font-medium text-apple-gray-dark">{{ b.homeTeam }} vs {{ b.awayTeam }}</span>
            <span class="text-[11px] text-apple-gray-light">{{ b.groupName }}组</span>
          </div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[11px] text-apple-gray">📅 {{ fmtTime(b.startTime) }}</span>
            <span class="text-[11px] font-medium text-apple-blue">⏱ {{ countdown(b.hoursUntilMatch) }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm font-bold text-amber-600">{{ b.pick }} @{{ b.odds }}</span>
            <span class="text-[12px] font-medium" :class="b.ev > 0.05 ? 'text-green-600' : 'text-apple-gray-dark'">EV{{ (b.ev > 0 ? '+' : '') }}{{ (b.ev * 100).toFixed(1) }}%</span>
            <span class="text-[11px] text-apple-gray-light">水位{{ (b.oddsConfidence * 100).toFixed(0) }}% · 仓位{{ (b.kellyStake * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 🕐 前瞻 -->
    <section v-if="data?.upcoming?.length" class="rounded-apple bg-white shadow-apple overflow-hidden">
      <div class="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <span class="text-sm font-semibold text-apple-gray-dark">🕐 前瞻分析 · 24-48小时</span>
        <span class="text-[11px] text-apple-gray ml-2">{{ data.upcoming.length }}条 · 水位初定 · 仅供参考</span>
      </div>
      <div class="divide-y divide-gray-50">
        <div v-for="b in data.upcoming.slice(0, 8)" :key="b.matchId +'-up-'+ b.type" class="px-5 py-3 hover:bg-gray-50/50">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="rounded px-1.5 py-0.5 text-[10px] font-medium" :class="confColors[b.confidence]">{{ typeLabels[b.type] }}</span>
            <span class="text-[13px] font-medium text-apple-gray-dark">{{ b.homeTeam }} vs {{ b.awayTeam }}</span>
            <span class="text-[11px] text-apple-gray-light">{{ b.groupName }}组</span>
          </div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[11px] text-apple-gray">📅 {{ fmtTime(b.startTime) }}</span>
            <span class="text-[11px] font-medium text-apple-gray">⏱ {{ countdown(b.hoursUntilMatch) }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm font-bold text-amber-600">{{ b.pick }} @{{ b.odds }}</span>
            <span class="text-[12px] text-apple-gray">EV{{ (b.ev > 0 ? '+' : '') }}{{ (b.ev * 100).toFixed(1) }}%</span>
            <span class="text-[11px] text-apple-gray-light">水位{{ (b.oddsConfidence * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 串关 -->
    <section v-if="data?.combos?.length" class="rounded-apple bg-white shadow-apple p-5">
      <div class="text-sm font-semibold text-apple-gray-dark mb-3">🎯 精选串关（每场只选1腿 · 不同比赛组合）</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div v-for="(c, i) in data.combos" :key="i" class="rounded-lg p-4 border"
          :class="c.type === 'score3x1' || c.type === 'cold3x1' ? 'border-amber-300 bg-amber-50/30' : 'border-gray-100 bg-gray-50/30'">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">{{ c.emoji }}</span>
            <span class="text-[13px] font-semibold">{{ c.label }}</span>
            <span class="text-[10px] rounded px-1.5 py-0.5 border"
              :class="c.type === 'score3x1' || c.type === 'cold3x1' ? 'border-amber-300 text-amber-600' : 'border-green-300 text-green-600'">
              {{ c.riskLevel }}
            </span>
          </div>
          <!-- 每腿带比赛名+pick -->
          <div class="space-y-1 mb-3">
            <div v-for="b in c.bets" :key="b.matchId + b.type" class="flex items-center justify-between text-[11px]">
              <span class="text-apple-gray truncate mr-2">
                <span class="rounded px-1 py-0.5 text-[9px] mr-1" :class="confColors[b.confidence]">{{ typeLabels[b.type] || b.type }}</span>
                {{ b.homeTeam }} vs {{ b.awayTeam }}
              </span>
              <span class="whitespace-nowrap">
                <span class="text-apple-gray-dark">{{ b.pick }}</span>
                <span class="text-amber-600 font-medium ml-1">@{{ b.odds }}</span>
              </span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-bold text-amber-600">@{{ c.totalOdds }}倍</span>
            <span class="text-[10px] text-apple-gray">{{ c.tagline }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
