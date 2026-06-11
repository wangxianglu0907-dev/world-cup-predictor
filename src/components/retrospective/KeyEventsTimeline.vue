<script setup lang="ts">
import type { KeyEvent } from '../../types'
defineProps<{ events: KeyEvent[] }>()
const icons: Record<string, string> = { goal: '⚽', red_card: '🟥', penalty: '📍', substitution: '🔄', var: '📺', injury: '🩹' }
</script>

<template>
  <div class="relative pl-5 border-l border-gray-200 space-y-3.5">
    <div v-for="evt in events" :key="evt.minute + evt.description" class="relative">
      <div class="absolute -left-[22px] top-1 w-2.5 h-2.5 rounded-full bg-apple-blue border-2 border-white" />
      <span class="text-[11px] font-mono font-medium text-apple-gray mr-2">{{ evt.minute }}'</span>
      <span class="mr-1">{{ icons[evt.type] || '📌' }}</span>
      <span class="text-[13px] text-apple-gray-dark">{{ evt.description }}</span>
      <span class="text-[11px] text-apple-gray-light ml-1.5">({{ evt.team }})</span>
    </div>
  </div>
</template>
