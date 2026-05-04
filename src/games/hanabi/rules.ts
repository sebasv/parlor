// ---------------------------------------------------------------------------
// Hanabi — pure rules engine
// ---------------------------------------------------------------------------
// All functions here are pure: no DOM, no side effects.
// ---------------------------------------------------------------------------

export type Suit = 'red' | 'yellow' | 'green' | 'blue' | 'white'
export type Rank = 1 | 2 | 3 | 4 | 5

export interface Card {
  suit: Suit
  rank: Rank
  /** Unique id within the deck (0–49) for stable identity. */
  id: number
}

/** What a player knows about a specific card slot from received clues. */
export interface CardKnowledge {
  suit: Suit | null
  rank: Rank | null
}

export interface GameState {
  /** Ordered deck; top of deck = index 0. */
  deck: Card[]
  /** hands[i] = cards held by player i, index 0 = leftmost. */
  hands: Card[][]
  /** knowledge[i][j] = clue info for hands[i][j]. */
  knowledge: CardKnowledge[][]
  /** fireworks[suit] = highest rank played (0 = nothing played). */
  fireworks: Record<Suit, number>
  /** Discard pile (unordered). */
  discard: Card[]
  /** 0–8. */
  clueTokens: number
  /** 0–3. Game ends immediately when this hits 3. */
  fuseTokens: number
  /** Index of the active player. */
  activePlayer: number
  /** Once deck is empty, this counts down. null = deck not yet exhausted. */
  finalTurnsRemaining: number | null
  phase: 'playing' | 'over'
  /** Reason the game ended, for display. */
  endReason: 'perfect' | 'fuse' | 'final-round' | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SUITS: Suit[] = ['red', 'yellow', 'green', 'blue', 'white']
export const MAX_CLUE_TOKENS = 8
export const MAX_FUSE_TOKENS = 3

/** How many of each rank exist in a suit. */
const RANK_COUNTS: Record<Rank, number> = { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1 }

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

function buildDeck(): Card[] {
  const cards: Card[] = []
  let id = 0
  for (const suit of SUITS) {
    for (const rank of [1, 2, 3, 4, 5] as Rank[]) {
      for (let n = 0; n < RANK_COUNTS[rank]; n++) {
        cards.push({ suit, rank, id: id++ })
      }
    }
  }
  return cards
}

/** Fisher-Yates shuffle (mutates and returns the array). */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function emptyKnowledge(): CardKnowledge {
  return { suit: null, rank: null }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function createInitialState(
  playerCount: number,
  rng: () => number = Math.random,
): GameState {
  const handSize = playerCount <= 3 ? 5 : 4

  const deck = shuffle(buildDeck(), rng)

  const hands: Card[][] = []
  const knowledge: CardKnowledge[][] = []

  for (let i = 0; i < playerCount; i++) {
    const hand = deck.splice(0, handSize)
    hands.push(hand)
    knowledge.push(hand.map(() => emptyKnowledge()))
  }

  const fireworks: Record<Suit, number> = {
    red: 0,
    yellow: 0,
    green: 0,
    blue: 0,
    white: 0,
  }

  return {
    deck,
    hands,
    knowledge,
    fireworks,
    discard: [],
    clueTokens: MAX_CLUE_TOKENS,
    fuseTokens: 0,
    activePlayer: 0,
    finalTurnsRemaining: null,
    phase: 'playing',
    endReason: null,
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function score(state: GameState): number {
  return SUITS.reduce((sum, suit) => sum + state.fireworks[suit], 0)
}

export function isOver(state: GameState): boolean {
  return state.phase === 'over'
}

// ---------------------------------------------------------------------------
// Legal actions
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'play'; cardIndex: number }
  | { type: 'discard'; cardIndex: number }
  | {
      type: 'clue'
      targetPlayer: number
      feature: { kind: 'suit'; suit: Suit } | { kind: 'rank'; rank: Rank }
    }

export function legalActions(state: GameState): Action[] {
  if (state.phase === 'over') return []

  const actions: Action[] = []
  const handSize = state.hands[state.activePlayer].length

  for (let i = 0; i < handSize; i++) {
    actions.push({ type: 'play', cardIndex: i })
  }

  // Discard only when at least one clue token has been spent
  if (state.clueTokens < MAX_CLUE_TOKENS) {
    for (let i = 0; i < handSize; i++) {
      actions.push({ type: 'discard', cardIndex: i })
    }
  }

  if (state.clueTokens > 0) {
    for (let p = 0; p < state.hands.length; p++) {
      if (p === state.activePlayer) continue
      for (const suit of SUITS) {
        // Only allow clues that apply to at least one card (no 0-clues)
        const matches = state.hands[p].some((c) => c.suit === suit)
        if (matches) {
          actions.push({ type: 'clue', targetPlayer: p, feature: { kind: 'suit', suit } })
        }
      }
      for (const rank of [1, 2, 3, 4, 5] as Rank[]) {
        const matches = state.hands[p].some((c) => c.rank === rank)
        if (matches) {
          actions.push({ type: 'clue', targetPlayer: p, feature: { kind: 'rank', rank } })
        }
      }
    }
  }

  return actions
}

// ---------------------------------------------------------------------------
// Apply action
// ---------------------------------------------------------------------------

/** Draw a card for `player` (if deck is non-empty). Returns updated state. */
function drawCard(state: GameState, player: number): GameState {
  if (state.deck.length === 0) return state

  const [drawn, ...remainingDeck] = state.deck
  const newHands = state.hands.map((h, i) => (i === player ? [...h, drawn] : h))
  const newKnowledge = state.knowledge.map((k, i) => (i === player ? [...k, emptyKnowledge()] : k))
  return { ...state, deck: remainingDeck, hands: newHands, knowledge: newKnowledge }
}

function advanceTurn(state: GameState): GameState {
  const nextPlayer = (state.activePlayer + 1) % state.hands.length

  // Check final-round countdown
  if (state.finalTurnsRemaining !== null) {
    const remaining = state.finalTurnsRemaining - 1
    if (remaining <= 0) {
      return {
        ...state,
        activePlayer: nextPlayer,
        finalTurnsRemaining: 0,
        phase: 'over',
        endReason: 'final-round',
      }
    }
    return { ...state, activePlayer: nextPlayer, finalTurnsRemaining: remaining }
  }

  // Deck just became empty — start final round countdown
  if (state.deck.length === 0) {
    // Each remaining player (including next) gets one more turn
    return { ...state, activePlayer: nextPlayer, finalTurnsRemaining: state.hands.length }
  }

  return { ...state, activePlayer: nextPlayer }
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase === 'over') return state

  switch (action.type) {
    case 'play': {
      const { cardIndex } = action
      const player = state.activePlayer
      const card = state.hands[player][cardIndex]

      const newHands = state.hands.map((h, i) =>
        i === player ? h.filter((_, j) => j !== cardIndex) : h,
      )
      const newKnowledge = state.knowledge.map((k, i) =>
        i === player ? k.filter((_, j) => j !== cardIndex) : k,
      )

      const expectedRank = state.fireworks[card.suit] + 1
      const success = card.rank === expectedRank

      if (success) {
        const newFireworks = { ...state.fireworks, [card.suit]: card.rank }
        let next: GameState = {
          ...state,
          hands: newHands,
          knowledge: newKnowledge,
          fireworks: newFireworks,
          // Completing a firework rewards a clue token (if not at max)
          clueTokens:
            card.rank === 5 ? Math.min(state.clueTokens + 1, MAX_CLUE_TOKENS) : state.clueTokens,
        }
        // Perfect score?
        if (score(next) === 25) {
          return { ...next, phase: 'over', endReason: 'perfect' }
        }
        next = drawCard(next, player)
        return advanceTurn(next)
      } else {
        // Misplay: discard card and spend a fuse
        const newFuse = state.fuseTokens + 1
        let next: GameState = {
          ...state,
          hands: newHands,
          knowledge: newKnowledge,
          discard: [...state.discard, card],
          fuseTokens: newFuse,
        }
        if (newFuse >= MAX_FUSE_TOKENS) {
          return { ...next, phase: 'over', endReason: 'fuse' }
        }
        next = drawCard(next, player)
        return advanceTurn(next)
      }
    }

    case 'discard': {
      const { cardIndex } = action
      const player = state.activePlayer
      const card = state.hands[player][cardIndex]

      const newHands = state.hands.map((h, i) =>
        i === player ? h.filter((_, j) => j !== cardIndex) : h,
      )
      const newKnowledge = state.knowledge.map((k, i) =>
        i === player ? k.filter((_, j) => j !== cardIndex) : k,
      )

      let next: GameState = {
        ...state,
        hands: newHands,
        knowledge: newKnowledge,
        discard: [...state.discard, card],
        clueTokens: Math.min(state.clueTokens + 1, MAX_CLUE_TOKENS),
      }
      next = drawCard(next, player)
      return advanceTurn(next)
    }

    case 'clue': {
      const { targetPlayer, feature } = action
      const targetHand = state.hands[targetPlayer]
      const newKnowledge = state.knowledge.map((k, i) => {
        if (i !== targetPlayer) return k
        return k.map((kk, j) => {
          const card = targetHand[j]
          if (feature.kind === 'suit' && card.suit === feature.suit) {
            return { ...kk, suit: feature.suit }
          }
          if (feature.kind === 'rank' && card.rank === feature.rank) {
            return { ...kk, rank: feature.rank }
          }
          return kk
        })
      })
      const next: GameState = {
        ...state,
        knowledge: newKnowledge,
        clueTokens: state.clueTokens - 1,
      }
      return advanceTurn(next)
    }
  }
}
