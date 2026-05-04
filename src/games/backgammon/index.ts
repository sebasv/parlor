import type { GameModule } from '../../lib/game'
import meta from './meta'
import {
  applyMove,
  canBearOff,
  type GameState,
  initialState,
  legalMoves,
  type Move,
  mustReenterFromBar,
  rollDice,
  winner,
} from './rules'

// ---------- Helpers ----------

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

// ---------- SVG helpers ----------

function svgEl(tag: string, attrs: Record<string, string | number> = {}): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}

// ---------- Layout constants ----------

// Board is 600 wide × 520 tall in SVG units.
// 12 points per half, each 44px wide, bar 32px wide.
// Top row: points 13–24 (left to right), bottom row: points 12–1 (left to right).
// Bear-off zones on the far right.

const BOARD_W = 600
const BOARD_H = 520
const BAR_W = 32
const BEAROFF_W = 44
const POINT_W = 44
const POINT_H = 200
const MID_Y = BOARD_H / 2
const TOP_Y = 20 // starting y for top triangles (tips point down)
const BOT_Y = BOARD_H - 20 // starting y for bottom triangles (tips point up)
const CHECKER_R = 16

// Left section: points 13–18 (indices 0–5 from left = points 13,14,15,16,17,18)
// Gap (bar): BAR_W
// Right section: points 19–24 (indices 6–11 from left = points 19,20,21,22,23,24)
// Then bear-off zone

// Bottom:
// Left section: points 12–7 (left to right = 12,11,10,9,8,7)
// Gap (bar)
// Right section: points 6–1 (left to right = 6,5,4,3,2,1)

function pointX(point: number): number {
  // Returns the center x of the given point's triangle.
  // Top half: points 13–24 left to right
  // Bottom half: points 12–1 left to right (12 on far left bottom, 1 on far right bottom)

  // We'll define layout:
  // Left section (6 points): x = 10 + col * POINT_W, cols 0–5
  // Bar: x = 10 + 6 * POINT_W  to  10 + 6 * POINT_W + BAR_W
  // Right section (6 points): x = 10 + 6 * POINT_W + BAR_W + col * POINT_W, cols 0–5
  const LEFT_START = 10

  if (point >= 13 && point <= 18) {
    const col = point - 13
    return LEFT_START + col * POINT_W + POINT_W / 2
  }
  if (point >= 19 && point <= 24) {
    const col = point - 19
    return LEFT_START + 6 * POINT_W + BAR_W + col * POINT_W + POINT_W / 2
  }
  if (point >= 7 && point <= 12) {
    const col = 12 - point // point 12 → col 0, point 7 → col 5
    return LEFT_START + col * POINT_W + POINT_W / 2
  }
  if (point >= 1 && point <= 6) {
    const col = 6 - point // point 6 → col 0, point 1 → col 5
    return LEFT_START + 6 * POINT_W + BAR_W + col * POINT_W + POINT_W / 2
  }
  return 0
}

function isTopPoint(point: number): boolean {
  return point >= 13 && point <= 24
}

// Checker stacking: top points stack downward, bottom points stack upward.
function checkerCY(point: number, stackIndex: number): number {
  const r = CHECKER_R
  if (isTopPoint(point)) {
    return TOP_Y + r + stackIndex * (r * 2 + 1)
  }
  return BOT_Y - r - stackIndex * (r * 2 + 1)
}

// Bear-off zone x centers
const BEAROFF_X = 10 + 6 * POINT_W + BAR_W + 6 * POINT_W + BEAROFF_W / 2 + 8

// Bar x center
const BAR_X = 10 + 6 * POINT_W + BAR_W / 2

// ---------- Colors ----------

