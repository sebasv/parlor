import type { GameModule } from '../../lib/game'
import meta from './meta'
import type { GameState } from './rules'
import {
  BOARD_COLS,
  BOARD_ROWS,
  createGameState,
  getRotatedCandidate,
  isEliminated,
  placementSlot,
  placeTile,
  rotateCandidateTile,
} from './rules'
import type { Port } from './tiles'
import { portPosition, TILE_SIZE, tilePathD } from './tiles'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_SIZE = TILE_SIZE + 4 // 94px per grid cell (tile + 2px border each side)
const MARGIN = 40 // px around the grid for pawn overhang and labels
const SVG_NS = 'http://www.w3.org/2000/svg'

// Player color palette — distinct, readable on dark background
const PLAYER_COLORS = ['#ef4444', '#6cb1ff', '#4ade80', '#facc15'] as const

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
.tsuro-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 0.5rem 1.5rem;
  min-height: 100%;
}

.tsuro-status {
  font-size: 1.1rem;
  font-weight: 600;
  min-height: 1.6em;
  text-align: center;
  color: var(--fg);
}

.tsuro-eliminated-list {
  font-size: 0.85rem;
  color: var(--fg-dim);
  text-align: center;
  min-height: 1.2em;
}

.tsuro-board-wrap {
  overflow: auto;
  max-width: 100%;
}

.tsuro-svg {
  display: block;
  touch-action: manipulation;
}

/* Tile slot background */
.tsuro-slot {
  fill: #1a1d26;
  stroke: #2e3650;
  stroke-width: 1.5;
}

/* Highlight the target slot for the current pawn's placement */
.tsuro-slot-target {
  fill: #252c42;
  stroke: var(--accent);
  stroke-width: 2;
}

/* Placed tile paths */
.tsuro-tile-path {
  fill: none;
  stroke: #4a5568;
  stroke-width: 5;
  stroke-linecap: round;
}

/* Pawn circle */
.tsuro-pawn {
  stroke: #0f1115;
  stroke-width: 2;
}

.tsuro-pawn-eliminated {
  opacity: 0.25;
}

