import type { GameModule } from '../../lib/game'
import meta from './meta'
import {
  applyMove,
  type GameState,
  initialState,
  legalMoves,
  type Move,
  type Pawn,
  type PlayerIndex,
  STARTS,
  skipTurn,
  stepsToHomeEntry,
  winner,
} from './rules'

// ---------------------------------------------------------------------------
// Board layout constants
// ---------------------------------------------------------------------------

// The board renders as a 480x480 SVG grid inside a 600x500 canvas.
// Each of the 15x15 cells is CELL px wide/tall.

const SVG_W = 600
const SVG_H = 500
const BOARD_X = 60 // left offset of the 15x15 grid within the SVG
const BOARD_Y = 10 // top offset
const BOARD_SIZE = 480
const CELL = BOARD_SIZE / 15 // 32 px per cell

// Player colours: Red, Yellow, Green, Blue
const PLAYER_COLORS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6'] as const
const PLAYER_NAMES = ['Red', 'Yellow', 'Green', 'Blue'] as const

// ---------------------------------------------------------------------------
// Board coordinate helpers
// ---------------------------------------------------------------------------

// Returns SVG [cx, cy] centre for 15x15 grid cell at [col, row] (0-indexed).
function cellCentre(col: number, row: number): [number, number] {
  return [BOARD_X + col * CELL + CELL / 2, BOARD_Y + row * CELL + CELL / 2]
}

// ---------------------------------------------------------------------------
// Standard Ludo 15x15 track — 52 squares, clockwise
// ---------------------------------------------------------------------------
//
// Player entry points on the main track:
//   Player 0 (Red):    index 0   → grid cell (6, 13)
//   Player 1 (Yellow): index 13  → grid cell (0, 5)
//   Player 2 (Green):  index 26  → grid cell (8, 0)
//   Player 3 (Blue):   index 39  → grid cell (14, 7)
//
// Each player's home-column entry is one step before completing the loop:
//   Player 0: after track index 51 → home col at col 7
//   Player 1: after track index 12 → home row at row 7 (cols 1..6)
//   Player 2: after track index 25 → home col at col 7
//   Player 3: after track index 38 → home row at row 7 (cols 8..13)

const MAIN_TRACK: readonly [number, number][] = [
  // Player 0 (Red) section — squares 0..12
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  [6, 8],
  [6, 7], // index 6: corner square before Yellow home row
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],

  // Player 1 (Yellow) section — squares 13..25
  [0, 5],
  [0, 4],
  [0, 3],
  [0, 2],
  [0, 1],
  [0, 0],
  [1, 0], // index 19: corner square
  [2, 0],
  [3, 0],
  [4, 0],
  [5, 0],
  [6, 0],
  [7, 0],

  // Player 2 (Green) section — squares 26..38
  [8, 0],
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  [8, 6], // index 32: corner square
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],

  // Player 3 (Blue) section — squares 39..51
  [14, 7],
  [14, 8],
  [14, 9],
  [14, 10],
  [14, 11],
  [14, 12],
  [14, 13], // index 45: corner square
  [13, 14],
  [12, 14],
  [11, 14],
  [10, 14],
  [9, 14],
  [8, 14],
] // 52 entries total (4 × 13)

// Home columns: 6 squares per player (index 0..5). Index 5 = finished centre.
const HOME_COL_COORDS: readonly (readonly [number, number][])[] = [
  // Player 0 (Red): col 7, rows 13 → 8 (towards centre)
  [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
    [7, 8],
  ],
  // Player 1 (Yellow): row 7, cols 1 → 6 (towards centre)
  [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
    [6, 7],
  ],
  // Player 2 (Green): col 7, rows 1 → 6 (towards centre)
  [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ],
  // Player 3 (Blue): row 7, cols 13 → 8 (towards centre)
  [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
    [8, 7],
  ],
]

// Yard pawn slots: 4 per player, spread across their 6×6 corner area.
const YARD_COORDS: readonly (readonly [number, number][])[] = [
  // Player 0 (Red): bottom-left corner
  [
    [2, 11],
    [4, 11],
    [2, 13],
    [4, 13],
  ],
  // Player 1 (Yellow): top-left corner
  [
    [2, 1],
    [4, 1],
    [2, 3],
    [4, 3],
  ],
  // Player 2 (Green): top-right corner
  [
    [10, 1],
    [12, 1],
    [10, 3],
    [12, 3],
  ],
  // Player 3 (Blue): bottom-right corner
  [
    [10, 11],
    [12, 11],
    [10, 13],
    [12, 13],
  ],
]

