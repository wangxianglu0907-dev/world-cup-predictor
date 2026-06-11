<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { RetrospectiveAnalysis } from '../types'
import { useMatchDetail } from '../composables/useMatches'
import { useAIPrediction } from '../composables/useAIPrediction'
import { stageLabel, formatDateTime } from '../utils'
import AIPredictionTabs from '../components/ai/AIPredictionTabs.vue'
import AIAnalysisReport from '../components/ai/AIAnalysisReport.vue'
import AIOddsAnalysis from '../components/ai/AIOddsAnalysis.vue'
import AIxGAnalysis from '../components/ai/AIxGAnalysis.vue'
import RetrospectiveReport from '../components/retrospective/RetrospectiveReport.vue'
import SectionCard from '../components/common/SectionCard.vue'

const route = useRoute()
const id = Number(route.params.id)
const activeTab = ref<'prediction' | 'retrospective'>('prediction')

const { data: match } = useMatchDetail(id)
const { data: prediction, isLoading } = useAIPrediction(id)

// 从报告文本中提取博彩推荐部分
const bettingSection = computed(() => {
  const report = prediction.value?.analysisReport || ''
  const idx = report.indexOf('博彩推荐')
  if (idx < 0) return null
  const end = report.indexOf('【专业盘口分析', idx)
  const text = end > idx ? report.slice(idx, end) : report.slice(idx)
  return text.trim()
})

// 博彩推荐前面的7因子分析部分
const analysisPart = computed(() => {
  const report = prediction.value?.analysisReport || ''
  const idx = report.indexOf('博彩推荐')
  if (idx < 0) return report
  const profIdx = report.indexOf('【专业盘口分析', idx)
  return profIdx > idx ? report.slice(0, idx).trim() + '\n\n' + report.slice(profIdx).trim() : report.slice(0, idx).trim()
})

// 分割专业盘口
const proOdds = computed(() => {
  const report = prediction.value?.analysisReport || ''
  const idx = report.indexOf('【专业盘口分析')
  if (idx < 0) return null
  const end = report.indexOf('【爆冷预警', idx)
  return end > idx ? report.slice(idx, end).trim() : report.slice(idx).trim()
})

// 爆冷预警
const upsetAlert = computed(() => {
  const report = prediction.value?.analysisReport || ''
  const idx = report.indexOf('【爆冷预警')
  if (idx < 0) return null
  const end = report.indexOf('【博彩推荐', idx)
  return end > idx ? report.slice(idx, end).trim() : report.slice(idx).trim()
})

const retrospective = ref<RetrospectiveAnalysis>({
  id: 1, matchId: id,
  predictionVsActual: [],
  xgReview: { homeXg: 0, awayXg: 0, homePossession: 0, awayPossession: 0, homeShots: 0, awayShots: 0, analysis: '' },
  keyEvents: [],
  summary: '',
  createdAt: '',
})
</script>

