import type { GameModule } from '../../lib/game'
import meta from './meta'
import type { Action, Card, CardKnowledge, Rank, Suit } from './rules'
import {
  applyAction,
  createInitialState,
  isOver,
  legalActions,
  MAX_CLUE_TOKENS,
  MAX_FUSE_TOKENS,
  SUITS,
  score,
} from './rules'

// ---------------------------------------------------------------------------
// Helpers
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
// Suit colours
// ---------------------------------------------------------------------------

const SUIT_COLORS: Record<Suit, string> = {
  red: '#e84040',
  yellow: '#d4a017',
  green: '#27a85a',
  blue: '#3b82f6',
  white: '#d4d4d4',
}

const SUIT_LABELS: Record<Suit, string> = {
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  white: 'White',
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CSS = `
.hb-root {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.75rem;
  min-height: 100%;
  font-size: clamp(1rem, 1.5vw, 1.25rem);
  max-width: min(100%, 960px);
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* ---- Pass screen ---- */
.hb-pass-screen {
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
.hb-pass-screen h2 {
  margin: 0;
  font-size: 1.8rem;
}
.hb-pass-screen p {
  margin: 0;
  color: #9aa0a6;
  max-width: 32ch;
}
.hb-ready-btn {
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
.hb-ready-btn:hover { background: #22263a; }

/* ---- Shared status bar ---- */
.hb-status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: center;
  background: #1a1d24;
  border-radius: 10px;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
}
.hb-token {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font-weight: 600;
}
.hb-token-clue { color: #6cb1ff; }
.hb-token-fuse { color: #ff6b6b; }

/* ---- Fireworks row ---- */
.hb-fireworks {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.hb-fw-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.hb-fw-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}
.hb-fw-card {
  width: 2.75rem;
  height: 3.75rem;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  font-weight: 900;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.hb-fw-card[data-empty="true"] {
  background: #1a1d24;
  color: #6a7080;
  font-size: 1rem;
  border: 2px solid #2e3548;
}

/* ---- Player hands ---- */
.hb-section-title {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #9aa0a6;
  margin: 0;
}
.hb-hands {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.hb-player-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.hb-player-label {
  font-size: 0.85rem;
  font-weight: 600;
}
.hb-player-label[data-active="true"] {
  color: #6cb1ff;
}
.hb-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

/* ---- Card ---- */
.hb-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: default;
}
.hb-card-face {
  width: 3.375rem;
  height: 4.75rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 900;
  color: #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  position: relative;
  transition: transform 0.1s, box-shadow 0.1s;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
.hb-card-face[data-back="true"] {
  background: #1e2330;
  color: transparent;
  border: 2px solid #2e3548;
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 6px,
    rgba(255,255,255,0.03) 6px,
    rgba(255,255,255,0.03) 12px
  );
}
.hb-card.hb-selectable .hb-card-face {
  cursor: pointer;
  border: 2px solid transparent;
}
.hb-card.hb-selectable .hb-card-face:hover,
.hb-card.hb-selectable .hb-card-face:focus-visible {
  transform: translateY(-4px);
  box-shadow: 0 6px 18px rgba(0,0,0,0.6);
  border-color: rgba(255,255,255,0.4);
}
.hb-card.hb-selected .hb-card-face {
  transform: translateY(-8px);
  box-shadow: 0 8px 22px rgba(108,177,255,0.5);
  border: 2px solid #6cb1ff;
}
.hb-card-knowledge {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  justify-content: center;
  min-height: 18px;
}
.hb-clue-tag {
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}
.hb-clue-tag-unknown {
  background: #2e3548;
  color: #9aa0a6;
}

/* ---- Action panel ---- */
.hb-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.hb-action-btns {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.hb-btn {
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
.hb-btn:hover:not(:disabled) { border-color: #6cb1ff; }
.hb-btn:disabled { opacity: 0.38; cursor: not-allowed; }
.hb-btn-primary {
  background: #1e3a5f;
  border-color: #6cb1ff;
  font-weight: 700;
}
.hb-btn-primary:hover:not(:disabled) { background: #254878; }
.hb-btn-danger {
  background: #3d1818;
  border-color: #ff6b6b;
}
.hb-btn-danger:hover:not(:disabled) { background: #4e1f1f; }

/* ---- Clue picker ---- */
.hb-clue-picker {
  background: #1a1d24;
  border-radius: 10px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.hb-clue-picker h4 {
  margin: 0;
  font-size: 0.85rem;
  color: #9aa0a6;
}
.hb-clue-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.hb-clue-option {
  padding: 0.4em 0.9em;
  border-radius: 7px;
  border: 2px solid transparent;
  background: #22263a;
  color: #e6e6e6;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}
.hb-clue-option:hover { border-color: rgba(255,255,255,0.3); }
.hb-clue-option[data-selected="true"] {
  border-color: #6cb1ff;
  background: #1e3a5f;
}

/* ---- Target picker ---- */
.hb-target-tabs {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.hb-target-tab {
  padding: 0.35em 0.8em;
  border-radius: 6px;
  border: 1px solid #2e3548;
  background: #1a1d24;
  color: #e6e6e6;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
.hb-target-tab[data-selected="true"] {
  border-color: #6cb1ff;
  background: #1e3a5f;
}

/* ---- Discard pile ---- */
.hb-discard-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.hb-discard-pile {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.hb-discard-chip {
  width: 36px;
  height: 48px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 900;
  color: rgba(255,255,255,0.6);
  opacity: 0.65;
}

/* ---- Game over ---- */
.hb-gameover {
  text-align: center;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.hb-gameover h2 { margin: 0; font-size: 2rem; }
.hb-gameover p { margin: 0; color: #9aa0a6; }
.hb-score-big {
  font-size: 4rem;
  font-weight: 900;
  line-height: 1;
  color: #6cb1ff;
}
.hb-score-label { font-size: 1rem; color: #9aa0a6; }

/* ---- Turn header ---- */
.hb-turn-header {
  font-size: 1.05rem;
  font-weight: 700;
  color: #6cb1ff;
}
`

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const { players } = ctx

    // Inject scoped styles once
    const styleEl = document.createElement('style')
    styleEl.textContent = CSS
    document.head.appendChild(styleEl)

    let state = createInitialState(players.length)

    // UI state
    type UiMode =
      | { kind: 'idle' }
      | { kind: 'select-play' }
      | { kind: 'select-discard' }
      | { kind: 'clue-pick-target' }
      | { kind: 'clue-pick-feature'; targetPlayer: number }
    let uiMode: UiMode = { kind: 'idle' }

    // Pass screen tracking
    let passScreenShowing = false

    // ---------------------------------------------------------------------------
    // Root container
    // ---------------------------------------------------------------------------

    const wrapper = el('div', { class: 'hb-root' })
    root.appendChild(wrapper)

    // Pass screen (rendered on top via fixed positioning)
    let passScreenEl: HTMLDivElement | null = null

    // ---------------------------------------------------------------------------
    // Pass screen
    // ---------------------------------------------------------------------------

    function showPassScreen(nextPlayerIdx: number, afterReady: () => void): void {
      passScreenShowing = true
      passScreenEl = el('div', { class: 'hb-pass-screen' })

      const heading = el('h2')
      heading.textContent = `Pass to ${players[nextPlayerIdx]}`

      const hint = el('p')
      hint.textContent = `Hand the tablet to ${players[nextPlayerIdx]}. Tap Ready when only they can see the screen.`

      const readyBtn = el('button', { class: 'hb-ready-btn', type: 'button' })
      readyBtn.textContent = 'Ready'
      readyBtn.addEventListener('click', () => {
        passScreenEl?.remove()
        passScreenEl = null
        passScreenShowing = false
        afterReady()
      })

      passScreenEl.appendChild(heading)
      passScreenEl.appendChild(hint)
      passScreenEl.appendChild(readyBtn)
      document.body.appendChild(passScreenEl)
    }

    // ---------------------------------------------------------------------------
    // Render helpers
    // ---------------------------------------------------------------------------

    function renderKnowledgeTag(kk: CardKnowledge): HTMLElement {
      const wrap = el('span', { class: 'hb-card-knowledge' })

      if (kk.suit === null && kk.rank === null) {
        const tag = el('span', { class: 'hb-clue-tag hb-clue-tag-unknown' })
        tag.textContent = '?'
        wrap.appendChild(tag)
        return wrap
      }

      if (kk.suit !== null) {
        const tag = el('span', { class: 'hb-clue-tag' })
        tag.style.background = SUIT_COLORS[kk.suit]
        tag.textContent = SUIT_LABELS[kk.suit].slice(0, 1)
        wrap.appendChild(tag)
      }
      if (kk.rank !== null) {
        const tag = el('span', { class: 'hb-clue-tag' })
        tag.style.background = '#3b4060'
        tag.textContent = String(kk.rank)
        wrap.appendChild(tag)
      }

      return wrap
    }

    function renderCard(
      card: Card,
      knowledge: CardKnowledge | null,
      opts: {
        faceDown?: boolean
        selectable?: boolean
        selected?: boolean
        onSelect?: () => void
      } = {},
    ): HTMLElement {
      const { faceDown = false, selectable = false, selected = false, onSelect } = opts

      const cardEl = el('div', { class: 'hb-card' })
      if (selectable) cardEl.classList.add('hb-selectable')
      if (selected) cardEl.classList.add('hb-selected')

      const face = el('div', { class: 'hb-card-face' })

      if (faceDown) {
        face.dataset.back = 'true'
        // Show suit/rank dots on back if they are known from clues
        if (knowledge !== null && (knowledge.suit !== null || knowledge.rank !== null)) {
          // Small indicator on the back
          if (knowledge.suit !== null) {
            const dot = el('div')
            dot.style.cssText = `
              position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
              width: 10px; height: 10px; border-radius: 50%;
              background: ${SUIT_COLORS[knowledge.suit]};
            `
            face.appendChild(dot)
          }
        }
      } else {
        face.style.background = SUIT_COLORS[card.suit]
        face.textContent = String(card.rank)
      }

      if (selectable && onSelect) {
        face.tabIndex = 0
        face.setAttribute('role', 'button')
        face.addEventListener('click', onSelect)
        face.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        })
      }

      cardEl.appendChild(face)

      if (knowledge !== null) {
        cardEl.appendChild(renderKnowledgeTag(knowledge))
      }

      return cardEl
    }

    // ---------------------------------------------------------------------------
    // Main render
    // ---------------------------------------------------------------------------

    function render(): void {
      if (passScreenShowing) return
      wrapper.innerHTML = ''

      if (isOver(state)) {
        renderGameOver()
        return
      }

      renderTurnHeader()
      renderStatusBar()
      renderFireworks()
      renderHands()
      renderActions()
      renderDiscardPile()
    }

    function renderTurnHeader(): void {
      const div = el('div', { class: 'hb-turn-header' })
      div.textContent = `${players[state.activePlayer]}'s turn`
      if (state.finalTurnsRemaining !== null) {
        const turns = state.finalTurnsRemaining
        const suffix = turns === 1 ? 'turn' : 'turns'
        div.textContent += ` — Final round (${turns} ${suffix} left)`
      }
      wrapper.appendChild(div)
    }

    function renderStatusBar(): void {
      const bar = el('div', { class: 'hb-status-bar' })

      const clueSpan = el('span', { class: 'hb-token hb-token-clue' })
      clueSpan.textContent = `Clues: ${state.clueTokens}/${MAX_CLUE_TOKENS}`

      const fuseSpan = el('span', { class: 'hb-token hb-token-fuse' })
      fuseSpan.textContent = `Fuses: ${state.fuseTokens}/${MAX_FUSE_TOKENS}`

      const deckSpan = el('span', { class: 'hb-token' })
      deckSpan.textContent = `Deck: ${state.deck.length}`

      const scoreSpan = el('span', { class: 'hb-token' })
      scoreSpan.textContent = `Score: ${score(state)}/25`

      const exitBtn = el('button', {
        class: 'hb-btn',
        type: 'button',
        style: 'margin-left: auto; padding: 0.3em 0.8em; font-size: 0.8rem;',
      })
      exitBtn.textContent = 'Exit'
      exitBtn.addEventListener('click', ctx.onExit)

      bar.appendChild(clueSpan)
      bar.appendChild(fuseSpan)
      bar.appendChild(deckSpan)
      bar.appendChild(scoreSpan)
      bar.appendChild(exitBtn)
      wrapper.appendChild(bar)
    }

    function renderFireworks(): void {
      const section = el('div')

      const title = el('p', { class: 'hb-section-title' })
      title.textContent = 'Fireworks'
      section.appendChild(title)

      const row = el('div', { class: 'hb-fireworks' })

      for (const suit of SUITS) {
        const stack = el('div', { class: 'hb-fw-stack' })
        const label = el('div', { class: 'hb-fw-label' })
        label.textContent = SUIT_LABELS[suit].slice(0, 1)
        label.style.color = SUIT_COLORS[suit]

        const cardEl = el('div', { class: 'hb-fw-card' })
        const top = state.fireworks[suit]
        if (top === 0) {
          cardEl.dataset.empty = 'true'
          cardEl.textContent = '-'
        } else {
          cardEl.style.background = SUIT_COLORS[suit]
          cardEl.textContent = String(top)
        }

        stack.appendChild(label)
        stack.appendChild(cardEl)
        row.appendChild(stack)
      }

      section.appendChild(row)
      wrapper.appendChild(section)
    }

    function renderHands(): void {
      const section = el('div', { class: 'hb-hands' })
      const activeP = state.activePlayer

      const title = el('p', { class: 'hb-section-title' })
      title.textContent = 'Hands'
      section.appendChild(title)

      // Render active player first (face-down), then others
      const order = [
        activeP,
        ...Array.from({ length: players.length - 1 }, (_, i) => (activeP + 1 + i) % players.length),
      ]

      for (const pIdx of order) {
        const isActive = pIdx === activeP
        const isSelf = isActive // The current tablet holder is the active player
        const row = el('div', { class: 'hb-player-row' })

        const label = el('div', { class: 'hb-player-label' })
        label.textContent = players[pIdx] + (isActive ? ' (you)' : '')
        if (isActive) label.dataset.active = 'true'
        row.appendChild(label)

        const cards = el('div', { class: 'hb-cards' })
        const hand = state.hands[pIdx]
        const knowledge = state.knowledge[pIdx]

        hand.forEach((card, cardIdx) => {
          let selectable = false
          const selected = false
          let onSelect: (() => void) | undefined

          if (isSelf) {
            if (uiMode.kind === 'select-play' || uiMode.kind === 'select-discard') {
              selectable = true
              onSelect = () => {
                const actionType = uiMode.kind === 'select-play' ? 'play' : 'discard'
                dispatch({ type: actionType, cardIndex: cardIdx })
              }
            }
          }

          const cardEl = renderCard(card, knowledge[cardIdx], {
            faceDown: isSelf,
            selectable,
            selected,
            onSelect,
          })
          cards.appendChild(cardEl)
        })

        // If in clue mode targeting this player, highlight matching cards
        if (uiMode.kind === 'clue-pick-feature' && uiMode.targetPlayer === pIdx && !isActive) {
          // Mark cards but they're already rendered; we can't easily re-render
          // This is handled in the clue picker below
        }

        row.appendChild(cards)
        section.appendChild(row)
      }

      wrapper.appendChild(section)
    }

    function renderActions(): void {
      const section = el('div', { class: 'hb-actions' })
      const legal = legalActions(state)

      const canPlay = legal.some((a) => a.type === 'play')
      const canDiscard = legal.some((a) => a.type === 'discard')
      const canClue = legal.some((a) => a.type === 'clue')

      const btnRow = el('div', { class: 'hb-action-btns' })

      if (
        uiMode.kind === 'idle' ||
        uiMode.kind === 'select-play' ||
        uiMode.kind === 'select-discard'
      ) {
        const playBtn = el('button', { class: 'hb-btn hb-btn-primary', type: 'button' })
        playBtn.textContent = uiMode.kind === 'select-play' ? 'Cancel' : 'Play a card'
        if (!canPlay) playBtn.disabled = true
        playBtn.addEventListener('click', () => {
          uiMode = uiMode.kind === 'select-play' ? { kind: 'idle' } : { kind: 'select-play' }
          render()
        })
        btnRow.appendChild(playBtn)

        const discardBtn = el('button', { class: 'hb-btn', type: 'button' })
        discardBtn.textContent = uiMode.kind === 'select-discard' ? 'Cancel' : 'Discard'
        if (!canDiscard) discardBtn.disabled = true
        discardBtn.addEventListener('click', () => {
          uiMode = uiMode.kind === 'select-discard' ? { kind: 'idle' } : { kind: 'select-discard' }
          render()
        })
        btnRow.appendChild(discardBtn)

        const clueBtn = el('button', { class: 'hb-btn', type: 'button' })
        clueBtn.textContent = 'Give a clue'
        if (!canClue) clueBtn.disabled = true
        clueBtn.addEventListener('click', () => {
          uiMode = { kind: 'clue-pick-target' }
          render()
          // After render, auto-select first other player
          const firstTab = wrapper.querySelector<HTMLButtonElement>('.hb-target-tab')
          if (firstTab) firstTab.click()
        })
        btnRow.appendChild(clueBtn)
      }

      section.appendChild(btnRow)

      // Clue picker sub-panel
      if (uiMode.kind === 'clue-pick-target' || uiMode.kind === 'clue-pick-feature') {
        section.appendChild(renderCluePicker())
      }

      // Instruction text
      if (uiMode.kind === 'select-play') {
        const hint = el('p', { style: 'margin:0; color:#9aa0a6; font-size:0.85rem;' })
        hint.textContent = 'Tap one of your face-down cards above to play it.'
        section.appendChild(hint)
      } else if (uiMode.kind === 'select-discard') {
        const hint = el('p', { style: 'margin:0; color:#9aa0a6; font-size:0.85rem;' })
        hint.textContent = 'Tap one of your face-down cards above to discard it.'
        section.appendChild(hint)
      }

      wrapper.appendChild(section)
    }

    function renderCluePicker(): HTMLElement {
      const picker = el('div', { class: 'hb-clue-picker' })

      // Target selector
      const targetHeading = el('h4')
      targetHeading.textContent = 'Give a clue to:'
      picker.appendChild(targetHeading)

      const targetTabs = el('div', { class: 'hb-target-tabs' })
      const otherPlayers = Array.from(
        { length: players.length - 1 },
        (_, i) => (state.activePlayer + 1 + i) % players.length,
      )

      const selectedTarget: number =
        uiMode.kind === 'clue-pick-feature' ? uiMode.targetPlayer : otherPlayers[0]

      for (const pIdx of otherPlayers) {
        const tab = el('button', { class: 'hb-target-tab', type: 'button' })
        tab.textContent = players[pIdx]
        if (pIdx === selectedTarget) tab.dataset.selected = 'true'
        tab.addEventListener('click', () => {
          uiMode = { kind: 'clue-pick-feature', targetPlayer: pIdx }
          render()
        })
        targetTabs.appendChild(tab)
      }
      picker.appendChild(targetTabs)

      // Feature selector (only after target chosen)
      if (uiMode.kind === 'clue-pick-feature') {
        const target = uiMode.targetPlayer
        const targetHand = state.hands[target]

        const featureHeading = el('h4')
        featureHeading.textContent = 'Clue type:'
        picker.appendChild(featureHeading)

        // Suits
        const suitOptions = el('div', { class: 'hb-clue-options' })
        for (const suit of SUITS) {
          const hasMatch = targetHand.some((c) => c.suit === suit)
          const opt = el('button', { class: 'hb-clue-option', type: 'button' })
          opt.textContent = SUIT_LABELS[suit]
          opt.style.borderColor = SUIT_COLORS[suit]
          opt.style.color = SUIT_COLORS[suit]
          if (!hasMatch) {
            opt.disabled = true
            opt.style.opacity = '0.45'
          }
          opt.addEventListener('click', () => {
            dispatch({ type: 'clue', targetPlayer: target, feature: { kind: 'suit', suit } })
          })
          suitOptions.appendChild(opt)
        }
        picker.appendChild(suitOptions)

        const rankHeading = el('h4')
        rankHeading.textContent = 'Number:'
        picker.appendChild(rankHeading)

        const rankOptions = el('div', { class: 'hb-clue-options' })
        for (const rank of [1, 2, 3, 4, 5] as Rank[]) {
          const hasMatch = targetHand.some((c) => c.rank === rank)
          const opt = el('button', { class: 'hb-clue-option', type: 'button' })
          opt.textContent = String(rank)
          if (!hasMatch) {
            opt.disabled = true
            opt.style.opacity = '0.45'
          }
          opt.addEventListener('click', () => {
            dispatch({ type: 'clue', targetPlayer: target, feature: { kind: 'rank', rank } })
          })
          rankOptions.appendChild(opt)
        }
        picker.appendChild(rankOptions)

        const cancelBtn = el('button', {
          class: 'hb-btn',
          type: 'button',
          style: 'margin-top: 0.25rem;',
        })
        cancelBtn.textContent = 'Cancel'
        cancelBtn.addEventListener('click', () => {
          uiMode = { kind: 'idle' }
          render()
        })
        picker.appendChild(cancelBtn)
      } else {
        const cancelBtn = el('button', {
          class: 'hb-btn',
          type: 'button',
          style: 'margin-top: 0.25rem;',
        })
        cancelBtn.textContent = 'Cancel'
        cancelBtn.addEventListener('click', () => {
          uiMode = { kind: 'idle' }
          render()
        })
        picker.appendChild(cancelBtn)
      }

      return picker
    }

    function renderDiscardPile(): void {
      if (state.discard.length === 0) return

      const section = el('div', { class: 'hb-discard-wrap' })
      const title = el('p', { class: 'hb-section-title' })
      title.textContent = `Discard (${state.discard.length})`
      section.appendChild(title)

      const pile = el('div', { class: 'hb-discard-pile' })
      for (const card of state.discard) {
        const chip = el('div', { class: 'hb-discard-chip' })
        chip.style.background = SUIT_COLORS[card.suit]
        chip.textContent = String(card.rank)
        pile.appendChild(chip)
      }

      section.appendChild(pile)
      wrapper.appendChild(section)
    }

    function renderGameOver(): void {
      const panel = el('div', { class: 'hb-gameover' })

      const heading = el('h2')
      const finalScore = score(state)

      if (state.endReason === 'perfect') {
        heading.textContent = 'Perfect Fireworks!'
      } else if (state.endReason === 'fuse') {
        heading.textContent = 'Kaboom! All fuses spent.'
      } else {
        heading.textContent = 'Game Over'
      }

      const scoreBig = el('div', { class: 'hb-score-big' })
      scoreBig.textContent = String(finalScore)

      const scoreLabel = el('div', { class: 'hb-score-label' })
      scoreLabel.textContent = `out of 25 — ${scoreMessage(finalScore)}`

      const btnRow = el('div', { class: 'hb-action-btns' })

      const newGameBtn = el('button', { class: 'hb-btn hb-btn-primary', type: 'button' })
      newGameBtn.textContent = 'New game'
      newGameBtn.addEventListener('click', () => {
        state = createInitialState(players.length)
        uiMode = { kind: 'idle' }
        render()
      })

      const exitBtn = el('button', { class: 'hb-btn', type: 'button' })
      exitBtn.textContent = 'Back to menu'
      exitBtn.addEventListener('click', ctx.onExit)

      btnRow.appendChild(newGameBtn)
      btnRow.appendChild(exitBtn)

      panel.appendChild(heading)
      panel.appendChild(scoreBig)
      panel.appendChild(scoreLabel)
      panel.appendChild(btnRow)

      wrapper.appendChild(panel)
    }

    function scoreMessage(s: number): string {
      if (s === 25) return 'Legendary!'
      if (s >= 22) return 'Excellent!'
      if (s >= 18) return 'Good'
      if (s >= 14) return 'Mediocre'
      if (s >= 10) return 'Poor'
      return 'Terrible'
    }

    // ---------------------------------------------------------------------------
    // Dispatch
    // ---------------------------------------------------------------------------

    function dispatch(action: Action): void {
      const prevPlayer = state.activePlayer
      state = applyAction(state, action)
      uiMode = { kind: 'idle' }

      if (isOver(state)) {
        render()
        return
      }

      const nextPlayer = state.activePlayer
      if (nextPlayer !== prevPlayer) {
        // Show pass screen before rendering next player's view
        render() // render current (blank) state first so DOM is ready
        showPassScreen(nextPlayer, () => {
          render()
        })
      } else {
        render()
      }
    }

    // Initial render
    render()

    // Cleanup
    return () => {
      wrapper.remove()
      styleEl.remove()
      passScreenEl?.remove()
    }
  },
}

export default game
