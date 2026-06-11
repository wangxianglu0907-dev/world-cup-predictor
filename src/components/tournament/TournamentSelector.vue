<script setup lang="ts">
import type { Tournament } from '../../types'

const props = defineProps<{ tournaments: Tournament[] }>()
const emit = defineEmits<{ select: [Tournament] }>()
const selectedId = defineModel<number | null>()
function onSelect(id: number) {
  selectedId.value = id
  const t = props.tournaments.find((t) => t.id === id)
  if (t) emit('select', t)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="text-xs text-apple-gray">赛事</span>
    <div class="flex gap-1.5 bg-gray-100 rounded-lg p-0.5">
      <button
        v-for="t in tournaments"
        :key="t.id"
        @click="onSelect(t.id)"
        class="rounded-md px-3.5 py-1.5 text-xs font-medium transition-all"
        :class="
          selectedId === t.id
            ? 'bg-white shadow-sm text-apple-gray-dark'
            : 'text-apple-gray hover:text-apple-gray-dark'
        "
      >
        {{ t.name }} {{ t.year }}
      </button>
    </div>
  </div>
</template>
