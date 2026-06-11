<script setup lang="ts">
import type { XgSummary } from '../../types'
defineProps<{ xg: XgSummary }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <div class="rounded-lg bg-gray-50 p-4 text-center">
      <p class="text-[11px] text-apple-gray uppercase tracking-wide">主队</p>
      <p class="text-xl font-semibold text-apple-gray-dark mt-1">{{ xg.homeXg.toFixed(2) }}</p>
      <p class="text-[11px] text-apple-gray-light mt-0.5">xG</p>
    </div>
    <div class="rounded-lg bg-gray-50 p-4 text-center">
      <p class="text-[11px] text-apple-gray uppercase tracking-wide">客队</p>
      <p class="text-xl font-semibold text-apple-gray-dark mt-1">{{ xg.awayXg.toFixed(2) }}</p>
      <p class="text-[11px] text-apple-gray-light mt-0.5">xG</p>
    </div>
  </div>
</template>