/* Candidate tile preview panel */
.tsuro-candidate-panel {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.tsuro-candidate-label {
  font-size: 0.9rem;
  color: var(--fg-dim);
}

.tsuro-candidate-svg {
  display: block;
  border-radius: 8px;
  background: #1a1d26;
  border: 1px solid #2e3650;
}

/* Candidate paths use a lighter colour so the preview pops */
.tsuro-candidate-path {
  fill: none;
  stroke: #a0aec0;
  stroke-width: 5;
  stroke-linecap: round;
}

/* Action buttons */
.tsuro-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.tsuro-btn {
  padding: 0.65em 1.4em;
  border-radius: 10px;
  border: 1px solid transparent;
  background: var(--bg-elev, #1a1d24);
  color: var(--fg, #e6e6e6);
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
  min-width: 8rem;
}

.tsuro-btn:hover:not(:disabled) {
  border-color: var(--accent, #6cb1ff);
}

.tsuro-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tsuro-btn-primary {
  background: var(--accent, #6cb1ff);
  color: #0f1115;
  font-weight: 600;
}

.tsuro-btn-primary:hover:not(:disabled) {
  border-color: #fff;
}

.tsuro-legend {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 0.85rem;
  color: var(--fg-dim);
}

.tsuro-legend-item {
  display: flex;
  align-items: center;
  gap: 0.4em;
}

.tsuro-legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
`

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Top-left pixel (x, y) of a grid slot inside the SVG. */
function slotOrigin(col: number, row: number): [number, number] {
  return [MARGIN + col * CELL_SIZE, MARGIN + row * CELL_SIZE]
}

/** Pixel coordinate of a port in global SVG space. */
function portCoord(col: number, row: number, port: Port): [number, number] {
  const [ox, oy] = slotOrigin(col, row)
  const [px, py] = portPosition(port)
  return [ox + px, oy + py]
}

// ---------------------------------------------------------------------------
// Pawn start indicator position (outside the board grid)
// ---------------------------------------------------------------------------
// Pawns that haven't been moved yet sit outside the board, near their start port.

function pawnStartCoord(port: Port, col: number, row: number): [number, number] {
  const [px, py] = portCoord(col, row, port)
  // Nudge outside the board by a small offset
  const offset = 14
  const side = (port <= 1 ? 'top' : port <= 3 ? 'right' : port <= 5 ? 'bottom' : 'left') as
    | 'top'
    | 'right'
    | 'bottom'
    | 'left'
  switch (side) {
    case 'top':
      return [px, py - offset]
    case 'right':
      return [px + offset, py]
    case 'bottom':
      return [px, py + offset]
    case 'left':
      return [px - offset, py]
  }
}

// ---------------------------------------------------------------------------
// Escape helper
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

// ---------------------------------------------------------------------------
// Main mount
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    // Inject styles
    const styleEl = document.createElement('style')
    styleEl.textContent = CSS
    document.head.appendChild(styleEl)

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let state: GameState = createGameState(ctx.players.length)

    // -----------------------------------------------------------------------
    // Build DOM skeleton
    // -----------------------------------------------------------------------

    const wrapper = document.createElement('div')
    wrapper.className = 'tsuro-root'

    const statusEl = document.createElement('div')
    statusEl.className = 'tsuro-status'

    const eliminatedEl = document.createElement('div')
    eliminatedEl.className = 'tsuro-eliminated-list'

    // Legend (player colours)
    const legendEl = document.createElement('div')
    legendEl.className = 'tsuro-legend'
    for (let i = 0; i < ctx.players.length; i++) {
      const item = document.createElement('span')
      item.className = 'tsuro-legend-item'
      item.innerHTML = `<span class="tsuro-legend-dot" style="background:${PLAYER_COLORS[i]}"></span><span>${escHtml(ctx.players[i])}</span>`
      legendEl.appendChild(item)
    }

    // SVG board
    const boardWrap = document.createElement('div')
    boardWrap.className = 'tsuro-board-wrap'

    const svgW = MARGIN * 2 + BOARD_COLS * CELL_SIZE
    const svgH = MARGIN * 2 + BOARD_ROWS * CELL_SIZE

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('width', String(svgW))
    svg.setAttribute('height', String(svgH))
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`)
    svg.setAttribute('class', 'tsuro-svg')
    svg.setAttribute('aria-label', 'Tsuro board')
    svg.setAttribute('role', 'img')

    // Groups for layering
    const slotGroup = document.createElementNS(SVG_NS, 'g')
    const pathGroup = document.createElementNS(SVG_NS, 'g')
    const pawnGroup = document.createElementNS(SVG_NS, 'g')
    svg.appendChild(slotGroup)
    svg.appendChild(pathGroup)
    svg.appendChild(pawnGroup)

    boardWrap.appendChild(svg)

    // Candidate tile panel
    const candidatePanel = document.createElement('div')
    candidatePanel.className = 'tsuro-candidate-panel'

    const candidateLabel = document.createElement('div')
    candidateLabel.className = 'tsuro-candidate-label'

    const PREVIEW_SIZE = TILE_SIZE * 1.1
    const candidateSvg = document.createElementNS(SVG_NS, 'svg')
    candidateSvg.setAttribute('width', String(PREVIEW_SIZE))
    candidateSvg.setAttribute('height', String(PREVIEW_SIZE))
    candidateSvg.setAttribute('viewBox', `0 0 ${TILE_SIZE} ${TILE_SIZE}`)
    candidateSvg.setAttribute('class', 'tsuro-candidate-svg')
    candidateSvg.setAttribute('aria-label', 'Current tile to place')

    candidatePanel.appendChild(candidateLabel)
    candidatePanel.appendChild(candidateSvg)

    // Action buttons
    const actionsEl = document.createElement('div')
    actionsEl.className = 'tsuro-actions'

    const rotateBtn = document.createElement('button')
    rotateBtn.type = 'button'
    rotateBtn.className = 'tsuro-btn'
    rotateBtn.textContent = 'Rotate 90°'

    const placeBtn = document.createElement('button')
    placeBtn.type = 'button'
    placeBtn.className = 'tsuro-btn tsuro-btn-primary'
    placeBtn.textContent = 'Place tile'

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.className = 'tsuro-btn'
    newGameBtn.textContent = 'New game'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.className = 'tsuro-btn'
    exitBtn.textContent = 'Back to menu'

    actionsEl.appendChild(rotateBtn)
    actionsEl.appendChild(placeBtn)
    actionsEl.appendChild(newGameBtn)
    actionsEl.appendChild(exitBtn)

    wrapper.appendChild(statusEl)
    wrapper.appendChild(eliminatedEl)
    wrapper.appendChild(legendEl)
    wrapper.appendChild(boardWrap)
    wrapper.appendChild(candidatePanel)
    wrapper.appendChild(actionsEl)
    root.appendChild(wrapper)

    // -----------------------------------------------------------------------
    // Render functions
    // -----------------------------------------------------------------------

    function renderStatus(): void {
      if (state.phase === 'done') {
        if (state.winners.length === 0) {
          statusEl.textContent = 'All pawns eliminated — no winner!'
        } else {
          const names = state.winners.map((i) => escHtml(ctx.players[i])).join(' & ')
          statusEl.innerHTML = `${names} wins!`
        }
      } else {
        const name = escHtml(ctx.players[state.currentPlayerIndex])
        statusEl.textContent = `${name}'s turn — place your tile`
      }

      const eliminated = state.pawns
        .filter((p) => p.status === 'eliminated')
        .map((p) => escHtml(ctx.players[p.playerIndex]))
      eliminatedEl.textContent = eliminated.length > 0 ? `Eliminated: ${eliminated.join(', ')}` : ''
    }

    function renderBoard(): void {
      // Clear groups
      while (slotGroup.firstChild) slotGroup.removeChild(slotGroup.firstChild)
      while (pathGroup.firstChild) pathGroup.removeChild(pathGroup.firstChild)
      while (pawnGroup.firstChild) pawnGroup.removeChild(pawnGroup.firstChild)

      // Current player's target slot
      const currentPawn = state.pawns[state.currentPlayerIndex]
      let targetSlot: { col: number; row: number } | null = null
      if (state.phase === 'placing' && currentPawn.status === 'active') {
        const slot = placementSlot(currentPawn)
        if (
          slot.col >= 0 &&
          slot.col < BOARD_COLS &&
          slot.row >= 0 &&
          slot.row < BOARD_ROWS &&
          state.board[slot.row][slot.col] === null
        ) {
          targetSlot = slot
        }
      }

      // Draw slots
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const [x, y] = slotOrigin(col, row)
          const rect = document.createElementNS(SVG_NS, 'rect')
          rect.setAttribute('x', String(x))
          rect.setAttribute('y', String(y))
          rect.setAttribute('width', String(TILE_SIZE))
          rect.setAttribute('height', String(TILE_SIZE))
          const isTarget = targetSlot && targetSlot.col === col && targetSlot.row === row
          rect.setAttribute('class', isTarget ? 'tsuro-slot-target' : 'tsuro-slot')
          slotGroup.appendChild(rect)
        }
      }

      // Draw placed tile paths
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const tile = state.board[row][col]
          if (!tile) continue

          const [ox, oy] = slotOrigin(col, row)

          const g = document.createElementNS(SVG_NS, 'g')
          g.setAttribute('transform', `translate(${ox}, ${oy})`)

          for (const conn of tile) {
            const pathEl = document.createElementNS(SVG_NS, 'path')
            pathEl.setAttribute('d', tilePathD(conn))
            pathEl.setAttribute('class', 'tsuro-tile-path')
            g.appendChild(pathEl)
          }

          pathGroup.appendChild(g)
        }
      }

      // Draw pawns
      for (const pawn of state.pawns) {
        const color = PLAYER_COLORS[pawn.playerIndex]
        let cx: number
        let cy: number

        if (pawn.status === 'eliminated' && isEliminated(pawn.pos)) {
          // Off-board eliminated pawn: skip rendering or show in a corner
          continue
        }

        if (state.board[pawn.pos.row]?.[pawn.pos.col]) {
          // Pawn is on a placed tile — sit at the port position
          ;[cx, cy] = portCoord(pawn.pos.col, pawn.pos.row, pawn.pos.port)
        } else {
          // Pawn is at starting position (no tile placed yet in that slot)
          ;[cx, cy] = pawnStartCoord(pawn.pos.port, pawn.pos.col, pawn.pos.row)
        }

        const circle = document.createElementNS(SVG_NS, 'circle')
        circle.setAttribute('cx', String(cx))
        circle.setAttribute('cy', String(cy))
        circle.setAttribute('r', '9')
        circle.setAttribute('fill', color)
        circle.setAttribute(
          'class',
          `tsuro-pawn${pawn.status === 'eliminated' ? ' tsuro-pawn-eliminated' : ''}`,
        )
        pawnGroup.appendChild(circle)
      }
    }

    function renderCandidateTile(): void {
      while (candidateSvg.firstChild) candidateSvg.removeChild(candidateSvg.firstChild)

      if (state.phase === 'done') {
        candidatePanel.style.display = 'none'
        return
      }
      candidatePanel.style.display = 'flex'

      const rotated = getRotatedCandidate(state)
      const name = escHtml(ctx.players[state.currentPlayerIndex])
      const color = PLAYER_COLORS[state.currentPlayerIndex]
      candidateLabel.innerHTML = `<strong style="color:${color}">${name}</strong>'s tile (rotation: ${state.candidateRotation * 90}°)`

      for (const conn of rotated) {
        const pathEl = document.createElementNS(SVG_NS, 'path')
        pathEl.setAttribute('d', tilePathD(conn))
        pathEl.setAttribute('class', 'tsuro-candidate-path')
        candidateSvg.appendChild(pathEl)
      }
    }

    function renderButtons(): void {
      const playing = state.phase === 'placing'
      const currentPawnActive = playing && state.pawns[state.currentPlayerIndex].status === 'active'

      rotateBtn.disabled = !currentPawnActive
      placeBtn.disabled = !currentPawnActive
    }

    function render(): void {
      renderStatus()
      renderBoard()
      renderCandidateTile()
      renderButtons()
    }

    // -----------------------------------------------------------------------
    // Event handlers
    // -----------------------------------------------------------------------

    function handlePlace(): void {
      if (state.phase !== 'placing') return
      const currentPawn = state.pawns[state.currentPlayerIndex]
      if (currentPawn.status !== 'active') return

      const slot = placementSlot(currentPawn)

      // Validate slot is on the board and empty
      if (slot.col < 0 || slot.col >= BOARD_COLS || slot.row < 0 || slot.row >= BOARD_ROWS) {
        // Current pawn is already off-board — shouldn't happen in normal flow
        return
      }

      if (state.board[slot.row][slot.col] !== null) {
        // Slot already occupied — skip (shouldn't happen in normal play)
        return
      }

      const rotatedTile = getRotatedCandidate(state)
      state = placeTile(state, slot, rotatedTile)
      render()
    }

    function handleRotate(): void {
      if (state.phase !== 'placing') return
      state = rotateCandidateTile(state)
      renderCandidateTile()
    }

    function handleNewGame(): void {
      state = createGameState(ctx.players.length)
      render()
    }

    rotateBtn.addEventListener('click', handleRotate)
    placeBtn.addEventListener('click', handlePlace)
    newGameBtn.addEventListener('click', handleNewGame)
    exitBtn.addEventListener('click', ctx.onExit)

    // Initial render
    render()

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------
    return () => {
      wrapper.remove()
      styleEl.remove()
    }
  },
}

export default game
