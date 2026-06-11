<script setup lang="ts">
defineProps<{ report: string }>()
</script>

<template>
  <div class="text-[13px] text-apple-gray-dark leading-relaxed whitespace-pre-wrap">{{ report }}</div>
</template>
