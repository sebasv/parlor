import type { GameModule } from '../../lib/game'
import meta from './meta'

// ---------------------------------------------------------------------------
// Types & config
// ---------------------------------------------------------------------------

interface NimConfig {
  /** Starting token count for each pile. Length determines number of piles. */
  piles: readonly number[]
  /**
   * 'normal'  — player who takes the last token WINS
   * 'misere'  — player who takes the last token LOSES
   */
  variant: 'normal' | 'misere'
}

const DEFAULT_CONFIG: NimConfig = {
  piles: [3, 5, 7],
  variant: 'normal',
}

interface NimState {
  piles: number[]
  currentPlayer: 0 | 1
  phase: 'playing' | 'ended'
  winner: number | null
  /** Index of the pile the player has clicked into; null = none selected */
  selectedPile: number | null
  /** Number of tokens marked for removal in the selected pile */
  markedCount: number
}

// ---------------------------------------------------------------------------
// Pure rules logic (reusable by a future AI)
// ---------------------------------------------------------------------------

/** Returns true when the position is a losing position for the player to move. */
function isLosingPosition(piles: readonly number[], variant: NimConfig['variant']): boolean {
  const xorSum = piles.reduce((a, b) => a ^ b, 0)
  if (variant === 'normal') {
    return xorSum === 0
  }
  // Misère: if all piles are 0 or 1, the losing condition flips
  const multiTokenPiles = piles.filter((p) => p > 1).length
  if (multiTokenPiles === 0) {
    // Whoever faces all-zeros-or-ones: XOR of all values tells parity
    return (piles.reduce((a, b) => a ^ b, 0) & 1) === 1
  }
  return xorSum === 0
}

/** Returns the legal moves for a given pile. */
function legalTakes(pile: number): readonly number[] {
  return Array.from({ length: pile }, (_, i) => i + 1)
}

/** Checks whether the game is over and who won. */
function checkWin(
  piles: readonly number[],
  justMoved: number,
  variant: NimConfig['variant'],
): number | null {
  const total = piles.reduce((a, b) => a + b, 0)
  if (total > 0) return null
  // All tokens taken. The player who just moved took the last one.
  if (variant === 'normal') {
    return justMoved
  }
  // Misère: taking the last token loses
  return justMoved === 0 ? 1 : 0
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) node.setAttribute(k, v)
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderPile(
  pileIndex: number,
  count: number,
  state: NimState,
  onTokenClick: (pileIndex: number, tokenIndex: number) => void,
): HTMLElement {
  const isSelected = state.selectedPile === pileIndex
  const isDisabled = state.phase === 'ended' || (state.selectedPile !== null && !isSelected)

  const pileEl = el('div', { class: `nim-pile${isSelected ? ' nim-pile--selected' : ''}` })

  const tokensEl = el('div', { class: 'nim-tokens' })
  for (let i = 0; i < count; i++) {
    const tokenIndex = i
    const isMarked = isSelected && state.markedCount > 0 && tokenIndex >= count - state.markedCount
    const tokenEl = el('button', {
      type: 'button',
      class: `nim-token${isMarked ? ' nim-token--marked' : ''}`,
      'aria-label': `Pile ${pileIndex + 1}, token ${tokenIndex + 1}`,
      disabled: isDisabled ? 'true' : undefined,
    })
    tokenEl.addEventListener('click', () => onTokenClick(pileIndex, tokenIndex))
    tokensEl.appendChild(tokenEl)
  }

  // Show empty pile indicator
  if (count === 0) {
    const emptyEl = el('div', { class: 'nim-pile-empty' }, '(empty)')
    tokensEl.appendChild(emptyEl)
  }

  pileEl.appendChild(tokensEl)
  return pileEl
}

// ---------------------------------------------------------------------------
// Styles (injected as a <style> tag; scoped via .nim-* class names)
// ---------------------------------------------------------------------------

