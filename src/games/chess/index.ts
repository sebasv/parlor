// CSS imports for chessground rendering.
// chessground.base.css: core board layout, squares, pieces positioning.
// chessground.brown.css: brown board color theme (calm, low-contrast).
// chessground.cburnett.css: CBurnett flat SVG piece set from Lichess (clean, not gaudy 3D).
import 'chessground/assets/chessground.base.css'
import 'chessground/assets/chessground.brown.css'
import 'chessground/assets/chessground.cburnett.css'

import { Chess } from 'chess.js'
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Config } from 'chessground/config'
import type { Color, Dests, Key } from 'chessground/types'
import type { GameModule } from '../../lib/game'
import meta from './meta'

// ---------- Helpers ----------

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

/**
 * Compute the legal-move destination map for chessground from chess.js.
 * chessground expects a Map<from-square, to-squares[]>.
 */
function computeDests(chess: Chess): Dests {
  const dests: Dests = new Map()
  const moves = chess.moves({ verbose: true })
  for (const move of moves) {
    const from = move.from as Key
    const to = move.to as Key
    const existing = dests.get(from)
    if (existing) {
      existing.push(to)
    } else {
      dests.set(from, [to])
    }
  }
  return dests
}

/** chess.js color ('w'|'b') → chessground Color ('white'|'black') */
function toColor(turn: 'w' | 'b'): Color {
  return turn === 'w' ? 'white' : 'black'
}

