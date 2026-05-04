import type { GameEntry } from '../lib/game'

// Each entry uses a dynamic import so Vite emits a separate chunk per game —
// the picker only loads the registry metadata, not any game code.
export const games: readonly GameEntry[] = [
  {
    id: 'placeholder',
    title: 'Placeholder',
    description: 'Hello-world game used to verify the shell wiring.',
    minPlayers: 1,
    maxPlayers: 8,
    load: () => import('./placeholder').then((m) => m.default),
  },
]