// ---------------------------------------------------------------------------
// SVG board builder (called once; pawns rendered separately)
// ---------------------------------------------------------------------------

function buildBoardSVG(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg'

  function svgEl<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attrs: Record<string, string | number>,
  ): SVGElementTagNameMap[K] {
    const el = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
    return el
  }

  const svg = svgEl('svg', {
    viewBox: `0 0 ${SVG_W} ${SVG_H}`,
    width: SVG_W,
    height: SVG_H,
    role: 'img',
    'aria-label': 'Ludo board',
  })

  // SVG background
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: SVG_W, height: SVG_H, fill: '#1a1d24' }))

  // Board base
  svg.appendChild(
    svgEl('rect', {
      x: BOARD_X,
      y: BOARD_Y,
      width: BOARD_SIZE,
      height: BOARD_SIZE,
      fill: '#e8e0d0',
      stroke: '#555',
      'stroke-width': 2,
      rx: 4,
    }),
  )

  // 15×15 grid lines
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      svg.appendChild(
        svgEl('rect', {
          x: BOARD_X + col * CELL,
          y: BOARD_Y + row * CELL,
          width: CELL,
          height: CELL,
          fill: 'none',
          stroke: '#bbb',
          'stroke-width': 0.5,
        }),
      )
    }
  }

  // Coloured yard corners (6×6 boxes)
  const YARD_BOXES = [
    { col: 0, row: 9, p: 0 }, // Red — bottom-left
    { col: 0, row: 0, p: 1 }, // Yellow — top-left
    { col: 9, row: 0, p: 2 }, // Green — top-right
    { col: 9, row: 9, p: 3 }, // Blue — bottom-right
  ]
  for (const { col, row, p } of YARD_BOXES) {
    svg.appendChild(
      svgEl('rect', {
        x: BOARD_X + col * CELL,
        y: BOARD_Y + row * CELL,
        width: CELL * 6,
        height: CELL * 6,
        fill: PLAYER_COLORS[p],
        opacity: 0.25,
        stroke: PLAYER_COLORS[p],
        'stroke-width': 2,
      }),
    )
  }

  // Coloured home column strips
  const HOME_STRIPS = [
    { col: 7, row: 8, w: 1, h: 6, p: 0 }, // Red: col 7, rows 8..13
    { col: 1, row: 7, w: 6, h: 1, p: 1 }, // Yellow: row 7, cols 1..6
    { col: 7, row: 1, w: 1, h: 6, p: 2 }, // Green: col 7, rows 1..6
    { col: 8, row: 7, w: 6, h: 1, p: 3 }, // Blue: row 7, cols 8..13
  ]
  for (const { col, row, w, h, p } of HOME_STRIPS) {
    svg.appendChild(
      svgEl('rect', {
        x: BOARD_X + col * CELL,
        y: BOARD_Y + row * CELL,
        width: CELL * w,
        height: CELL * h,
        fill: PLAYER_COLORS[p],
        opacity: 0.35,
      }),
    )
  }

  // Centre hexagonal winning area
  const cx7 = BOARD_X + 7 * CELL
  const cy7 = BOARD_Y + 7 * CELL
  svg.appendChild(
    svgEl('polygon', {
      points: [
        `${cx7},${cy7 - CELL}`,
        `${cx7 + CELL},${cy7 - CELL}`,
        `${cx7 + 2 * CELL},${cy7}`,
        `${cx7 + CELL},${cy7 + CELL}`,
        `${cx7},${cy7 + CELL}`,
        `${cx7 - CELL},${cy7}`,
      ].join(' '),
      fill: '#888',
      opacity: 0.5,
    }),
  )

  // Start square highlights (one per player)
  for (let p = 0; p < 4; p++) {
    const [col, row] = MAIN_TRACK[STARTS[p]]
    svg.appendChild(
      svgEl('rect', {
        x: BOARD_X + col * CELL + 1,
        y: BOARD_Y + row * CELL + 1,
        width: CELL - 2,
        height: CELL - 2,
        fill: PLAYER_COLORS[p],
        opacity: 0.5,
        rx: 3,
      }),
    )
  }

  return svg
}

