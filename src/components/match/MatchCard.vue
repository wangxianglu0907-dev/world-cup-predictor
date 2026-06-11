<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Match } from '../../types'
import { formatDateTime, stageLabel } from '../../utils'

const props = defineProps<{ match: Match }>()

const score = computed(() => {
  if (props.match.status === 'SCHEDULED') return 'vs'
  return `${props.match.homeScore} – ${props.match.awayScore}`
})

const statusLabel = computed(() =>
  ({ SCHEDULED: '未开始', LIVE: '进行中', FINISHED: '已结束' })[props.match.status] || ''
)
</script>

<template>
  <RouterLink
    :to="`/match/${match.id}`"
    class="group block rounded-apple bg-white shadow-apple p-4 transition-all hover:shadow-apple-lg"
  >
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span
          v-if="match.groupName"
          class="rounded-md bg-apple-blue/10 text-apple-blue text-[11px] font-semibold px-2 py-0.5"
        >
          {{ match.groupName }} 组
        </span>
        <span class="text-[11px] text-apple-gray-light">{{ stageLabel(match.stage) }}</span>
      </div>
      <span
        class="text-[11px]"
        :class="match.status === 'LIVE' ? 'text-red-500 font-medium' : 'text-apple-gray-light'"
      >
        {{ statusLabel }}
      </span>
    </div>
    <div class="flex items-center justify-between">
      <div class="flex-1 text-center">
        <p class="text-xs font-medium truncate text-apple-gray-dark">
          {{ match.homeTeam?.shortName || match.homeTeam?.name || '—' }}
        </p>
      </div>
      <div class="mx-3 text-center min-w-[64px]">
        <p class="text-lg font-semibold tracking-tight text-apple-gray-dark">{{ score }}</p>
        <p class="text-[11px] text-apple-gray-light mt-0.5">{{ formatDateTime(match.startTime) }}</p>
      </div>
      <div class="flex-1 text-center">
        <p class="text-xs font-medium truncate text-apple-gray-dark">
          {{ match.awayTeam?.shortName || match.awayTeam?.name || '—' }}
        </p>
      </div>
    </div>
  </RouterLink>
</template>
