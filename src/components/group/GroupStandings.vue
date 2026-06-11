<script setup lang="ts">
import type { TeamAdvanceProb } from '../../types'
defineProps<{ groupName: string; standings: TeamAdvanceProb[] }>()
</script>

<template>
  <table class="w-full text-[12px]">
    <thead>
      <tr class="border-b border-gray-100 text-[10px] text-apple-gray uppercase tracking-wide">
        <th class="py-2 pl-4 text-left font-medium">#</th>
        <th class="py-2 text-left font-medium">球队</th>
        <th class="py-2 font-medium">场</th>
        <th class="py-2 font-medium">胜</th>
        <th class="py-2 font-medium">平</th>
        <th class="py-2 font-medium">负</th>
        <th class="py-2 font-medium">GD</th>
        <th class="py-2 font-medium">分</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(t, i) in standings" :key="t.teamId" class="border-b border-gray-50" :class="i < 2 ? 'bg-blue-50/30' : ''">
        <td class="py-2 pl-4 text-apple-gray-light">{{ i + 1 }}</td>
        <td class="py-2 text-apple-gray-dark font-medium">{{ t.shortName }}</td>
        <td class="py-2 text-center text-apple-gray">{{ t.played }}</td>
        <td class="py-2 text-center text-apple-gray">{{ t.won }}</td>
        <td class="py-2 text-center text-apple-gray">{{ t.drawn }}</td>
        <td class="py-2 text-center text-apple-gray">{{ t.lost }}</td>
        <td class="py-2 text-center font-medium" :class="t.goalDiff >= 0 ? 'text-green-600' : 'text-red-500'">{{ t.goalDiff > 0 ? '+' : '' }}{{ t.goalDiff }}</td>
        <td class="py-2 text-center font-semibold text-apple-gray-dark">{{ t.points }}</td>
      </tr>
    </tbody>
  </table>
</template>
