import { confirmDestructive } from '../../lib/confirm'
import type { GameModule } from '../../lib/game'
import meta from './meta'

// ---------------------------------------------------------------------------
// Card types
// ---------------------------------------------------------------------------

type Shape = 'circle' | 'square' | 'triangle'
type Color = 'red' | 'green' | 'purple'
type Count = 1 | 2 | 3
type Shading = 'solid' | 'striped' | 'open'

interface Card {
  readonly id: number
  readonly shape: Shape
  readonly color: Color
  readonly count: Count
  readonly shading: Shading
}

// ---------------------------------------------------------------------------
// Deck construction
// ---------------------------------------------------------------------------

const SHAPES: Shape[] = ['circle', 'square', 'triangle']
const COLORS: Color[] = ['red', 'green', 'purple']
const COUNTS: Count[] = [1, 2, 3]
const SHADINGS: Shading[] = ['solid', 'striped', 'open']

function buildDeck(): Card[] {
  const deck: Card[] = []
  let id = 0
  for (const shape of SHAPES) {
    for (const color of COLORS) {
      for (const count of COUNTS) {
        for (const shading of SHADINGS) {
          deck.push({ id: id++, shape, color, count, shading })
        }
      }
    }
  }
  return deck
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------------------------------------------------------------------------
// Pure game logic
// ---------------------------------------------------------------------------

/**
 * Returns true when three cards form a valid Set: for every feature,
 * the three values are either all the same or all different.
 */
export function isValidSet(a: Card, b: Card, c: Card): boolean {
  function allSameOrAllDiff<T>(x: T, y: T, z: T): boolean {
    return (x === y && y === z) || (x !== y && y !== z && x !== z)
  }
  return (
    allSameOrAllDiff(a.shape, b.shape, c.shape) &&
    allSameOrAllDiff(a.color, b.color, c.color) &&
    allSameOrAllDiff(a.count, b.count, c.count) &&
    allSameOrAllDiff(a.shading, b.shading, c.shading)
  )
}

/** Returns the first valid set found among the given cards, or null. */
export function findAnySet(cards: Card[]): [Card, Card, Card] | null {
  for (let i = 0; i < cards.length - 2; i++) {
    for (let j = i + 1; j < cards.length - 1; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        if (isValidSet(cards[i], cards[j], cards[k])) {
          return [cards[i], cards[j], cards[k]]
        }
      }
    }
  }
  return null
}

/** Removes `count` cards from the front of the deck and returns them. Mutates deck. */
export function dealCards(deck: Card[], count: number): Card[] {
  return deck.splice(0, count)
}

// ---------------------------------------------------------------------------
// Player colours — distinct, readable on dark background
// ---------------------------------------------------------------------------

const PLAYER_COLORS = ['#6cb1ff', '#ff6b6b', '#6bff9e', '#ffcc4d', '#d06bff', '#ff9b6b']

// ---------------------------------------------------------------------------
// SVG rendering helpers
// ---------------------------------------------------------------------------

const COLOR_FILLS: Record<Color, string> = {
  red: '#e84040',
  green: '#3db868',
  purple: '#9b6bff',
}

function stripePatternId(color: Color, shading: Shading): string {
  return `set-stripe-${color}-${shading}`
}

/**
 * Builds one SVG symbol (40×40 viewport) for a given shape + color + shading.
 * Shapes are simplified: circle, square, triangle (not oval/diamond/squiggle).
 */
