import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'hex',
  title: 'Hex',
  description:
    'Two players claim hexes on an 11×11 rhombus grid. First to connect your two opposite edges wins. Cannot end in a draw.',
  minPlayers: 2,
  maxPlayers: 2,
}

export default meta
