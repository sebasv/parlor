import { confirmDestructive } from '../../lib/confirm'
import type { GameModule } from '../../lib/game'
import meta from './meta'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOT_RADIUS = 5
const CELL_SIZE = 70 // px between adjacent dots
const MARGIN = 30 // px around the grid
const HIT_HALF = 16 // half the hit-target width for lines (≥30px total)

// Player 2 uses a local accent; player 1 inherits --accent from the shell.
const PLAYER_COLORS = ['var(--accent)', 'var(--p2-color)'] as const

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

/** A line between two adjacent dots. */
interface Line {
  owner: number | null // player index (0 or 1), null = unclaimed
}

/** The full game state. Pure data — no DOM references. */
interface State {
  cols: number // number of dot columns
  rows: number // number of dot rows
  /** Horizontal lines: [row][col] where row ∈ [0, rows-1], col ∈ [0, cols-2] */
  hLines: Line[][]
  /** Vertical lines: [row][col] where row ∈ [0, rows-2], col ∈ [0, cols-1] */
  vLines: Line[][]
  /** Box owners: [row][col] where row ∈ [0, rows-2], col ∈ [0, cols-2] */
  boxes: (number | null)[][]
  currentPlayer: number
  scores: [number, number]
  phase: 'playing' | 'done'
}

// ---------------------------------------------------------------------------
// Pure game logic
// ---------------------------------------------------------------------------

function makeState(rows: number, cols: number): State {
  return {
    cols,
    rows,
    hLines: Array.from({ length: rows }, () =>
      Array.from({ length: cols - 1 }, () => ({ owner: null })),
    ),
    vLines: Array.from({ length: rows - 1 }, () =>
      Array.from({ length: cols }, () => ({ owner: null })),
    ),
    boxes: Array.from({ length: rows - 1 }, () => Array.from({ length: cols - 1 }, () => null)),
    currentPlayer: 0,
    scores: [0, 0],
    phase: 'playing',
  }
}

/**
 * Returns how many boxes were completed by claiming the line at (kind, r, c).
 * Does NOT mutate state.
 */
/**
 * Returns how many boxes claiming this line would complete.
 * Exported for use by future AI/hint integrations.
 */
export function countCompletions(state: State, kind: 'h' | 'v', r: number, c: number): number {
  // Check each box that this line could border.
  // A horizontal line at (r, c) borders the box above (r-1, c) and below (r, c).
  // A vertical line at (r, c) borders the box to the left (r, c-1) and to the right (r, c).
  const candidates: Array<[number, number]> = []

  if (kind === 'h') {
    if (r > 0) candidates.push([r - 1, c]) // box above
    if (r < state.rows - 1) candidates.push([r, c]) // box below
  } else {
    if (c > 0) candidates.push([r, c - 1]) // box to the left
    if (c < state.cols - 1) candidates.push([r, c]) // box to the right
  }

  let count = 0
  for (const [br, bc] of candidates) {
    if (isBoxComplete(state, br, bc, kind, r, c)) count++
  }
  return count
}

/**
 * Returns true if the box at (br, bc) would be complete if the proposed line
 * (kind, r, c) were claimed (but it hasn't been mutated yet).
 */
function isBoxComplete(
  state: State,
  br: number,
  bc: number,
  proposedKind: 'h' | 'v',
  proposedR: number,
  proposedC: number,
): boolean {
  // The 4 sides of box (br, bc):
  //   top:    hLines[br][bc]
  //   bottom: hLines[br+1][bc]
  //   left:   vLines[br][bc]
  //   right:  vLines[br][bc+1]
  const sides: Array<{ kind: 'h' | 'v'; r: number; c: number }> = [
    { kind: 'h', r: br, c: bc },
    { kind: 'h', r: br + 1, c: bc },
    { kind: 'v', r: br, c: bc },
    { kind: 'v', r: br, c: bc + 1 },
  ]

  return sides.every(({ kind, r, c }) => {
    if (kind === proposedKind && r === proposedR && c === proposedC) return true
    if (kind === 'h') return state.hLines[r][c].owner !== null
    return state.vLines[r][c].owner !== null
  })
}

/**
 * Applies a move. Returns how many boxes were claimed so the caller knows
 * whether the player gets another turn.
 */
