import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'nim',
  title: 'Nim',
  description:
    'Three piles of tokens. On your turn, take any number from one pile. Take the last token to win. The XOR strategy is hiding in plain sight.',
  minPlayers: 2,
  maxPlayers: 2,
}

export default meta
