<script setup lang="ts">
import type { XgSummary } from '../../types'

defineProps<{ xg: XgSummary }>()
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-lg bg-gray-50 p-3 text-center">
        <p class="text-[11px] text-apple-gray">主队 xG</p>
        <p class="text-xl font-semibold text-apple-gray-dark">{{ xg.homeXg.toFixed(2) }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 p-3 text-center">
        <p class="text-[11px] text-apple-gray">客队 xG</p>
        <p class="text-xl font-semibold text-apple-gray-dark">{{ xg.awayXg.toFixed(2) }}</p>
      </div>
    </div>
    <div class="flex justify-between text-[11px] text-apple-gray">
      <span>控球率 {{ xg.homePossession }}% / {{ xg.awayPossession }}%</span>
      <span>射门 {{ xg.homeShots }} / {{ xg.awayShots }}</span>
    </div>
    <p class="text-xs text-apple-gray leading-relaxed">{{ xg.analysis }}</p>
  </div>
</template>
