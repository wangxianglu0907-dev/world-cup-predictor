<script setup lang="ts">
import type { AIPrediction } from '../../types'
import AISpfPrediction from './AISpfPrediction.vue'
import AIScorePrediction from './AIScorePrediction.vue'
import AIHandicapPrediction from './AIHandicapPrediction.vue'
import AIGoalsPrediction from './AIGoalsPrediction.vue'

defineProps<{ prediction: AIPrediction }>()
const tabs = ['胜平负', '比分预测', '让球胜平负', '总进球数']
const activeTab = defineModel<string>('tab', { default: '胜平负' })
</script>

<template>
  <div>
    <div class="flex gap-0 border-b border-gray-100 mb-5">
      <button
        v-for="tab in tabs" :key="tab" @click="activeTab = tab"
        class="px-3.5 pb-2.5 text-[13px] border-b-2 -mb-px transition-colors"
        :class="activeTab === tab ? 'border-apple-blue text-apple-blue font-medium' : 'border-transparent text-apple-gray'"
      >{{ tab }}</button>
    </div>
    <AISpfPrediction v-if="activeTab === '胜平负'" :prediction="prediction" />
    <AIScorePrediction v-else-if="activeTab === '比分预测'" :scores="prediction.scoreDistribution" />
    <AIHandicapPrediction v-else-if="activeTab === '让球胜平负'" :handicap="prediction.handicap" />
    <AIGoalsPrediction v-else-if="activeTab === '总进球数'" :goals="prediction.goals" />
  </div>
</template>
