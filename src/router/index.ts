import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'Home', component: () => import('../views/HomeView.vue') },
  { path: '/matches', name: 'Matches', component: () => import('../views/MatchListView.vue') },
  { path: '/match/:id', name: 'MatchDetail', component: () => import('../views/MatchDetailView.vue'), props: true },
  { path: '/groups', name: 'Groups', component: () => import('../views/GroupView.vue') },
  { path: '/bracket', name: 'Bracket', component: () => import('../views/BracketView.vue') },
  { path: '/gambler', name: 'Gambler', component: () => import('../views/GamblerView.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
