<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="rounded-apple bg-white shadow-apple p-5">
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-apple-gray-dark">{{ title }}</h3>
      <p v-if="subtitle" class="text-xs text-apple-gray mt-0.5">{{ subtitle }}</p>
    </div>
    <slot />
  </div>
</template>