const NIM_CSS = `
.nim-wrapper {
  display: grid;
  gap: 1.5rem;
  padding: 1rem;
  width: 100%;
  max-width: min(98vw, 800px);
  margin: 0 auto;
}

.nim-status {
  font-size: 1.25rem;
  font-weight: 600;
  min-height: 2rem;
}

.nim-status--ended .nim-winner {
  color: var(--accent);
  font-size: 1.5rem;
}

.nim-piles {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-end;
}

.nim-pile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: var(--radius);
  background: var(--bg-elev);
  border: 2px solid transparent;
  transition: border-color 0.15s;
  min-width: 5rem;
}

.nim-pile--selected {
  border-color: var(--accent);
}

.nim-tokens {
  display: flex;
  flex-direction: column-reverse;
  gap: 6px;
  align-items: center;
}

.nim-token {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--fg-dim);
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, transform 0.1s;
}

.nim-token:hover:not(:disabled) {
  background: var(--accent);
  transform: scale(1.1);
}

.nim-token--marked {
  background: var(--danger);
  border-color: var(--fg);
}

.nim-token--marked:hover:not(:disabled) {
  background: var(--danger);
  filter: brightness(1.15);
}

.nim-pile-empty {
  color: var(--fg-dim);
  font-size: 0.85rem;
  padding: 0.5rem 0;
}

.nim-pile-label {
  color: var(--fg-dim);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.nim-action-bar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.nim-btn {
  padding: 0.6em 1.2em;
}

.nim-btn--primary {
  background: var(--accent);
  color: #000;
  font-weight: 600;
  border: none;
}

.nim-btn--primary:disabled {
  background: var(--bg-elev);
  color: var(--fg-dim);
}

.nim-variant-label {
  margin: 0;
  color: var(--fg-dim);
  font-size: 0.85rem;
}

.nim-footer {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
`

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const config = DEFAULT_CONFIG
    let state: NimState = {
      piles: [...config.piles],
      currentPlayer: 0,
      phase: 'playing',
      winner: null,
      selectedPile: null,
      markedCount: 0,
    }

    // -----------------------------------------------------------------------
    // Build shell DOM
    // -----------------------------------------------------------------------

    // Inject game-scoped styles once
    const styleId = 'nim-styles'
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style')
      styleEl.id = styleId
      styleEl.textContent = NIM_CSS
      document.head.appendChild(styleEl)
    }

    const wrapper = el('div', { class: 'nim-wrapper' })

    const statusEl = el('div', { class: 'nim-status' })
    const pilesAreaEl = el('div', { class: 'nim-piles' })

    const actionBar = el('div', { class: 'nim-action-bar' })
    const takeBtn = el('button', { type: 'button', class: 'nim-btn nim-btn--primary' }, 'Take')
    const cancelBtn = el('button', { type: 'button', class: 'nim-btn' }, 'Cancel')
    actionBar.append(cancelBtn, takeBtn)

    const footer = el('div', { class: 'nim-footer' })
    const newGameBtn = el('button', { type: 'button', class: 'nim-btn' }, 'New game')
    const exitBtn = el('button', { type: 'button', class: 'nim-btn' }, 'Back to picker')
    footer.append(newGameBtn, exitBtn)

    const variantLabel = el(
      'p',
      { class: 'nim-variant-label' },
      config.variant === 'normal' ? 'Take the last token to WIN' : 'Take the last token to LOSE',
    )

    wrapper.append(statusEl, pilesAreaEl, actionBar, variantLabel, footer)
    root.appendChild(wrapper)

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    function render() {
      // Status line
      if (state.phase === 'ended' && state.winner !== null) {
        statusEl.innerHTML = `<span class="nim-winner">${escapeHtml(ctx.players[state.winner])} wins!</span>`
        statusEl.className = 'nim-status nim-status--ended'
      } else {
        statusEl.innerHTML = `<span class="nim-turn">${escapeHtml(ctx.players[state.currentPlayer])}'s turn</span>`
        statusEl.className = 'nim-status'
      }

      // Piles
      pilesAreaEl.innerHTML = ''
      for (let i = 0; i < state.piles.length; i++) {
        const pileEl = renderPile(i, state.piles[i], state, handleTokenClick)
        pilesAreaEl.appendChild(pileEl)
      }

      // Pile labels
      const pileEls = pilesAreaEl.querySelectorAll('.nim-pile')
      pileEls.forEach((pileEl, i) => {
        const labelEl = el('div', { class: 'nim-pile-label' }, `Pile ${i + 1}`)
        pileEl.appendChild(labelEl)
      })

      // Action bar visibility
      const hasSelection = state.selectedPile !== null && state.markedCount > 0
      takeBtn.disabled = !hasSelection || state.phase === 'ended'
      cancelBtn.disabled = state.selectedPile === null || state.phase === 'ended'

      if (state.phase === 'ended') {
        actionBar.style.visibility = 'hidden'
      } else {
        actionBar.style.visibility = 'visible'
      }
    }

    // -----------------------------------------------------------------------
    // Interaction handlers
    // -----------------------------------------------------------------------

    function handleTokenClick(pileIndex: number, tokenIndex: number) {
      if (state.phase === 'ended') return
      const pileCount = state.piles[pileIndex]

      if (state.selectedPile !== null && state.selectedPile !== pileIndex) {
        // Clicked a different pile — ignore (pile is disabled in render)
        return
      }

      if (state.selectedPile === null) {
        // First click: select the pile and mark from this token onwards
        const markedCount = pileCount - tokenIndex
        state = { ...state, selectedPile: pileIndex, markedCount }
      } else {
        // Already selected this pile: adjust the marked count
        const markedCount = pileCount - tokenIndex
        state = { ...state, markedCount }
      }

      render()
    }

    takeBtn.addEventListener('click', () => {
      if (state.phase === 'ended') return
      if (state.selectedPile === null || state.markedCount === 0) return

      const pileIndex = state.selectedPile
      const newPiles = state.piles.map((count, i) =>
        i === pileIndex ? count - state.markedCount : count,
      )

      // Validate legal move (must take at least 1, not more than pile size)
      const originalCount = state.piles[pileIndex]
      if (state.markedCount < 1 || state.markedCount > originalCount) return
      if (legalTakes(originalCount).indexOf(state.markedCount) === -1) return

      const justMoved = state.currentPlayer
      const winner = checkWin(newPiles, justMoved, config.variant)
      const nextPlayer: 0 | 1 = state.currentPlayer === 0 ? 1 : 0

      state = {
        piles: newPiles,
        currentPlayer: winner !== null ? state.currentPlayer : nextPlayer,
        phase: winner !== null ? 'ended' : 'playing',
        winner,
        selectedPile: null,
        markedCount: 0,
      }

      render()
    })

    cancelBtn.addEventListener('click', () => {
      state = { ...state, selectedPile: null, markedCount: 0 }
      render()
    })

    newGameBtn.addEventListener('click', () => {
      state = {
        piles: [...config.piles],
        currentPlayer: 0,
        phase: 'playing',
        winner: null,
        selectedPile: null,
        markedCount: 0,
      }
      render()
    })

    exitBtn.addEventListener('click', ctx.onExit)

    // Initial render
    render()

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return () => {
      wrapper.remove()
      document.getElementById('nim-styles')?.remove()
    }
  },
}

export type { NimConfig }
// Re-export the pure logic for potential future AI use
export { checkWin, isLosingPosition, legalTakes }
export default game