// ---------------------------------------------------------------------------
// Pawn SVG coordinate lookup
// ---------------------------------------------------------------------------

function pawnCoords(pawn: Pawn): [number, number] {
  const { pos, player, slot } = pawn
  if (pos.zone === 'yard') {
    const [col, row] = YARD_COORDS[player][slot]
    return cellCentre(col, row)
  }
  if (pos.zone === 'track') {
    const [col, row] = MAIN_TRACK[pos.index]
    return cellCentre(col, row)
  }
  if (pos.zone === 'home') {
    const [col, row] = HOME_COL_COORDS[player][pos.index]
    return cellCentre(col, row)
  }
  // finished — render in centre cell
  return cellCentre(7, 7)
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CSS = `
.ludo-root {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.5rem;
  user-select: none;
}

.ludo-board-wrap {
  flex-shrink: 0;
  position: relative;
}

.ludo-board-wrap svg {
  display: block;
  max-width: 100%;
  height: auto;
}

.ludo-pawn { cursor: default; }
.ludo-pawn.selectable { cursor: pointer; }
.ludo-pawn.selectable circle { stroke: #fff; stroke-width: 3; }
.ludo-pawn.selected circle  { stroke: #fff; stroke-width: 3; filter: brightness(1.4); }

.ludo-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 140px;
}

.ludo-status {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--fg, #e6e6e6);
}

.ludo-players { display: flex; flex-direction: column; gap: 0.4rem; }

.ludo-player-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--fg, #e6e6e6);
  opacity: 0.5;
}
.ludo-player-row.active { opacity: 1; font-weight: 700; }

.ludo-player-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ludo-dice-area {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.ludo-dice-display {
  font-size: 2rem;
  min-height: 2.4rem;
  line-height: 1;
}

.ludo-btn {
  padding: 0.5em 1em;
  border-radius: 8px;
  border: 1px solid transparent;
  background: var(--bg-elev, #1a1d24);
  color: var(--fg, #e6e6e6);
  font: inherit;
  cursor: pointer;
  font-size: 0.9rem;
}
.ludo-btn:hover:not(:disabled) { border-color: var(--accent, #6cb1ff); }
.ludo-btn:disabled { opacity: 0.4; cursor: default; }

.ludo-actions { display: flex; flex-direction: column; gap: 0.5rem; }

@media (max-width: 640px) {
  .ludo-root { flex-direction: column; align-items: center; }
}
`

// Unicode die faces ⚀–⚅ (code points U+2680..U+2685)
const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1
}

