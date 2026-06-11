<script setup lang="ts">
import type { BracketMatch } from '../../types'
defineProps<{ rounds: Record<string, BracketMatch[]>; champion: string | null }>()

const labels: Record<string, string> = {
  ROUND_OF_16: '1/8 决赛', QUARTER_FINAL: '1/4 决赛', SEMI_FINAL: '半决赛',
  FINAL: '决赛', THIRD_PLACE: '三四名',
}
</script>

<template>
  <div class="overflow-x-auto">
    <div class="flex gap-3 min-w-[800px]">
      <div v-for="(label, round) in labels" :key="round" class="flex-1 min-w-[130px]">
        <p class="text-[10px] text-apple-gray uppercase tracking-wide mb-3 text-center">{{ label }}</p>
        <div class="space-y-2">
          <div
            v-for="(m, i) in rounds[round] || []" :key="i"
            class="rounded-lg bg-gray-50 p-2.5 text-center"
          >
            <p class="text-[12px] font-medium text-apple-gray-dark">{{ m.homeTeam || '—' }}</p>
            <p class="text-[11px] text-apple-gray-light my-0.5">vs</p>
            <p class="text-[12px] font-medium text-apple-gray-dark">{{ m.awayTeam || '—' }}</p>
            <p v-if="m.homeProb !== null" class="text-[10px] text-apple-blue mt-1">
              主 {{ (m.homeProb * 100).toFixed(0) }}%
            </p>
          </div>
        </div>
      </div>
    </div>
    <div v-if="champion" class="mt-8 text-center">
      <span class="text-xs text-apple-gray">🏆 冠军预测：</span>
      <span class="text-base font-bold text-apple-gray-dark">{{ champion }}</span>
    </div>
  </div>
</template>