const TRIANGLE_COLORS = ['#c0392b', '#ecf0f1'] // alternating red/white (dark/light triangles)
const CHECKER_FILL: [string, string] = ['#f5f5f0', '#1a1a2e'] // player 0 white, player 1 dark
const CHECKER_STROKE: [string, string] = ['#9a9a8a', '#4a4a6e']
const CHECKER_TEXT: [string, string] = ['#333', '#ddd']
const HIGHLIGHT_FILL = '#6cb1ff'
const HIT_FILL = '#ff9f43'
const SELECTED_FILL = '#2ecc71'
const BAR_FILL = '#2c2c2c'
const BOARD_FILL = '#2d5016'
const POINT_LABEL_COLOR = '#ffffffaa'

// ---------- Game module ----------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const [p0Name, p1Name] = [ctx.players[0], ctx.players[1]]

    // ---- Mutable state ----
    let state: GameState = initialState()
    let selectedPoint: number | null = null // point index or -1 for bar
    let selectedIsBar = false
    // Moves available from the selected checker
    let movesFromSelected: Move[] = []
    // All legal moves given current dice
    let allMoves: Move[] = []
    let gameOver = false

    // ---- Style ----
    const style = document.createElement('style')
    style.textContent = `
      .bg-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.5rem 1rem;
        width: 100%;
      }

      .bg-status {
        font-size: 1.05rem;
        font-weight: 600;
        min-height: 1.6em;
        text-align: center;
        color: var(--fg);
      }
      .bg-status.bg-win { color: var(--accent); }

      .bg-info-row {
        display: flex;
        gap: 1.5rem;
        align-items: center;
        flex-wrap: wrap;
        justify-content: center;
        font-size: 0.9rem;
        color: var(--fg-dim);
      }

      .bg-player-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        min-width: 110px;
      }
      .bg-player-info.bg-active .bg-player-name {
        color: var(--accent);
      }
      .bg-player-name { font-size: 0.85rem; font-weight: 600; }
      .bg-player-counts { font-size: 0.8rem; color: var(--fg-dim); }

      .bg-dice-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        min-height: 2.5rem;
        flex-wrap: wrap;
        justify-content: center;
      }

      .bg-die {
        width: 2.2rem;
        height: 2.2rem;
        border-radius: 6px;
        background: var(--bg-elev);
        border: 2px solid var(--fg-dim);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--fg);
        cursor: default;
        transition: opacity 0.15s;
      }
      .bg-die.bg-die-used {
        opacity: 0.28;
        border-color: #444;
        color: var(--fg-dim);
      }
      .bg-die.bg-die-highlight {
        border-color: var(--accent);
        color: var(--accent);
      }

      .bg-board-wrap {
        width: min(96vw, 640px);
      }

      .bg-board-wrap svg {
        width: 100%;
        height: auto;
        display: block;
      }

      .bg-controls {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: center;
      }
      .bg-btn-roll {
        background: var(--accent);
        color: #000;
        font-weight: 600;
        border: none;
        min-width: 7rem;
      }
      .bg-btn-pass {
        background: #555;
        color: var(--fg);
        border: none;
      }
      .bg-btn-new {
        background: var(--accent);
        color: #000;
        font-weight: 600;
        border: none;
      }
      .bg-btn-exit {
        background: var(--bg-elev);
        color: var(--fg-dim);
      }

      .bg-hint {
        font-size: 0.82rem;
        color: var(--fg-dim);
        text-align: center;
        min-height: 1.1em;
      }
    `

    // ---- DOM structure ----
    const wrap = document.createElement('div')
    wrap.className = 'bg-wrap'

    const statusEl = document.createElement('div')
    statusEl.className = 'bg-status'

    const infoRow = document.createElement('div')
    infoRow.className = 'bg-info-row'

    const p0Info = document.createElement('div')
    p0Info.className = 'bg-player-info'
    const p0NameEl = document.createElement('div')
    p0NameEl.className = 'bg-player-name'
    p0NameEl.textContent = p0Name
    const p0Counts = document.createElement('div')
    p0Counts.className = 'bg-player-counts'
    p0Info.appendChild(p0NameEl)
    p0Info.appendChild(p0Counts)

    const p1Info = document.createElement('div')
    p1Info.className = 'bg-player-info'
    const p1NameEl = document.createElement('div')
    p1NameEl.className = 'bg-player-name'
    p1NameEl.textContent = p1Name
    const p1Counts = document.createElement('div')
    p1Counts.className = 'bg-player-counts'
    p1Info.appendChild(p1NameEl)
    p1Info.appendChild(p1Counts)

    infoRow.appendChild(p0Info)
    infoRow.appendChild(p1Info)

    const diceRow = document.createElement('div')
    diceRow.className = 'bg-dice-row'

    const boardWrap = document.createElement('div')
    boardWrap.className = 'bg-board-wrap'

    const hintEl = document.createElement('div')
    hintEl.className = 'bg-hint'

    const controlsEl = document.createElement('div')
    controlsEl.className = 'bg-controls'

    const rollBtn = document.createElement('button')
    rollBtn.type = 'button'
    rollBtn.textContent = 'Roll dice'
    rollBtn.className = 'bg-btn-roll'

    const passBtn = document.createElement('button')
    passBtn.type = 'button'
    passBtn.textContent = 'No legal moves — pass'
    passBtn.className = 'bg-btn-pass'

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.textContent = 'New game'
    newGameBtn.className = 'bg-btn-new'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.textContent = 'Back to picker'
    exitBtn.className = 'bg-btn-exit'

    controlsEl.appendChild(rollBtn)
    controlsEl.appendChild(passBtn)
    controlsEl.appendChild(newGameBtn)
    controlsEl.appendChild(exitBtn)

    wrap.appendChild(statusEl)
    wrap.appendChild(infoRow)
    wrap.appendChild(diceRow)
    wrap.appendChild(boardWrap)
    wrap.appendChild(hintEl)
    wrap.appendChild(controlsEl)

    // ---- SVG board ----
    const svg = svgEl('svg', {
      viewBox: `0 0 ${BOARD_W} ${BOARD_H}`,
      xmlns: 'http://www.w3.org/2000/svg',
    }) as SVGSVGElement

    // Board background
    const boardBg = svgEl('rect', {
      x: 0,
      y: 0,
      width: BOARD_W,
      height: BOARD_H,
      fill: BOARD_FILL,
      rx: 8,
    })
    svg.appendChild(boardBg)

    // Draw 24 triangles
    for (let point = 1; point <= 24; point++) {
      const cx = pointX(point)
      const top = isTopPoint(point)
      const colorIdx = point % 2 === 0 ? 0 : 1 // alternate colors
      const fill = TRIANGLE_COLORS[colorIdx]

      let points24: string
      const halfW = POINT_W / 2 - 2
      if (top) {
        // Triangle points downward: base at top, tip at MID_Y - gap
        const baseY = TOP_Y
        const tipY = MID_Y - 8
        points24 = `${cx - halfW},${baseY} ${cx + halfW},${baseY} ${cx},${tipY}`
      } else {
        // Triangle points upward: base at bottom, tip at MID_Y + gap
        const baseY = BOT_Y
        const tipY = MID_Y + 8
        points24 = `${cx - halfW},${baseY} ${cx + halfW},${baseY} ${cx},${tipY}`
      }

      const tri = svgEl('polygon', {
        points: points24,
        fill,
        opacity: '0.85',
        'data-point': point,
      })
      svg.appendChild(tri)
    }

    // Point number labels
    for (let point = 1; point <= 24; point++) {
      const cx = pointX(point)
      const top = isTopPoint(point)
      const labelY = top ? TOP_Y - 6 : BOT_Y + 12
      const label = svgEl('text', {
        x: cx,
        y: labelY,
        'text-anchor': 'middle',
        fill: POINT_LABEL_COLOR,
        'font-size': '9',
        'font-family': 'system-ui, sans-serif',
      })
      label.textContent = String(point)
      svg.appendChild(label)
    }

    // Bar
    const barRect = svgEl('rect', {
      x: 10 + 6 * POINT_W,
      y: 0,
      width: BAR_W,
      height: BOARD_H,
      fill: BAR_FILL,
    })
    svg.appendChild(barRect)

    // Bear-off zone background
    const bearOffRect = svgEl('rect', {
      x: 10 + 6 * POINT_W + BAR_W + 6 * POINT_W,
      y: 0,
      width: BEAROFF_W + 16,
      height: BOARD_H,
      fill: '#1a2a0a',
    })
    svg.appendChild(bearOffRect)

    // Center divider line
    const midLine = svgEl('line', {
      x1: 10,
      y1: MID_Y,
      x2: 10 + 6 * POINT_W + BAR_W + 6 * POINT_W,
      y2: MID_Y,
      stroke: '#1a3009',
      'stroke-width': '2',
    })
    svg.appendChild(midLine)

    // ---- Highlight overlay group (drawn on top) ----
    const overlayGroup = svgEl('g') as SVGGElement
    svg.appendChild(overlayGroup)

    // ---- Checker group ----
    const checkerGroup = svgEl('g') as SVGGElement
    svg.appendChild(checkerGroup)

    // ---- Clickable hit zones (transparent, on top of checkers) ----
    const hitZoneGroup = svgEl('g') as SVGGElement
    svg.appendChild(hitZoneGroup)

    boardWrap.appendChild(svg)

    // ---- Render ----

    function computeDieHighlights(): Set<number> {
      // Which die values are used by moves from the selected source?
      if (movesFromSelected.length === 0) return new Set()
      return new Set(movesFromSelected.map((m) => m.die))
    }

    function renderDice() {
      diceRow.innerHTML = ''
      if (!state.rolled || state.dice.length === 0) return

      // Show the original rolled dice: we track them as remaining only,
      // so figure out how many were originally rolled vs now.
      // We just show what's left as active chips.
      const highlightDice = computeDieHighlights()

      for (const val of state.dice) {
        const chip = document.createElement('div')
        chip.className = 'bg-die'
        if (highlightDice.has(val)) chip.classList.add('bg-die-highlight')
        chip.textContent = String(val)
        diceRow.appendChild(chip)
      }
    }

    function renderBoard() {
      // Clear dynamic layers
      while (overlayGroup.firstChild) overlayGroup.removeChild(overlayGroup.firstChild)
      while (checkerGroup.firstChild) checkerGroup.removeChild(checkerGroup.firstChild)
      while (hitZoneGroup.firstChild) hitZoneGroup.removeChild(hitZoneGroup.firstChild)

      // Compute destination points for current selection
      const destPoints = new Set<number>()
      const destIsBar = false // bar is never a move destination (re-entry goes to board points)
      void destIsBar

      for (const m of movesFromSelected) {
        if (m.kind === 'reenter' || m.kind === 'normal') destPoints.add(m.toPoint)
        // bearoff destination is "off board" — we'll handle via bearoff zone click
      }

      const hasBearoff = movesFromSelected.some((m) => m.kind === 'bearoff')

      // Selectable points: points that have checker of current player and have moves
      const selectablePoints = new Set<number>()
      const selectableBar = mustReenterFromBar(state, state.turn) && allMoves.length > 0
      if (!selectableBar) {
        for (const m of allMoves) {
          if (m.kind === 'normal' || m.kind === 'bearoff') selectablePoints.add(m.fromPoint)
        }
      }

      // Draw highlight overlays for destinations
      for (const p of destPoints) {
        const cx = pointX(p)
        const isTop = isTopPoint(p)
        const halfW = POINT_W / 2 - 2
        let polyPts: string
        if (isTop) {
          polyPts = `${cx - halfW},${TOP_Y} ${cx + halfW},${TOP_Y} ${cx},${MID_Y - 8}`
        } else {
          polyPts = `${cx - halfW},${BOT_Y} ${cx + halfW},${BOT_Y} ${cx},${MID_Y + 8}`
        }
        const hi = svgEl('polygon', {
          points: polyPts,
          fill: HIGHLIGHT_FILL,
          opacity: '0.35',
          'pointer-events': 'none',
        })
        overlayGroup.appendChild(hi)
      }

      // Bear-off zone highlight if bearing off is possible from selection
      if (hasBearoff) {
        const hiRect = svgEl('rect', {
          x: 10 + 6 * POINT_W + BAR_W + 6 * POINT_W,
          y: 0,
          width: BEAROFF_W + 16,
          height: BOARD_H,
          fill: HIGHLIGHT_FILL,
          opacity: '0.25',
          'pointer-events': 'none',
        })
        overlayGroup.appendChild(hiRect)
      }

      // Draw checkers on each point
      for (let p = 1; p <= 24; p++) {
        const slot = state.points[p]
        if (!slot) continue

        const cx = pointX(p)
        const isSelected = selectedPoint === p && !selectedIsBar
        const isDestination = destPoints.has(p)
        const isSelectable = selectablePoints.has(p)

        const maxVisible = 5
        const count = slot.count
        const visibleCount = Math.min(count, maxVisible)

        for (let i = 0; i < visibleCount; i++) {
          const cy = checkerCY(p, i)
          let fill = CHECKER_FILL[slot.player]
          if (isSelected && i === visibleCount - 1) fill = SELECTED_FILL
          else if (isDestination) fill = HIT_FILL

          const circle = svgEl('circle', {
            cx,
            cy,
            r: CHECKER_R,
            fill,
            stroke: CHECKER_STROKE[slot.player],
            'stroke-width': '1.5',
          })
          checkerGroup.appendChild(circle)

          if (i === visibleCount - 1 && count > maxVisible) {
            const txt = svgEl('text', {
              x: cx,
              y: cy + 4,
              'text-anchor': 'middle',
              fill: CHECKER_TEXT[slot.player],
              'font-size': '11',
              'font-weight': 'bold',
              'font-family': 'system-ui, sans-serif',
              'pointer-events': 'none',
            })
            txt.textContent = String(count)
            checkerGroup.appendChild(txt)
          } else if (count > 1 && i === 0) {
            const txt = svgEl('text', {
              x: cx,
              y: cy + 4,
              'text-anchor': 'middle',
              fill: CHECKER_TEXT[slot.player],
              'font-size': '10',
              'font-weight': 'bold',
              'font-family': 'system-ui, sans-serif',
              'pointer-events': 'none',
            })
            txt.textContent = String(count)
            checkerGroup.appendChild(txt)
          }
        }

        // Clickable zone (transparent rect over triangle area)
        if ((isSelectable || isDestination) && !gameOver && state.rolled) {
          const isTop = isTopPoint(p)
          const zoneH = POINT_H * 0.7
          const zoneY = isTop ? TOP_Y : BOT_Y - zoneH
          const zone = svgEl('rect', {
            x: cx - POINT_W / 2,
            y: zoneY,
            width: POINT_W,
            height: zoneH,
            fill: 'transparent',
            'data-point': p,
            cursor: 'pointer',
          })
          zone.addEventListener('click', () => handlePointClick(p))
          hitZoneGroup.appendChild(zone)
        }
      }

      // Bar checkers
      for (const player of [0, 1] as const) {
        const count = state.barCounts[player]
        if (count === 0) continue
        const isTop = player === 1 // player 1's bar checkers shown at top half
        for (let i = 0; i < Math.min(count, 4); i++) {
          const cy = isTop ? MID_Y - 20 - i * 18 : MID_Y + 20 + i * 18
          const isBarSelected = selectedIsBar && player === state.turn
          const fill = isBarSelected ? SELECTED_FILL : CHECKER_FILL[player]
          const circle = svgEl('circle', {
            cx: BAR_X,
            cy,
            r: 14,
            fill,
            stroke: CHECKER_STROKE[player],
            'stroke-width': '1.5',
          })
          checkerGroup.appendChild(circle)

          if (i === 0 && count > 1) {
            const txt = svgEl('text', {
              x: BAR_X,
              y: cy + 4,
              'text-anchor': 'middle',
              fill: CHECKER_TEXT[player],
              'font-size': '10',
              'font-weight': 'bold',
              'font-family': 'system-ui, sans-serif',
              'pointer-events': 'none',
            })
            txt.textContent = String(count)
            checkerGroup.appendChild(txt)
          }
        }

        // Bar click zone (for re-entry)
        if (
          player === state.turn &&
          state.barCounts[player] > 0 &&
          selectableBar &&
          !gameOver &&
          state.rolled
        ) {
          const barZoneY = isTop ? MID_Y - 20 - 4 * 18 : MID_Y
          const barZoneH = 4 * 18 + 20
          const zone = svgEl('rect', {
            x: BAR_X - 14,
            y: barZoneY,
            width: 28,
            height: barZoneH,
            fill: 'transparent',
            cursor: 'pointer',
          })
          zone.addEventListener('click', () => handleBarClick())
          hitZoneGroup.appendChild(zone)
        }
      }

      // Bear-off zone checkers (shown as stacked count)
      for (const player of [0, 1] as const) {
        const count = state.bornOff[player]
        if (count === 0) continue
        const isTop = player === 1
        const cy = isTop ? TOP_Y + 40 : BOT_Y - 40
        const circle = svgEl('circle', {
          cx: BEAROFF_X,
          cy,
          r: 14,
          fill: CHECKER_FILL[player],
          stroke: CHECKER_STROKE[player],
          'stroke-width': '1.5',
        })
        checkerGroup.appendChild(circle)
        const txt = svgEl('text', {
          x: BEAROFF_X,
          y: cy + 4,
          'text-anchor': 'middle',
          fill: CHECKER_TEXT[player],
          'font-size': '10',
          'font-weight': 'bold',
          'font-family': 'system-ui, sans-serif',
          'pointer-events': 'none',
        })
        txt.textContent = String(count)
        checkerGroup.appendChild(txt)
      }

      // Bear-off click zone (if bearing off is available)
      if (hasBearoff && !gameOver && state.rolled) {
        const zone = svgEl('rect', {
          x: 10 + 6 * POINT_W + BAR_W + 6 * POINT_W,
          y: 0,
          width: BEAROFF_W + 16,
          height: BOARD_H,
          fill: 'transparent',
          cursor: 'pointer',
        })
        zone.addEventListener('click', () => handleBearOffClick())
        hitZoneGroup.appendChild(zone)
      }
    }

    function render() {
      const win = winner(state)
      gameOver = win !== null
      allMoves = gameOver || !state.rolled ? [] : legalMoves(state)

      // Status
      statusEl.className = 'bg-status'
      if (win !== null) {
        const name = escapeHtml(win === 0 ? p0Name : p1Name)
        statusEl.textContent = `${name} wins!`
        statusEl.classList.add('bg-win')
      } else {
        const name = escapeHtml(state.turn === 0 ? p0Name : p1Name)
        const color = state.turn === 0 ? 'White' : 'Black'
        statusEl.textContent = `${name} (${color}) to move`
      }

      // Player info
      p0Info.className = `bg-player-info${state.turn === 0 && !gameOver ? ' bg-active' : ''}`
      p1Info.className = `bg-player-info${state.turn === 1 && !gameOver ? ' bg-active' : ''}`
      const bar0 = state.barCounts[0]
      const bar1 = state.barCounts[1]
      const off0 = state.bornOff[0]
      const off1 = state.bornOff[1]
      p0Counts.textContent = `Bar: ${bar0}  Off: ${off0}/15`
      p1Counts.textContent = `Bar: ${bar1}  Off: ${off1}/15`

      const bearOff0 = canBearOff(state, 0)
      const bearOff1 = canBearOff(state, 1)
      if (bearOff0) p0Counts.textContent += '  [bearing off]'
      if (bearOff1) p1Counts.textContent += '  [bearing off]'

      // Dice row
      renderDice()

      // Controls visibility
      rollBtn.style.display = !gameOver && !state.rolled ? '' : 'none'
      passBtn.style.display = !gameOver && state.rolled && allMoves.length === 0 ? '' : 'none'
      newGameBtn.style.display = gameOver ? '' : 'none'

      // Hint
      if (!gameOver) {
        if (!state.rolled) {
          hintEl.textContent = 'Tap "Roll dice" to roll.'
        } else if (mustReenterFromBar(state, state.turn)) {
          hintEl.textContent = 'You have a checker on the bar — tap it to re-enter.'
        } else if (selectedPoint !== null || selectedIsBar) {
          hintEl.textContent = 'Tap a highlighted point to move, or tap another checker.'
        } else if (allMoves.length > 0) {
          hintEl.textContent = 'Tap a checker to select it.'
        } else {
          hintEl.textContent = ''
        }
      } else {
        hintEl.textContent = ''
      }

      renderBoard()
    }

    // ---- Interaction ----

    function handlePointClick(point: number) {
      if (gameOver || !state.rolled) return

      // Is this a destination for the selected checker?
      const destMoves = movesFromSelected.filter(
        (m) => (m.kind === 'reenter' || m.kind === 'normal') && m.toPoint === point,
      )

      if (destMoves.length > 0) {
        // Execute the first matching move (there may be multiple dice that reach this point;
        // just pick the first — in practice any is equivalent for the destination).
        state = applyMove(state, destMoves[0])
        clearSelection()
        render()
        return
      }

      // Is this a selectable source?
      const movesFrom = allMoves.filter(
        (m) => (m.kind === 'normal' || m.kind === 'bearoff') && m.fromPoint === point,
      )
      if (movesFrom.length > 0) {
        selectedPoint = point
        selectedIsBar = false
        movesFromSelected = movesFrom
        render()
        return
      }

      // Deselect
      clearSelection()
      render()
    }

    function handleBarClick() {
      if (gameOver || !state.rolled) return
      if (!mustReenterFromBar(state, state.turn)) return

      selectedIsBar = true
      selectedPoint = null
      movesFromSelected = allMoves.filter((m) => m.kind === 'reenter')
      render()
    }

    function handleBearOffClick() {
      if (gameOver || !state.rolled) return
      const bearoffMoves = movesFromSelected.filter((m) => m.kind === 'bearoff')
      if (bearoffMoves.length === 0) return

      // Execute the first available bearoff move.
      state = applyMove(state, bearoffMoves[0])
      clearSelection()
      render()
    }

    function clearSelection() {
      selectedPoint = null
      selectedIsBar = false
      movesFromSelected = []
    }

    rollBtn.addEventListener('click', () => {
      if (state.rolled || gameOver) return
      const rolled = rollDice()
      state = { ...state, dice: rolled, rolled: true }
      clearSelection()
      allMoves = legalMoves(state)
      render()
    })

    passBtn.addEventListener('click', () => {
      if (!state.rolled) return
      // Force end turn — no legal moves.
      state = {
        ...state,
        turn: (1 - state.turn) as 0 | 1,
        dice: [],
        rolled: false,
      }
      clearSelection()
      render()
    })

    newGameBtn.addEventListener('click', () => {
      state = initialState()
      clearSelection()
      gameOver = false
      allMoves = []
      render()
    })

    exitBtn.addEventListener('click', ctx.onExit)

    // Mount
    root.appendChild(style)
    root.appendChild(wrap)

    // Initial render
    render()

    return () => {
      style.remove()
      wrap.remove()
    }
  },
}

export default game
