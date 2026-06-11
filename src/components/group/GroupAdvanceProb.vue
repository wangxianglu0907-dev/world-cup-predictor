<script setup lang="ts">
import { formatPercent } from '../../utils'
import type { TeamAdvanceProb } from '../../types'
defineProps<{ standings: TeamAdvanceProb[] }>()
</script>

<template>
  <div class="space-y-2.5">
    <p class="text-[11px] text-apple-gray uppercase tracking-wide mb-2">出线概率</p>
    <div v-for="t in standings" :key="t.teamId" class="flex items-center gap-3">
      <span class="w-14 text-xs text-apple-gray-dark">{{ t.shortName }}</span>
      <div class="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full bg-apple-blue/60" :style="{ width: formatPercent(t.advanceProb) }" />
      </div>
      <span class="w-12 text-right text-[11px] text-apple-gray">{{ formatPercent(t.advanceProb) }}</span>
    </div>
  </div>
</template>
