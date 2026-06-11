<script setup lang="ts">
import { formatPercent } from '../../utils'
import type { HandicapPrediction } from '../../types'

defineProps<{ handicap: HandicapPrediction }>()
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2 text-sm">
      <span class="text-apple-gray">让球：</span>
      <span class="font-mono font-medium text-apple-gray-dark">{{ handicap.handicap > 0 ? `+${handicap.handicap}` : handicap.handicap }}</span>
    </div>
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-lg bg-gray-50 p-3 text-center" v-for="item in [
        { k: 'home', l: '主胜' }, { k: 'draw', l: '平局' }, { k: 'away', l: '客胜' }
      ]" :key="item.k">
        <p class="text-[11px] text-apple-gray">{{ item.l }}</p>
        <p class="text-base font-semibold text-apple-gray-dark">{{ formatPercent((handicap as any)[item.k]) }}</p>
      </div>
    </div>
    <div class="rounded-lg bg-blue-50 p-3.5 text-center">
      <span class="text-[13px] text-apple-blue font-medium">
        AI推荐：{{ handicap.recommendation === 'home' ? '主胜' : '客胜' }} · 置信度 {{ formatPercent(handicap.confidence) }}
      </span>
    </div>
  </div>
</template>