// ---------- Game module ----------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    // ctx.players[0] plays white, ctx.players[1] plays black.
    const whiteName = ctx.players[0]
    const blackName = ctx.players[1]

    // chess.js is the rules engine — source of truth for legal moves, state, etc.
    let chess = new Chess()

    // ---- DOM construction ----

    const style = document.createElement('style')
    style.textContent = `
      .ch-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 0.5rem 1rem;
      }

      .ch-layout {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        justify-content: center;
        align-items: flex-start;
        width: 100%;
      }

      .ch-board-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }

      .ch-player-tag {
        font-size: 0.9rem;
        color: var(--fg-dim);
        text-align: center;
        min-height: 1.4em;
      }
      .ch-player-tag.ch-active {
        color: var(--fg);
        font-weight: 600;
      }
      .ch-player-tag .ch-color-dot {
        display: inline-block;
        width: 0.65em;
        height: 0.65em;
        border-radius: 50%;
        margin-right: 0.35em;
        vertical-align: middle;
      }
      .ch-color-dot.ch-white-dot {
        background: #f0d9b5;
        border: 1px solid #888;
      }
      .ch-color-dot.ch-black-dot {
        background: #3d3d3d;
        border: 1px solid #888;
      }

      .ch-board-wrap {
        width: min(94vw, 520px);
        aspect-ratio: 1;
        position: relative;
      }

      /* chessground mounts here and fills the container */
      .ch-board-wrap .cg-wrap {
        width: 100%;
        height: 100%;
      }

      .ch-status {
        font-size: 1rem;
        font-weight: 600;
        min-height: 1.6em;
        text-align: center;
        color: var(--fg);
      }
      .ch-status.ch-check { color: #f5a623; }
      .ch-status.ch-win { color: var(--accent); }
      .ch-status.ch-draw { color: var(--fg-dim); }

      .ch-sidebar {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: 160px;
        max-width: 220px;
        flex: 1;
      }

      .ch-history-label {
        font-size: 0.8rem;
        color: var(--fg-dim);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .ch-history {
        background: var(--bg-elev);
        border-radius: var(--radius);
        padding: 0.5rem 0.6rem;
        font-size: 0.82rem;
        font-family: ui-monospace, monospace;
        line-height: 1.6;
        max-height: min(94vw, 520px);
        overflow-y: auto;
        color: var(--fg-dim);
        min-height: 3rem;
      }

      .ch-history-row {
        display: grid;
        grid-template-columns: 2em 1fr 1fr;
        gap: 0.25em;
      }

      .ch-history-num {
        color: var(--fg-dim);
        opacity: 0.5;
      }

      .ch-history-move {
        color: var(--fg);
      }

      .ch-controls {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: center;
      }

      .ch-btn-new {
        background: var(--accent);
        color: #000;
        font-weight: 600;
        border: none;
      }

      .ch-btn-exit {
        background: var(--bg-elev);
        color: var(--fg-dim);
      }

      /* Override chessground highlight colors to fit dark theme */
      cg-board square.last-move {
        background-color: rgba(108, 177, 255, 0.35) !important;
      }
      cg-board square.selected {
        background-color: rgba(108, 177, 255, 0.5) !important;
      }
      cg-board square.move-dest {
        background: radial-gradient(rgba(108, 177, 255, 0.45) 19%, rgba(0,0,0,0) 20%) !important;
      }
      cg-board square.oc.move-dest {
        background: radial-gradient(transparent 0%, transparent 79%, rgba(108, 177, 255, 0.4) 80%) !important;
      }
      cg-board square.check {
        background: radial-gradient(ellipse at center, rgba(255, 107, 107, 0.85) 0%, rgba(255, 107, 107, 0) 60%) !important;
      }
    `

    const wrap = document.createElement('div')
    wrap.className = 'ch-wrap'

    const statusEl = document.createElement('div')
    statusEl.className = 'ch-status'

    const layoutEl = document.createElement('div')
    layoutEl.className = 'ch-layout'

    // Board column (black label on top, board, white label on bottom)
    const boardColEl = document.createElement('div')
    boardColEl.className = 'ch-board-col'

    const blackTagEl = document.createElement('div')
    blackTagEl.className = 'ch-player-tag'

    const boardWrapEl = document.createElement('div')
    boardWrapEl.className = 'ch-board-wrap'

    const whiteTagEl = document.createElement('div')
    whiteTagEl.className = 'ch-player-tag'

    boardColEl.appendChild(blackTagEl)
    boardColEl.appendChild(boardWrapEl)
    boardColEl.appendChild(whiteTagEl)

    // Sidebar: move history
    const sidebarEl = document.createElement('div')
    sidebarEl.className = 'ch-sidebar'

    const historyLabelEl = document.createElement('div')
    historyLabelEl.className = 'ch-history-label'
    historyLabelEl.textContent = 'Moves'

    const historyEl = document.createElement('div')
    historyEl.className = 'ch-history'

    sidebarEl.appendChild(historyLabelEl)
    sidebarEl.appendChild(historyEl)

    layoutEl.appendChild(boardColEl)
    layoutEl.appendChild(sidebarEl)

    const controlsEl = document.createElement('div')
    controlsEl.className = 'ch-controls'

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.textContent = 'New game'
    newGameBtn.className = 'ch-btn-new'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.textContent = 'Back to picker'
    exitBtn.className = 'ch-btn-exit'

    controlsEl.appendChild(newGameBtn)
    controlsEl.appendChild(exitBtn)

    wrap.appendChild(statusEl)
    wrap.appendChild(layoutEl)
    wrap.appendChild(controlsEl)

    // Mount into root before initializing chessground (needs layout dimensions)
    root.appendChild(style)
    root.appendChild(wrap)

    // ---- Chessground init ----
    // Chessground renders the board UI; chess.js drives all move logic.

    function buildChessgroundConfig(pendingPromotion?: { orig: Key; dest: Key }): Config {
      const turn = chess.turn()
      const color = toColor(turn)
      const isOver = chess.isGameOver()

      const cfg: Config = {
        fen: chess.fen(),
        orientation: 'white', // fixed orientation for pass-and-play; see chess-design.md
        turnColor: color,
        check: chess.inCheck() ? color : false,
        highlight: { lastMove: true, check: true },
        animation: { enabled: true, duration: 150 },
        movable: {
          free: false,
          color: isOver ? undefined : color,
          dests: isOver ? new Map() : computeDests(chess),
          showDests: true,
          events: {
            after(orig, dest) {
              handleMove(orig, dest, pendingPromotion)
            },
          },
        },
        draggable: { enabled: true, showGhost: true },
        selectable: { enabled: true },
        coordinates: true,
      }
      return cfg
    }

    const cg: Api = Chessground(boardWrapEl, buildChessgroundConfig())

    // ---- Promotion handling ----
    // Detect pawn reaching the back rank and default to queen (TODO: picker in v2).

    function isPromotion(orig: Key, dest: Key): boolean {
      const piece = chess.get(orig as Parameters<typeof chess.get>[0])
      if (!piece || piece.type !== 'p') return false
      const destRank = dest[1]
      return (piece.color === 'w' && destRank === '8') || (piece.color === 'b' && destRank === '1')
    }

    function handleMove(orig: Key, dest: Key, _pending?: { orig: Key; dest: Key }) {
      const promotionFlag = isPromotion(orig, dest)

      const result = chess.move({
        from: orig,
        to: dest,
        promotion: promotionFlag ? 'q' : undefined,
      })

      if (result === null) {
        // Move was illegal (shouldn't happen since dests come from chess.js, but guard anyway)
        syncBoard()
        return
      }

      syncBoard()
    }

    // ---- Sync chessground from chess.js state ----

    function syncBoard() {
      const turn = chess.turn()
      const color = toColor(turn)
      const isOver = chess.isGameOver()

      cg.set({
        fen: chess.fen(),
        turnColor: color,
        check: chess.inCheck() ? color : false,
        movable: {
          color: isOver ? undefined : color,
          dests: isOver ? new Map() : computeDests(chess),
        },
      })

      renderStatus()
      renderPlayerTags()
      renderHistory()
    }

    // ---- UI renders ----

    function renderStatus() {
      statusEl.className = 'ch-status'

      if (chess.isCheckmate()) {
        const loserColor = chess.turn()
        const winner = loserColor === 'w' ? escapeHtml(blackName) : escapeHtml(whiteName)
        statusEl.innerHTML = `${winner} wins by checkmate`
        statusEl.classList.add('ch-win')
        return
      }

      if (chess.isStalemate()) {
        statusEl.textContent = 'Draw — stalemate'
        statusEl.classList.add('ch-draw')
        return
      }

      if (chess.isThreefoldRepetition()) {
        statusEl.textContent = 'Draw — threefold repetition'
        statusEl.classList.add('ch-draw')
        return
      }

      if (chess.isInsufficientMaterial()) {
        statusEl.textContent = 'Draw — insufficient material'
        statusEl.classList.add('ch-draw')
        return
      }

      if (chess.isDraw()) {
        // Covers 50-move rule and any other draw
        statusEl.textContent = 'Draw'
        statusEl.classList.add('ch-draw')
        return
      }

      const turn = chess.turn()
      const name = escapeHtml(turn === 'w' ? whiteName : blackName)
      const colorLabel = turn === 'w' ? 'White' : 'Black'

      if (chess.inCheck()) {
        statusEl.innerHTML = `${name} (${colorLabel}) — in check!`
        statusEl.classList.add('ch-check')
      } else {
        statusEl.textContent = `${name} (${colorLabel}) to move`
      }
    }

    function renderPlayerTags() {
      const turn = chess.turn()
      const isOver = chess.isGameOver()

      // Black player at top
      blackTagEl.innerHTML = `<span class="ch-color-dot ch-black-dot"></span>${escapeHtml(blackName)} (Black)`
      blackTagEl.className = 'ch-player-tag'
      if (!isOver && turn === 'b') blackTagEl.classList.add('ch-active')

      // White player at bottom
      whiteTagEl.innerHTML = `<span class="ch-color-dot ch-white-dot"></span>${escapeHtml(whiteName)} (White)`
      whiteTagEl.className = 'ch-player-tag'
      if (!isOver && turn === 'w') whiteTagEl.classList.add('ch-active')
    }

    function renderHistory() {
      const moves = chess.history()
      historyEl.innerHTML = ''

      if (moves.length === 0) {
        historyEl.textContent = '—'
        return
      }

      // Group into pairs: move 1 = [white, black], etc.
      for (let i = 0; i < moves.length; i += 2) {
        const row = document.createElement('div')
        row.className = 'ch-history-row'

        const numEl = document.createElement('span')
        numEl.className = 'ch-history-num'
        numEl.textContent = `${Math.floor(i / 2) + 1}.`

        const whiteEl = document.createElement('span')
        whiteEl.className = 'ch-history-move'
        whiteEl.textContent = moves[i]

        const blackEl = document.createElement('span')
        blackEl.className = 'ch-history-move'
        blackEl.textContent = moves[i + 1] ?? ''

        row.appendChild(numEl)
        row.appendChild(whiteEl)
        row.appendChild(blackEl)
        historyEl.appendChild(row)
      }

      // Scroll to bottom
      historyEl.scrollTop = historyEl.scrollHeight
    }

    // ---- New game ----

    function handleNewGame() {
      chess = new Chess()
      cg.set(buildChessgroundConfig())
      renderStatus()
      renderPlayerTags()
      renderHistory()
    }

    newGameBtn.addEventListener('click', handleNewGame)
    exitBtn.addEventListener('click', ctx.onExit)

    // Initial render
    renderStatus()
    renderPlayerTags()
    renderHistory()

    // Cleanup: remove DOM, destroy chessground, remove listeners
    return () => {
      cg.destroy()
      style.remove()
      wrap.remove()
    }
  },
}

export default game
