<script setup lang="ts">
import type { OddsSummary } from '../../types'

defineProps<{ odds: OddsSummary }>()

const mm: Record<string, string> = {
  stable: '稳定', home_drop: '主胜赔率↓', away_drop: '客胜赔率↓', draw_drop: '平局赔率↓',
}
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-lg bg-gray-50 p-3 text-center" v-for="item in [
        { l: '主胜', v: odds.homeWin.toFixed(2) },
        { l: '平局', v: odds.draw.toFixed(2) },
        { l: '客胜', v: odds.awayWin.toFixed(2) }
      ]" :key="item.l">
        <p class="text-[11px] text-apple-gray">{{ item.l }}</p>
        <p class="text-base font-semibold text-apple-gray-dark">{{ item.v }}</p>
      </div>
    </div>
    <p class="text-[11px] text-apple-gray-light">走势：{{ mm[odds.movement] || odds.movement }} · 来源：{{ odds.source }}</p>
    <p class="text-xs text-apple-gray leading-relaxed">{{ odds.analysis }}</p>
  </div>
</template>
