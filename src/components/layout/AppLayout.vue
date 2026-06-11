<script setup lang="ts">
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'
</script>

<template>
  <div class="min-h-screen bg-apple-bg">
    <AppHeader />
    <main class="mx-auto max-w-5xl px-6 pt-16 pb-12">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