function buildSymbolSvg(shape: Shape, color: Color, shading: Shading): string {
  const fill = COLOR_FILLS[color]
  const pid = stripePatternId(color, shading)

  let shapeFill: string
  let strokeAttr: string

  if (shading === 'solid') {
    shapeFill = fill
    strokeAttr = `stroke="${fill}" stroke-width="2"`
  } else if (shading === 'open') {
    shapeFill = 'none'
    strokeAttr = `stroke="${fill}" stroke-width="2.5"`
  } else {
    // striped
    shapeFill = `url(#${pid})`
    strokeAttr = `stroke="${fill}" stroke-width="2"`
  }

  const patternDef =
    shading === 'striped'
      ? `<defs>
          <pattern id="${pid}" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="5" height="2.5" fill="${fill}"/>
          </pattern>
        </defs>`
      : ''

  let shapeEl: string
  if (shape === 'circle') {
    shapeEl = `<circle cx="20" cy="20" r="15" fill="${shapeFill}" ${strokeAttr}/>`
  } else if (shape === 'square') {
    shapeEl = `<rect x="5" y="5" width="30" height="30" rx="4" fill="${shapeFill}" ${strokeAttr}/>`
  } else {
    // triangle
    shapeEl = `<polygon points="20,4 36,36 4,36" fill="${shapeFill}" ${strokeAttr}/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
    ${patternDef}
    ${shapeEl}
  </svg>`
}

/** Renders a card as an HTMLButtonElement. */
function renderCard(card: Card): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'set-card'
  el.dataset.cardId = String(card.id)
  el.setAttribute('aria-label', `${card.count} ${card.shading} ${card.color} ${card.shape}`)

  const symbolSvg = buildSymbolSvg(card.shape, card.color, card.shading)
  const symbols = Array.from({ length: card.count }, () => symbolSvg).join('')

  el.innerHTML = `<div class="set-card-symbols">${symbols}</div>`
  return el
}

