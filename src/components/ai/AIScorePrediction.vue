<script setup lang="ts">
import { computed } from 'vue'
import { formatPercent } from '../../utils'
import type { ScoreDistribution } from '../../types'

const props = defineProps<{ scores: ScoreDistribution[] }>()
const top = computed(() => [...props.scores].sort((a, b) => b.probability - a.probability).slice(0, 6))
</script>

<template>
  <div class="space-y-2.5">
    <p class="text-[11px] text-apple-gray-light mb-2 uppercase tracking-wide">比分概率分布</p>
    <div v-for="s in top" :key="s.score" class="flex items-center gap-3">
      <span class="w-10 text-[13px] font-mono font-medium text-apple-gray-dark">{{ s.score }}</span>
      <div class="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full bg-apple-blue/70" :style="{ width: formatPercent(s.probability) }" />
      </div>
      <span class="w-12 text-right text-[11px] text-apple-gray">{{ formatPercent(s.probability) }}</span>
    </div>
  </div>
</template>