function applyMove(state: State, kind: 'h' | 'v', r: number, c: number): number {
  // Mark the line
  if (kind === 'h') {
    state.hLines[r][c].owner = state.currentPlayer
  } else {
    state.vLines[r][c].owner = state.currentPlayer
  }

  // Claim any completed boxes
  const candidates: Array<[number, number]> = []
  if (kind === 'h') {
    if (r > 0) candidates.push([r - 1, c])
    if (r < state.rows - 1) candidates.push([r, c])
  } else {
    if (c > 0) candidates.push([r, c - 1])
    if (c < state.cols - 1) candidates.push([r, c])
  }

  let claimed = 0
  for (const [br, bc] of candidates) {
    if (state.boxes[br][bc] === null && isBoxNowComplete(state, br, bc)) {
      state.boxes[br][bc] = state.currentPlayer
      state.scores[state.currentPlayer]++
      claimed++
    }
  }

  return claimed
}

function isBoxNowComplete(state: State, br: number, bc: number): boolean {
  return (
    state.hLines[br][bc].owner !== null &&
    state.hLines[br + 1][bc].owner !== null &&
    state.vLines[br][bc].owner !== null &&
    state.vLines[br][bc + 1].owner !== null
  )
}

function isGameOver(state: State): boolean {
  return (
    state.hLines.every((row) => row.every((l) => l.owner !== null)) &&
    state.vLines.every((row) => row.every((l) => l.owner !== null))
  )
}

// ---------------------------------------------------------------------------
// SVG rendering helpers
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg'

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag)
}

function dotX(col: number): number {
  return MARGIN + col * CELL_SIZE
}