// ---------------------------------------------------------------------------
// GameModule
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const styleEl = document.createElement('style')
    styleEl.textContent = CSS
    document.head.appendChild(styleEl)

    // State
    let state: GameState = initialState(ctx.players.length as 2 | 3 | 4)

    // DOM skeleton
    const wrapper = document.createElement('div')
    wrapper.className = 'ludo-root'

    const boardWrap = document.createElement('div')
    boardWrap.className = 'ludo-board-wrap'
    const boardSVG = buildBoardSVG()
    boardWrap.appendChild(boardSVG)

    const pawnGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    boardSVG.appendChild(pawnGroup)

    const sidebar = document.createElement('div')
    sidebar.className = 'ludo-sidebar'

    const statusEl = document.createElement('div')
    statusEl.className = 'ludo-status'

    const playersEl = document.createElement('div')
    playersEl.className = 'ludo-players'

    const diceArea = document.createElement('div')
    diceArea.className = 'ludo-dice-area'

    const diceDisplay = document.createElement('div')
    diceDisplay.className = 'ludo-dice-display'

    const rollBtn = document.createElement('button')
    rollBtn.className = 'ludo-btn'
    rollBtn.type = 'button'
    rollBtn.textContent = 'Roll'

    diceArea.appendChild(diceDisplay)
    diceArea.appendChild(rollBtn)

    const actionsEl = document.createElement('div')
    actionsEl.className = 'ludo-actions'

    const newGameBtn = document.createElement('button')
    newGameBtn.className = 'ludo-btn'
    newGameBtn.type = 'button'
    newGameBtn.textContent = 'New game'

    const exitBtn = document.createElement('button')
    exitBtn.className = 'ludo-btn'
    exitBtn.type = 'button'
    exitBtn.textContent = 'Back to menu'

    actionsEl.appendChild(newGameBtn)
    actionsEl.appendChild(exitBtn)

    sidebar.appendChild(statusEl)
    sidebar.appendChild(playersEl)
    sidebar.appendChild(diceArea)
    sidebar.appendChild(actionsEl)

    wrapper.appendChild(boardWrap)
    wrapper.appendChild(sidebar)
    root.appendChild(wrapper)

    // ---- Helpers ----

    function playerName(p: number): string {
      return ctx.players[p] ?? PLAYER_NAMES[p] ?? `Player ${p + 1}`
    }

    // ---- Animation helpers ----

    // Whether an animation is currently in progress (blocks input).
    let animating = false

    /**
     * Compute the list of SVG [cx, cy] positions a pawn travels through
     * during a move, one entry per step (not counting the start position).
     * Used to drive the hop animation.
     */
    function moveWaypoints(pawn: Pawn, move: Move, dice: number): [number, number][] {
      const waypoints: [number, number][] = []

      if (move.kind === 'release') {
        // Single hop: yard → start square
        const startTrack = STARTS[pawn.player]
        waypoints.push(cellCentre(...MAIN_TRACK[startTrack]))
        return waypoints
      }

      const { pos } = pawn

      if (pos.zone === 'home') {
        // Hop along home column
        const startIdx = pos.index
        for (let step = 1; step <= dice; step++) {
          const homeIdx = startIdx + step
          if (homeIdx >= HOME_COL_COORDS[pawn.player].length) {
            // Finished — render in centre cell
            waypoints.push(cellCentre(7, 7))
            break
          }
          const [col, row] = HOME_COL_COORDS[pawn.player][homeIdx]
          waypoints.push(cellCentre(col, row))
        }
        return waypoints
      }

      if (pos.zone === 'track') {
        const stepsLeft = stepsToHomeEntry(pawn.player, pos.index)
        for (let step = 1; step <= dice; step++) {
          if (step < stepsLeft) {
            // Still on main track
            const trackIdx = (pos.index + step) % 52
            waypoints.push(cellCentre(...MAIN_TRACK[trackIdx]))
          } else {
            // Entering home column
            const homeIdx = step - stepsLeft
            if (homeIdx >= HOME_COL_COORDS[pawn.player].length) {
              waypoints.push(cellCentre(7, 7))
              break
            }
            const [col, row] = HOME_COL_COORDS[pawn.player][homeIdx]
            waypoints.push(cellCentre(col, row))
          }
        }
        return waypoints
      }

      return waypoints
    }

    /**
     * Animate a pawn hopping through `waypoints` (~80ms per hop) in SVG-space,
     * then call `onDone`.
     *
     * We create a temporary SVG circle element in pawnGroup, animate it via
     * requestAnimationFrame + CSS transitions, then remove it when done.
     */
    function animatePawnHop(
      startCx: number,
      startCy: number,
      waypoints: [number, number][],
      color: string,
      onDone: () => void,
    ): void {
      if (waypoints.length === 0) {
        onDone()
        return
      }

      const NS = 'http://www.w3.org/2000/svg'

      // The SVG viewBox is fixed (SVG_W × SVG_H) but rendered at a smaller size.
      // We animate cx/cy attributes directly using requestAnimationFrame.
      const circle = document.createElementNS(NS, 'circle')
      circle.setAttribute('cx', String(startCx))
      circle.setAttribute('cy', String(startCy))
      circle.setAttribute('r', String(CELL * 0.38))
      circle.setAttribute('fill', color)
      circle.setAttribute('stroke', '#fff')
      circle.setAttribute('stroke-width', '2')
      circle.setAttribute('pointer-events', 'none')
      pawnGroup.appendChild(circle)

      const HOP_MS = 80
      let hopIndex = 0

      function nextHop(): void {
        if (hopIndex >= waypoints.length) {
          circle.remove()
          onDone()
          return
        }
        const [tx, ty] = waypoints[hopIndex]
        hopIndex++

        // Animate by stepping cx/cy attributes via rAF over HOP_MS
        const fromX = Number(circle.getAttribute('cx'))
        const fromY = Number(circle.getAttribute('cy'))
        const dx = tx - fromX
        const dy = ty - fromY
        const startTime = performance.now()

        function tick(now: number): void {
          const t = Math.min(1, (now - startTime) / HOP_MS)
          circle.setAttribute('cx', String(fromX + dx * t))
          circle.setAttribute('cy', String(fromY + dy * t))
          if (t < 1) {
            requestAnimationFrame(tick)
          } else {
            nextHop()
          }
        }
        requestAnimationFrame(tick)
      }

      nextHop()
    }

    /**
     * Animate a captured pawn flying back to its yard slot (250ms ease-out).
     */
    function animateCapturedPawn(
      fromCx: number,
      fromCy: number,
      toCx: number,
      toCy: number,
      color: string,
      onDone: () => void,
    ): void {
      const NS = 'http://www.w3.org/2000/svg'
      const circle = document.createElementNS(NS, 'circle')
      circle.setAttribute('cx', String(fromCx))
      circle.setAttribute('cy', String(fromCy))
      circle.setAttribute('r', String(CELL * 0.35))
      circle.setAttribute('fill', color)
      circle.setAttribute('stroke', '#333')
      circle.setAttribute('stroke-width', '1.5')
      circle.setAttribute('pointer-events', 'none')
      pawnGroup.appendChild(circle)

      const DURATION = 250
      const startTime = performance.now()
      const dx = toCx - fromCx
      const dy = toCy - fromCy

      function tick(now: number): void {
        const t = Math.min(1, (now - startTime) / DURATION)
        // ease-out: t => 1 - (1 - t)^2
        const eased = 1 - (1 - t) * (1 - t)
        circle.setAttribute('cx', String(fromCx + dx * eased))
        circle.setAttribute('cy', String(fromCy + dy * eased))
        if (t < 1) {
          requestAnimationFrame(tick)
        } else {
          circle.remove()
          onDone()
        }
      }
      requestAnimationFrame(tick)
    }

    // ---- Render ----

    function renderPlayers(): void {
      playersEl.innerHTML = ''
      for (let p = 0; p < state.playerCount; p++) {
        const row = document.createElement('div')
        row.className = `ludo-player-row${p === state.turn ? ' active' : ''}`

        const dot = document.createElement('div')
        dot.className = 'ludo-player-dot'
        dot.style.background = PLAYER_COLORS[p]

        row.appendChild(dot)
        row.appendChild(document.createTextNode(`${playerName(p)} (${PLAYER_NAMES[p]})`))
        playersEl.appendChild(row)
      }
    }

    function renderStatus(w: PlayerIndex | null): void {
      if (w !== null) {
        statusEl.textContent = `${playerName(w)} wins!`
        return
      }
      const name = playerName(state.turn)
      if (state.dice === null) {
        statusEl.textContent = `${name}: roll the die`
      } else if (legalMoves(state).length === 0) {
        statusEl.textContent = `${name}: no moves — skipping`
      } else {
        statusEl.textContent = `${name}: choose a pawn`
      }
    }

    function renderDice(): void {
      diceDisplay.textContent = state.dice !== null ? DIE_FACES[state.dice] : ''
    }

    function renderPawns(w: PlayerIndex | null): void {
      pawnGroup.innerHTML = ''

      const moves = state.dice !== null ? legalMoves(state) : []
      const movableSlots = new Set(moves.map((m) => `${state.turn},${m.pawnSlot}`))
      const NS = 'http://www.w3.org/2000/svg'

      for (const pawn of state.pawns) {
        const [cx, cy] = pawnCoords(pawn)
        const key = `${pawn.player},${pawn.slot}`
        const isSelectable = w === null && movableSlots.has(key)

        const g = document.createElementNS(NS, 'g')
        g.setAttribute('class', `ludo-pawn${isSelectable ? ' selectable' : ''}`)

        const circle = document.createElementNS(NS, 'circle')
        circle.setAttribute('cx', String(cx))
        circle.setAttribute('cy', String(cy))
        circle.setAttribute('r', String(CELL * 0.35))
        circle.setAttribute('fill', PLAYER_COLORS[pawn.player])
        circle.setAttribute('stroke', '#333')
        circle.setAttribute('stroke-width', '1.5')

        const text = document.createElementNS(NS, 'text')
        text.setAttribute('x', String(cx))
        text.setAttribute('y', String(cy + 4))
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('font-size', '9')
        text.setAttribute('fill', '#000')
        text.setAttribute('pointer-events', 'none')
        text.textContent = String(pawn.slot + 1)

        g.appendChild(circle)
        g.appendChild(text)

        if (isSelectable) {
          g.addEventListener('click', () => handlePawnClick(pawn.player as PlayerIndex, pawn.slot))
        }

        pawnGroup.appendChild(g)
      }
    }

    function render(): void {
      const w = winner(state)
      renderPlayers()
      renderStatus(w)
      renderDice()
      renderPawns(w)
      rollBtn.disabled = state.dice !== null || w !== null || animating
    }

    // ---- Interaction ----

    function handleRoll(): void {
      if (state.dice !== null || winner(state) !== null) return

      const rolled = rollD6()

      // Three consecutive 6s: show the roll, then forfeit turn automatically.
      if (rolled === 6 && state.consecutiveSixes >= 2) {
        state = { ...state, dice: rolled }
        render()
        setTimeout(() => {
          state = skipTurn(state)
          render()
        }, 700)
        return
      }

      state = { ...state, dice: rolled }

      // Auto-skip when no legal moves exist.
      if (legalMoves(state).length === 0) {
        render()
        setTimeout(() => {
          state = skipTurn(state)
          render()
        }, 800)
        return
      }

      render()
    }

    function handlePawnClick(player: PlayerIndex, slot: number): void {
      if (state.dice === null || player !== state.turn || winner(state) !== null) return
      if (animating) return

      const move: Move | undefined = legalMoves(state).find((m) => m.pawnSlot === slot)
      if (!move) return

      // Find the pawn being moved
      const movingPawn = state.pawns.find((p) => p.player === player && p.slot === slot)
      if (!movingPawn) return

      const dice = state.dice
      const waypoints = moveWaypoints(movingPawn, move, dice)
      const [startCx, startCy] = pawnCoords(movingPawn)
      const color = PLAYER_COLORS[player]

      // Detect capture: find any lone opponent that would be captured (only on track advances)
      let capturedPawn: Pawn | null = null
      let capturedYardCoord: [number, number] | null = null
      if (move.kind === 'advance' && movingPawn.pos.zone === 'track' && waypoints.length > 0) {
        // The final waypoint is where the pawn lands. Find any lone opponent there.
        const finalWaypoint = waypoints[waypoints.length - 1]
        for (const opponent of state.pawns) {
          if (opponent.player === player) continue
          if (opponent.pos.zone !== 'track') continue
          const [opCx, opCy] = pawnCoords(opponent)
          if (Math.abs(opCx - finalWaypoint[0]) < 1 && Math.abs(opCy - finalWaypoint[1]) < 1) {
            capturedPawn = opponent
            const yardSlot = YARD_COORDS[opponent.player][opponent.slot]
            capturedYardCoord = cellCentre(yardSlot[0], yardSlot[1])
            break
          }
        }
      }

      animating = true
      rollBtn.disabled = true

      animatePawnHop(startCx, startCy, waypoints, color, () => {
        if (capturedPawn && capturedYardCoord) {
          const finalWaypoint = waypoints[waypoints.length - 1]
          const capturedColor = PLAYER_COLORS[capturedPawn.player]
          // Apply the move first so the board state is correct, then animate capture
          state = applyMove(state, move)
          // Render without the animation marker (pawnGroup will be redrawn)
          // But we still need to show the capture animation on top
          render()
          animateCapturedPawn(
            finalWaypoint[0],
            finalWaypoint[1],
            capturedYardCoord[0],
            capturedYardCoord[1],
            capturedColor,
            () => {
              animating = false
              render()
            },
          )
        } else {
          state = applyMove(state, move)
          animating = false
          render()
        }
      })
    }

    function startNewGame(): void {
      state = initialState(ctx.players.length as 2 | 3 | 4)
      render()
    }

    rollBtn.addEventListener('click', handleRoll)
    newGameBtn.addEventListener('click', startNewGame)
    exitBtn.addEventListener('click', ctx.onExit)

    render()

    return () => {
      wrapper.remove()
      styleEl.remove()
    }
  },
}

export default game
