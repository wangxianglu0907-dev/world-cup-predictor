import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Tournament } from '../types'

export const useTournamentStore = defineStore('tournament', () => {
  const currentTournamentId = ref<number | null>(null)
  const currentTournament = ref<Tournament | null>(null)
  const tournamentList = ref<Tournament[]>([])

  function setCurrentTournament(tournament: Tournament) {
    currentTournamentId.value = tournament.id
    currentTournament.value = tournament
  }

  function setTournamentList(list: Tournament[]) {
    tournamentList.value = list
  }

  return {
    currentTournamentId,
    currentTournament,
    tournamentList,
    setCurrentTournament,
    setTournamentList,
  }
})
