<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { Match, Team } from '../types'
import { getMatches, getTournamentDetail } from '../api'
import MatchCard from '../components/match/MatchCard.vue'
import LoadingState from '../components/common/LoadingState.vue'
import EmptyState from '../components/common/EmptyState.vue'
import { formatDateTime } from '../utils'

const matches = ref<Match[]>([])
const teams = ref<Team[]>([])
const loading = ref(true)
const activeGroup = ref<string>('')

onMounted(async () => {
  try {
    const [matchRes, detail] = await Promise.all([
      getMatches({ tournamentId: 1 }),
      getTournamentDetail(1),
    ])
    matches.value = matchRes.matches
    teams.value = (detail as any).teams || []
    if (!activeGroup.value && groupedMatches.value.length > 0) {
      activeGroup.value = groupedMatches.value[0].group
    }
  } catch {}
  loading.value = false
})

// 按小组分组
const groupedMatches = computed(() => {
  const groups = new Map<string, { group: string; teams: Team[]; matches: Match[] }>()
  for (const m of matches.value) {
    const g = m.groupName || '淘汰赛'
    if (!groups.has(g)) {
      const gteams = teams.value.filter(t => t.groupName === g)
      groups.set(g, { group: g, teams: gteams, matches: [] })
    }
    groups.get(g)!.matches.push(m)
  }
  return Array.from(groups.values()).sort((a, b) => a.group.localeCompare(b.group))
})

const currentGroup = computed(() =>
  groupedMatches.value.find(g => g.group === activeGroup.value)
)
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-bold tracking-tight text-apple-gray-dark">比赛列表</h1>

    <!-- 小组选项卡 -->
    <div class="flex flex-wrap gap-1.5 bg-gray-100 rounded-lg p-1">
      <button
        v-for="g in groupedMatches" :key="g.group"
        @click="activeGroup = g.group"
        class="rounded-md px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
        :class="activeGroup === g.group
          ? 'bg-white shadow-sm text-apple-gray-dark'
          : 'text-apple-gray hover:text-apple-gray-dark'"
      >
        {{ g.group }} 组
      </button>
    </div>

    <LoadingState v-if="loading" />
    <EmptyState v-else-if="!currentGroup" title="暂无数据" />

    <template v-else>
      <!-- 小组积分榜 -->
      <div class="rounded-apple bg-white shadow-apple overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-apple-gray-dark">{{ currentGroup.group }} 组 — 积分榜</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-[12px]">
            <thead>
              <tr class="border-b border-gray-50 text-[10px] text-apple-gray uppercase tracking-wide">
                <th class="py-2 pl-4 text-left font-medium w-6">#</th>
                <th class="py-2 text-left font-medium">球队</th>
                <th class="py-2 font-medium w-8">场</th>
                <th class="py-2 font-medium w-8">胜</th>
                <th class="py-2 font-medium w-8">平</th>
                <th class="py-2 font-medium w-8">负</th>
                <th class="py-2 font-medium w-8">GD</th>
                <th class="py-2 pr-4 font-medium w-8">分</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(t, i) in currentGroup.teams"
                :key="t.id"
                class="border-b border-gray-50 last:border-0"
              >
                <td class="py-2 pl-4 text-apple-gray-light">{{ i + 1 }}</td>
                <td class="py-2 text-apple-gray-dark font-medium">{{ t.shortName || t.name }}</td>
                <td class="py-2 text-center text-apple-gray">0</td>
                <td class="py-2 text-center text-apple-gray">0</td>
                <td class="py-2 text-center text-apple-gray">0</td>
                <td class="py-2 text-center text-apple-gray">0</td>
                <td class="py-2 text-center text-apple-gray">0</td>
                <td class="py-2 pr-4 text-center font-semibold text-apple-gray-dark">0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 该小组比赛 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <MatchCard v-for="m in currentGroup.matches" :key="m.id" :match="m" />
      </div>
    </template>
  </div>
</template>
