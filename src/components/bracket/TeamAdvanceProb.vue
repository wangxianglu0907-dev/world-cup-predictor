<script setup lang="ts">
import { computed } from 'vue'
import { formatPercent } from '../../utils'
import type { TeamKnockoutProb } from '../../types'

const props = defineProps<{ teams: TeamKnockoutProb[] }>()
const sorted = computed(() => [...props.teams].sort((a, b) => b.champion - a.champion))
</script>

<template>
  <div class="space-y-2">
    <div v-for="t in sorted" :key="t.teamId" class="flex items-center gap-2">
      <span class="w-14 text-xs text-apple-gray-dark">{{ t.shortName }}</span>
      <div class="flex-1 flex h-2 rounded-full overflow-hidden">
        <div class="bg-blue-200" :style="{ width: formatPercent(t.roundOf16 - t.quarterFinal) }" />
        <div class="bg-blue-300" :style="{ width: formatPercent(t.quarterFinal - t.semiFinal) }" />
        <div class="bg-blue-400" :style="{ width: formatPercent(t.semiFinal - t.final) }" />
        <div class="bg-apple-blue" :style="{ width: formatPercent(t.final) }" />
      </div>
      <span class="w-10 text-right text-[11px] text-apple-gray">{{ formatPercent(t.champion) }}</span>
    </div>
    <div class="flex gap-3 mt-3 text-[10px] text-apple-gray-light">
      <span>◻ 16强</span><span>◻ 8强</span><span>◻ 4强</span><span>◼ 夺冠</span>
    </div>
  </div>
</template>
