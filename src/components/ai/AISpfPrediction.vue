<script setup lang="ts">
import { computed } from 'vue'
import { formatPercent } from '../../utils'
import type { AIPrediction } from '../../types'

const props = defineProps<{ prediction: AIPrediction }>()

const riskStyle = computed(() => {
  const m: Record<string, string> = {
    low: 'text-green-600 bg-green-50',
    medium: 'text-amber-600 bg-amber-50',
    high: 'text-red-600 bg-red-50',
  }
  return m[props.prediction.riskLevel] || ''
})
const riskText = computed(() =>
  ({ low: '低风险', medium: '中风险', high: '高风险' })[props.prediction.riskLevel] || ''
)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <span class="rounded-full px-2.5 py-0.5 text-[11px] font-medium" :class="riskStyle">{{ riskText }}</span>
      <span class="text-[11px] text-apple-gray">置信度 {{ formatPercent(prediction.spf.confidence) }}</span>
    </div>

    <div>
      <p class="text-[11px] text-apple-gray-light mb-2 uppercase tracking-wide">胜平负概率</p>
      <div class="flex h-8 rounded-md overflow-hidden">
        <div class="flex items-center justify-center text-xs font-semibold text-white bg-apple-blue" :style="{ width: formatPercent(prediction.spf.home) }">{{ formatPercent(prediction.spf.home) }}</div>
        <div class="flex items-center justify-center text-xs font-medium text-apple-gray bg-gray-200" :style="{ width: formatPercent(prediction.spf.draw) }">{{ formatPercent(prediction.spf.draw) }}</div>
        <div class="flex items-center justify-center text-xs font-medium text-apple-gray bg-gray-300" :style="{ width: formatPercent(prediction.spf.away) }">{{ formatPercent(prediction.spf.away) }}</div>
      </div>
      <div class="flex justify-between mt-1.5 text-[11px] text-apple-gray-light">
        <span>主胜</span><span>平局</span><span>客胜</span>
      </div>
    </div>

    <div class="rounded-lg bg-blue-50 p-3.5 text-center">
      <span class="text-[13px] text-apple-blue font-medium">
        AI推荐：{{ prediction.spf.recommendation === 'home' ? '主胜' : prediction.spf.recommendation === 'draw' ? '平局' : '客胜' }}
      </span>
    </div>
  </div>
</template>
