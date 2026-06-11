<script setup lang="ts">
import { formatPercent } from '../../utils'
import type { GoalsPrediction } from '../../types'

defineProps<{ goals: GoalsPrediction }>()

const ranges = [
  { k: 'range0_1' as const, l: '0-1 球' },
  { k: 'range2_3' as const, l: '2-3 球' },
  { k: 'range4_plus' as const, l: '4+ 球' },
]
</script>

<template>
  <div class="space-y-2.5">
    <p class="text-[11px] text-apple-gray-light mb-2 uppercase tracking-wide">总进球概率</p>
    <div v-for="r in ranges" :key="r.k" class="flex items-center gap-3">
      <span class="w-12 text-[13px] text-apple-gray-dark">{{ r.l }}</span>
      <div class="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all"
          :class="goals.recommendation === r.l ? 'bg-apple-blue' : 'bg-apple-blue/30'"
          :style="{ width: formatPercent(goals[r.k]) }"
        />
      </div>
      <span class="w-12 text-right text-[11px] text-apple-gray">{{ formatPercent(goals[r.k]) }}</span>
    </div>
    <div class="rounded-lg bg-blue-50 p-3.5 text-center mt-3">
      <span class="text-[13px] text-apple-blue font-medium">
        AI推荐：{{ goals.recommendation }}球 · 置信度 {{ formatPercent(goals.confidence) }}
      </span>
    </div>
  </div>
</template>
