<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useTournamentStore } from '../stores/tournament'
import { getTournaments, getAIStatus } from '../api'
import type { Tournament, AIStatus } from '../../types'
import TournamentSelector from '../components/tournament/TournamentSelector.vue'
import SectionCard from '../components/common/SectionCard.vue'

const store = useTournamentStore()
const tournaments = ref<Tournament[]>([])
const loading = ref(true)
const aiStatus = ref<AIStatus | null>(null)

onMounted(async () => {
  try {
    const [tData, status] = await Promise.all([getTournaments(), getAIStatus()])
    tournaments.value = tData
    aiStatus.value = status
    store.setTournamentList(tournaments.value)
    if (tournaments.value.length) store.setCurrentTournament(tournaments.value[0])
  } catch {}
  loading.value = false
})
</script>

<template>
  <div class="space-y-8">
    <!-- Hero -->
    <div class="text-center py-12">
      <h1 class="text-3xl font-bold tracking-tight text-apple-gray-dark">World Cup Predictor</h1>
      <p class="mt-3 text-sm text-apple-gray max-w-lg mx-auto leading-relaxed">
        基于 StatsBomb xG 高级指标与多维赔率分析，
        智能预测每场比赛的胜平负、比分、让球及总进球数。
      </p>
      <div class="flex gap-3 justify-center mt-6">
        <RouterLink to="/matches" class="rounded-full bg-apple-blue text-white px-5 py-2 text-[13px] font-medium hover:bg-apple-blue-hover transition-colors">
          查看比赛预测
        </RouterLink>
        <RouterLink to="/bracket" class="rounded-full bg-gray-100 text-apple-gray-dark px-5 py-2 text-[13px] font-medium hover:bg-gray-200 transition-colors">
          晋级路径 →
        </RouterLink>
      </div>
    </div>

    <!-- 赛事选择 -->
    <TournamentSelector v-if="tournaments.length" v-model="store.currentTournamentId" :tournaments="tournaments" />

    <!-- 快速入口 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <RouterLink to="/matches" class="rounded-apple bg-white shadow-apple p-5 text-center hover:shadow-apple-lg transition-shadow">
        <p class="text-2xl mb-1">📅</p>
        <p class="text-[13px] font-medium text-apple-gray-dark">比赛预测</p>
        <p class="text-[11px] text-apple-gray mt-0.5">AI 四维分析</p>
      </RouterLink>
      <RouterLink to="/groups" class="rounded-apple bg-white shadow-apple p-5 text-center hover:shadow-apple-lg transition-shadow">
        <p class="text-2xl mb-1">📊</p>
        <p class="text-[13px] font-medium text-apple-gray-dark">小组出线</p>
        <p class="text-[11px] text-apple-gray mt-0.5">Monte Carlo 模拟</p>
      </RouterLink>
      <RouterLink to="/bracket" class="rounded-apple bg-white shadow-apple p-5 text-center hover:shadow-apple-lg transition-shadow">
        <p class="text-2xl mb-1">🏆</p>
        <p class="text-[13px] font-medium text-apple-gray-dark">晋级路径</p>
        <p class="text-[11px] text-apple-gray mt-0.5">夺冠概率排名</p>
      </RouterLink>
      <RouterLink to="/matches" class="rounded-apple bg-white shadow-apple p-5 text-center hover:shadow-apple-lg transition-shadow">
        <p class="text-2xl mb-1">🔍</p>
        <p class="text-[13px] font-medium text-apple-gray-dark">赛后回溯</p>
        <p class="text-[11px] text-apple-gray mt-0.5">xG 复盘分析</p>
      </RouterLink>
    </div>

    <!-- 数据源状态 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <SectionCard title="数据更新时间">
        <div class="space-y-1.5">
          <div v-for="(ds, key) in aiStatus?.dataSources" :key="key" class="flex justify-between items-center">
            <span class="text-xs text-apple-gray">{{ (ds as any).label || key }}</span>
            <span class="text-[11px]" :class="(ds as any).status === 'ok' ? 'text-green-600' : 'text-red-500'">
              {{ (ds as any).lastSync ? new Date((ds as any).lastSync).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '未同步' }}
            </span>
          </div>
          <div class="flex justify-between items-center pt-1 border-t border-gray-100">
            <span class="text-xs text-apple-gray">AI 预测</span>
            <span class="text-[11px] text-apple-blue">
              {{ aiStatus?.aiPredictLastRun ? new Date(aiStatus.aiPredictLastRun).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '未运行' }}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs text-apple-gray">定时任务</span>
            <span class="text-[11px] text-apple-gray-light">{{ aiStatus?.nextRunAt || '20/21/09点' }}</span>
          </div>
        </div>
      </SectionCard>
      <SectionCard title="AI 引擎">
        <p class="text-xs" :class="aiStatus?.status === 'idle' ? 'text-green-600' : 'text-apple-blue'">
          {{ aiStatus?.status === 'running' ? '⏳ 运行中' : (aiStatus?.status === 'idle' ? '✅ 待命中' : '❌ 异常') }}
        </p>
        <p class="text-[11px] text-apple-gray-light mt-0.5">
          {{ aiStatus?.lastAction ? aiStatus.lastAction : '空闲' }}
        </p>
      </SectionCard>
      <SectionCard title="回测准确率">
        <p class="text-xs text-apple-gray-dark font-semibold">
          {{ aiStatus?.latestBacktestAccuracy ? (aiStatus.latestBacktestAccuracy * 100).toFixed(0) + '%' : '暂无数据' }}
        </p>
        <p class="text-[11px] text-apple-gray-light mt-0.5">近7日均值（赛前为0）</p>
      </SectionCard>
    </div>
  </div>
</template>
