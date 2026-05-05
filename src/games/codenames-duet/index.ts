import type { GameModule } from '../../lib/game'
import meta from './meta'
import { WORD_LIST } from './words'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TileRole = 'agent' | 'neutral' | 'assassin'

/** Each word has an independent role from each player's perspective. */
interface KeyCard {
  // roles[playerIndex][wordIndex]
  readonly roles: readonly [readonly TileRole[], readonly TileRole[]]
}

type PlayerIndex = 0 | 1

type GamePhase =
  | { kind: 'spymaster'; playerIndex: PlayerIndex } // spymaster sees key, enters clue
  | { kind: 'pass-to-guesser'; spymasterIndex: PlayerIndex; guesserIndex: PlayerIndex }
  | {
      kind: 'guessing'
      guesserIndex: PlayerIndex
      clue: string
      clueNumber: number
      guessesLeft: number
    }
  | { kind: 'pass-to-spymaster'; nextSpymasterIndex: PlayerIndex }
  | { kind: 'game-over'; winner: 'players' | 'assassin' | 'timeout' }

interface GameState {
  readonly words: readonly string[]
  readonly keyCard: KeyCard
  readonly revealed: readonly boolean[] // true if this tile has been tapped
  readonly turnsRemaining: number
  readonly phase: GamePhase
}

// ---------------------------------------------------------------------------
// Pure game logic
// ---------------------------------------------------------------------------

const TOTAL_TURNS = 9

/** Generate a key card with ~9 agents, ~3 assassins (rest neutral) per player. */
function generateKey(): KeyCard {
  function assignRoles(): TileRole[] {
    const roles: TileRole[] = Array(25).fill('neutral')
    const indices = Array.from({ length: 25 }, (_, i) => i)
    shuffle(indices)

    // 9 agents, 3 assassins, 13 neutral
    for (let i = 0; i < 9; i++) roles[indices[i]] = 'agent'
    for (let i = 9; i < 12; i++) roles[indices[i]] = 'assassin'
    return roles
  }

  return {
    roles: [assignRoles(), assignRoles()],
  }
}

/** Fisher-Yates shuffle (mutates in place, returns same array). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Pick 25 random words from the word list. */
function pickWords(): string[] {
  const pool = [...WORD_LIST]
  shuffle(pool)
  return pool.slice(0, 25)
}

function createInitialState(playerNames: readonly string[]): GameState {
  void playerNames // names are used by UI layer, not state logic
  const words = pickWords()
  const keyCard = generateKey()
  return {
    words,
    keyCard,
    revealed: Array(25).fill(false),
    turnsRemaining: TOTAL_TURNS,
    phase: { kind: 'spymaster', playerIndex: 0 },
  }
}

/**
 * All green-agent words across both players' key cards that need to be found.
 * A word counts once in the target set regardless of how many players mark it green.
 */
function allAgentIndices(keyCard: KeyCard): Set<number> {
  const result = new Set<number>()
  for (let i = 0; i < 25; i++) {
    if (keyCard.roles[0][i] === 'agent' || keyCard.roles[1][i] === 'agent') {
      result.add(i)
    }
  }
  return result
}

function isGameOver(state: GameState): { winner: 'players' | 'assassin' | 'timeout' | null } {
  if (state.phase.kind === 'game-over') {
    return { winner: state.phase.winner }
  }
  return { winner: null }
}

