import type { GameModule } from '../../lib/game'
import meta from './meta'

// Board is a flat array of 9 cells: indices 0-8 map to rows left-to-right, top-to-bottom.
// null = empty, 0 = player index 0 (X), 1 = player index 1 (O)
type Cell = 0 | 1 | null
type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell]

const WIN_LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

/** Pure function — returns the player index (0 or 1) who has won, or null if no winner yet. */
export function checkWinner(board: Board): 0 | 1 | null {
  for (const [a, b, c] of WIN_LINES) {
    const v = board[a]
    if (v !== null && v === board[b] && v === board[c]) return v
  }
  return null
}

function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== null)
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const [p0, p1] = [ctx.players[0], ctx.players[1]]

    // --- State ---
    let board: Board = [null, null, null, null, null, null, null, null, null]
    let currentPlayer: 0 | 1 = 0
    let gameOver = false

    // --- DOM structure ---
    const container = document.createElement('div')
    container.className = 'ttt-container'

    const statusEl = document.createElement('div')
    statusEl.className = 'ttt-status'

    const boardEl = document.createElement('div')
    boardEl.className = 'ttt-board'
    boardEl.setAttribute('role', 'grid')
    boardEl.setAttribute('aria-label', 'Tic-Tac-Toe board')

    const controlsEl = document.createElement('div')
    controlsEl.className = 'ttt-controls'

    const newGameBtn = document.createElement('button')
    newGameBtn.type = 'button'
    newGameBtn.textContent = 'New game'
    newGameBtn.className = 'ttt-btn-new'

    const exitBtn = document.createElement('button')
    exitBtn.type = 'button'
    exitBtn.textContent = 'Back to picker'
    exitBtn.className = 'ttt-btn-exit'

    controlsEl.appendChild(newGameBtn)
    controlsEl.appendChild(exitBtn)

    // Build the 9 cell buttons
    const cellEls: HTMLButtonElement[] = []
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'ttt-cell'
      cell.setAttribute('aria-label', `Cell ${i + 1}`)
      cell.dataset.index = String(i)
      boardEl.appendChild(cell)
      cellEls.push(cell)
    }

    container.appendChild(statusEl)
    container.appendChild(boardEl)
    container.appendChild(controlsEl)

    // Inject scoped styles
    const style = document.createElement('style')
    style.textContent = `
      .ttt-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.25rem;
        padding: 1rem 0.5rem;
      }

      .ttt-status {
        font-size: 1.2rem;
        font-weight: 600;
        min-height: 1.8em;
        text-align: center;
        color: var(--fg);
      }

      .ttt-status.ttt-win {
        color: var(--accent);
      }

      .ttt-status.ttt-draw {
        color: var(--fg-dim);
      }

      .ttt-board {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        background: #2a2f38;
        border-radius: var(--radius);
        padding: 6px;
        width: min(90vw, 360px);
        aspect-ratio: 1;
      }

      .ttt-cell {
        background: var(--bg-elev);
        border: none;
        border-radius: 8px;
        font-size: clamp(2rem, 8vw, 3.5rem);
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 60px;
        transition: background 0.1s;
        padding: 0;
      }

      .ttt-cell:hover:not(:disabled) {
        background: #252a34;
      }

      .ttt-cell:disabled {
        cursor: default;
        opacity: 1;
      }

      .ttt-cell[data-mark="0"] {
        color: var(--accent);
      }

      .ttt-cell[data-mark="1"] {
        color: var(--danger);
      }

      .ttt-cell.ttt-winning {
        background: #1e2a3a;
      }

      .ttt-controls {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: center;
      }

      .ttt-btn-new {
        background: var(--accent);
        color: #000;
        font-weight: 600;
        border: none;
      }

      .ttt-btn-exit {
        background: var(--bg-elev);
        color: var(--fg-dim);
      }
    `

    // --- Render ---
    function render() {
      const winner = checkWinner(board)
      const full = isBoardFull(board)

      // Update status
      statusEl.className = 'ttt-status'
      if (winner !== null) {
        const winnerName = escapeHtml(winner === 0 ? p0 : p1)
        const mark = winner === 0 ? 'X' : 'O'
        statusEl.innerHTML = `${winnerName} (${mark}) wins!`
        statusEl.classList.add('ttt-win')
      } else if (full) {
        statusEl.textContent = "It's a draw!"
        statusEl.classList.add('ttt-draw')
      } else {
        const name = escapeHtml(currentPlayer === 0 ? p0 : p1)
        const mark = currentPlayer === 0 ? 'X' : 'O'
        statusEl.innerHTML = `${name}'s turn (${mark})`
      }

      // Determine winning cells to highlight
      const winningCells = new Set<number>()
      if (winner !== null) {
        for (const [a, b, c] of WIN_LINES) {
          if (board[a] === winner && board[b] === winner && board[c] === winner) {
            winningCells.add(a)
            winningCells.add(b)
            winningCells.add(c)
          }
        }
      }

      // Update cells
      for (let i = 0; i < 9; i++) {
        const cell = cellEls[i]
        const val = board[i]

        if (val === null) {
          cell.textContent = ''
          cell.removeAttribute('data-mark')
          cell.disabled = gameOver
          cell.classList.remove('ttt-winning')
          cell.setAttribute('aria-label', `Cell ${i + 1}, empty`)
        } else {
          const mark = val === 0 ? 'X' : 'O'
          cell.textContent = mark
          cell.dataset.mark = String(val)
          cell.disabled = true
          cell.setAttribute('aria-label', `Cell ${i + 1}, ${mark}`)

          if (winningCells.has(i)) {
            cell.classList.add('ttt-winning')
          } else {
            cell.classList.remove('ttt-winning')
          }
        }
      }
    }

    // --- Event handlers ---
    function handleCellClick(e: Event) {
      if (gameOver) return
      const target = e.currentTarget as HTMLButtonElement
      const idx = Number(target.dataset.index)
      if (board[idx] !== null) return

      board[idx] = currentPlayer
      const winner = checkWinner(board)
      const full = isBoardFull(board)

      if (winner !== null || full) {
        gameOver = true
      } else {
        currentPlayer = currentPlayer === 0 ? 1 : 0
      }

      render()
    }

    function handleNewGame() {
      board = [null, null, null, null, null, null, null, null, null]
      currentPlayer = 0
      gameOver = false
      render()
    }

    // Wire up cell listeners
    for (const cell of cellEls) {
      cell.addEventListener('click', handleCellClick)
    }
    newGameBtn.addEventListener('click', handleNewGame)
    exitBtn.addEventListener('click', ctx.onExit)

    // Mount
    root.appendChild(style)
    root.appendChild(container)

    // Initial render
    render()

    // Cleanup
    return () => {
      style.remove()
      container.remove()
    }
  },
}

export default game