function dotY(row: number): number {
  return MARGIN + row * CELL_SIZE
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    // ---- Local CSS variables ----
    const styleTag = document.createElement('style')
    styleTag.textContent = `
      .dab-root {
        --p2-color: #ff9f5a;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 1rem 0.5rem;
      }
      .dab-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: center;
      }
      .dab-status {
        font-size: 1.1rem;
        font-weight: 600;
        min-width: 12ch;
        text-align: center;
      }
      .dab-scores {
        display: flex;
        gap: 0.6rem;
      }
      .dab-score {
        display: flex;
        align-items: center;
        gap: 0.4em;
        font-size: 1rem;
        padding: 0.3em 0.75em;
        border-radius: 999px;
        border: 2px solid transparent;
        background: var(--bg-elev, #1a1d24);
        opacity: 0.4;
        transition: opacity 0.15s, border-color 0.15s, background 0.15s;
      }
      .dab-score.dab-score-active {
        opacity: 1;
        border-color: var(--dab-chip-color);
        background: color-mix(in srgb, var(--dab-chip-color) 12%, var(--bg-elev, #1a1d24));
      }
      @keyframes dab-pulse {
        0%, 100% { box-shadow: 0 0 0 0 var(--dab-chip-color); }
        50%       { box-shadow: 0 0 0 4px transparent; }
      }
      .dab-score.dab-score-active {
        animation: dab-pulse 1.5s ease-in-out infinite;
      }
      .dab-score-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .dab-score-count {
        font-weight: 700;
        min-width: 2ch;
      }
      .dab-svg-wrap {
        width: 100%;
        max-width: min(95vw, 90vh, 700px);
      }
      .dab-svg {
        width: 100%;
        height: auto;
      }
      .dab-svg line.dab-line-drawn {
        stroke-width: 3;
        stroke-linecap: round;
      }
      .dab-svg rect.dab-hit {
        fill: transparent;
        cursor: pointer;
      }
      .dab-svg rect.dab-hit:hover {
        fill: rgba(255,255,255,0.08);
        border-radius: 4px;
      }
      .dab-svg rect.dab-hit[data-claimed] {
        cursor: default;
        pointer-events: none;
      }
      .dab-footer {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: center;
      }
      .dab-size-select {
        display: flex;
        align-items: center;
        gap: 0.5em;
        font-size: 0.9rem;
        color: var(--fg-dim);
      }
      .dab-size-select select {
        font: inherit;
        color: inherit;
        background: var(--bg-elev);
        border: 1px solid #2a2f38;
        border-radius: var(--radius);
        padding: 0.4em 0.6em;
        cursor: pointer;
      }
    `
    document.head.appendChild(styleTag)

    // ---- Outer container ----
    const container = document.createElement('div')
    container.className = 'dab-root'
    root.appendChild(container)

    // ---- Grid size selector ----
    let gridDots = 5 // default 5x5 dots → 4x4 boxes
    let state = makeState(gridDots, gridDots)

    // ---- Build DOM skeleton ----
    const header = document.createElement('div')
    header.className = 'dab-header'

    const statusEl = document.createElement('div')
    statusEl.className = 'dab-status'

    const scoresEl = document.createElement('div')
    scoresEl.className = 'dab-scores'

    // Score chips for each player
    const scoreEls = ctx.players.map((name, i) => {
      const chip = document.createElement('div')
      chip.className = 'dab-score'
      chip.style.setProperty('--dab-chip-color', PLAYER_COLORS[i])
      const dot = document.createElement('div')
      dot.className = 'dab-score-dot'
      dot.style.background = PLAYER_COLORS[i]
      const label = document.createElement('span')
      label.textContent = name
      const count = document.createElement('span')
      count.className = 'dab-score-count'
      count.textContent = '0'
      chip.appendChild(dot)
      chip.appendChild(label)
      chip.appendChild(count)
      return { chip, count }
    })
    for (const { chip } of scoreEls) {
      scoresEl.appendChild(chip)
    }

    header.appendChild(statusEl)
    header.appendChild(scoresEl)
    container.appendChild(header)

    // ---- SVG wrapper ----
    const svgWrap = document.createElement('div')
    svgWrap.className = 'dab-svg-wrap'
    container.appendChild(svgWrap)

    let svg: SVGSVGElement | null = null
    let cleanupSvgListeners: (() => void) | null = null

    // ---- Footer ----
    const footer = document.createElement('div')
    footer.className = 'dab-footer'

    const sizeWrap = document.createElement('div')
    sizeWrap.className = 'dab-size-select'
    const sizeLabel = document.createElement('label')
    sizeLabel.textContent = 'Grid:'
    const sizeSelect = document.createElement('select')
    ;[4, 5, 6, 7, 8].forEach((n) => {
      const opt = document.createElement('option')
      opt.value = String(n)
      opt.textContent = `${n}x${n} dots (${n - 1}x${n - 1} boxes)`
      if (n === gridDots) opt.selected = true
      sizeSelect.appendChild(opt)
    })
    sizeWrap.appendChild(sizeLabel)
    sizeWrap.appendChild(sizeSelect)

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.textContent = 'New game'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.textContent = 'Back to picker'

    footer.appendChild(sizeWrap)
    footer.appendChild(newGameBtn)
    footer.appendChild(exitBtn)
    container.appendChild(footer)

    // ---- Rendering ----

    function renderSvg(): void {
      if (cleanupSvgListeners) {
        cleanupSvgListeners()
        cleanupSvgListeners = null
      }
      if (svg) svg.remove()

      const { rows, cols } = state
      const width = MARGIN * 2 + (cols - 1) * CELL_SIZE
      const height = MARGIN * 2 + (rows - 1) * CELL_SIZE

      svg = svgEl('svg')
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      svg.classList.add('dab-svg')

      // Box fill layer (below lines and dots)
      const boxLayer = svgEl('g')
      for (let br = 0; br < rows - 1; br++) {
        for (let bc = 0; bc < cols - 1; bc++) {
          const rect = svgEl('rect')
          rect.setAttribute('x', String(dotX(bc) + 1))
          rect.setAttribute('y', String(dotY(br) + 1))
          rect.setAttribute('width', String(CELL_SIZE - 2))
          rect.setAttribute('height', String(CELL_SIZE - 2))
          rect.setAttribute('rx', '4')
          rect.setAttribute('fill', 'transparent')
          rect.dataset.boxR = String(br)
          rect.dataset.boxC = String(bc)
          boxLayer.appendChild(rect)
        }
      }
      svg.appendChild(boxLayer)

      // Line drawn layer
      const lineLayer = svgEl('g')
      svg.appendChild(lineLayer)

      // Dot layer (always on top)
      const dotLayer = svgEl('g')
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const circle = svgEl('circle')
          circle.setAttribute('cx', String(dotX(c)))
          circle.setAttribute('cy', String(dotY(r)))
          circle.setAttribute('r', String(DOT_RADIUS))
          circle.setAttribute('fill', 'var(--fg-dim)')
          dotLayer.appendChild(circle)
        }
      }
      svg.appendChild(dotLayer)

      // Hit target layer (on top of everything)
      const hitLayer = svgEl('g')
      svg.appendChild(hitLayer)

      const abortCtrl = new AbortController()
      const { signal } = abortCtrl

      // Horizontal hit targets
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const x1 = dotX(c)
          const y1 = dotY(r)
          const x2 = dotX(c + 1)
          // Drawn line element
          const lineEl = svgEl('line')
          lineEl.setAttribute('x1', String(x1 + DOT_RADIUS))
          lineEl.setAttribute('y1', String(y1))
          lineEl.setAttribute('x2', String(x2 - DOT_RADIUS))
          lineEl.setAttribute('y2', String(y1))
          lineEl.setAttribute('stroke', 'var(--fg-dim)')
          lineEl.setAttribute('stroke-width', '2')
          lineEl.setAttribute('stroke-dasharray', '4 4')
          lineEl.setAttribute('opacity', '0.45')
          lineEl.dataset.hR = String(r)
          lineEl.dataset.hC = String(c)
          lineLayer.appendChild(lineEl)

          // Fat hit target
          const hit = svgEl('rect')
          hit.setAttribute('x', String(x1 + DOT_RADIUS))
          hit.setAttribute('y', String(y1 - HIT_HALF))
          hit.setAttribute('width', String(CELL_SIZE - DOT_RADIUS * 2))
          hit.setAttribute('height', String(HIT_HALF * 2))
          hit.classList.add('dab-hit')
          hit.dataset.kind = 'h'
          hit.dataset.r = String(r)
          hit.dataset.c = String(c)
          hitLayer.appendChild(hit)
        }
      }

      // Vertical hit targets
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          const x1 = dotX(c)
          const y1 = dotY(r)
          const y2 = dotY(r + 1)
          // Drawn line element
          const lineEl = svgEl('line')
          lineEl.setAttribute('x1', String(x1))
          lineEl.setAttribute('y1', String(y1 + DOT_RADIUS))
          lineEl.setAttribute('x2', String(x1))
          lineEl.setAttribute('y2', String(y2 - DOT_RADIUS))
          lineEl.setAttribute('stroke', 'var(--fg-dim)')
          lineEl.setAttribute('stroke-width', '2')
          lineEl.setAttribute('stroke-dasharray', '4 4')
          lineEl.setAttribute('opacity', '0.45')
          lineEl.dataset.vR = String(r)
          lineEl.dataset.vC = String(c)
          lineLayer.appendChild(lineEl)

          // Fat hit target
          const hit = svgEl('rect')
          hit.setAttribute('x', String(x1 - HIT_HALF))
          hit.setAttribute('y', String(y1 + DOT_RADIUS))
          hit.setAttribute('width', String(HIT_HALF * 2))
          hit.setAttribute('height', String(CELL_SIZE - DOT_RADIUS * 2))
          hit.classList.add('dab-hit')
          hit.dataset.kind = 'v'
          hit.dataset.r = String(r)
          hit.dataset.c = String(c)
          hitLayer.appendChild(hit)
        }
      }

      // Click handler on the hit layer (event delegation)
      hitLayer.addEventListener(
        'click',
        (e: Event) => {
          if (state.phase !== 'playing') return
          const target = e.target as SVGElement
          if (!target.classList.contains('dab-hit')) return
          if (target.dataset.claimed !== undefined) return

          const kind = target.dataset.kind as 'h' | 'v'
          const r = Number(target.dataset.r)
          const c = Number(target.dataset.c)

          const claimed = applyMove(state, kind, r, c)

          if (isGameOver(state)) {
            state.phase = 'done'
          } else if (claimed === 0) {
            // No box claimed → switch player
            state.currentPlayer = 1 - state.currentPlayer
          }
          // If claimed > 0, same player goes again (no switch)

          updateVisuals()
        },
        { signal },
      )

      cleanupSvgListeners = () => abortCtrl.abort()

      svgWrap.appendChild(svg)
    }

    function updateVisuals(): void {
      if (!svg) return
      const { rows, cols } = state

      // Update drawn horizontal lines
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const line = state.hLines[r][c]
          const el = svg?.querySelector<SVGLineElement>(`[data-h-r="${r}"][data-h-c="${c}"]`)
          if (!el) continue
          if (line.owner !== null) {
            el.setAttribute('stroke', PLAYER_COLORS[line.owner])
            el.setAttribute('stroke-width', '3')
            el.removeAttribute('stroke-dasharray')
            el.setAttribute('opacity', '1')
            el.classList.add('dab-line-drawn')
            // Disable the hit target
            const hit = svg?.querySelector<SVGRectElement>(
              `[data-kind="h"][data-r="${r}"][data-c="${c}"]`,
            )
            if (hit) hit.dataset.claimed = 'true'
          }
        }
      }

      // Update drawn vertical lines
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          const line = state.vLines[r][c]
          const el = svg?.querySelector<SVGLineElement>(`[data-v-r="${r}"][data-v-c="${c}"]`)
          if (!el) continue
          if (line.owner !== null) {
            el.setAttribute('stroke', PLAYER_COLORS[line.owner])
            el.setAttribute('stroke-width', '3')
            el.removeAttribute('stroke-dasharray')
            el.setAttribute('opacity', '1')
            el.classList.add('dab-line-drawn')
            const hit = svg?.querySelector<SVGRectElement>(
              `[data-kind="v"][data-r="${r}"][data-c="${c}"]`,
            )
            if (hit) hit.dataset.claimed = 'true'
          }
        }
      }

      // Update box fills
      for (let br = 0; br < rows - 1; br++) {
        for (let bc = 0; bc < cols - 1; bc++) {
          const owner = state.boxes[br][bc]
          const el = svg?.querySelector<SVGRectElement>(`[data-box-r="${br}"][data-box-c="${bc}"]`)
          if (!el) continue
          if (owner !== null) {
            el.setAttribute('fill', PLAYER_COLORS[owner])
            el.setAttribute('opacity', '0.35')
            // Initial text label — only add once
            if (!el.dataset.labeled) {
              el.dataset.labeled = 'true'
              const text = svgEl('text')
              text.setAttribute('x', String(dotX(bc) + CELL_SIZE / 2))
              text.setAttribute('y', String(dotY(br) + CELL_SIZE / 2 + 5))
              text.setAttribute('text-anchor', 'middle')
              text.setAttribute('fill', PLAYER_COLORS[owner])
              text.setAttribute('font-size', '14')
              text.setAttribute('font-weight', '700')
              text.setAttribute('opacity', '0.9')
              text.textContent = ctx.players[owner].charAt(0).toUpperCase()
              // Insert before dot layer
              const dotLayer = svg?.querySelector('g:nth-child(3)')
              svg?.insertBefore(text, dotLayer ?? null)
            }
          }
        }
      }

      // Update score counts and active-player highlighting
      scoreEls.forEach(({ chip, count }, i) => {
        count.textContent = String(state.scores[i])
        chip.classList.toggle(
          'dab-score-active',
          state.phase === 'playing' && state.currentPlayer === i,
        )
      })

      // Update status
      if (state.phase === 'done') {
        const [s0, s1] = state.scores
        if (s0 === s1) {
          statusEl.textContent = "It's a tie!"
        } else {
          const winner = s0 > s1 ? 0 : 1
          statusEl.textContent = `${ctx.players[winner]} wins!`
          statusEl.style.color = PLAYER_COLORS[winner]
        }
      } else {
        statusEl.style.color = ''
        statusEl.textContent = `${ctx.players[state.currentPlayer]}'s turn`
        statusEl.style.color = PLAYER_COLORS[state.currentPlayer]
      }
    }

    function startGame(): void {
      gridDots = Number(sizeSelect.value)
      state = makeState(gridDots, gridDots)
      renderSvg()
      updateVisuals()
    }

    newGameBtn.addEventListener('click', async () => {
      if (!(await confirmDestructive())) return
      startGame()
    })
    exitBtn.addEventListener('click', ctx.onExit)
    sizeSelect.addEventListener('change', startGame)

    // Initial render
    startGame()

    // Cleanup
    return () => {
      if (cleanupSvgListeners) cleanupSvgListeners()
      newGameBtn.removeEventListener('click', startGame)
      exitBtn.removeEventListener('click', ctx.onExit)
      sizeSelect.removeEventListener('change', startGame)
      container.remove()
      styleTag.remove()
    }
  },
}

export default game
