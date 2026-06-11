<script setup lang="ts">
import type { RetrospectiveAnalysis } from '../../types'
import PredictionVsActual from './PredictionVsActual.vue'
import KeyEventsTimeline from './KeyEventsTimeline.vue'
import XGReview from './XGReview.vue'

defineProps<{ analysis: RetrospectiveAnalysis }>()
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-[11px] text-apple-gray uppercase tracking-wide mb-3">预测准确度</p>
      <PredictionVsActual :items="analysis.predictionVsActual" />
    </div>
    <div>
      <p class="text-[11px] text-apple-gray uppercase tracking-wide mb-3">关键事件</p>
      <KeyEventsTimeline :events="analysis.keyEvents" />
    </div>
    <div>
      <p class="text-[11px] text-apple-gray uppercase tracking-wide mb-3">xG 复盘</p>
      <XGReview :xg="analysis.xgReview" />
    </div>
    <div class="rounded-lg bg-gray-50 p-4">
      <p class="text-[11px] text-apple-gray uppercase tracking-wide mb-1.5">AI 复盘总结</p>
      <p class="text-[13px] text-apple-gray-dark leading-relaxed">{{ analysis.summary }}</p>
    </div>
  </div>
</template>
