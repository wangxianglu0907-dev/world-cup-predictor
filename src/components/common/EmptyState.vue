<script setup lang="ts">
defineProps<{ title?: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-24 text-apple-gray">
    <p class="text-sm">{{ title || '暂无数据' }}</p>
    <p v-if="description" class="mt-1 text-xs text-apple-gray-light">{{ description }}</p>
  </div>
</template>