/** Get what a tile looks like from a specific player's perspective. */
function revealResult(wordIndex: number, playerIndex: PlayerIndex, keyCard: KeyCard): TileRole {
  return keyCard.roles[playerIndex][wordIndex]
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
.cd-root {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.75rem;
  min-height: 100%;
  font-size: clamp(1rem, 1.4vw, 1.2rem);
  max-width: min(100%, 960px);
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* ---- Pass screen ---- */
.cd-pass-screen {
  position: fixed;
  inset: 0;
  background: #0f1115;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  z-index: 100;
  padding: 2rem;
  text-align: center;
}
.cd-pass-screen h2 {
  margin: 0;
  font-size: 1.8rem;
}
.cd-pass-screen p {
  margin: 0;
  color: #9aa0a6;
  max-width: 34ch;
}
.cd-ready-btn {
  padding: 1rem 2.5rem;
  font-size: 1.3rem;
  font-weight: 700;
  border-radius: 14px;
  border: 2px solid #6cb1ff;
  background: #1a1d24;
  color: #e6e6e6;
  cursor: pointer;
  touch-action: manipulation;
}
.cd-ready-btn:hover { background: #22263a; }

/* ---- Status bar ---- */
.cd-status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: center;
  background: #1a1d24;
  border-radius: 10px;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
}
.cd-status-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font-weight: 600;
}
.cd-status-turns { color: #6cb1ff; }
.cd-status-agents { color: #4dd880; }

/* ---- Clue display (guesser view) ---- */
.cd-clue-display {
  background: #1a1d24;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.cd-clue-word {
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  color: #e6e6e6;
}
.cd-clue-num {
  font-size: 1.2rem;
  font-weight: 700;
  color: #6cb1ff;
}
.cd-clue-label {
  font-size: 0.8rem;
  color: #9aa0a6;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ---- Grid ---- */
.cd-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.4rem;
}

/* ---- Tile ---- */
.cd-tile {
  aspect-ratio: 4/3;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.04em;
  padding: 0.3em;
  border: 2px solid transparent;
  cursor: default;
  user-select: none;
  transition: transform 0.08s, box-shadow 0.08s;
  line-height: 1.2;
  word-break: break-word;
}

/* Guesser: plain untapped tile */
.cd-tile[data-state="hidden"] {
  background: #1a1d24;
  border-color: #2a2f38;
  color: #e6e6e6;
}
.cd-tile[data-state="hidden"][data-tappable="true"] {
  cursor: pointer;
}
.cd-tile[data-state="hidden"][data-tappable="true"]:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.5);
  border-color: rgba(255,255,255,0.25);
}
.cd-tile[data-state="hidden"][data-tappable="true"]:active {
  transform: scale(0.96);
}

/* Revealed states */
.cd-tile[data-state="agent"] {
  background: #1a3d2b;
  border-color: #27a85a;
  color: #5cd68a;
}
.cd-tile[data-state="neutral"] {
  background: #2a2620;
  border-color: #5c4f38;
  color: #a08050;
}
.cd-tile[data-state="assassin"] {
  background: #3d1515;
  border-color: #ff4444;
  color: #ff6b6b;
}

/* Spymaster view overlays */
.cd-tile[data-spymaster="agent"] {
  background: #1a3d2b;
  border-color: #27a85a;
  color: #5cd68a;
}
.cd-tile[data-spymaster="neutral"] {
  background: #22263a;
  border-color: #3a4060;
  color: #9aa0a6;
}
.cd-tile[data-spymaster="assassin"] {
  background: #3d1515;
  border-color: #cc3333;
  color: #ff8888;
}
/* Already revealed tiles in spymaster view — dimmed */
.cd-tile[data-spymaster][data-revealed="true"] {
  opacity: 0.5;
}

/* ---- Clue input (spymaster) ---- */
.cd-clue-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #1a1d24;
  border-radius: 10px;
  padding: 0.75rem 1rem;
}
.cd-clue-form h3 {
  margin: 0;
  font-size: 1rem;
  color: #9aa0a6;
  font-weight: 600;
}
.cd-clue-input-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.cd-clue-text {
  flex: 1;
  min-width: 120px;
  font: inherit;
  font-size: 1rem;
  color: #e6e6e6;
  background: #0f1115;
  border: 1px solid #2a2f38;
  border-radius: 8px;
  padding: 0.55em 0.8em;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.cd-clue-text:focus {
  outline: none;
  border-color: #6cb1ff;
}
.cd-num-select {
  font: inherit;
  font-size: 1rem;
  color: #e6e6e6;
  background: #0f1115;
  border: 1px solid #2a2f38;
  border-radius: 8px;
  padding: 0.55em 0.7em;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  min-width: 60px;
  text-align: center;
}
.cd-num-select:focus {
  outline: none;
  border-color: #6cb1ff;
}

/* ---- Buttons ---- */
.cd-btn {
  padding: 0.7em 1.4em;
  border-radius: 10px;
  border: 1px solid transparent;
  background: #1a1d24;
  color: #e6e6e6;
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
  touch-action: manipulation;
}
.cd-btn:hover:not(:disabled) { border-color: #6cb1ff; }
.cd-btn:disabled { opacity: 0.38; cursor: not-allowed; }
.cd-btn-primary {
  background: #1e3a5f;
  border-color: #6cb1ff;
  font-weight: 700;
}
.cd-btn-primary:hover:not(:disabled) { background: #254878; }
.cd-btn-danger {
  background: #3d1818;
  border-color: #ff6b6b;
}
.cd-btn-danger:hover:not(:disabled) { background: #4e1f1f; }
.cd-btn-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* ---- Section title ---- */
.cd-section-title {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #9aa0a6;
  margin: 0 0 0.35rem;
}

/* ---- Key legend (spymaster) ---- */
.cd-legend {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.8rem;
}
.cd-legend-item {
  display: flex;
  align-items: center;
  gap: 0.3em;
}
.cd-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}
.cd-legend-dot-agent { background: #27a85a; }
.cd-legend-dot-neutral { background: #3a4060; }
.cd-legend-dot-assassin { background: #cc3333; }

/* ---- Game over ---- */
.cd-gameover {
  text-align: center;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.cd-gameover h2 { margin: 0; font-size: 2rem; }
.cd-gameover p { margin: 0; color: #9aa0a6; }
.cd-result-win { color: #27a85a; }
.cd-result-lose { color: #ff6b6b; }

/* ---- Phase label ---- */
.cd-phase-label {
  font-size: 1.05rem;
  font-weight: 700;
  color: #6cb1ff;
}

/* ---- Hint text ---- */
.cd-hint {
  font-size: 0.85rem;
  color: #9aa0a6;
  margin: 0;
}

/* ---- Guesses remaining indicator ---- */
.cd-guesses-left {
  font-size: 0.85rem;
  color: #9aa0a6;
}
.cd-guesses-left strong {
  color: #e6e6e6;
}
`

// ---------------------------------------------------------------------------
// DOM helper
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else node.setAttribute(k, v)
  }
  return node
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const { players, onExit } = ctx

    // Inject styles
    const styleEl = document.createElement('style')
    styleEl.textContent = CSS
    document.head.appendChild(styleEl)

    let state = createInitialState(players)

    const wrapper = el('div', { class: 'cd-root' })
    root.appendChild(wrapper)

    // Pass screen (fixed overlay, appended to body)
    let passScreenEl: HTMLDivElement | null = null

    // ---------------------------------------------------------------------------
    // Pass screen
    // ---------------------------------------------------------------------------

    function showPassScreen(toName: string, hint: string, afterReady: () => void): void {
      passScreenEl = el('div', { class: 'cd-pass-screen' })

      const heading = el('h2')
      heading.textContent = `Pass to ${toName}`

      const hintEl = el('p')
      hintEl.textContent = hint

      const readyBtn = el('button', { class: 'cd-ready-btn', type: 'button' })
      readyBtn.textContent = 'Ready'
      readyBtn.addEventListener('click', () => {
        passScreenEl?.remove()
        passScreenEl = null
        afterReady()
      })

      passScreenEl.appendChild(heading)
      passScreenEl.appendChild(hintEl)
      passScreenEl.appendChild(readyBtn)
      document.body.appendChild(passScreenEl)
    }

    // ---------------------------------------------------------------------------
    // Render helpers
    // ---------------------------------------------------------------------------

    function countRevealedAgents(): number {
      const agentSet = allAgentIndices(state.keyCard)
      let count = 0
      for (const idx of agentSet) {
        if (state.revealed[idx]) count++
      }
      return count
    }

    function totalAgents(): number {
      return allAgentIndices(state.keyCard).size
    }

    function renderStatusBar(): void {
      const bar = el('div', { class: 'cd-status-bar' })

      const turnsSpan = el('span', { class: 'cd-status-item cd-status-turns' })
      turnsSpan.textContent = `Turns: ${state.turnsRemaining}`

      const agentsSpan = el('span', { class: 'cd-status-item cd-status-agents' })
      agentsSpan.textContent = `Agents: ${countRevealedAgents()} / ${totalAgents()}`

      const exitBtn = el('button', {
        class: 'cd-btn',
        type: 'button',
        style: 'margin-left: auto; padding: 0.3em 0.8em; font-size: 0.8rem;',
      })
      exitBtn.textContent = 'Exit'
      exitBtn.addEventListener('click', onExit)

      bar.appendChild(turnsSpan)
      bar.appendChild(agentsSpan)
      bar.appendChild(exitBtn)
      wrapper.appendChild(bar)
    }

    function renderLegend(): void {
      const legend = el('div', { class: 'cd-legend' })
      const items: Array<{ label: string; cls: string }> = [
        { label: 'Agent', cls: 'cd-legend-dot-agent' },
        { label: 'Neutral', cls: 'cd-legend-dot-neutral' },
        { label: 'Assassin', cls: 'cd-legend-dot-assassin' },
      ]
      for (const { label, cls } of items) {
        const item = el('div', { class: 'cd-legend-item' })
        const dot = el('div', { class: `cd-legend-dot ${cls}` })
        const text = document.createTextNode(label)
        item.appendChild(dot)
        item.appendChild(text)
        legend.appendChild(item)
      }
      wrapper.appendChild(legend)
    }

    function renderGrid(opts: {
      spymasterPlayerIndex?: PlayerIndex
      guesserPlayerIndex?: PlayerIndex
      onTap?: (wordIndex: number) => void
    }): void {
      const { spymasterPlayerIndex, guesserPlayerIndex, onTap } = opts
      const gridEl = el('div', { class: 'cd-grid' })

      for (let i = 0; i < 25; i++) {
        const tileEl = el('div', { class: 'cd-tile' })
        tileEl.textContent = state.words[i]

        if (state.revealed[i]) {
          // Already revealed — show what it was from guesser perspective (or either)
          // Use the guesser's perspective if we have one, else player 0
          const pIdx = guesserPlayerIndex ?? 0
          tileEl.dataset.state = state.keyCard.roles[pIdx][i]
          if (spymasterPlayerIndex !== undefined) {
            tileEl.dataset.revealed = 'true'
          }
        } else if (spymasterPlayerIndex !== undefined) {
          // Spymaster view: show colored tiles
          tileEl.dataset.spymaster = state.keyCard.roles[spymasterPlayerIndex][i]
        } else {
          // Guesser view: plain tile
          tileEl.dataset.state = 'hidden'
          if (onTap) {
            tileEl.dataset.tappable = 'true'
            tileEl.addEventListener('click', () => onTap(i))
          }
        }

        gridEl.appendChild(tileEl)
      }

      wrapper.appendChild(gridEl)
    }

    // ---------------------------------------------------------------------------
    // Phase renders
    // ---------------------------------------------------------------------------

    function renderSpymasterPhase(playerIndex: PlayerIndex): void {
      const playerName = players[playerIndex]

      const phaseLabel = el('div', { class: 'cd-phase-label' })
      phaseLabel.textContent = `${playerName} — Spymaster`
      wrapper.appendChild(phaseLabel)

      renderStatusBar()
      renderLegend()
      renderGrid({ spymasterPlayerIndex: playerIndex })

      // Clue entry form
      const form = el('div', { class: 'cd-clue-form' })

      const formTitle = el('h3')
      formTitle.textContent = 'Enter your clue for your partner:'
      form.appendChild(formTitle)

      const inputRow = el('div', { class: 'cd-clue-input-row' })

      const textInput = el('input', {
        class: 'cd-clue-text',
        type: 'text',
        placeholder: 'ONE WORD',
        maxlength: '30',
        autocomplete: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
      }) as HTMLInputElement

      const numSelect = el('select', { class: 'cd-num-select' }) as HTMLSelectElement
      for (let n = 1; n <= 9; n++) {
        const opt = el('option')
        opt.value = String(n)
        opt.textContent = String(n)
        numSelect.appendChild(opt)
      }
      numSelect.value = '1'

      inputRow.appendChild(textInput)
      inputRow.appendChild(numSelect)
      form.appendChild(inputRow)

      const hint = el('p', { class: 'cd-hint' })
      hint.textContent =
        'One word only — no hints about positions. Pass to your partner when ready.'
      form.appendChild(hint)

      const doneBtn = el('button', { class: 'cd-btn cd-btn-primary', type: 'button' })
      const guesserName = players[playerIndex === 0 ? 1 : 0]
      doneBtn.textContent = `Done — pass to ${guesserName}`
      doneBtn.addEventListener('click', () => {
        const clueText = textInput.value.trim().toUpperCase()
        if (!clueText) {
          textInput.focus()
          textInput.style.borderColor = '#ff6b6b'
          return
        }
        const clueNumber = Number.parseInt(numSelect.value, 10)
        const guesserIndex: PlayerIndex = playerIndex === 0 ? 1 : 0

        // Update state before passing
        state = {
          ...state,
          phase: {
            kind: 'pass-to-guesser',
            spymasterIndex: playerIndex,
            guesserIndex,
          },
        }

        showPassScreen(
          guesserName,
          `Only ${guesserName} should be looking now. Tap Ready when you're set.`,
          () => {
            state = {
              ...state,
              phase: {
                kind: 'guessing',
                guesserIndex,
                clue: clueText,
                clueNumber,
                guessesLeft: clueNumber + 1,
              },
            }
            render()
          },
        )
      })

      const exitBtn = el('button', { class: 'cd-btn', type: 'button' })
      exitBtn.textContent = 'Exit game'
      exitBtn.addEventListener('click', onExit)

      const btnRow = el('div', { class: 'cd-btn-row' })
      btnRow.appendChild(doneBtn)
      btnRow.appendChild(exitBtn)
      form.appendChild(btnRow)

      wrapper.appendChild(form)
    }

    function renderGuessingPhase(phase: Extract<GamePhase, { kind: 'guessing' }>): void {
      const { guesserIndex, clue, clueNumber, guessesLeft } = phase
      const guesserName = players[guesserIndex]

      const phaseLabel = el('div', { class: 'cd-phase-label' })
      phaseLabel.textContent = `${guesserName} — Guesser`
      wrapper.appendChild(phaseLabel)

      renderStatusBar()

      // Clue display
      const clueDisplay = el('div', { class: 'cd-clue-display' })
      const clueLabel = el('span', { class: 'cd-clue-label' })
      clueLabel.textContent = 'Clue:'
      const clueWordEl = el('span', { class: 'cd-clue-word' })
      clueWordEl.textContent = clue
      const clueNumEl = el('span', { class: 'cd-clue-num' })
      clueNumEl.textContent = `x${clueNumber}`
      clueDisplay.appendChild(clueLabel)
      clueDisplay.appendChild(clueWordEl)
      clueDisplay.appendChild(clueNumEl)
      wrapper.appendChild(clueDisplay)

      const guessesLeftEl = el('p', { class: 'cd-guesses-left' })
      guessesLeftEl.innerHTML = `Guesses remaining: <strong>${guessesLeft}</strong>`
      wrapper.appendChild(guessesLeftEl)

      renderGrid({
        guesserPlayerIndex: guesserIndex,
        onTap: (wordIndex) => handleGuess(wordIndex, phase),
      })

      // Pass / stop guessing button
      const btnRow = el('div', { class: 'cd-btn-row' })

      const stopBtn = el('button', { class: 'cd-btn', type: 'button' })
      stopBtn.textContent = 'Stop guessing (end turn)'
      stopBtn.addEventListener('click', () => endGuesserTurn())

      btnRow.appendChild(stopBtn)
      wrapper.appendChild(btnRow)

      const hint = el('p', { class: 'cd-hint' })
      hint.textContent = 'Tap a word to guess. Hitting an assassin ends the game immediately.'
      wrapper.appendChild(hint)
    }

    // ---------------------------------------------------------------------------
    // Game actions
    // ---------------------------------------------------------------------------

    function handleGuess(wordIndex: number, phase: Extract<GamePhase, { kind: 'guessing' }>): void {
      if (state.revealed[wordIndex]) return

      const { guesserIndex, clue, clueNumber } = phase
      const role = revealResult(wordIndex, guesserIndex, state.keyCard)

      const newRevealed = [...state.revealed]
      newRevealed[wordIndex] = true

      // Check win condition before updating state
      const agentSet = allAgentIndices(state.keyCard)

      if (role === 'assassin') {
        state = {
          ...state,
          revealed: newRevealed,
          phase: { kind: 'game-over', winner: 'assassin' },
        }
        render()
        return
      }

      // Check if all agents revealed
      const allFound = [...agentSet].every((idx) => newRevealed[idx])

      if (allFound) {
        state = {
          ...state,
          revealed: newRevealed,
          phase: { kind: 'game-over', winner: 'players' },
        }
        render()
        return
      }

      const newGuessesLeft = phase.guessesLeft - 1

      if (role === 'neutral' || newGuessesLeft <= 0) {
        // Turn ends: neutral tap or ran out of bonus guesses
        endTurn(newRevealed, guesserIndex)
        return
      }

      // Agent found — continue guessing
      state = {
        ...state,
        revealed: newRevealed,
        phase: { kind: 'guessing', guesserIndex, clue, clueNumber, guessesLeft: newGuessesLeft },
      }
      render()
    }

    function endGuesserTurn(): void {
      const phase = state.phase
      if (phase.kind !== 'guessing') return
      endTurn(state.revealed, phase.guesserIndex)
    }

    function endTurn(revealed: readonly boolean[], guesserIndex: PlayerIndex): void {
      const newTurns = state.turnsRemaining - 1
      const nextSpymasterIndex = guesserIndex // roles swap: guesser becomes next spymaster

      if (newTurns <= 0) {
        state = {
          ...state,
          revealed,
          turnsRemaining: 0,
          phase: { kind: 'game-over', winner: 'timeout' },
        }
        render()
        return
      }

      state = {
        ...state,
        revealed,
        turnsRemaining: newTurns,
        phase: { kind: 'pass-to-spymaster', nextSpymasterIndex },
      }

      const nextSpymasterName = players[nextSpymasterIndex]
      showPassScreen(
        nextSpymasterName,
        `${nextSpymasterName} is now the Spymaster. Only they should see the key card.`,
        () => {
          state = {
            ...state,
            phase: { kind: 'spymaster', playerIndex: nextSpymasterIndex },
          }
          render()
        },
      )
    }

    // ---------------------------------------------------------------------------
    // Game over
    // ---------------------------------------------------------------------------

    function renderGameOver(winner: 'players' | 'assassin' | 'timeout'): void {
      const panel = el('div', { class: 'cd-gameover' })

      const heading = el('h2')
      const subtext = el('p')

      if (winner === 'players') {
        heading.textContent = 'You win!'
        heading.classList.add('cd-result-win')
        subtext.textContent = 'All agents found. Great teamwork!'
      } else if (winner === 'assassin') {
        heading.textContent = 'Game over!'
        heading.classList.add('cd-result-lose')
        subtext.textContent = 'You hit an assassin. Better luck next time.'
      } else {
        heading.textContent = 'Out of turns!'
        heading.classList.add('cd-result-lose')
        subtext.textContent = `Not all agents were found in ${TOTAL_TURNS} turns.`
      }

      // Show final grid (both keys visible)
      const gridEl = el('div', { class: 'cd-grid' })
      for (let i = 0; i < 25; i++) {
        const tileEl = el('div', { class: 'cd-tile' })
        tileEl.textContent = state.words[i]
        if (state.revealed[i]) {
          tileEl.dataset.state = state.keyCard.roles[0][i]
        } else {
          // Show what it would have been from player 0's perspective
          tileEl.dataset.spymaster = state.keyCard.roles[0][i]
        }
        gridEl.appendChild(tileEl)
      }

      const btnRow = el('div', { class: 'cd-btn-row' })

      const newGameBtn = el('button', { class: 'cd-btn cd-btn-primary', type: 'button' })
      newGameBtn.textContent = 'New game'
      newGameBtn.addEventListener('click', () => {
        state = createInitialState(players)
        showPassScreen(
          players[0],
          `${players[0]} is the first Spymaster. Only they should see the key card.`,
          () => {
            render()
          },
        )
      })

      const exitBtn = el('button', { class: 'cd-btn', type: 'button' })
      exitBtn.textContent = 'Back to menu'
      exitBtn.addEventListener('click', onExit)

      btnRow.appendChild(newGameBtn)
      btnRow.appendChild(exitBtn)

      panel.appendChild(heading)
      panel.appendChild(subtext)
      panel.appendChild(gridEl)
      panel.appendChild(btnRow)
      wrapper.appendChild(panel)
    }

    // ---------------------------------------------------------------------------
    // Main render
    // ---------------------------------------------------------------------------

    function render(): void {
      wrapper.innerHTML = ''

      const { phase } = state
      const gameOverResult = isGameOver(state)

      if (gameOverResult.winner !== null) {
        renderGameOver(gameOverResult.winner)
        return
      }

      if (phase.kind === 'spymaster') {
        renderSpymasterPhase(phase.playerIndex)
      } else if (phase.kind === 'guessing') {
        renderGuessingPhase(phase)
      }
      // pass-to-* phases are handled by pass screen; render does nothing new
    }

    // Show handoff screen before revealing the first spymaster's key card
    showPassScreen(
      players[0],
      `${players[0]} is the first Spymaster. Only they should see the key card.`,
      () => {
        render()
      },
    )

    return () => {
      wrapper.remove()
      styleEl.remove()
      passScreenEl?.remove()
    }
  },
}

export { allAgentIndices, generateKey, isGameOver, revealResult }
export default game
