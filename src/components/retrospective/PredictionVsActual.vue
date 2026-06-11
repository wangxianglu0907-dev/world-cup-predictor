<script setup lang="ts">
import type { PredictionVsActual } from '../../types'
defineProps<{ items: PredictionVsActual[] }>()
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-[13px]">
      <thead>
        <tr class="border-b border-gray-100 text-left text-[11px] text-apple-gray uppercase tracking-wide">
          <th class="pb-2.5 pr-4 font-medium">维度</th>
          <th class="pb-2.5 pr-4 font-medium">AI 预测</th>
          <th class="pb-2.5 pr-4 font-medium">实际结果</th>
          <th class="pb-2.5 font-medium">结果</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.dimension" class="border-b border-gray-50">
          <td class="py-2.5 pr-4 text-apple-gray-dark">{{ item.dimension }}</td>
          <td class="py-2.5 pr-4">{{ item.prediction }}</td>
          <td class="py-2.5 pr-4 text-apple-gray">{{ item.actual }}</td>
          <td class="py-2.5">
            <span v-if="item.correct" class="text-green-600 text-[11px] font-medium">正确</span>
            <span v-else class="text-red-500 text-[11px] font-medium">未中</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
