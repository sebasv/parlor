import type { GameModule } from '../../lib/game'
import meta from './meta'
import {
  applyMove,
  type GameState,
  initialState,
  legalMoves,
  type Move,
  rowColToIdx,
  winner,
} from './rules'

// ---------- Helpers ----------

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

// ---------- Game module ----------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const [p0Name, p1Name] = [ctx.players[0], ctx.players[1]]

    // ---- Mutable game state ----
    let state: GameState = initialState()
    let selectedIdx: number | null = null
    // Moves available from the selected piece
    let movesFromSelected: Move[] = []
    // All legal moves for current turn
    let allMoves: Move[] = []
    // Captured counts
    let capturedByPlayer: [number, number] = [0, 0]
    let gameOver = false

    // ---- DOM construction ----
    const style = document.createElement('style')
    style.textContent = `
      .dr-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 0.5rem 1rem;
      }

      .dr-status {
        font-size: 1.05rem;
        font-weight: 600;
        min-height: 1.6em;
        text-align: center;
        color: var(--fg);
      }
      .dr-status.dr-win { color: var(--accent); }

      .dr-scores {
        display: flex;
        gap: 1.5rem;
        font-size: 0.9rem;
        color: var(--fg-dim);
      }
      .dr-score-item { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
      .dr-score-name { font-size: 0.8rem; }
      .dr-score-val { font-size: 1.2rem; font-weight: 700; color: var(--fg); }
      .dr-score-item.dr-active-player .dr-score-name { color: var(--accent); }

      .dr-board-wrap {
        width: min(96vw, 90vh, 640px);
        aspect-ratio: 1;
      }

      .dr-board {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        grid-template-rows: repeat(10, 1fr);
        width: 100%;
        height: 100%;
        border: 2px solid #2a2f38;
        border-radius: 6px;
        overflow: hidden;
      }

      .dr-sq {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .dr-sq.dr-light-sq {
        background: #c8b57a;
      }
      .dr-sq.dr-dark-sq {
        background: #5a3e1b;
        cursor: default;
      }
      .dr-sq.dr-dark-sq.dr-selectable {
        background: #6b4d22;
        cursor: pointer;
      }
      .dr-sq.dr-dark-sq.dr-selectable:hover {
        background: #7d5a2a;
      }
      .dr-sq.dr-dark-sq.dr-selected {
        background: #3a5a80;
        cursor: pointer;
      }
      .dr-sq.dr-dark-sq.dr-dest {
        background: #2a6040;
        cursor: pointer;
      }
      .dr-sq.dr-dark-sq.dr-dest:hover {
        background: #327048;
        cursor: pointer;
      }

      .dr-piece {
        width: 76%;
        height: 76%;
        border-radius: 50%;
        pointer-events: none;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: clamp(0.55rem, 1.5vw, 0.8rem);
        font-weight: 900;
        letter-spacing: -0.02em;
        box-shadow: 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.12);
      }
      .dr-piece.dr-piece-light {
        background: radial-gradient(circle at 35% 35%, #f0e8d0, #c8b89a);
        color: #3a2a0a;
        border: 2px solid #a0906a;
      }
      .dr-piece.dr-piece-dark {
        background: radial-gradient(circle at 35% 35%, #c44, #7a1010);
        color: #ffe8e8;
        border: 2px solid #ff8080;
      }

      .dr-controls {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: center;
      }
      .dr-btn-new {
        background: var(--accent);
        color: #000;
        font-weight: 600;
        border: none;
      }
      .dr-btn-exit {
        background: var(--bg-elev);
        color: var(--fg-dim);
      }

      .dr-midjump-note {
        font-size: 0.85rem;
        color: var(--accent);
        min-height: 1.2em;
        text-align: center;
      }
    `

    const wrap = document.createElement('div')
    wrap.className = 'dr-wrap'

    const statusEl = document.createElement('div')
    statusEl.className = 'dr-status'

    const scoresEl = document.createElement('div')
    scoresEl.className = 'dr-scores'

    const midJumpNote = document.createElement('div')
    midJumpNote.className = 'dr-midjump-note'

    const boardWrap = document.createElement('div')
    boardWrap.className = 'dr-board-wrap'

    const boardEl = document.createElement('div')
    boardEl.className = 'dr-board'
    boardEl.setAttribute('role', 'grid')
    boardEl.setAttribute('aria-label', 'Draughts board')
    boardWrap.appendChild(boardEl)

    const controlsEl = document.createElement('div')
    controlsEl.className = 'dr-controls'

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.textContent = 'New game'
    newGameBtn.className = 'dr-btn-new'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.textContent = 'Back to picker'
    exitBtn.className = 'dr-btn-exit'

    controlsEl.appendChild(newGameBtn)
    controlsEl.appendChild(exitBtn)

    wrap.appendChild(statusEl)
    wrap.appendChild(scoresEl)
    wrap.appendChild(midJumpNote)
    wrap.appendChild(boardWrap)
    wrap.appendChild(controlsEl)

    // Build 100 square elements (10×10)
    const sqEls: HTMLDivElement[] = []
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const sq = document.createElement('div')
        sq.className = 'dr-sq'
        const isDark = (row + col) % 2 === 1
        sq.classList.add(isDark ? 'dr-dark-sq' : 'dr-light-sq')
        if (isDark) {
          const darkIdx = rowColToIdx(row, col)
          sq.dataset.idx = String(darkIdx)
        }
        boardEl.appendChild(sq)
        sqEls.push(sq)
      }
    }

    // ---- Render ----

    function render() {
      const win = winner(state)
      gameOver = win !== null
      allMoves = gameOver ? [] : legalMoves(state)

      // Determine which squares are selectable (pieces that have moves)
      const selectableFrom = new Set(allMoves.map((m) => m.from))
      // Destination squares for the selected piece
      const destSet = new Set(movesFromSelected.map((m) => m.path[m.path.length - 1]))

      // Update status
      statusEl.className = 'dr-status'
      if (win !== null) {
        const name = escapeHtml(win === 0 ? p0Name : p1Name)
        statusEl.innerHTML = `${name} wins!`
        statusEl.classList.add('dr-win')
      } else {
        const name = escapeHtml(state.turn === 0 ? p0Name : p1Name)
        const label = state.turn === 0 ? 'Light' : 'Dark'
        statusEl.innerHTML = `${name} (${label}) to move`
      }

      // Mid-jump note
      midJumpNote.textContent = state.midJump !== null ? 'Continue capturing — jump again!' : ''

      // Scores
      scoresEl.innerHTML = ''
      for (const p of [0, 1] as const) {
        const div = document.createElement('div')
        div.className = 'dr-score-item'
        if (!gameOver && state.turn === p) div.classList.add('dr-active-player')
        const nameSpan = document.createElement('span')
        nameSpan.className = 'dr-score-name'
        nameSpan.textContent = escapeHtml(p === 0 ? p0Name : p1Name)
        const valSpan = document.createElement('span')
        valSpan.className = 'dr-score-val'
        valSpan.textContent = `${capturedByPlayer[p]} captured`
        div.appendChild(nameSpan)
        div.appendChild(valSpan)
        scoresEl.appendChild(div)
      }

      // Update all squares
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          const sqEl = sqEls[row * 10 + col]
          const isDark = (row + col) % 2 === 1
          if (!isDark) continue

          const idx = rowColToIdx(row, col)
          const piece = state.board[idx]

          // Reset classes
          sqEl.classList.remove('dr-selectable', 'dr-selected', 'dr-dest')

          // Clear children
          while (sqEl.firstChild) sqEl.removeChild(sqEl.firstChild)

          // Add piece element if present
          if (piece !== null) {
            const pieceEl = document.createElement('div')
            pieceEl.className = 'dr-piece'
            const isLight = piece === 'light-man' || piece === 'light-king'
            pieceEl.classList.add(isLight ? 'dr-piece-light' : 'dr-piece-dark')
            if (piece === 'light-king' || piece === 'dark-king') {
              pieceEl.textContent = 'K'
            }
            sqEl.appendChild(pieceEl)
          }

          // Apply state classes
          if (idx === selectedIdx) {
            sqEl.classList.add('dr-selected')
          } else if (destSet.has(idx)) {
            sqEl.classList.add('dr-dest')
          } else if (!gameOver && selectableFrom.has(idx)) {
            sqEl.classList.add('dr-selectable')
          }
        }
      }
    }

    // ---- Interaction ----

    function handleSquareClick(e: Event) {
      if (gameOver) return
      const target = e.currentTarget as HTMLDivElement
      const idxStr = target.dataset.idx
      if (idxStr === undefined) return
      const idx = Number(idxStr)

      const selectableFrom = new Set(allMoves.map((m) => m.from))
      const destSet = new Set(movesFromSelected.map((m) => m.path[m.path.length - 1]))

      if (selectedIdx !== null && destSet.has(idx)) {
        // Execute the move to this destination
        const move = movesFromSelected.find((m) => m.path[m.path.length - 1] === idx)
        if (move === undefined) return

        // Track captures
        capturedByPlayer[state.turn] += move.captured.length

        state = applyMove(state, move)
        selectedIdx = null
        movesFromSelected = []
        render()
        return
      }

      if (selectableFrom.has(idx)) {
        // Select this piece
        selectedIdx = idx
        movesFromSelected = allMoves.filter((m) => m.from === idx)
        render()
        return
      }

      // Clicked on empty/unselectable square: deselect (unless mid-jump forces selection)
      if (state.midJump === null) {
        selectedIdx = null
        movesFromSelected = []
        render()
      }
    }

    // Wire click events to dark squares
    for (const sq of sqEls) {
      if (sq.classList.contains('dr-dark-sq')) {
        sq.addEventListener('click', handleSquareClick)
      }
    }

    function handleNewGame() {
      state = initialState()
      selectedIdx = null
      movesFromSelected = []
      allMoves = []
      capturedByPlayer = [0, 0]
      gameOver = false
      render()
    }

    newGameBtn.addEventListener('click', handleNewGame)
    exitBtn.addEventListener('click', ctx.onExit)

    // Mount
    root.appendChild(style)
    root.appendChild(wrap)

    // Initial render
    allMoves = legalMoves(state)
    render()

    // Cleanup
    return () => {
      style.remove()
      wrap.remove()
    }
  },
}

export default game
