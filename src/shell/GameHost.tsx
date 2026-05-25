import { createEffect, createResource, onCleanup, Show } from 'solid-js'
import type { GameEntry, Locale } from '../lib/game'
import { SHELL_STRINGS } from '../lib/strings'

interface Props {
  entry: GameEntry
  players: readonly string[]
  locale: () => Locale
  onExit: () => void
  onShowRules?: () => void
}

export function GameHost(props: Props) {
  const [mod] = createResource(
    () => props.entry,
    (e) => e.load(),
  )
  let host: HTMLDivElement | undefined
  const t = () => SHELL_STRINGS[props.locale()]

  // Mount the game into a Solid-untouched div once the module is ready.
  // The game owns the DOM inside `host`; we only call its cleanup on teardown.
  createEffect(() => {
    const m = mod()
    const root = host
    if (!m || !root) return

    const cleanup = m.mount(root, {
      players: props.players,
      onExit: props.onExit,
    })

    onCleanup(cleanup)
  })

  return (
    <section class="game-host">
      <header>
        <button type="button" onClick={props.onExit}>
          ← {t().back}
        </button>
        <h2>{props.entry.title[props.locale()]}</h2>
        <Show when={props.onShowRules && props.entry.rules}>
          <button
            type="button"
            class="game-host-help"
            aria-label={t().howToPlay}
            onClick={props.onShowRules}
          >
            ?
          </button>
        </Show>
      </header>
      <Show when={mod.loading}>
        <p>{t().loading}</p>
      </Show>
      <Show when={mod.error}>
        <p>{t().loadFailed}</p>
      </Show>
      <div ref={host} class="game-root" />
    </section>
  )
}
