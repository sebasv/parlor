import type { GameModule } from '../../lib/game'
import meta from './meta'

const game: GameModule = {
  ...meta,

  mount(root, ctx) {
    const el = document.createElement('div')
    el.className = 'game-placeholder'
    el.innerHTML = `
      <h2>Placeholder game</h2>
      <p>Players: ${ctx.players.map((p) => escapeHtml(p)).join(', ')}</p>
      <button type="button" data-exit>Back to picker</button>
    `
    el.querySelector('[data-exit]')?.addEventListener('click', ctx.onExit)
    root.appendChild(el)

    return () => {
      el.remove()
    }
  },
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

export default game
