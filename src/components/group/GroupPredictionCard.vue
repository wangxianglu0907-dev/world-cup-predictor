<script setup lang="ts">
import { ref } from 'vue'
import type { TeamAdvanceProb } from '../../types'
import GroupStandings from './GroupStandings.vue'
import GroupAdvanceProb from './GroupAdvanceProb.vue'

defineProps<{ groupName: string; standings: TeamAdvanceProb[] }>()
const expanded = ref(false)
</script>

<template>
  <div class="rounded-apple bg-white shadow-apple overflow-hidden">
    <div class="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors" @click="expanded = !expanded">
      <h3 class="text-sm font-semibold text-apple-gray-dark">{{ groupName }} 组</h3>
      <span class="text-[11px] text-apple-blue">{{ expanded ? '收起' : '展开' }}</span>
    </div>
    <GroupStandings :groupName="groupName" :standings="standings" />
    <div v-if="expanded" class="px-4 pb-4">
      <GroupAdvanceProb :standings="standings" />
    </div>
  </div>
</template>
