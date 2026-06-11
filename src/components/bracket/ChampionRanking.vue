<script setup lang="ts">
import { computed } from 'vue'
import { formatPercent } from '../../utils'
import type { TeamKnockoutProb } from '../../types'

const props = defineProps<{ teams: TeamKnockoutProb[] }>()
const top8 = computed(() => [...props.teams].sort((a, b) => b.champion - a.champion).slice(0, 8))
</script>

<template>
  <div class="space-y-2">
    <div v-for="(t, i) in top8" :key="t.teamId" class="flex items-center gap-3">
      <span class="w-4 text-[11px] text-apple-gray-light text-right">{{ i + 1 }}</span>
      <span class="flex-1 text-[13px] text-apple-gray-dark">{{ t.shortName }}</span>
      <div class="w-28 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full bg-apple-blue" :style="{ width: formatPercent(t.champion) }" />
      </div>
      <span class="w-12 text-right text-[11px] font-medium text-apple-gray-dark">{{ formatPercent(t.champion) }}</span>
    </div>
  </div>
</template>
