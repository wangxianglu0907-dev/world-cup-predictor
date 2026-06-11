<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { triggerDataCollect, triggerAIPredict, getAIStatus } from '../../api'

const route = useRoute()
const loading = ref('') // '' | '采集' | '预测'
const feedback = ref('')

const navItems = [
  { path: '/', label: '首页' },
  { path: '/matches', label: '比赛' },
  { path: '/groups', label: '小组出线' },
  { path: '/bracket', label: '晋级路径' },
  { path: '/gambler', label: '🎰 搏一搏' },
]

async function onCollect() {
  if (loading.value) return
  loading.value = '采集'
  feedback.value = '正在拉取最新赔率...'
  try {
    const res = await triggerDataCollect()
    if ('error' in res) {
      feedback.value = res.error as string
    } else {
      feedback.value = '✅ 数据采集完成'
    }
  } catch {
    feedback.value = '❌ 采集失败'
  }
  setTimeout(() => { loading.value = ''; feedback.value = '' }, 3000)
}

async function onPredict() {
  if (loading.value) return
  loading.value = '预测'
  feedback.value = '正在刷新AI预测...'
  try {
    const res = await triggerAIPredict()
    if ('error' in res) {
      feedback.value = res.error as string
    } else {
      feedback.value = '✅ AI预测更新完成'
    }
  } catch {
    feedback.value = '❌ 预测失败'
  }
  setTimeout(() => { loading.value = ''; feedback.value = '' }, 3000)
}
</script>

<template>
  <header class="fixed top-0 left-0 right-0 z-50 h-12 border-b border-gray-200/60 bg-white/70 backdrop-blur-xl">
    <div class="mx-auto flex h-full max-w-5xl items-center justify-between px-6">
      <RouterLink to="/" class="flex items-center gap-2 text-sm font-semibold tracking-tight text-apple-gray-dark">
        ⚽ World Cup Predictor
      </RouterLink>

      <nav class="flex items-center gap-0.5">
        <RouterLink
          v-for="item in navItems" :key="item.path" :to="item.path"
          class="rounded-md px-3 py-1 text-xs transition-colors"
          :class="route.path === item.path ? 'text-apple-blue' : 'text-apple-gray hover:text-apple-gray-dark'"
        >{{ item.label }}</RouterLink>

        <!-- 分隔线 -->
        <span class="mx-1.5 w-px h-4 bg-gray-200" />

        <!-- 手动按钮 -->
        <button
          @click="onCollect"
          :disabled="!!loading"
          class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all"
          :class="loading === '采集' ? 'bg-blue-50 text-apple-blue' : 'text-apple-gray hover:text-apple-gray-dark hover:bg-gray-100'"
        >
          {{ loading === '采集' ? '⏳ 采集中' : '📡 采集' }}
        </button>
        <button
          @click="onPredict"
          :disabled="!!loading"
          class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all"
          :class="loading === '预测' ? 'bg-blue-50 text-apple-blue' : 'text-apple-gray hover:text-apple-gray-dark hover:bg-gray-100'"
        >
          {{ loading === '预测' ? '⏳ 预测中' : '🧠 预测' }}
        </button>
      </nav>
    </div>

    <!-- 反馈提示 -->
    <Transition name="fade">
      <div
        v-if="feedback"
        class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full mt-1 rounded-lg bg-apple-gray-dark text-white px-4 py-2 text-[11px] shadow-lg whitespace-nowrap"
      >
        {{ feedback }}
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