// ---------------------------------------------------------------------------
// GameModule
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    let deck: Card[] = shuffle(buildDeck())
    let tableCards: Card[] = dealCards(deck, 12)
    const scores: number[] = ctx.players.map(() => 0)

    // Claim / selection state
    let claimingPlayer: number | null = null
    let selectedIds: Set<number> = new Set()
    let statusTimeout: ReturnType<typeof setTimeout> | null = null
    let gameOver = false

    // -----------------------------------------------------------------------
    // DOM skeleton
    // -----------------------------------------------------------------------

    const style = document.createElement('style')
    style.textContent = `
      .set-root {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.25rem;
        min-height: 100%;
        box-sizing: border-box;
      }

      .set-score-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
      }

      .set-score-badge {
        padding: 0.35em 0.85em;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.9rem;
        color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.4);
        min-width: 3.5em;
        text-align: center;
        box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      }

      .set-status {
        min-height: 1.6em;
        font-size: 1rem;
        font-weight: 600;
        text-align: center;
        color: var(--fg);
      }

      .set-status.set-status--error {
        color: var(--danger);
      }

      .set-status.set-status--success {
        color: #6bff9e;
      }

      .set-claim-banner {
        font-size: 1rem;
        font-weight: 700;
        text-align: center;
        padding: 0.4em 1em;
        border-radius: var(--radius);
        min-height: 1.8em;
      }

      .set-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        width: 100%;
        max-width: min(98vw, 720px);
      }

      @media (max-width: 400px) {
        .set-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      .set-card {
        background: #fff;
        border: 2.5px solid #c8c8c8;
        border-radius: 10px;
        padding: 0.4rem 0.2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
        min-height: 80px;
        aspect-ratio: 0.65;
        box-shadow: 0 1px 4px rgba(0,0,0,0.18);
        /* Keep full opacity even when disabled — shapes must always read clearly */
        opacity: 1;
      }

      .set-card:disabled {
        /* Override browser default which dims disabled buttons */
        opacity: 1;
        cursor: default;
      }

      .set-card:hover:not(:disabled) {
        border-color: #999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.22);
      }

      .set-card.set-card--selected {
        background: #fff;
      }

      .set-card-symbols {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        pointer-events: none;
      }

      .set-card-symbols svg {
        width: clamp(28px, 6vw, 38px);
        height: clamp(28px, 6vw, 38px);
      }

      .set-claim-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
        width: 100%;
        max-width: min(98vw, 720px);
      }

      @keyframes set-pulse {
        0%, 100% { box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
        50% { box-shadow: 0 2px 14px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.35); }
      }

      .set-claim-btn {
        flex: 1 1 120px;
        max-width: 160px;
        min-height: 56px;
        font-size: 1rem;
        font-weight: 700;
        border: 3px solid transparent;
        border-radius: var(--radius);
        color: #fff;
        cursor: pointer;
        transition: opacity 0.12s, box-shadow 0.12s, transform 0.12s, border-color 0.12s;
        text-shadow: 0 1px 2px rgba(0,0,0,0.35);
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        letter-spacing: 0.01em;
      }

      /* Pulse all buttons in idle state to draw attention */
      .set-claim-btn.set-claim-btn--idle {
        animation: set-pulse 1.6s ease-in-out infinite;
      }

      /* Active claimer: thick white border + slight scale-up */
      .set-claim-btn.set-claim-btn--active {
        border-color: #fff;
        transform: scale(1.08);
        box-shadow: 0 4px 16px rgba(0,0,0,0.45), 0 0 0 3px rgba(255,255,255,0.6);
        animation: none;
      }

      .set-claim-btn::after {
        content: ' ▶ TAP';
        font-size: 0.7em;
        opacity: 0.85;
        display: block;
        font-weight: 400;
        letter-spacing: 0.05em;
      }

      .set-claim-btn:hover:not(:disabled) {
        box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      }

      .set-claim-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        box-shadow: none;
        animation: none;
      }

      .set-claim-btn:disabled::after {
        display: none;
      }

      /* Grid frame lights up in the active player's colour during a claim */
      .set-grid.set-grid--claiming {
        border-radius: 12px;
        outline: 4px solid var(--set-claimer-color, transparent);
        outline-offset: 4px;
      }

      .set-selection-controls {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
      }

      .set-btn-confirm {
        background: #3db868;
        color: #000;
        font-weight: 700;
        min-width: 100px;
        min-height: 48px;
        border: none;
        border-radius: var(--radius);
      }

      .set-btn-confirm:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .set-btn-cancel {
        background: var(--bg-elev);
        color: var(--fg-dim);
        min-width: 80px;
        min-height: 48px;
        border: none;
        border-radius: var(--radius);
      }

      .set-deck-info {
        font-size: 0.85rem;
        color: var(--fg-dim);
        text-align: center;
      }

      .set-controls {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: center;
      }

      .set-btn-new {
        background: var(--accent);
        color: #000;
        font-weight: 700;
        min-height: 44px;
        border: none;
        border-radius: var(--radius);
      }

      .set-btn-exit {
        background: var(--bg-elev);
        color: var(--fg-dim);
        min-height: 44px;
        border: none;
        border-radius: var(--radius);
      }

      .set-gameover {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
      }

      .set-gameover h2 {
        margin: 0;
        font-size: 1.6rem;
        color: var(--accent);
      }

      .set-gameover-scores {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-size: 1.1rem;
        width: 100%;
        max-width: 280px;
      }

      .set-gameover-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.3em 0.8em;
        border-radius: 8px;
        background: var(--bg-elev);
      }

      .set-gameover-row.set-gameover-row--winner {
        font-weight: 700;
      }

      .set-countdown {
        font-size: 0.85rem;
        opacity: 0.8;
      }
    `

    const container = document.createElement('div')
    container.className = 'set-root'

    // Score strip
    const scoreStrip = document.createElement('div')
    scoreStrip.className = 'set-score-strip'

    // Status line
    const statusEl = document.createElement('div')
    statusEl.className = 'set-status'

    // Claim banner (visible during selection)
    const claimBanner = document.createElement('div')
    claimBanner.className = 'set-claim-banner'
    claimBanner.style.display = 'none'

    // Card grid
    const gridEl = document.createElement('div')
    gridEl.className = 'set-grid'

    // Selection controls (confirm / cancel)
    const selectionControls = document.createElement('div')
    selectionControls.className = 'set-selection-controls'
    selectionControls.style.display = 'none'

    const confirmBtn = document.createElement('button')
    confirmBtn.type = 'button'
    confirmBtn.className = 'set-btn-confirm'
    confirmBtn.textContent = 'Confirm'
    confirmBtn.disabled = true

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'set-btn-cancel'
    cancelBtn.textContent = 'Cancel'

    selectionControls.appendChild(confirmBtn)
    selectionControls.appendChild(cancelBtn)

    // Claim buttons row
    const claimRow = document.createElement('div')
    claimRow.className = 'set-claim-row'

    const claimBtns: HTMLButtonElement[] = ctx.players.map((name, i) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'set-claim-btn'
      btn.textContent = name
      btn.style.background = PLAYER_COLORS[i] ?? '#aaa'
      claimRow.appendChild(btn)
      return btn
    })

    // Deck info
    const deckInfo = document.createElement('div')
    deckInfo.className = 'set-deck-info'

    // Game controls
    const controlsEl = document.createElement('div')
    controlsEl.className = 'set-controls'

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.className = 'set-btn-new'
    newGameBtn.textContent = 'New game'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.className = 'set-btn-exit'
    exitBtn.textContent = 'Back to picker'

    controlsEl.appendChild(newGameBtn)
    controlsEl.appendChild(exitBtn)

    container.appendChild(scoreStrip)
    container.appendChild(statusEl)
    container.appendChild(claimBanner)
    container.appendChild(gridEl)
    container.appendChild(selectionControls)
    container.appendChild(claimRow)
    container.appendChild(deckInfo)
    container.appendChild(controlsEl)

    root.appendChild(style)
    root.appendChild(container)

    // -----------------------------------------------------------------------
    // Countdown timer for selection
    // -----------------------------------------------------------------------

    let countdownInterval: ReturnType<typeof setInterval> | null = null
    let countdownSeconds = 0

    function startCountdown(seconds: number, onExpire: () => void) {
      countdownSeconds = seconds
      updateClaimBanner()
      countdownInterval = setInterval(() => {
        countdownSeconds -= 1
        updateClaimBanner()
        if (countdownSeconds <= 0) {
          stopCountdown()
          onExpire()
        }
      }, 1000)
    }

    function stopCountdown() {
      if (countdownInterval !== null) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
    }

    // -----------------------------------------------------------------------
    // Render helpers
    // -----------------------------------------------------------------------

    function escapeHtml(s: string): string {
      return s.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
      )
    }

    function updateScores() {
      scoreStrip.innerHTML = ''
      ctx.players.forEach((name, i) => {
        const badge = document.createElement('div')
        badge.className = 'set-score-badge'
        badge.style.background = PLAYER_COLORS[i] ?? '#aaa'
        badge.title = name
        badge.textContent = `${escapeHtml(name.length > 8 ? `${name.slice(0, 7)}…` : name)}: ${scores[i]}`
        scoreStrip.appendChild(badge)
      })
    }

    function updateClaimBanner() {
      if (claimingPlayer === null) {
        claimBanner.style.display = 'none'
        return
      }
      const name = escapeHtml(ctx.players[claimingPlayer])
      const color = PLAYER_COLORS[claimingPlayer] ?? '#aaa'
      claimBanner.style.display = ''
      claimBanner.style.background = color
      claimBanner.style.color = '#fff'
      claimBanner.style.textShadow = '0 1px 2px rgba(0,0,0,0.35)'
      claimBanner.innerHTML = `${name} is selecting <span class="set-countdown">(${countdownSeconds}s)</span>`
    }

    function showStatus(msg: string, type: 'neutral' | 'error' | 'success' = 'neutral') {
      if (statusTimeout !== null) clearTimeout(statusTimeout)
      statusEl.className = 'set-status'
      if (type === 'error') statusEl.classList.add('set-status--error')
      if (type === 'success') statusEl.classList.add('set-status--success')
      statusEl.textContent = msg
      if (msg !== '') {
        statusTimeout = setTimeout(() => {
          statusEl.textContent = ''
          statusTimeout = null
        }, 2500)
      }
    }

    function renderGrid() {
      gridEl.innerHTML = ''

      // Grid frame: light up with the active player's colour during a claim
      if (claimingPlayer !== null) {
        const playerColor = PLAYER_COLORS[claimingPlayer] ?? '#aaa'
        gridEl.classList.add('set-grid--claiming')
        gridEl.style.setProperty('--set-claimer-color', playerColor)
      } else {
        gridEl.classList.remove('set-grid--claiming')
        gridEl.style.removeProperty('--set-claimer-color')
      }

      // Use active player's colour for the selection ring on cards
      const selectionColor =
        claimingPlayer !== null ? (PLAYER_COLORS[claimingPlayer] ?? '#aaa') : null

      for (const card of tableCards) {
        const el = renderCard(card)
        el.disabled = claimingPlayer === null
        if (selectedIds.has(card.id)) {
          el.classList.add('set-card--selected')
          if (selectionColor !== null) {
            el.style.borderColor = selectionColor
            el.style.boxShadow = `0 0 0 3px ${selectionColor}, 0 2px 8px rgba(0,0,0,0.2)`
          }
        }
        el.addEventListener('click', () => handleCardClick(card))
        gridEl.appendChild(el)
      }
    }

    function updateClaimButtons() {
      claimBtns.forEach((btn, i) => {
        btn.disabled = (claimingPlayer !== null && claimingPlayer !== i) || gameOver
        btn.classList.remove('set-claim-btn--idle', 'set-claim-btn--active')
        if (claimingPlayer === null && !gameOver) {
          btn.classList.add('set-claim-btn--idle')
        } else if (claimingPlayer === i) {
          btn.classList.add('set-claim-btn--active')
        }
      })
    }

    function updateSelectionControls() {
      if (claimingPlayer === null) {
        selectionControls.style.display = 'none'
        return
      }
      selectionControls.style.display = 'flex'
      confirmBtn.disabled = selectedIds.size !== 3
    }

    function render() {
      updateScores()
      renderGrid()
      updateClaimButtons()
      updateSelectionControls()
      updateClaimBanner()
      deckInfo.textContent = `${deck.length} cards remaining in deck`
    }

    // -----------------------------------------------------------------------
    // Game logic helpers
    // -----------------------------------------------------------------------

    /**
     * After a set is claimed, removes those 3 cards, refills from deck,
     * and if no set exists keeps dealing 3 more until a set appears or deck is empty.
     */
    function refillTable(removedIds: Set<number>) {
      tableCards = tableCards.filter((c) => !removedIds.has(c.id))

      // Refill to 12
      const needed = 12 - tableCards.length
      if (deck.length > 0) {
        tableCards.push(...dealCards(deck, Math.min(needed, deck.length)))
      }

      // Deal extras until a set exists or deck is empty
      while (findAnySet(tableCards) === null && deck.length > 0) {
        const extra = dealCards(deck, Math.min(3, deck.length))
        tableCards.push(...extra)
        showStatus(`No set visible — dealing ${extra.length} more cards`, 'neutral')
      }
    }

    function checkGameOver(): boolean {
      if (deck.length === 0 && findAnySet(tableCards) === null) {
        return true
      }
      return false
    }

    function showGameOver() {
      gameOver = true

      const maxScore = Math.max(...scores)
      const winners = ctx.players.filter((_, i) => scores[i] === maxScore)

      // Build game-over overlay inside container
      const overlay = document.createElement('div')
      overlay.className = 'set-gameover'

      const title = document.createElement('h2')
      title.textContent = winners.length === 1 ? `${winners[0]} wins!` : 'Tie game!'
      overlay.appendChild(title)

      const scoreList = document.createElement('div')
      scoreList.className = 'set-gameover-scores'

      // Sort descending
      const ranked = ctx.players
        .map((name, i) => ({ name, score: scores[i], color: PLAYER_COLORS[i] ?? '#aaa' }))
        .sort((a, b) => b.score - a.score)

      for (const { name, score, color } of ranked) {
        const row = document.createElement('div')
        row.className = 'set-gameover-row'
        if (score === maxScore) row.classList.add('set-gameover-row--winner')
        row.innerHTML = `<span>${escapeHtml(name)}</span><span style="color:${color};font-weight:700">${score}</span>`
        scoreList.appendChild(row)
      }

      overlay.appendChild(scoreList)

      // Replace grid with overlay
      gridEl.innerHTML = ''
      gridEl.appendChild(overlay)

      claimRow.style.display = 'none'
      selectionControls.style.display = 'none'
      claimBanner.style.display = 'none'
    }

    // -----------------------------------------------------------------------
    // Event handlers
    // -----------------------------------------------------------------------

    function handleCardClick(card: Card) {
      if (claimingPlayer === null) return

      if (selectedIds.has(card.id)) {
        selectedIds.delete(card.id)
      } else if (selectedIds.size < 3) {
        selectedIds.add(card.id)
      }

      renderGrid()
      updateSelectionControls()
    }

    function handleClaim(playerIndex: number) {
      if (claimingPlayer !== null || gameOver) return

      claimingPlayer = playerIndex
      selectedIds = new Set()

      render()

      startCountdown(10, () => {
        // Auto-cancel — no penalty
        cancelClaim()
      })
    }

    function cancelClaim() {
      stopCountdown()
      claimingPlayer = null
      selectedIds = new Set()
      render()
    }

    function confirmClaim() {
      if (claimingPlayer === null || selectedIds.size !== 3) return

      stopCountdown()

      const triple = tableCards.filter((c) => selectedIds.has(c.id))
      if (triple.length !== 3) {
        cancelClaim()
        return
      }

      const [a, b, c] = triple as [Card, Card, Card]
      const player = claimingPlayer

      if (isValidSet(a, b, c)) {
        scores[player] = (scores[player] ?? 0) + 1
        showStatus(`${ctx.players[player]} found a set! +1`, 'success')
        const claimedIds = new Set(selectedIds)
        claimingPlayer = null
        selectedIds = new Set()
        refillTable(claimedIds)

        if (checkGameOver()) {
          render()
          showGameOver()
          return
        }
      } else {
        scores[player] = (scores[player] ?? 0) - 1
        showStatus(`Not a set! ${ctx.players[player]} −1`, 'error')
        claimingPlayer = null
        selectedIds = new Set()
      }

      render()
    }

    // Wire claim buttons
    claimBtns.forEach((btn, i) => {
      btn.addEventListener('click', () => handleClaim(i))
    })

    confirmBtn.addEventListener('click', confirmClaim)
    cancelBtn.addEventListener('click', cancelClaim)

    newGameBtn.addEventListener('click', async () => {
      if (!(await confirmDestructive())) return
      stopCountdown()
      if (statusTimeout !== null) clearTimeout(statusTimeout)

      deck = shuffle(buildDeck())
      tableCards = dealCards(deck, 12)
      for (let i = 0; i < scores.length; i++) scores[i] = 0
      claimingPlayer = null
      selectedIds = new Set()
      gameOver = false
      claimRow.style.display = ''
      statusEl.textContent = ''

      render()
    })

    exitBtn.addEventListener('click', ctx.onExit)

    // Initial render
    render()

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return () => {
      stopCountdown()
      if (statusTimeout !== null) clearTimeout(statusTimeout)
      style.remove()
      container.remove()
    }
  },
}

export default game
