<script setup lang="ts">
const props = defineProps<{ stages: string[] }>()
const modelValue = defineModel<string>()

const options = [
  { label: '全部阶段', value: '' },
  ...props.stages.map((s) => {
    const map: Record<string, string> = {
      GROUP: '小组赛',
      ROUND_OF_16: '1/8决赛',
      QUARTER_FINAL: '1/4决赛',
      SEMI_FINAL: '半决赛',
      THIRD_PLACE: '三四名决赛',
      FINAL: '决赛',
    }
    return { label: map[s] || s, value: s }
  }),
]

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '未开始', value: 'SCHEDULED' },
  { label: '进行中', value: 'LIVE' },
  { label: '已结束', value: 'FINISHED' },
]
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <select
      v-model="modelValue"
      class="rounded-lg border border-[#2E4A4A] bg-[#1A2E2E] px-3 py-1.5 text-sm text-gray-300 outline-none focus:border-gold-400/50"
    >
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <slot />
  </div>
</template>
