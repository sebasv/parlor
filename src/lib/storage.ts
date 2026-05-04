const PLAYERS_KEY = 'vg.players'

export function loadPlayers(): string[] {
  try {
    const raw = localStorage.getItem(PLAYERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function savePlayers(players: readonly string[]): void {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players))
}
