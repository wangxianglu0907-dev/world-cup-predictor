<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { BracketMatch, TeamKnockoutProb } from '../types'
import { getBracketPrediction } from '../api'
import BracketTreeChart from '../components/bracket/BracketTreeChart.vue'
import TeamAdvanceProb from '../components/bracket/TeamAdvanceProb.vue'
import ChampionRanking from '../components/bracket/ChampionRanking.vue'
import SectionCard from '../components/common/SectionCard.vue'
import LoadingState from '../components/common/LoadingState.vue'
import EmptyState from '../components/common/EmptyState.vue'

const loading = ref(true)
const rounds = ref<Record<string, BracketMatch[]>>({})
const teamProbs = ref<TeamKnockoutProb[]>([])
const error = ref('')

onMounted(async () => {
  try {
    const { getBracketPrediction } = await import('../api')
    const res = await getBracketPrediction(1)
    rounds.value = res.bracketData?.rounds || {}
    teamProbs.value = res.teamProbabilities || []
  } catch (e: any) {
    error.value = e.message || '加载失败'
  }
  loading.value = false
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-apple-gray-dark">晋级路径预测</h1>
      <p class="text-xs text-apple-gray mt-1">基于每场 AI 预测结果的概率传导，逐轮推算各队晋级概率</p>
    </div>

    <LoadingState v-if="loading" />
    <EmptyState v-else-if="error || !teamProbs.length" :title="error || '暂无晋级数据'" description="请先执行AI预测" />

    <template v-else>
      <SectionCard title="淘汰赛对阵">
        <BracketTreeChart :rounds="rounds" champion="—" />
      </SectionCard>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="晋级概率" subtitle="16强 → 8强 → 4强 → 决赛 → 冠军">
          <TeamAdvanceProb :teams="teamProbs" />
        </SectionCard>
        <SectionCard title="夺冠排名" subtitle="Top 8">
          <ChampionRanking :teams="teamProbs" />
        </SectionCard>
      </div>
    </template>
  </div>
</template>