<template>
  <div class="space-y-6">
    <!-- 比赛信息 -->
    <div class="rounded-apple bg-white shadow-apple p-8 text-center">
      <div class="flex items-center justify-between mb-6">
        <span class="text-[11px] text-apple-gray-light uppercase tracking-wide">{{ stageLabel(match?.stage || '') }}</span>
        <span class="text-[11px] text-apple-gray-light">{{ formatDateTime(match?.startTime || '') }}</span>
      </div>
      <div class="flex items-center justify-center gap-10">
        <div>
          <p class="text-xs text-apple-gray mb-1.5 uppercase tracking-wide">主队</p>
          <p class="text-xl font-bold text-apple-gray-dark">{{ match?.homeTeam?.name || '主队' }}</p>
        </div>
        <div class="flex flex-col items-center">
          <p class="text-2xl font-bold text-apple-gray-dark tracking-tight">
            {{ match?.status === 'SCHEDULED' ? 'vs' : `${match?.homeScore || 0} – ${match?.awayScore || 0}` }}
          </p>
          <p v-if="match?.handicap" class="text-[11px] text-apple-gray mt-0.5">让球 {{ match.handicap }}</p>
        </div>
        <div>
          <p class="text-xs text-apple-gray mb-1.5 uppercase tracking-wide">客队</p>
          <p class="text-xl font-bold text-apple-gray-dark">{{ match?.awayTeam?.name || '客队' }}</p>
        </div>
      </div>
    </div>

    <!-- Tab -->
    <div class="flex gap-0 border-b border-gray-100">
      <button
        @click="activeTab = 'prediction'"
        class="px-4 pb-2.5 text-[13px] border-b-2 -mb-px transition-colors"
        :class="activeTab === 'prediction' ? 'border-apple-blue text-apple-blue font-medium' : 'border-transparent text-apple-gray'"
      >AI 预测报告</button>
      <button
        v-if="match?.status === 'FINISHED'"
        @click="activeTab = 'retrospective'"
        class="px-4 pb-2.5 text-[13px] border-b-2 -mb-px transition-colors"
        :class="activeTab === 'retrospective' ? 'border-apple-blue text-apple-blue font-medium' : 'border-transparent text-apple-gray'"
      >赛后回溯</button>
    </div>

    <!-- AI预测 -->
    <div v-if="activeTab === 'prediction' && prediction">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <!-- 博彩推荐 -->
          <div v-if="bettingSection" class="rounded-apple bg-white shadow-apple border-l-2 border-apple-blue p-5">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-sm font-semibold text-apple-gray-dark">🎯 博彩推荐 · 胆大心细</span>
            </div>
            <div class="text-[13px] text-apple-gray-dark leading-relaxed whitespace-pre-wrap">
              {{ bettingSection.replace('【博彩推荐 · 胆大心细】', '').replace(/\n\n/g, '\n').trim() }}
            </div>
          </div>

          <SectionCard title="四维预测" subtitle="胜平负 / 比分 / 让球 / 总进球">
            <AIPredictionTabs :prediction="prediction" />
          </SectionCard>

          <!-- 爆冷预警 -->
          <div v-if="upsetAlert" class="rounded-apple bg-white shadow-apple border-l-2 border-red-400 p-4">
            <div class="text-xs text-apple-gray uppercase tracking-wide mb-1">爆冷预警</div>
            <div class="text-[12px] text-apple-gray-dark leading-relaxed whitespace-pre-wrap">{{ upsetAlert.replace('【爆冷预警', '').trim() }}</div>
          </div>

          <SectionCard title="AI 综合报告">
            <AIAnalysisReport :report="analysisPart" />
          </SectionCard>
        </div>
        <div class="space-y-6">
          <SectionCard title="赔率分析">
            <AIOddsAnalysis v-if="prediction.oddsAnalysis" :odds="prediction.oddsAnalysis" />
          </SectionCard>
          <SectionCard title="xG 指标">
            <AIxGAnalysis v-if="prediction.xgAnalysis" :xg="prediction.xgAnalysis" />
          </SectionCard>
          <!-- 专业盘口 -->
          <div v-if="proOdds" class="rounded-apple bg-white shadow-apple border-l-2 border-blue-400 p-4">
            <div class="text-xs text-apple-gray uppercase tracking-wide mb-2">专业盘口</div>
            <div class="text-[11px] text-apple-gray-dark leading-relaxed whitespace-pre-wrap">{{ proOdds.replace('【专业盘口分析', '').trim() }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-else-if="activeTab === 'prediction' && isLoading" class="text-center py-12 text-apple-gray text-sm">
      加载AI预测报告...
    </div>

    <!-- 回溯 -->
    <div v-else-if="activeTab === 'retrospective'">
      <SectionCard title="赛后回溯" subtitle="预测 vs 实际 · 关键事件 · xG 复盘">
        <RetrospectiveReport :analysis="retrospective" />
      </SectionCard>
    </div>
  </div>
</template>
