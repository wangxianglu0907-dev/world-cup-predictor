<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { GroupPrediction } from '../types'
import { getGroupPrediction } from '../api'
import GroupPredictionCard from '../components/group/GroupPredictionCard.vue'
import LoadingState from '../components/common/LoadingState.vue'
import EmptyState from '../components/common/EmptyState.vue'

const data = ref<GroupPrediction | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    data.value = await getGroupPrediction(1)
  } catch (e: any) {
    error.value = e.message || '加载失败'
  }
  loading.value = false
})

</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-apple-gray-dark">小组出线预测</h1>
      <p class="text-xs text-apple-gray mt-1">基于 Monte Carlo 模拟剩余赛程，统计各队出线概率</p>
    </div>
    <LoadingState v-if="loading" />
    <EmptyState v-else-if="error || !data?.groupsData?.length" :title="error || '暂无小组数据'" description="请先执行数据采集" />
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <GroupPredictionCard
        v-for="g in data.groupsData" :key="g.groupName"
        :groupName="g.groupName" :standings="g.standings"
      />
    </div>
  </div>
</template>
